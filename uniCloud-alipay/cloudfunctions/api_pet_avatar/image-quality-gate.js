'use strict';

const { PNG } = require('pngjs');
const jpeg = require('jpeg-js');

const SAMPLE_SIZE = 64;

function qualityGateError(reasonCode, metrics = {}) {
	const error = new Error('REVISION_RESULT_UNSTABLE');
	error.code = 'REVISION_RESULT_UNSTABLE';
	error.legacyCode = 'REVISION_QUALITY_REJECTED';
	error.qualityGateResult = { passed: false, reasonCode, metrics };
	return error;
}

function decodeImage(buffer) {
	if (!Buffer.isBuffer(buffer) || buffer.length < 32) throw qualityGateError('IMAGE_DECODE_FAILED');
	try {
		if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
			const width = buffer.readUInt32BE(16), height = buffer.readUInt32BE(20);
			if (!width || !height || width > 8192 || height > 8192 || width * height > 16 * 1024 * 1024) throw qualityGateError('IMAGE_DIMENSIONS_LIMIT');
			const decoded = PNG.sync.read(buffer, { skipRescale: true });
			return { width: decoded.width, height: decoded.height, data: decoded.data };
		}
		if (buffer[0] === 0xff && buffer[1] === 0xd8) {
			const decoded = jpeg.decode(buffer, { useTArray: true, formatAsRGBA: true, maxResolutionInMP: 16, maxMemoryUsageInMB: 128 });
			return { width: decoded.width, height: decoded.height, data: decoded.data };
		}
	} catch (error) {
		throw qualityGateError('IMAGE_DECODE_FAILED');
	}
	throw qualityGateError('IMAGE_DECODE_FAILED');
}

function sampleImage(image, size = SAMPLE_SIZE) {
	const pixels = new Float32Array(size * size * 3);
	for (let y = 0; y < size; y += 1) {
		const sourceY = Math.min(Math.floor((y + 0.5) * image.height / size), image.height - 1);
		for (let x = 0; x < size; x += 1) {
			const sourceX = Math.min(Math.floor((x + 0.5) * image.width / size), image.width - 1);
			const sourceIndex = (sourceY * image.width + sourceX) * 4;
			const targetIndex = (y * size + x) * 3;
			const alpha = image.data[sourceIndex + 3] / 255;
			for (let channel = 0; channel < 3; channel += 1) {
				pixels[targetIndex + channel] = (image.data[sourceIndex + channel] * alpha + 255 * (1 - alpha)) / 255;
			}
		}
	}
	return pixels;
}

function analyzeSample(pixels, size = SAMPLE_SIZE) {
	let luminanceSum = 0;
	let luminanceSquaredSum = 0;
	let adjacentDifferenceSum = 0;
	let adjacentCount = 0;
	let extremeEdgeCount = 0;
	let borderDifferenceSum = 0;
	let borderDifferenceCount = 0;
	const luminanceBins = new Uint32Array(32);
	const colorMean = [0, 0, 0];
	for (let y = 0; y < size; y += 1) {
		for (let x = 0; x < size; x += 1) {
			const index = (y * size + x) * 3;
			const red = pixels[index];
			const green = pixels[index + 1];
			const blue = pixels[index + 2];
			const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
			luminanceBins[Math.min(31, Math.floor(luminance * 32))] += 1;
			luminanceSum += luminance;
			luminanceSquaredSum += luminance * luminance;
			colorMean[0] += red;
			colorMean[1] += green;
			colorMean[2] += blue;
			if (x > 0) {
				const left = index - 3;
				const difference = (Math.abs(red - pixels[left]) + Math.abs(green - pixels[left + 1]) + Math.abs(blue - pixels[left + 2])) / 3;
				adjacentDifferenceSum += difference;
				adjacentCount += 1;
				if (difference > 0.72) extremeEdgeCount += 1;
				if (y < 8 || y >= size - 8) { borderDifferenceSum += difference; borderDifferenceCount += 1; }
			}
			if (y > 0) {
				const above = index - size * 3;
				const difference = (Math.abs(red - pixels[above]) + Math.abs(green - pixels[above + 1]) + Math.abs(blue - pixels[above + 2])) / 3;
				adjacentDifferenceSum += difference;
				adjacentCount += 1;
				if (difference > 0.72) extremeEdgeCount += 1;
				if (x < 8 || x >= size - 8) { borderDifferenceSum += difference; borderDifferenceCount += 1; }
			}
		}
	}
	const pixelCount = size * size;
	const luminanceMean = luminanceSum / pixelCount;
	let luminanceEntropy = 0;
	for (const count of luminanceBins) {
		if (!count) continue;
		const probability = count / pixelCount;
		luminanceEntropy -= probability * Math.log2(probability);
	}
	return {
		luminanceMean,
		luminanceStd: Math.sqrt(Math.max(luminanceSquaredSum / pixelCount - luminanceMean * luminanceMean, 0)),
		colorMean: colorMean.map(value => value / pixelCount),
		adjacentDifferenceMean: adjacentDifferenceSum / Math.max(adjacentCount, 1),
		extremeEdgeRatio: extremeEdgeCount / Math.max(adjacentCount, 1),
		backgroundTextureMean: borderDifferenceSum / Math.max(borderDifferenceCount, 1),
		luminanceEntropy
	};
}

