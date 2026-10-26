'use strict';

const TERMINAL_FAILURES = ['PROCESS_FAILED', 'TIMEOUT_FAILED', 'LIMIT_RETRY_FAILED'];

function parseResult(value) {
	if (value && typeof value === 'object') return value;
	try { return JSON.parse(String(value || '{}')); } catch (error) { return {}; }
}

function getResultUrl(value) {
	const parsed = parseResult(value);
	const url = parsed.ImageUrl || parsed.ImageURL || parsed.imageUrl || parsed.imageURL || '';
	return /^https?:\/\//i.test(url) ? url : '';
}

function createRpcClient(config, endpoint, apiVersion) {
	// Lazy load keeps the cloud function testable when optional provider dependencies are not installed locally.
	const RPCClient = require('@alicloud/pop-core');
	return new RPCClient({
		accessKeyId: config.viapiAccessKeyId,
		accessKeySecret: config.viapiAccessKeySecret,
		endpoint,
		apiVersion
	});
}

async function submitTransparentCutout(config, imageUrl) {
	if (!config.viapiEnabled) return { status: 'NOT_CONFIGURED' };
	if (config.cutoutProvider !== 'aliyun-viapi') return { status: 'NOT_CONFIGURED' };
	if (!config.viapiAccessKeyId || !config.viapiAccessKeySecret) return { status: 'NOT_CONFIGURED' };
	if (!/^https?:\/\//i.test(String(imageUrl || ''))) {
		const error = new Error('CUTOUT_SOURCE_URL_INVALID');
		error.code = 'CUTOUT_SOURCE_URL_INVALID';
		throw error;
	}

	const imageseg = createRpcClient(config, 'https://imageseg.cn-shanghai.aliyuncs.com', '2019-12-30');
	const submitted = await imageseg.request('SegmentHDCommonImage', { ImageUrl: imageUrl }, { method: 'POST' });
	const immediateUrl = getResultUrl(submitted && submitted.Data);
	if (immediateUrl) return { status: 'SUCCEEDED', resultUrl: immediateUrl, providerJobId: submitted.RequestId || '' };

	const providerJobId = String(submitted && submitted.RequestId || '');
	if (!providerJobId) {
		const error = new Error('CUTOUT_JOB_ID_MISSING');
		error.code = 'CUTOUT_JOB_ID_MISSING';
		throw error;
	}
	return { status: 'RUNNING', providerJobId };
}

async function getTransparentCutoutStatus(config, providerJobId) {
	const jobId = String(providerJobId || '').trim();
	if (!config.viapiEnabled || config.cutoutProvider !== 'aliyun-viapi' || !config.viapiAccessKeyId || !config.viapiAccessKeySecret) {
		return { status: 'NOT_CONFIGURED' };
	}
	if (!jobId) {
		const error = new Error('CUTOUT_JOB_ID_MISSING');
		error.code = 'CUTOUT_JOB_ID_MISSING';
		throw error;
	}
	const viapi = createRpcClient(config, 'https://viapi.cn-shanghai.aliyuncs.com', '2023-01-17');
	const response = await viapi.request('GetAsyncJobResult', { JobId: jobId }, { method: 'POST' });
	const data = response && response.Data || {};
	const status = String(data.Status || '').toUpperCase();
	if (status === 'PROCESS_SUCCESS') {
		const resultUrl = getResultUrl(data.Result);
		if (!resultUrl) {
			const error = new Error('CUTOUT_RESULT_URL_MISSING');
			error.code = 'CUTOUT_RESULT_URL_MISSING';
			throw error;
		}
		return { status: 'SUCCEEDED', resultUrl, providerJobId: jobId };
	}
	if (TERMINAL_FAILURES.includes(status)) return { status: 'FAILED', providerJobId: jobId, providerStatus: status };
	return { status: 'RUNNING', providerJobId: jobId, providerStatus: status || 'PROCESSING' };
}

module.exports = { getResultUrl, getTransparentCutoutStatus, parseResult, submitTransparentCutout };
