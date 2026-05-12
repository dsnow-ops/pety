'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CONFIG_ROOT = path.resolve(__dirname, '../common/uni-config-center');

const DEFAULT_CONFIG = {
	deepseek: {
		apiKey: '',
		apiBaseUrl: 'https://api.deepseek.com',
		model: 'deepseek-chat',
		temperature: 0.7,
		maxTokens: 1000
	},
	security: {
		maxUserMessageChars: 1200
	},
	rateLimit: {
		enabled: true,
		dailyLimit: 30,
		collection: 'deepseek_rate_limits'
	}
};

function getEnv(name) {
	if (typeof process === 'undefined' || !process.env) return '';
	return process.env[name] || '';
}

function toNumber(value, fallback) {
	const num = Number(value);
	return Number.isFinite(num) ? num : fallback;
}

function toPositiveInteger(value, fallback) {
	const num = Number(value);
	return Number.isInteger(num) && num > 0 ? num : fallback;
}

function loadCloudConfig() {
	try {
		const createConfig = require('uni-config-center');
		const configCenter = createConfig({
			pluginId: 'api_deepseek',
			defaultConfig: DEFAULT_CONFIG,
			root: CONFIG_ROOT
		});
		return configCenter.config() || DEFAULT_CONFIG;
	} catch (error) {
		console.error('load_config_failed', error && error.message ? error.message : error);
		return loadConfigFile() || DEFAULT_CONFIG;
	}
}

function loadConfigFile() {
	const configPath = path.join(CONFIG_ROOT, 'api_deepseek', 'config.json');
	try {
		if (!fs.existsSync(configPath)) return null;
		return JSON.parse(fs.readFileSync(configPath, 'utf8'));
	} catch (error) {
		console.error('load_config_file_failed', error && error.message ? error.message : error);
		return null;
	}
}

function normalizeConfig(rawConfig) {
	const deepseek = rawConfig.deepseek || {};
	const security = rawConfig.security || {};
	const rateLimit = rawConfig.rateLimit || {};

	return {
		deepseek: {
			apiKey: getEnv('DEEPSEEK_API_KEY') || deepseek.apiKey || '',
			apiBaseUrl: getEnv('DEEPSEEK_API_BASE_URL') || deepseek.apiBaseUrl || DEFAULT_CONFIG.deepseek.apiBaseUrl,
			model: getEnv('DEEPSEEK_MODEL') || deepseek.model || DEFAULT_CONFIG.deepseek.model,
			temperature: toNumber(getEnv('DEEPSEEK_TEMPERATURE') || deepseek.temperature, DEFAULT_CONFIG.deepseek.temperature),
			maxTokens: toPositiveInteger(getEnv('DEEPSEEK_MAX_TOKENS') || deepseek.maxTokens, DEFAULT_CONFIG.deepseek.maxTokens)
		},
		security: {
			maxUserMessageChars: toPositiveInteger(
				getEnv('DEEPSEEK_MAX_USER_MESSAGE_CHARS') || security.maxUserMessageChars,
				DEFAULT_CONFIG.security.maxUserMessageChars
			)
		},
		rateLimit: {
			enabled: rateLimit.enabled !== false,
			dailyLimit: toPositiveInteger(getEnv('DEEPSEEK_DAILY_LIMIT') || rateLimit.dailyLimit, DEFAULT_CONFIG.rateLimit.dailyLimit),
			collection: rateLimit.collection || DEFAULT_CONFIG.rateLimit.collection
		}
	};
}

function getConfig() {
	return normalizeConfig(loadCloudConfig());
}

function createError(code, msg) {
	return { code, msg };
}

function validateUserMessage(event, maxLength) {
	if (!event || typeof event.userMessage !== 'string') {
		return { error: createError(400, '缺少 userMessage 参数') };
	}

	const userMessage = event.userMessage.trim();
	if (!userMessage) {
		return { error: createError(400, 'userMessage 不能为空') };
	}

	if (userMessage.length > maxLength) {
		return { error: createError(400, `单次提问不能超过 ${maxLength} 个字符`) };
	}

	return { userMessage };
}