function compareSamples(reference, candidate) {
	let absoluteDifference = 0;
	let luminanceDifference = 0;
	const pixelCount = reference.length / 3;
	for (let index = 0; index < reference.length; index += 3) {
		absoluteDifference += Math.abs(reference[index] - candidate[index]);
		absoluteDifference += Math.abs(reference[index + 1] - candidate[index + 1]);
		absoluteDifference += Math.abs(reference[index + 2] - candidate[index + 2]);
		const referenceLuma = reference[index] * 0.2126 + reference[index + 1] * 0.7152 + reference[index + 2] * 0.0722;
		const candidateLuma = candidate[index] * 0.2126 + candidate[index + 1] * 0.7152 + candidate[index + 2] * 0.0722;
		luminanceDifference += Math.abs(referenceLuma - candidateLuma);
	}
	return {
		meanAbsoluteColorDifference: absoluteDifference / Math.max(pixelCount * 3, 1),
		meanAbsoluteLuminanceDifference: luminanceDifference / Math.max(pixelCount, 1)
	};
}

function evaluateRevisionQuality(referenceBuffer, candidateBuffer) {
	const reference = decodeImage(referenceBuffer);
	const candidate = decodeImage(candidateBuffer);
	const aspectRatio = candidate.width / candidate.height;
	if (candidate.width < 512 || candidate.height < 512 || aspectRatio < 0.88 || aspectRatio > 1.14) {
		throw qualityGateError('INVALID_DIMENSIONS', { width: candidate.width, height: candidate.height, aspectRatio });
	}
	const referenceSample = sampleImage(reference);
	const candidateSample = sampleImage(candidate);
	const referenceMetrics = analyzeSample(referenceSample);
	const candidateMetrics = analyzeSample(candidateSample);
	const comparison = compareSamples(referenceSample, candidateSample);
	const colorMeanShift = referenceMetrics.colorMean.reduce((sum, value, index) => sum + Math.abs(value - candidateMetrics.colorMean[index]), 0) / 3;
	const metrics = {
		luminanceMean: candidateMetrics.luminanceMean,
		luminanceStd: candidateMetrics.luminanceStd,
		adjacentDifferenceMean: candidateMetrics.adjacentDifferenceMean,
		extremeEdgeRatio: candidateMetrics.extremeEdgeRatio,
		meanAbsoluteColorDifference: comparison.meanAbsoluteColorDifference,
		meanAbsoluteLuminanceDifference: comparison.meanAbsoluteLuminanceDifference,
		colorMeanShift,
		backgroundTextureMean: candidateMetrics.backgroundTextureMean,
		backgroundTextureIncrease: candidateMetrics.backgroundTextureMean - referenceMetrics.backgroundTextureMean,
		luminanceEntropy: candidateMetrics.luminanceEntropy,
		luminanceEntropyIncrease: candidateMetrics.luminanceEntropy - referenceMetrics.luminanceEntropy,
		edgeDensityIncrease: candidateMetrics.extremeEdgeRatio - referenceMetrics.extremeEdgeRatio
	};
	if (candidateMetrics.luminanceMean < 0.025 || candidateMetrics.luminanceMean > 0.985 || candidateMetrics.luminanceStd < 0.008) {
		throw qualityGateError('EXTREME_BRIGHTNESS', metrics);
	}
	if (candidateMetrics.adjacentDifferenceMean > 0.32) throw qualityGateError('EXTREME_NOISE', metrics);
	if (candidateMetrics.extremeEdgeRatio > 0.12) throw qualityGateError('EXTREME_EDGE_DENSITY', metrics);
	if (metrics.backgroundTextureIncrease > 0.16 && candidateMetrics.backgroundTextureMean > 0.2) throw qualityGateError('EXTREME_NOISE', metrics);
	if (metrics.luminanceEntropyIncrease > 1.65 && candidateMetrics.adjacentDifferenceMean > 0.16) throw qualityGateError('EXTREME_NOISE', metrics);
	if (metrics.edgeDensityIncrease > 0.085 && candidateMetrics.extremeEdgeRatio > 0.095) throw qualityGateError('EXTREME_EDGE_DENSITY', metrics);
	if (colorMeanShift > 0.48) throw qualityGateError('EXTREME_COLOR_DRIFT', metrics);
	if (comparison.meanAbsoluteColorDifference > 0.62 || comparison.meanAbsoluteLuminanceDifference > 0.56) {
		throw qualityGateError('EXTREME_STRUCTURAL_CHANGE', metrics);
	}
	return { passed: true, reasonCode: '', metrics };
}

module.exports = { analyzeSample, compareSamples, decodeImage, evaluateRevisionQuality, sampleImage };
