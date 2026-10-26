'use strict';

const { PNG } = require('pngjs');
const { decodeImage } = require('./image-quality-gate');

const DISPLAY_EDGE = 768;
const THUMBNAIL_EDGE = 256;
const LOCAL_CUTOUT_CONFIDENCE = 0.72;

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

function resizeRgba(image, targetEdge) {
	const scale = Math.min(1, targetEdge / Math.max(image.width, image.height));
	const width = Math.max(1, Math.round(image.width * scale));
	const height = Math.max(1, Math.round(image.height * scale));
	if (width === image.width && height === image.height) {
		return { width, height, data: Buffer.from(image.data) };
	}
	const data = Buffer.alloc(width * height * 4);
	for (let y = 0; y < height; y += 1) {
		const sourceY = (y + 0.5) / scale - 0.5;
		const y0 = clamp(Math.floor(sourceY), 0, image.height - 1);
		const y1 = clamp(y0 + 1, 0, image.height - 1);
		const yWeight = clamp(sourceY - y0, 0, 1);
		for (let x = 0; x < width; x += 1) {
			const sourceX = (x + 0.5) / scale - 0.5;
			const x0 = clamp(Math.floor(sourceX), 0, image.width - 1);
			const x1 = clamp(x0 + 1, 0, image.width - 1);
			const xWeight = clamp(sourceX - x0, 0, 1);
			const targetIndex = (y * width + x) * 4;
			for (let channel = 0; channel < 4; channel += 1) {
				const topLeft = image.data[(y0 * image.width + x0) * 4 + channel];
				const topRight = image.data[(y0 * image.width + x1) * 4 + channel];
				const bottomLeft = image.data[(y1 * image.width + x0) * 4 + channel];
				const bottomRight = image.data[(y1 * image.width + x1) * 4 + channel];
				const top = topLeft + (topRight - topLeft) * xWeight;
				const bottom = bottomLeft + (bottomRight - bottomLeft) * xWeight;
				data[targetIndex + channel] = Math.round(top + (bottom - top) * yWeight);
			}
		}
	}
	return { width, height, data };
}

function encodePng(image) {
	return PNG.sync.write({ width: image.width, height: image.height, data: Buffer.from(image.data) }, {
		colorType: 6,
		inputColorType: 6,
		inputHasAlpha: true,
		deflateLevel: 8,
		deflateStrategy: 3
	});
}

function normalizeToPng(buffer) {
	return encodePng(decodeImage(buffer));
}

function sampleBorder(image) {
	const samples = [];
	const step = Math.max(1, Math.floor(Math.min(image.width, image.height) / 96));
	const push = (x, y) => {
		const index = (y * image.width + x) * 4;
		samples.push([image.data[index], image.data[index + 1], image.data[index + 2]]);
	};
	for (let x = 0; x < image.width; x += step) {
		push(x, 0);
		push(x, image.height - 1);
	}
	for (let y = step; y < image.height - 1; y += step) {
		push(0, y);
		push(image.width - 1, y);
	}
	const mean = [0, 0, 0];
	samples.forEach(sample => sample.forEach((value, channel) => { mean[channel] += value; }));
	mean.forEach((value, channel) => { mean[channel] = value / Math.max(samples.length, 1); });
	let variance = 0;
	samples.forEach(sample => {
		variance += sample.reduce((sum, value, channel) => sum + Math.pow(value - mean[channel], 2), 0) / 3;
	});
	variance /= Math.max(samples.length, 1);
	const deviation = Math.sqrt(variance);
	return {
		mean,
		deviation,
		confidence: clamp(1 - deviation / 46, 0, 1)
	};
}

function colorDistance(data, index, mean) {
	const red = data[index] - mean[0];
	const green = data[index + 1] - mean[1];
	const blue = data[index + 2] - mean[2];
	return Math.sqrt((red * red + green * green + blue * blue) / 3);
}

function blurAlpha(alpha, width, height, radius = 3) {
	let source = Float32Array.from(alpha);
	let target = new Float32Array(alpha.length);
	for (let y = 0; y < height; y += 1) {
		let sum = 0;
		for (let x = -radius; x <= radius; x += 1) sum += source[y * width + clamp(x, 0, width - 1)];
		for (let x = 0; x < width; x += 1) {
			target[y * width + x] = sum / (radius * 2 + 1);
			sum -= source[y * width + clamp(x - radius, 0, width - 1)];
			sum += source[y * width + clamp(x + radius + 1, 0, width - 1)];
		}
	}
	source = target;
	target = new Float32Array(alpha.length);
	for (let x = 0; x < width; x += 1) {
		let sum = 0;
		for (let y = -radius; y <= radius; y += 1) sum += source[clamp(y, 0, height - 1) * width + x];
		for (let y = 0; y < height; y += 1) {
			target[y * width + x] = sum / (radius * 2 + 1);
			sum -= source[clamp(y - radius, 0, height - 1) * width + x];
			sum += source[clamp(y + radius + 1, 0, height - 1) * width + x];
		}
	}
	return target;
}

