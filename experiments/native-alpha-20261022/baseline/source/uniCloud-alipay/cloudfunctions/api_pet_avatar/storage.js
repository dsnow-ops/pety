'use strict';

const crypto = require('crypto');
const { downloadHttps } = require('./safe-download');

const MAX_RESULT_BYTES = 25 * 1024 * 1024;
const MIN_REVISION_SOURCE_BYTES = 64 * 1024;
const MIN_REVISION_SOURCE_EDGE = 768;

function getImageQualityGate() {
	// Revision-only image decoders must not become startup dependencies for initial generation.
	return require('./image-quality-gate');
}

function getDisplayDerivativeTools() {
	// Keep image decoders out of the cloud-function startup path.
	return require('./avatar-display-derivatives');
}

function assertPrivateFileId(fileId) {
	const value = String(fileId || '').trim();
	if (!value || !/^cloud:\/\//i.test(value)) {
		const error = new Error('INVALID_CLOUD_FILE_ID');
		error.code = 'INVALID_CLOUD_FILE_ID';
		throw error;
	}
	return value;
}

async function getTempUrls(fileIds) {
	const normalized = fileIds.map(assertPrivateFileId);
	const response = await uniCloud.getTempFileURL({ fileList: normalized });
	const list = response && response.fileList;
	if (!Array.isArray(list) || list.length !== normalized.length) {
		throw new Error('TEMP_URL_UNAVAILABLE');
	}
	return list.map(item => {
		const url = item && (item.tempFileURL || item.tempFileUrl);
		if (!url || !/^https:\/\//i.test(url)) throw new Error('TEMP_URL_UNAVAILABLE');
		return url;
	});
}

function sha256Buffer(buffer) {
	return crypto.createHash('sha256').update(buffer).digest('hex');
}

function getCloudPath(fileId) {
	const matched = String(fileId || '').match(/^cloud:\/\/[^/]+\/(.+)$/i);
	return matched ? matched[1] : '';
}

function getImageMime(buffer) {
	if (!Buffer.isBuffer(buffer)) return '';
	if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
	if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg';
	return '';
}

function revisionSourceError(code) {
	const error = new Error(code);
	error.code = code;
	return error;
}

function assertDistinctHashes(candidateHash, styleHash) {
	if (styleHash && candidateHash === styleHash) {
		const error = new Error('OUTPUT_EQUALS_STYLE_REFERENCE');
		error.code = 'OUTPUT_EQUALS_STYLE_REFERENCE';
		throw error;
	}
}

async function downloadCloudFile(fileId) {
	const response = await uniCloud.downloadFile({ fileID: assertPrivateFileId(fileId) });
	const fileContent = response && response.fileContent;
	if (!Buffer.isBuffer(fileContent)) {
		const error = new Error('CLOUD_FILE_DOWNLOAD_FAILED');
		error.code = 'CLOUD_FILE_DOWNLOAD_FAILED';
		throw error;
	}
	return fileContent;
}

// Send the actual reference bytes. Provider workers cannot reliably reach the
// cloudstatic signed URLs (including after a storage subscription is renewed).
async function getProviderImageInputs(fileIds, expectedHashes = {}) {
	const inputs = [];
	let totalBytes = 0;
	for (let index = 0; index < fileIds.length; index += 1) {
		try {
			let bytes;
			for (let attempt = 0; attempt < 2; attempt += 1) {
				try {
					if (expectedHashes[fileIds[index]]) {
						const [url] = await getTempUrls([fileIds[index]]);
						bytes = await downloadHttps(url, 2, 20 * 1024 * 1024);
					} else bytes = await downloadCloudFile(fileIds[index]);
					break;
				}
				catch (error) {
					if (attempt || error.code === 'INVALID_CLOUD_FILE_ID') throw error;
					await new Promise(resolve => setTimeout(resolve, 500));
				}
			}
			const mime = getImageMime(bytes);
			if (expectedHashes[fileIds[index]] && sha256Buffer(bytes) !== expectedHashes[fileIds[index]]) throw revisionSourceError('AVATAR_SOURCE_CHANGED');
			totalBytes += bytes.length;
			if (!mime || !bytes.length) throw revisionSourceError('PROVIDER_INPUT_INVALID_IMAGE');
			if (bytes.length > 20 * 1024 * 1024 || totalBytes > 48 * 1024 * 1024) throw revisionSourceError('PROVIDER_INPUT_TOO_LARGE');
			inputs.push(`data:${mime};base64,${bytes.toString('base64')}`);
		} catch (error) {
			const failure = revisionSourceError(error.code || 'PROVIDER_INPUT_DOWNLOAD_FAILED');
			failure.stage = 'REFERENCE_PREPARATION';
			failure.message = `${failure.code}: reference ${index + 1}`;
			throw failure;
		}
	}
	return inputs;
}

async function inspectRevisionSource(fileId) {
	let fileContent;
	try {
		fileContent = await downloadCloudFile(fileId);
	} catch (error) {
		throw revisionSourceError(error && error.code === 'INVALID_CLOUD_FILE_ID' ? 'REVISION_SOURCE_INVALID' : 'REVISION_SOURCE_NOT_FOUND');
	}
	const inspected = inspectImageBuffer(fileContent, fileId);
	if (inspected.bytes < MIN_REVISION_SOURCE_BYTES || inspected.width < MIN_REVISION_SOURCE_EDGE || inspected.height < MIN_REVISION_SOURCE_EDGE) {
		const error = revisionSourceError('REVISION_SOURCE_INVALID');
		error.reasonCode = 'REVISION_SOURCE_TOO_SMALL';
		error.sourceMetrics = { bytes: inspected.bytes, width: inspected.width, height: inspected.height };
		throw error;
	}
	if (inspected.mime !== 'image/png') {
		const error = revisionSourceError('REVISION_SOURCE_INVALID');
		error.reasonCode = 'REVISION_SOURCE_NOT_PNG';
		throw error;
	}
	const dataUrl = `data:image/png;base64,${fileContent.toString('base64')}`;
	const encodedBytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
	const encodedSha256 = sha256Buffer(encodedBytes);
	if (encodedSha256 !== inspected.sha256 || encodedBytes.length !== inspected.bytes) {
		const error = revisionSourceError('REVISION_SOURCE_INVALID');
		error.reasonCode = 'REVISION_SOURCE_BASE64_MISMATCH';
		throw error;
	}
	return { ...inspected, dataUrl, encodedSha256 };
}

function inspectImageBuffer(fileContent, fileId = '') {
	const mime = getImageMime(fileContent);
	if (!mime) throw revisionSourceError('REVISION_SOURCE_INVALID');
	let decoded;
	try {
		decoded = getImageQualityGate().decodeImage(fileContent);
	} catch (error) {
		throw revisionSourceError('REVISION_SOURCE_INVALID');
	}
	let hasAlpha = false;
	for (let index = 3; index < decoded.data.length; index += 4) {
		if (decoded.data[index] < 255) { hasAlpha = true; break; }
	}
	return {
		...getDisplayDerivativeTools().analyzeAlpha(decoded),
		hasAlpha,
		fileId: fileId ? assertPrivateFileId(fileId) : '',
		cloudPath: fileId ? getCloudPath(fileId) : '',
		mime,
		bytes: fileContent.length,
		width: decoded.width,
		height: decoded.height,
		sha256: sha256Buffer(fileContent)
	};
}

async function inspectCloudImage(fileId) {
	let fileContent;
	try {
		fileContent = await downloadCloudFile(fileId);
	} catch (error) {
		throw revisionSourceError(error && error.code === 'INVALID_CLOUD_FILE_ID' ? 'REVISION_SOURCE_INVALID' : 'REVISION_SOURCE_NOT_FOUND');
	}
	return inspectImageBuffer(fileContent, fileId);
}

function assertSourceHeaderDimensions(bytes) {
	let width=0,height=0;
	if (getImageMime(bytes)==='image/png' && bytes.length>=24 && bytes.toString('ascii',12,16)==='IHDR') {
		width=bytes.readUInt32BE(16);height=bytes.readUInt32BE(20);
	} else if (getImageMime(bytes)==='image/jpeg') {
		for(let offset=2;offset+4<bytes.length;) {
			if(bytes[offset++]!==0xff) break;
			while(bytes[offset]===0xff)offset++;
			const marker=bytes[offset++];
			if(marker===0xda||marker===0xd9)break;
			if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
			if(offset+2>bytes.length)break;
			const length=bytes.readUInt16BE(offset);
			if(length<2||offset+length>bytes.length)break;
			if([0xc0,0xc1,0xc2].includes(marker)&&length>=8){height=bytes.readUInt16BE(offset+3);width=bytes.readUInt16BE(offset+5);break;}
			offset+=length;
		}
	}
	if(width<1||height<1||width>8192||height>8192||width*height>16000000)throw revisionSourceError('INVALID_SOURCE_IMAGES');
	return {width,height};
}

async function inspectUploadedSource(fileId) {
	// Bound transfer before buffering; inspect dimensions before allocating RGBA.
	const [url]=await getTempUrls([fileId]);
	const bytes=await downloadHttps(url,2,20*1024*1024);
	assertSourceHeaderDimensions(bytes);
	return inspectImageBuffer(bytes,fileId);
}

function inspectTransparentPng(fileContent) {
	if (getImageMime(fileContent) !== 'image/png') {
		const error = new Error('CUTOUT_ALPHA_INVALID');
		error.code = 'CUTOUT_ALPHA_INVALID';
		throw error;
	}
	let decoded;
	try {
		decoded = getImageQualityGate().decodeImage(fileContent);
	} catch (error) {
		const invalid = new Error('CUTOUT_ALPHA_INVALID');
		invalid.code = 'CUTOUT_ALPHA_INVALID';
		throw invalid;
	}
	let alphaPixelCount = 0;
	for (let index = 3; index < decoded.data.length; index += 4) {
		if (decoded.data[index] < 250) alphaPixelCount += 1;
	}
	const pixelCount = decoded.width * decoded.height;
	const transparentPixelRatio = alphaPixelCount / Math.max(pixelCount, 1);
	if (!alphaPixelCount || !pixelCount || transparentPixelRatio < 0.005) {
		const error = new Error('CUTOUT_ALPHA_INVALID');
		error.code = 'CUTOUT_ALPHA_INVALID';
		throw error;
	}
	// Conservative mask checks: foreground occupancy, clipped borders, fragmented mask and hard edges.
	let opaque = 0, soft = 0, borderOpaque = 0, borderCount = 0, transitions = 0;
	const gridEdge = 128;
	const mask = new Uint8Array(gridEdge * gridEdge);
	for (let y = 0; y < gridEdge; y++) for (let x = 0; x < gridEdge; x++) {
		const sx = Math.min(decoded.width - 1, Math.floor(x * decoded.width / gridEdge));
		const sy = Math.min(decoded.height - 1, Math.floor(y * decoded.height / gridEdge));
		mask[y * gridEdge + x] = decoded.data[(sy * decoded.width + sx) * 4 + 3] >= 128 ? 1 : 0;
	}
	for (let y = 0; y < decoded.height; y++) for (let x = 0; x < decoded.width; x++) {
		const a = decoded.data[(y * decoded.width + x) * 4 + 3];
		if (a >= 128) opaque++;
		if (a > 8 && a < 247) soft++;
		if (x === 0 || y === 0 || x === decoded.width - 1 || y === decoded.height - 1) { borderCount++; if (a >= 128) borderOpaque++; }
		if (x && (a >= 128) !== (decoded.data[(y * decoded.width + x - 1) * 4 + 3] >= 128)) transitions++;
		if (y && (a >= 128) !== (decoded.data[((y - 1) * decoded.width + x) * 4 + 3] >= 128)) transitions++;
	}
	let totalMask = 0, largest = 0;
	const visited = new Uint8Array(mask.length);
	for (let start = 0; start < mask.length; start++) {
		if (!mask[start] || visited[start]) continue;
		const queue = [start]; visited[start] = 1;
		for (let cursor = 0; cursor < queue.length; cursor++) {
			const i = queue[cursor], x = i % gridEdge, y = Math.floor(i / gridEdge);
			for (const n of [x ? i - 1 : -1, x < gridEdge - 1 ? i + 1 : -1, y ? i - gridEdge : -1, y < gridEdge - 1 ? i + gridEdge : -1]) {
				if (n >= 0 && mask[n] && !visited[n]) { visited[n] = 1; queue.push(n); }
			}
		}
		totalMask += queue.length; largest = Math.max(largest, queue.length);
	}
	const foregroundRatio = opaque / pixelCount;
	const alphaContent = getDisplayDerivativeTools().analyzeAlpha(decoded);
	const borderForegroundRatio = borderOpaque / Math.max(borderCount, 1);
	const connectedForegroundRatio = largest / Math.max(totalMask, 1);
	const softEdgeRatio = soft / Math.max(transitions, 1);
	const fallbackReason = Math.min(decoded.width, decoded.height) < 768 ? 'DERIVATIVE_TOO_SMALL'
		: foregroundRatio < 0.002 || foregroundRatio > 0.9 ? 'UNSAFE_FOREGROUND_RATIO'
		: borderForegroundRatio > 0.03 ? 'SUBJECT_TOUCHES_BORDER'
		: !alphaContent.cornersTransparent ? 'OPAQUE_CORNERS'
		: alphaContent.boundingBoxFillRatio > 0.96 ? 'RECTANGULAR_ALPHA_MASK'
		: connectedForegroundRatio < 0.95 ? 'FRAGMENTED_SUBJECT'
		: softEdgeRatio < 0.15 ? 'HARD_ALPHA_EDGE' : '';
	return {
		...alphaContent,
		qualityVersion: 2, qualified: !fallbackReason, fallbackReason,
		foregroundRatio, borderForegroundRatio, connectedForegroundRatio, softEdgeRatio,
		mime: 'image/png',
		width: decoded.width,
		height: decoded.height,
		hasAlpha: true,
		alphaPixelCount,
		transparentPixelRatio,
		bytes: fileContent.length,
		sha256: sha256Buffer(fileContent)
	};
}

function requireQualifiedCutout(fileContent) {
	const inspection = inspectTransparentPng(fileContent);
	if (!inspection.qualified) {
		const error = new Error('CUTOUT_ALPHA_INVALID');
		error.code = 'CUTOUT_ALPHA_INVALID';
		error.inspection = inspection;
		throw error;
	}
	return inspection;
}

async function uploadBuffer(cloudPath, fileContent) {
	const uploaded = await uniCloud.uploadFile({ cloudPath, fileContent });
	const fileId = uploaded && (uploaded.fileID || uploaded.fileId);
	if (!fileId) {
		const error = new Error('RESULT_SAVE_FAILED');
		error.code = 'RESULT_SAVE_FAILED';
		throw error;
	}
	return fileId;
}

async function persistGeneratedImage(petHash, jobId, providerUrl, options = {}) {
	const providerContent = await downloadHttps(providerUrl);
	const providerInspection = inspectImageBuffer(providerContent);
	const preservesProviderBytes = providerInspection.mime === 'image/png';
	const fileContent = preservesProviderBytes
		? providerContent
		: getDisplayDerivativeTools().normalizeToPng(providerContent);
	let revisionQuality = null;
	const outputInspection = preservesProviderBytes
		? providerInspection
		: inspectImageBuffer(fileContent);
	if (options.requestedSize === '2048*2048' && (outputInspection.width !== 2048 || outputInspection.height !== 2048)) {
		throw Object.assign(new Error('MASTER_COMPOSITION_SIZE_REJECTED'), { code: 'MASTER_COMPOSITION_SIZE_REJECTED' });
	}
	if (options.revisionReferenceFileId) {
		const referenceContent = await downloadCloudFile(options.revisionReferenceFileId);
		revisionQuality = getImageQualityGate().evaluateRevisionQuality(referenceContent, fileContent);
	}
	const generatedCandidateSha256 = sha256Buffer(fileContent);
	let styleReferenceSha256 = '';
	if (options.styleReferenceFileId) {
		try {
			styleReferenceSha256 = sha256Buffer(await downloadCloudFile(options.styleReferenceFileId));
		} catch (error) {
			styleReferenceSha256 = '';
		}
	}
	assertDistinctHashes(generatedCandidateSha256, styleReferenceSha256);
	const cloudPath = `pety-private-v3/pet-avatar/output/${petHash}/${jobId}/candidate.png`;
	const generatedFileId = await uploadBuffer(cloudPath, fileContent);
	const thumbnailCloudPath = `pety-private-v3/pet-avatar/output/${petHash}/${jobId}/thumbnail.png`;
	const generatedThumbnailFileId = await uploadBuffer(thumbnailCloudPath, getDisplayDerivativeTools().buildCandidateThumbnail(fileContent));
	const [generatedTempUrl, generatedThumbnailUrl] = await getTempUrls([generatedFileId, generatedThumbnailFileId]);
	const mainAssetMetadata = {
		assetRole: 'workbench_master',
		compositionVersion: options.compositionVersion || '',
		requestedSize: options.requestedSize || '',
		poseVerification: 'NOT_VISUALLY_VERIFIED',
		width: outputInspection.width,
		height: outputInspection.height,
		bytes: outputInspection.bytes,
		mime: outputInspection.mime,
		hasAlpha: outputInspection.hasAlpha,
		alphaBoundingBox: outputInspection.alphaBoundingBox,
		alphaCoverage: outputInspection.alphaCoverage,
		contentWidth: outputInspection.contentWidth,
		contentHeight: outputInspection.contentHeight,
		transparentPaddingRatio: outputInspection.transparentPaddingRatio,
		extension: outputInspection.mime === 'image/png' ? 'png' : 'jpg',
		wasReencoded: !preservesProviderBytes,
		wasDownscaled: false,
		providerOriginal: preservesProviderBytes && outputInspection.sha256 === providerInspection.sha256,
		providerWidth: providerInspection.width,
		providerHeight: providerInspection.height,
		providerBytes: providerInspection.bytes,
		providerMime: providerInspection.mime,
		providerSize: String(options.providerSize || ''),
		sourceRole: 'candidate_original'
	};
	return { generatedFileId, generatedTempUrl, generatedThumbnailFileId, generatedThumbnailUrl, cloudPath, thumbnailCloudPath, generatedCandidateSha256, styleReferenceSha256, revisionQuality, outputInspection, mainAssetMetadata };
}

async function persistFinalImage(petHash, jobId, candidateFileId, candidateMetadata = {}) {
	const fileContent = await downloadCloudFile(candidateFileId);
	const inspection = inspectImageBuffer(fileContent);
	const cloudPath = `pety-private-v3/pet-avatar/final/${petHash}/${jobId}/final.png`;
	const finalFileId = await uploadBuffer(cloudPath, fileContent);
	const [finalTempUrl] = await getTempUrls([finalFileId]);
	return {
		finalFileId,
		finalTempUrl,
		cloudPath,
		finalSha256: sha256Buffer(fileContent),
		mainAssetMetadata: {
			...candidateMetadata,
			contentSha256: sha256Buffer(fileContent),
			width: inspection.width,
			height: inspection.height,
			bytes: inspection.bytes,
			mime: inspection.mime,
			hasAlpha: inspection.hasAlpha,
			alphaBoundingBox: inspection.alphaBoundingBox,
			alphaCoverage: inspection.alphaCoverage,
			contentWidth: inspection.contentWidth,
			contentHeight: inspection.contentHeight,
			transparentPaddingRatio: inspection.transparentPaddingRatio,
			extension: inspection.mime === 'image/png' ? 'png' : 'jpg',
			wasDownscaled: false,
			sourceRole: 'final_original'
		}
	};
}

async function persistCutoutImage(petHash, jobId, cutoutUrl) {
	const fileContent = await downloadHttps(cutoutUrl);
	// Provider success only means that a file was returned.  A Hero cutout is
	// persisted only after the mask passes the same geometry/edge quality gate
	// used by the display selector.
	const alphaInspection = requireQualifiedCutout(fileContent);
	const cloudPath = `pety-private-v3/pet-avatar/final/${petHash}/${jobId}/cutout.png`;
	const cutoutFileId = await uploadBuffer(cloudPath, fileContent);
	const [cutoutTempUrl] = await getTempUrls([cutoutFileId]);
	return { cutoutFileId, cutoutTempUrl, cloudPath, alphaInspection };
}

function assertMagentaTechnicalSource(decoded, localCutoutMetrics) {
	const mean = localCutoutMetrics && localCutoutMetrics.mean || [];
	const red = Number(mean[0]) || 0;
	const green = Number(mean[1]) || 0;
	const blue = Number(mean[2]) || 0;
	const isSeparatedKey = localCutoutMetrics && localCutoutMetrics.chromaKey === true &&
		red >= 190 && green <= 72 && blue >= 145 && red - green >= 125 && blue - green >= 82;
	if (!isSeparatedKey || Math.min(decoded.width, decoded.height) < 768) {
		const error = new Error('HERO_TECHNICAL_BACKGROUND_INVALID');
		error.code = 'HERO_TECHNICAL_BACKGROUND_INVALID';
		throw error;
	}
}

async function persistChromaHeroImage(petHash, jobId, providerUrl) {
	const sourceContent = await downloadHttps(providerUrl);
	const decoded = getImageQualityGate().decodeImage(sourceContent);
	const local = getDisplayDerivativeTools().createLocalCutout(decoded);
	assertMagentaTechnicalSource(decoded, local.metrics);
	if (!local.buffer) throw Object.assign(new Error('HERO_CHROMA_CUTOUT_FAILED'), { code: 'HERO_CHROMA_CUTOUT_FAILED' });
	const edgeImage = getImageQualityGate().decodeImage(local.buffer);
	const edgeQuality = require('./hero-edge-quality').enforceHeroEdges(edgeImage);
	if (!edgeQuality.qualified) throw Object.assign(new Error('HERO_EDGE_QUALITY_REJECTED'), { code: 'HERO_EDGE_QUALITY_REJECTED' });
	local.buffer = require('pngjs').PNG.sync.write(edgeImage);
	const inspection = requireQualifiedCutout(local.buffer);
	const cutout = getImageQualityGate().decodeImage(local.buffer);
	let visible = 0;
	let matteLeak = 0;
	for (let index = 0; index < cutout.width * cutout.height; index += 1) {
		const offset = index * 4;
		if (cutout.data[offset + 3] <= 16) continue;
		visible += 1;
		const red = cutout.data[offset], green = cutout.data[offset + 1], blue = cutout.data[offset + 2];
		if (red > 150 && blue > 120 && green < 100 && red - green > 70 && blue - green > 50) matteLeak += 1;
	}
	const matteLeakRatio = matteLeak / Math.max(visible, 1);
	if (matteLeakRatio > 0.003) {
		const error = new Error('HERO_CHROMA_EDGE_CONTAMINATION');
		error.code = 'HERO_CHROMA_EDGE_CONTAMINATION';
		throw error;
	}
	const tight = getDisplayDerivativeTools().buildTightCutout(local.buffer);
	if (!tight.buffer || !tight.metrics.qualified) throw Object.assign(new Error('HERO_CHROMA_CUTOUT_FAILED'), { code: 'HERO_CHROMA_CUTOUT_FAILED' });
	const finalEdgeQuality = require('./hero-edge-quality').evaluateHeroEdges(getImageQualityGate().decodeImage(tight.buffer));
	if (!finalEdgeQuality.qualified) throw Object.assign(new Error('HERO_EDGE_QUALITY_REJECTED'), { code: 'HERO_EDGE_QUALITY_REJECTED' });
	// Immutable content identity prevents a cached URL from displaying an older
	// matte after a CPU-only reprocessing of the same provider result.
	const cloudPath = `pety-private-v3/pet-avatar/final/${petHash}/${jobId}/hero-character-${sha256Buffer(tight.buffer).slice(0, 12)}.png`;
	const heroFileId = await uploadBuffer(cloudPath, tight.buffer);
	const [heroUrl] = await getTempUrls([heroFileId]);
	return {
		heroFileId,
		heroUrl,
		cloudPath,
		heroMetrics: {
			...tight.metrics,
			bytes: tight.buffer.length,
			sha256: sha256Buffer(tight.buffer),
			qualified: true,
			assetRole: 'home_hero',
			sourceRole: 'wan_chroma_technical',
			backgroundMean: local.metrics.mean,
			backgroundConfidence: local.metrics.confidence,
			matteLeakRatio,
			edgeDecontaminated: local.metrics.edgeDecontaminated === true,
			edgeQuality: { ...finalEdgeQuality, repair: edgeQuality.repair, passes: edgeQuality.passes }
		}
	};
}

// Wan image editing does not accept an input PNG carrying an alpha channel,
// even when every alpha sample is 255. Confirmed masters are deliberately kept
// byte-for-byte, so create a separate opaque JPEG solely for the Hero edit job.
function buildHeroProviderSourceJpeg(finalContent) {
	const jpeg = require('jpeg-js');
	const source = getImageQualityGate().decodeImage(finalContent);
	const resized = getDisplayDerivativeTools().resizeRgba(source, 1280);
	const opaque = Buffer.from(resized.data);
	for (let index = 0; index < opaque.length; index += 4) {
		const alpha = opaque[index + 3] / 255;
		for (let channel = 0; channel < 3; channel += 1) {
			opaque[index + channel] = Math.round(opaque[index + channel] * alpha + 246 * (1 - alpha));
		}
		opaque[index + 3] = 255;
	}
	const encoded = jpeg.encode({ width: resized.width, height: resized.height, data: opaque }, 92).data;
	if (!Buffer.isBuffer(encoded) || encoded.length < 32 || encoded[0] !== 0xff || encoded[1] !== 0xd8) {
		throw Object.assign(new Error('HERO_SOURCE_ENCODE_FAILED'), { code: 'HERO_SOURCE_ENCODE_FAILED' });
	}
	return { buffer: encoded, width: resized.width, height: resized.height, bytes: encoded.length, mime: 'image/jpeg', alphaChannel: false };
}

async function persistHeroProviderSource(petHash, jobId, finalFileId) {
	const prepared = buildHeroProviderSourceJpeg(await downloadCloudFile(finalFileId));
	const encoded = prepared.buffer;
	const fileId = await uploadBuffer(`pety-private-v3/pet-avatar/final/${petHash}/${jobId}/hero-provider-source.jpg`, encoded);
	return { ...prepared, buffer: undefined, fileId };
}

async function persistTightCutout(petHash, jobId, sourceFileId, local = false, native = false) {
	const content = await downloadCloudFile(sourceFileId);
	const inspection = inspectTransparentPng(content);
	const tight = getDisplayDerivativeTools().buildTightCutout(content);
	const metrics = { ...tight.metrics, sourceFileId, originalBytes: content.length };
	// Canvas dimensions can shrink without losing a single subject pixel. Quality
	// is evaluated on the original mask, then on the retained content, never bytes.
	if (!inspection.qualified) { metrics.qualified = false; metrics.fallbackReason = inspection.fallbackReason; }
	if (!metrics.qualified || !tight.buffer) return { fileId: '', metrics };
	const name = native ? 'hero-native-tight.png' : local ? 'local-cutout-tight.png' : 'cutout-tight.png';
	const fileId = await uploadBuffer(`pety-private-v3/pet-avatar/final/${petHash}/${jobId}/${name}`, tight.buffer);
	return { fileId, metrics: { ...metrics, bytes: tight.buffer.length, sha256: sha256Buffer(tight.buffer) } };
}

async function persistDisplayDerivatives(petHash, jobId, finalFileId) {
	const finalContent = await downloadCloudFile(finalFileId);
	const derivatives = getDisplayDerivativeTools().buildDisplayDerivatives(finalContent);
	const displayFileId = await uploadBuffer(`pety-private-v3/pet-avatar/final/${petHash}/${jobId}/display.png`, derivatives.displayBuffer);
	const thumbnailFileId = await uploadBuffer(`pety-private-v3/pet-avatar/final/${petHash}/${jobId}/thumbnail.png`, derivatives.thumbnailBuffer);
	const featheredDisplayFileId = await uploadBuffer(`pety-private-v3/pet-avatar/final/${petHash}/${jobId}/hero-feather.png`, derivatives.featheredBuffer);
	let localCutoutFileId = '';
	let localCutoutAlphaInspection = null;
	if (derivatives.localCutoutBuffer) {
		try {
			localCutoutAlphaInspection = requireQualifiedCutout(derivatives.localCutoutBuffer);
			localCutoutFileId = await uploadBuffer(`pety-private-v3/pet-avatar/final/${petHash}/${jobId}/hero-cutout.png`, derivatives.localCutoutBuffer);
		} catch (error) {
			derivatives.localCutoutMetrics = {
				...(derivatives.localCutoutMetrics || {}),
				reason: 'LOCAL_CUTOUT_UNSUITABLE'
			};
		}
	}
	const fileIds = [displayFileId, thumbnailFileId, featheredDisplayFileId].concat(localCutoutFileId ? [localCutoutFileId] : []);
	const urls = await getTempUrls(fileIds);
	return {
		displayFileId,
		displayUrl: urls[0] || '',
		thumbnailFileId,
		thumbnailUrl: urls[1] || '',
		featheredDisplayFileId,
		featheredDisplayUrl: urls[2] || '',
		localCutoutFileId,
		localCutoutUrl: localCutoutFileId ? urls[3] || '' : '',
		localCutoutAlphaValid: Boolean(localCutoutFileId && localCutoutAlphaInspection),
		localCutoutMetrics: {
			...(derivatives.localCutoutMetrics || {}),
			...(localCutoutAlphaInspection || {}),
			backgroundConfidence: Number(derivatives.localCutoutMetrics && derivatives.localCutoutMetrics.confidence) || 0,
			transparentPixelRatio: localCutoutAlphaInspection ? localCutoutAlphaInspection.transparentPixelRatio : Number(derivatives.localCutoutMetrics && derivatives.localCutoutMetrics.transparentRatio) || 0,
			outputBytes: localCutoutAlphaInspection ? localCutoutAlphaInspection.bytes : 0,
			outputWidth: localCutoutAlphaInspection ? localCutoutAlphaInspection.width : 0,
			outputHeight: localCutoutAlphaInspection ? localCutoutAlphaInspection.height : 0,
			mime: localCutoutAlphaInspection ? 'image/png' : '',
			wasReencoded: Boolean(localCutoutAlphaInspection),
			wasDownscaled: false,
			providerOriginal: false,
			cutoutShaPrefix: localCutoutAlphaInspection ? localCutoutAlphaInspection.sha256.slice(0, 12) : '',
			reason: localCutoutFileId ? '' : 'LOCAL_CUTOUT_UNSUITABLE'
		},
		dimensions: derivatives.dimensions
	};
}

async function verifyCloudFileExists(fileId) {
	try {
		const fileContent = await downloadCloudFile(fileId);
		return Buffer.isBuffer(fileContent) && fileContent.length > 0;
	} catch (error) {
		return false;
	}
}

async function deleteCloudFiles(fileIds) {
	const fileList = Array.from(new Set((Array.isArray(fileIds) ? fileIds : []).filter(item => /^cloud:\/\//i.test(String(item || '')))));
	if (!fileList.length) return { deleted: 0 };
	await uniCloud.deleteFile({ fileList });
	return { deleted: fileList.length };
}

module.exports = {
	getProviderImageInputs,
	assertMagentaTechnicalSource,
	assertPrivateFileId,
	assertDistinctHashes,
	buildHeroProviderSourceJpeg,
	deleteCloudFiles,
	downloadCloudFile,
	downloadHttps,
	getTempUrls,
	getCloudPath,
	getImageMime,
	inspectCloudImage,
	inspectUploadedSource,
	assertSourceHeaderDimensions,
	inspectImageBuffer,
	inspectRevisionSource,
	inspectTransparentPng,
	persistTightCutout,
	persistChromaHeroImage,
	persistCutoutImage,
	persistDisplayDerivatives,
	persistHeroProviderSource,
	persistFinalImage,
	persistGeneratedImage,
	sha256Buffer,
	verifyCloudFileExists
};
