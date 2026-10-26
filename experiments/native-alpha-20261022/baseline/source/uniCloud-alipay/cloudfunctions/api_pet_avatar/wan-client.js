'use strict';

const https = require('https');

function requestJson(url, options, body, timeoutMs) {
	return new Promise((resolve, reject) => {
		const request = https.request(url, options, response => {
			const chunks = [];
			response.on('data', chunk => chunks.push(chunk));
			response.on('end', () => {
				const raw = Buffer.concat(chunks).toString('utf8');
				let parsed = {};
				try {
					parsed = raw ? JSON.parse(raw) : {};
				} catch (error) {
					const invalid = new Error('WAN_INVALID_RESPONSE');
					invalid.statusCode = response.statusCode;
					return reject(invalid);
				}
				if (response.statusCode < 200 || response.statusCode >= 300) {
					const providerError = new Error(String(parsed.message || parsed.code || 'WAN_REQUEST_FAILED'));
					providerError.code = 'WAN_REQUEST_FAILED';
					providerError.statusCode = response.statusCode;
					providerError.providerCode = String(parsed.code || '');
					providerError.providerMessage = String(parsed.message || '');
					providerError.providerRequestId = String(parsed.request_id || parsed.requestId || '');
					return reject(providerError);
				}
				resolve(parsed);
			});
		});
		request.setTimeout(timeoutMs, () => request.destroy(new Error('WAN_REQUEST_TIMEOUT')));
		request.on('error', reject);
		if (body) request.write(JSON.stringify(body));
		request.end();
	});
}

function getBaseUrl(config) {
	return `https://${config.workspaceId}.cn-beijing.maas.aliyuncs.com/api/v1`;
}

function buildWanPayload(config, prompt, imageUrls, options = {}) {
	const parameters = {
		size: options.size || config.size,
		n: options.n === undefined ? config.n : options.n,
		watermark: options.watermark === undefined ? config.watermark : options.watermark,
		enable_sequential: options.enableSequential === true,
		seed: options.seed
	};
	if (Array.isArray(options.bboxList) && options.bboxList.length) {
		parameters.bbox_list = options.bboxList;
	}
	return {
		model: config.model,
		input: {
			messages: [{
				role: 'user',
				content: imageUrls.map(image => ({ image })).concat({ text: prompt })
			}]
		},
		parameters
	};
}

async function createWanTask(config, prompt, imageUrls, options = {}) {
	const payload = buildWanPayload(config, prompt, imageUrls, options);
	const response = await requestJson(
		`${getBaseUrl(config)}/services/aigc/image-generation/generation`,
		{
			method: 'POST',
			headers: {
				Authorization: `Bearer ${config.apiKey}`,
				'Content-Type': 'application/json',
				'X-DashScope-Async': 'enable'
			}
		},
		payload,
		config.requestTimeoutMs
	);
	return {
		requestId: response.request_id || response.requestId || '',
		taskId: response.output && response.output.task_id,
		taskStatus: response.output && response.output.task_status,
		raw: response
	};
}

async function getWanTask(config, taskId) {
	return requestJson(
		`${getBaseUrl(config)}/tasks/${encodeURIComponent(taskId)}`,
		{
			method: 'GET',
			headers: { Authorization: `Bearer ${config.apiKey}` }
		},
		null,
		config.requestTimeoutMs
	);
}

function extractResultImageUrl(response) {
	const choices = response && response.output && response.output.choices;
	if (!Array.isArray(choices)) return '';
	for (const choice of choices) {
		const content = choice && choice.message && choice.message.content;
		if (!Array.isArray(content)) continue;
		const image = content.find(item => item && item.type === 'image' && /^https:\/\//i.test(item.image || ''));
		if (image) return image.image;
	}
	return '';
}

module.exports = {
	buildWanPayload,
	createWanTask,
	extractResultImageUrl,
	getWanTask
};