function sha256(value) {
	return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function getDateKey() {
	const chinaOffsetMs = 8 * 60 * 60 * 1000;
	return new Date(Date.now() + chinaOffsetMs).toISOString().slice(0, 10);
}

function getClientIdentity(context) {
	const candidates = [
		context && context.OPENID,
		context && context.UID,
		context && context.UNI_ID_TOKEN,
		context && context.DEVICEID,
		context && context.CLIENTIP,
		context && context.clientIP
	];

	const identity = candidates.find(item => typeof item === 'string' && item.trim());
	return identity || 'anonymous';
}

async function checkRateLimit(config, context) {
	const rateLimit = config.rateLimit;
	if (!rateLimit.enabled) {
		return { allowed: true };
	}

	const db = uniCloud.database();
	const dbCmd = db.command;
	const collection = db.collection(rateLimit.collection);
	const date = getDateKey();
	const identityHash = sha256(getClientIdentity(context));
	const docId = sha256(`${date}:${identityHash}`);
	const now = Date.now();

	try {
		const record = await collection.doc(docId).get();
		const current = record && record.data && record.data[0];

		if (current && current.count >= rateLimit.dailyLimit) {
			return {
				allowed: false,
				response: createError(429, `今日 AI 调用次数已达上限（${rateLimit.dailyLimit} 次），请明天再试`)
			};
		}

		if (current) {
			await collection.doc(docId).update({
				count: dbCmd.inc(1),
				updatedAt: now
			});
			return {
				allowed: true,
				remaining: Math.max(rateLimit.dailyLimit - current.count - 1, 0)
			};
		}

		await collection.add({
			_id: docId,
			date,
			identityHash,
			count: 1,
			createdAt: now,
			updatedAt: now
		});

		return {
			allowed: true,
			remaining: Math.max(rateLimit.dailyLimit - 1, 0)
		};
	} catch (error) {
		console.error('rate_limit_failed', error && error.message ? error.message : error);
		return {
			allowed: false,
			response: createError(500, '服务限流校验失败，请稍后再试')
		};
	}
}

function buildMessages(userMessage) {
	return [
		{
			role: 'system',
			content: [
				'你是《归爪》App 的宠物健康与陪伴助手。',
				'回答要温和、清晰、具体，优先给出可执行建议。',
				'你不能替代线下兽医；遇到抽搐、呼吸困难、持续呕吐、出血、误食毒物等紧急情况，必须建议立即就医。',
				'不要声称你已经看到了图片或检查报告，除非用户在文字里描述了具体内容。'
			].join('\n')
		},
		{
			role: 'user',
			content: userMessage
		}
	];
}

async function requestDeepSeek(config, userMessage) {
	const endpoint = `${config.deepseek.apiBaseUrl.replace(/\/+$/, '')}/chat/completions`;

	const res = await uniCloud.httpclient.request(endpoint, {
		method: 'POST',
		data: {
			model: config.deepseek.model,
			messages: buildMessages(userMessage),
			temperature: config.deepseek.temperature,
			max_tokens: config.deepseek.maxTokens
		},
		contentType: 'json',
		dataType: 'json',
		headers: {
			Authorization: `Bearer ${config.deepseek.apiKey}`,
			'Content-Type': 'application/json'
		},
		timeout: 30000
	});

	const statusCode = res.status || res.statusCode || 200;
	if (statusCode < 200 || statusCode >= 300) {
		console.error('deepseek_http_error', {
			statusCode,
			error: res.data && res.data.error ? res.data.error.message : undefined
		});
		throw new Error('DEEPSEEK_HTTP_ERROR');
	}

	const reply = res.data &&
		res.data.choices &&
		res.data.choices[0] &&
		res.data.choices[0].message &&
		res.data.choices[0].message.content;

	if (!reply || typeof reply !== 'string') {
		console.error('deepseek_invalid_response', res.data);
		throw new Error('DEEPSEEK_INVALID_RESPONSE');
	}

	return reply.trim();
}

exports.main = async (event, context) => {
	const config = getConfig();

	if (!config.deepseek.apiKey) {
		return createError(500, 'DeepSeek API Key 未配置');
	}

	const validation = validateUserMessage(event, config.security.maxUserMessageChars);
	if (validation.error) {
		return validation.error;
	}

	const limit = await checkRateLimit(config, context);
	if (!limit.allowed) {
		return limit.response;
	}

	try {
		const reply = await requestDeepSeek(config, validation.userMessage);
		return {
			code: 0,
			reply,
			remaining: limit.remaining
		};
	} catch (error) {
		console.error('deepseek_request_failed', error && error.message ? error.message : error);
		return createError(502, 'AI 服务暂时不可用，请稍后再试');
	}
};