function decontaminateMatteEdges(image, alpha, keyMean = []) {
	const pixelCount = image.width * image.height;
	const owner = new Int32Array(pixelCount);
	const queue = new Int32Array(pixelCount);
	const core = new Uint8Array(pixelCount);
	let head = 0;
	let tail = 0;
	const radius = 6;
	for (let index = 0; index < pixelCount; index += 1) {
		if (alpha[index] < 248) continue;
		const x = index % image.width;
		const y = Math.floor(index / image.width);
		if (x < radius || y < radius || x + radius >= image.width || y + radius >= image.height) continue;
		const probes = [index - radius, index + radius, index - radius * image.width, index + radius * image.width,
			index - radius * image.width - radius, index - radius * image.width + radius,
			index + radius * image.width - radius, index + radius * image.width + radius];
		if (!probes.every(probe => alpha[probe] >= 248)) continue;
		// A pale pink fringe can be fully opaque, so alpha-only erosion may choose
		// contaminated fur as a color donor. Exclude such donors only near the
		// silhouette; interior pink noses/ears and all alpha samples stay intact.
		const offset = index * 4;
		const magentaKey = keyMean[0] - keyMean[1] > 100 && keyMean[2] - keyMean[1] > 80;
		// Warm white fur can mix the key into pale salmon rather than saturated
		// purple (real output: RGB 236,203,203). Its blue-green excess can be zero.
		const pinkSpill = image.data[offset] - image.data[offset + 1] > 14 && image.data[offset + 2] - image.data[offset + 1] > -8;
		if (magentaKey && pinkSpill) {
			const reach = 24;
			const nearEdge = x < reach || y < reach || x + reach >= image.width || y + reach >= image.height ||
				[index - reach, index + reach, index - reach * image.width, index + reach * image.width].some(probe => alpha[probe] < 248);
			if (nearEdge) continue;
		}
		core[index] = 1;
		owner[index] = index + 1;
		queue[tail++] = index;
	}
	while (head < tail) {
		const index = queue[head++];
		const x = index % image.width;
		const y = Math.floor(index / image.width);
		const visit = next => {
			if (owner[next] || alpha[next] <= 2) return;
			owner[next] = owner[index];
			queue[tail++] = next;
		};
		if (x > 0) visit(index - 1);
		if (x + 1 < image.width) visit(index + 1);
		if (y > 0) visit(index - image.width);
		if (y + 1 < image.height) visit(index + image.width);
	}
	const cleaned = Buffer.from(image.data);
	for (let index = 0; index < pixelCount; index += 1) {
		if (!owner[index] || alpha[index] <= 2) continue;
		const target = index * 4;
		if (core[index]) continue;
		const source = (owner[index] - 1) * 4;
		cleaned[target] = image.data[source];
		cleaned[target + 1] = image.data[source + 1];
		cleaned[target + 2] = image.data[source + 2];
	}
	const smoothed = Buffer.from(cleaned);
	for (let index = 0; index < pixelCount; index += 1) {
		if (!owner[index] || core[index] || alpha[index] <= 2) continue;
		const x = index % image.width;
		const y = Math.floor(index / image.width);
		const sum = [0, 0, 0];
		let count = 0;
		for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
			const sx = x + dx;
			const sy = y + dy;
			if (sx < 0 || sy < 0 || sx >= image.width || sy >= image.height) continue;
			const neighbor = sy * image.width + sx;
			if (!owner[neighbor] || alpha[neighbor] <= 2) continue;
			const source = neighbor * 4;
			for (let channel = 0; channel < 3; channel += 1) sum[channel] += cleaned[source + channel];
			count += 1;
		}
		const target = index * 4;
		for (let channel = 0; channel < 3; channel += 1) smoothed[target + channel] = Math.round(sum[channel] / Math.max(count, 1));
	}
	image.data = smoothed;
}

