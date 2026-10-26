'use strict';

const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const functionDir = path.join(projectRoot, 'uniCloud-alipay', 'cloudfunctions', 'api_pet_avatar');
const configPath = path.join(functionDir, 'config.json');
const { buildAvatarRevisionPrompt } = require(path.join(functionDir, 'avatar-revision-prompt'));
const { decodeImage, evaluateRevisionQuality } = require(path.join(functionDir, 'image-quality-gate'));
const { createWanTask, extractResultImageUrl, getWanTask } = require(path.join(functionDir, 'wan-client'));

const SOURCE_MIN_BYTES = 64 * 1024;
const SOURCE_MIN_EDGE = 768;
const POLL_INTERVAL_MS = 3000;
const MAX_WAIT_MS = 10 * 60 * 1000;
const REVISION_CASES = [
	'脸再瘦一点，只轻微调整脸部轮廓，其他全部保持不变。',
	'尾巴是纯白色的，没有其他颜色或花纹，只修改尾巴颜色，其他全部保持不变。'
];

function fail(message) {
	console.error(message);
	process.exit(1);
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function download(url, maxBytes = 30 * 1024 * 1024) {
	return new Promise((resolve, reject) => {
		const request = https.get(url, response => {
			if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
				response.resume();
				return download(response.headers.location, maxBytes).then(resolve, reject);
			}
			if (response.statusCode !== 200) {
				response.resume();
				return reject(new Error(`DOWNLOAD_HTTP_${response.statusCode}`));
			}
			const chunks = [];
			let bytes = 0;
			response.on('data', chunk => {
				bytes += chunk.length;
				if (bytes > maxBytes) request.destroy(new Error('DOWNLOAD_TOO_LARGE'));
				else chunks.push(chunk);
			});
			response.on('end', () => resolve(Buffer.concat(chunks)));
		});
		request.setTimeout(30000, () => request.destroy(new Error('DOWNLOAD_TIMEOUT')));
		request.on('error', reject);
	});
}

function inspect(buffer) {
	const image = decodeImage(buffer);
	return {
		bytes: buffer.length,
		width: image.width,
		height: image.height,
		sha256Prefix: crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16)
	};
}

function readConfig() {
	if (!fs.existsSync(configPath)) fail('No ignored api_pet_avatar/config.json was found. Smoke test was not started.');
	const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, ''));
	const config = {
		...fileConfig,
		apiKey: process.env.DASHSCOPE_API_KEY || process.env.WAN_API_KEY || fileConfig.apiKey || '',
		workspaceId: process.env.DASHSCOPE_WORKSPACE_ID || process.env.WAN_WORKSPACE_ID || fileConfig.workspaceId || '',
		requestTimeoutMs: Math.max(Number(fileConfig.requestTimeoutMs) || 25000, 1000),
		n: 1,
		watermark: false
	};
	if (!config.apiKey || !config.workspaceId || !config.model) fail('Wan credentials/model are incomplete. Smoke test was not started.');
	return config;
}

async function waitForResult(config, taskId) {
	const deadline = Date.now() + MAX_WAIT_MS;
	while (Date.now() < deadline) {
		const response = await getWanTask(config, taskId);
		const status = String(response && response.output && response.output.task_status || '').toUpperCase();
		if (status === 'SUCCEEDED') {
			const resultUrl = extractResultImageUrl(response);
			if (!resultUrl) throw new Error('WAN_RESULT_IMAGE_MISSING');
			return { requestId: response.request_id || response.requestId || '', resultUrl };
		}
		if (status === 'FAILED' || status === 'CANCELED' || status === 'UNKNOWN') {
			throw new Error(`WAN_TASK_${status}`);
		}
		await sleep(POLL_INTERVAL_MS);
	}
	throw new Error('WAN_TASK_TIMEOUT');
}

async function main() {
	if (String(process.env.PETY_RUN_PAID_AVATAR_SMOKE || '').toLowerCase() !== 'true') {
		fail('Paid smoke is disabled. Set PETY_RUN_PAID_AVATAR_SMOKE=true explicitly to allow at most two Wan calls.');
	}
	const sourceUrl = String(process.env.PETY_AVATAR_CURRENT_RESULT_URL || '').trim();
	if (!/^https:\/\//i.test(sourceUrl)) fail('PETY_AVATAR_CURRENT_RESULT_URL must be an HTTPS URL for a current full-resolution AI result.');

	const config = readConfig();
	const sourceBuffer = await download(sourceUrl);
	const source = inspect(sourceBuffer);
	if (source.bytes < SOURCE_MIN_BYTES || source.width < SOURCE_MIN_EDGE || source.height < SOURCE_MIN_EDGE) {
		fail(`Revision source rejected before paid calls: ${JSON.stringify(source)}`);
	}
	if (!sourceBuffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
		fail('Revision source rejected before paid calls: source is not a full-resolution PNG.');
	}
	const sourceDataUrl = `data:image/png;base64,${sourceBuffer.toString('base64')}`;

	const report = {
		startedAt: new Date().toISOString(),
		model: config.model,
		source,
		cases: []
	};
	for (const revisionText of REVISION_CASES) {
		const prompt = buildAvatarRevisionPrompt(0, revisionText);
		const created = await createWanTask(config, prompt, [sourceDataUrl], {
			size: '1K',
			seed: Math.floor(Math.random() * 2147483646) + 1,
			n: 1,
			watermark: false,
			enableSequential: false
		});
		if (!created.taskId) throw new Error('WAN_TASK_ID_MISSING');
		const completed = await waitForResult(config, created.taskId);
		const resultBuffer = await download(completed.resultUrl);
		const result = inspect(resultBuffer);
		let qualityGateResult;
		try {
			qualityGateResult = evaluateRevisionQuality(sourceBuffer, resultBuffer);
		} catch (error) {
			qualityGateResult = error.qualityGateResult || { passed: false, reasonCode: error.code || error.message };
		}
		report.cases.push({
			revisionText,
			taskIdHash: crypto.createHash('sha256').update(created.taskId).digest('hex').slice(0, 16),
			requestId: completed.requestId,
			result,
			qualityGateResult
		});
	}
	report.completedAt = new Date().toISOString();
	const reportDir = path.join(projectRoot, 'unpackage', 'reports');
	fs.mkdirSync(reportDir, { recursive: true });
	const reportPath = path.join(reportDir, `pet-avatar-revision-smoke-${Date.now()}.json`);
	fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
	console.log(JSON.stringify({ ok: true, calls: report.cases.length, source: report.source, cases: report.cases, reportPath }, null, 2));
}

main().catch(error => {
	console.error(JSON.stringify({ ok: false, error: error.code || error.message || 'SMOKE_FAILED' }));
	process.exit(1);
});