function createLocalCutout(image) {
	const border = sampleBorder(image);
	if (border.confidence < LOCAL_CUTOUT_CONFIDENCE) return { buffer: null, metrics: { ...border, reason: 'BACKGROUND_NOT_UNIFORM' } };
	const pixelCount = image.width * image.height;
	const background = new Uint8Array(pixelCount);
	const visited = new Uint8Array(pixelCount);
	const queue = new Int32Array(pixelCount);
	let queueStart = 0;
	let queueEnd = 0;
	const threshold = clamp(24 + border.deviation * 1.35, 24, 48);
	const enqueue = index => {
		if (visited[index]) return;
		visited[index] = 1;
		const offset = index * 4;
		if (colorDistance(image.data, offset, border.mean) > threshold) return;
		background[index] = 1;
		queue[queueEnd++] = index;
	};
	for (let x = 0; x < image.width; x += 1) {
		enqueue(x);
		enqueue((image.height - 1) * image.width + x);
	}
	for (let y = 1; y < image.height - 1; y += 1) {
		enqueue(y * image.width);
		enqueue(y * image.width + image.width - 1);
	}
	while (queueStart < queueEnd) {
		const index = queue[queueStart++];
		const x = index % image.width;
		const y = Math.floor(index / image.width);
		if (x > 0) enqueue(index - 1);
		if (x + 1 < image.width) enqueue(index + 1);
		if (y > 0) enqueue(index - image.width);
		if (y + 1 < image.height) enqueue(index + image.width);
	}
	const transparentRatio = queueEnd / Math.max(pixelCount, 1);
	// Large empty canvases are exactly what tight cropping fixes. Reject empty
	// masks here; assess subject resolution and retained shape after alpha bounds.
	if (transparentRatio < 0.08 || transparentRatio > 0.995) {
		return { buffer: null, metrics: { ...border, threshold, transparentRatio, reason: 'UNSAFE_FOREGROUND_RATIO' } };
	}
	const chromaRange = Math.max(...border.mean) - Math.min(...border.mean);
	const chromaKey = border.confidence >= 0.82 && chromaRange >= 42;
	const alpha = new Uint8Array(pixelCount);
	for (let index = 0; index < pixelCount; index += 1) alpha[index] = background[index] ? 0 : 255;
	const softened = blurAlpha(alpha, image.width, image.height, 3);
	const output = { width: image.width, height: image.height, data: Buffer.from(image.data) };
	for (let index = 0; index < pixelCount; index += 1) {
		const offset = index * 4 + 3;
		const distance = colorDistance(image.data, index * 4, border.mean);
		const chromaAlpha = chromaKey ? clamp((distance - threshold * 0.45) / (threshold * 1.9), 0, 1) * 255 : 255;
		alpha[index] = Math.round(Math.min(output.data[offset], softened[index], chromaAlpha));
		output.data[offset] = alpha[index];
	}
	if (chromaKey) decontaminateMatteEdges(output, alpha, border.mean);
	return { buffer: encodePng(output), metrics: { ...border, threshold, transparentRatio, chromaKey, chromaRange, edgeDecontaminated: chromaKey, reason: '' } };
}

function createFeatheredDisplay(image) {
	const output = { width: image.width, height: image.height, data: Buffer.from(image.data) };
	const featherWidth = Math.max(8, Math.round(Math.min(image.width, image.height) * 0.18));
	for (let y = 0; y < image.height; y += 1) {
		for (let x = 0; x < image.width; x += 1) {
			const edgeDistance = Math.min(x, y, image.width - 1 - x, image.height - 1 - y);
			const amount = clamp(edgeDistance / featherWidth, 0, 1);
			const smooth = amount * amount * (3 - 2 * amount);
			const alphaIndex = (y * image.width + x) * 4 + 3;
			output.data[alphaIndex] = Math.round(output.data[alphaIndex] * smooth);
		}
	}
	return encodePng(output);
}

function buildDisplayDerivatives(masterBuffer) {
	const decoded = decodeImage(masterBuffer);
	const display = resizeRgba(decoded, DISPLAY_EDGE);
	const thumbnail = resizeRgba(decoded, THUMBNAIL_EDGE);
	const localCutout = createLocalCutout(decoded);
	return {
		displayBuffer: encodePng(display),
		thumbnailBuffer: encodePng(thumbnail),
		featheredBuffer: createFeatheredDisplay(display),
		localCutoutBuffer: localCutout.buffer,
		localCutoutMetrics: localCutout.metrics,
		dimensions: { masterWidth: decoded.width, masterHeight: decoded.height, displayWidth: display.width, displayHeight: display.height, thumbnailWidth: thumbnail.width, thumbnailHeight: thumbnail.height }
	};
}

function buildCandidateThumbnail(masterBuffer) {
	return encodePng(resizeRgba(decodeImage(masterBuffer), THUMBNAIL_EDGE));
}

// Bounds describe meaningful alpha, not PNG canvas dimensions. Near-zero alpha
// is ignored so encoder noise does not turn one stray pixel into metres of padding.
function analyzeAlpha(image) {
	const { width, height, data } = image;
	let minX = width, minY = height, maxX = -1, maxY = -1, count = 0, alphaSum = 0, transparent = 0;
	for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
		const alpha = data[(y * width + x) * 4 + 3];
		alphaSum += alpha;
		if (alpha < 255) transparent++;
		if (alpha <= 8) continue;
		count++; minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
	}
	const contentWidth = count ? maxX - minX + 1 : 0;
	const contentHeight = count ? maxY - minY + 1 : 0;
	const cornersTransparent = [0, width - 1, (height - 1) * width, width * height - 1].every(i => data[i * 4 + 3] <= 8);
	return {
		hasAlpha: transparent > 0,
		alphaThreshold: 8,
		alphaBoundingBox: count ? { minX, minY, maxX, maxY } : null,
		contentWidth, contentHeight,
		alphaCoverage: count / (width * height),
		alphaWeightedCoverage: alphaSum / (255 * width * height),
		contentAreaRatio: contentWidth * contentHeight / (width * height),
		transparentPaddingRatio: 1 - contentWidth * contentHeight / (width * height),
		boundingBoxFillRatio: count / Math.max(1, contentWidth * contentHeight),
		cornersTransparent
	};
}

function buildTightCutout(buffer) {
	if (!Buffer.isBuffer(buffer) || buffer.length < 8 || buffer.readUInt32BE(0) !== 0x89504e47) throw Object.assign(new Error('CUTOUT_ALPHA_INVALID'), { code: 'CUTOUT_ALPHA_INVALID' });
	const original = decodeImage(buffer);
	const before = analyzeAlpha(original);
	const box = before.alphaBoundingBox;
	let fallbackReason = !before.hasAlpha || !box ? 'CUTOUT_ALPHA_INVALID'
		: !before.cornersTransparent ? 'OPAQUE_CORNERS'
		: before.boundingBoxFillRatio > 0.96 ? 'RECTANGULAR_ALPHA_MASK'
		: box.minX === 0 || box.minY === 0 || box.maxX === original.width - 1 || box.maxY === original.height - 1 ? 'SUBJECT_TOUCHES_BORDER'
		: Math.min(before.contentWidth, before.contentHeight) < 160 || Math.max(before.contentWidth, before.contentHeight) < 512 ? 'SUBJECT_RESOLUTION_TOO_SMALL' : '';
	const paddingX = Math.max(2, Math.ceil(before.contentWidth * 0.07));
	const paddingY = Math.max(2, Math.ceil(before.contentHeight * 0.07));
	const base = { ...before, tightVersion: 1, qualityVersion: 2, originalWidth: original.width, originalHeight: original.height, originalAlphaBoundingBox: box, qualified: false, fallbackReason };
	if (fallbackReason) return { buffer: null, metrics: base };
	// Do not clamp padding to the old canvas. New transparent pixels provide the
	// same safety margin even if a preserved tail or ear was close to an old edge.
	const crop = { x: box.minX - paddingX, y: box.minY - paddingY, width: before.contentWidth + paddingX * 2, height: before.contentHeight + paddingY * 2 };
	const image = { width: crop.width, height: crop.height, data: Buffer.alloc(crop.width * crop.height * 4) };
	for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
		const sx = crop.x + x, sy = crop.y + y;
		if (sx < 0 || sy < 0 || sx >= original.width || sy >= original.height) continue;
		const source = (sy * original.width + sx) * 4, target = (y * image.width + x) * 4;
		original.data.copy(image.data, target, source, source + 4);
		if (image.data[target + 3] <= 8) image.data[target + 3] = 0;
	}
	const after = analyzeAlpha(image);
	if (after.contentAreaRatio < 0.7 || after.alphaCoverage < 0.15) fallbackReason = 'EXCESS_TRANSPARENT_PADDING';
	return {
		buffer: fallbackReason ? null : encodePng(image),
		metrics: {
			...base, ...after, qualified: !fallbackReason, fallbackReason,
			width: image.width, height: image.height, croppedWidth: image.width, croppedHeight: image.height,
			cropRect: crop, padding: { left: paddingX, right: paddingX, top: paddingY, bottom: paddingY, ratio: 0.07 },
			wasDownscaled: false, wasReencoded: true, mime: 'image/png', sourceRole: 'cutout_tight'
		}
	};
}

module.exports = {
	DISPLAY_EDGE,
	LOCAL_CUTOUT_CONFIDENCE,
	THUMBNAIL_EDGE,
	buildCandidateThumbnail,
	analyzeAlpha,
	buildTightCutout,
	buildDisplayDerivatives,
	createLocalCutout,
	decontaminateMatteEdges,
	normalizeToPng,
	resizeRgba
};
