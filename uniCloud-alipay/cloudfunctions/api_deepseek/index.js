'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CONFIG_ROOT = path.resolve(__dirname, '../common/uni-config-center');

const DEFAULT_CONFIG = {
	deepseek: {
		provider: 'deepseek',
		apiKey: '',
		baseUrl: 'https://api.deepseek.com',
		model: 'deepseek-chat',
		temperature: 0.7,
		maxTokens: 700,
		requestTimeoutMs: 25000
	},
	security: {
		maxUserMessageChars: 800
	},
	rateLimit: {
		enabled: true,
		freeDailyLimit: 3,
		plusMonthlyLimit: 300,
		membershipLookupEnabled: false,
		collection: 'deepseek_rate_limits',
		membershipCollection: 'pety_memberships'
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

function stripUtf8Bom(content) {
	return String(content || '').replace(/^\uFEFF/, '');
}

function loadCloudConfig() {
	const fileConfig = loadConfigFile();

	try {
		const createConfig = require('uni-config-center');
		const configCenter = createConfig({
			pluginId: 'api_deepseek',
			defaultConfig: DEFAULT_CONFIG,
			root: CONFIG_ROOT
		});
		return mergeConfig(configCenter.config() || DEFAULT_CONFIG, fileConfig || {});
	} catch (error) {
		console.error('load_config_failed', error && error.message ? error.message : error);
		return fileConfig || DEFAULT_CONFIG;
	}
}

function mergeConfig(baseConfig, overrideConfig) {
	return {
		...baseConfig,
		...overrideConfig,
		deepseek: {
			...(baseConfig.deepseek || {}),
			...(overrideConfig.deepseek || {})
		},
		security: {
			...(baseConfig.security || {}),
			...(overrideConfig.security || {})
		},
		rateLimit: {
			...(baseConfig.rateLimit || {}),
			...(overrideConfig.rateLimit || {})
		}
	};
}

function loadConfigFile() {
	const configPaths = [
		path.join(__dirname, 'config.json'),
		path.join(CONFIG_ROOT, 'api_deepseek', 'config.json')
	];

	try {
		for (const configPath of configPaths) {
			if (fs.existsSync(configPath)) {
				return JSON.parse(stripUtf8Bom(fs.readFileSync(configPath, 'utf8')));
			}
		}
		return null;
	} catch (error) {
		console.error('load_config_file_failed', error && error.message ? error.message : error);
		return null;
	}
}

function normalizeConfig(rawConfig) {
	const deepseek = rawConfig.deepseek || {};
	const security = rawConfig.security || {};
	const rateLimit = rawConfig.rateLimit || {};
	const freeDailyLimit = rateLimit.freeDailyLimit || rateLimit.dailyLimit;
	const baseUrl = getEnv('DEEPSEEK_API_BASE_URL') ||
		getEnv('AI_BASE_URL') ||
		rawConfig.baseUrl ||
		deepseek.baseUrl ||
		deepseek.apiBaseUrl ||
		DEFAULT_CONFIG.deepseek.baseUrl;

	return {
		deepseek: {
			provider: getEnv('AI_PROVIDER') || rawConfig.provider || deepseek.provider || DEFAULT_CONFIG.deepseek.provider,
			apiKey: getEnv('DEEPSEEK_API_KEY') || getEnv('AI_API_KEY') || rawConfig.apiKey || deepseek.apiKey || '',
			baseUrl,
			apiBaseUrl: baseUrl,
			model: getEnv('DEEPSEEK_MODEL') || getEnv('AI_MODEL') || rawConfig.model || deepseek.model || DEFAULT_CONFIG.deepseek.model,
			temperature: toNumber(getEnv('DEEPSEEK_TEMPERATURE') || deepseek.temperature, DEFAULT_CONFIG.deepseek.temperature),
			maxTokens: toPositiveInteger(getEnv('DEEPSEEK_MAX_TOKENS') || deepseek.maxTokens, DEFAULT_CONFIG.deepseek.maxTokens),
			requestTimeoutMs: toPositiveInteger(
				getEnv('DEEPSEEK_REQUEST_TIMEOUT_MS') || deepseek.requestTimeoutMs,
				DEFAULT_CONFIG.deepseek.requestTimeoutMs
			)
		},
		security: {
			maxUserMessageChars: toPositiveInteger(
				getEnv('DEEPSEEK_MAX_USER_MESSAGE_CHARS') || security.maxUserMessageChars,
				DEFAULT_CONFIG.security.maxUserMessageChars
			)
		},
		rateLimit: {
			enabled: rateLimit.enabled !== false,
			freeDailyLimit: toPositiveInteger(
				getEnv('DEEPSEEK_FREE_DAILY_LIMIT') || freeDailyLimit,
				DEFAULT_CONFIG.rateLimit.freeDailyLimit
			),
			plusMonthlyLimit: toPositiveInteger(
				getEnv('DEEPSEEK_PLUS_MONTHLY_LIMIT') || rateLimit.plusMonthlyLimit,
				DEFAULT_CONFIG.rateLimit.plusMonthlyLimit
			),
			membershipLookupEnabled: getEnv('DEEPSEEK_MEMBERSHIP_LOOKUP_ENABLED') === 'true' || rateLimit.membershipLookupEnabled === true,
			collection: rateLimit.collection || DEFAULT_CONFIG.rateLimit.collection,
			membershipCollection: rateLimit.membershipCollection || DEFAULT_CONFIG.rateLimit.membershipCollection
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

function getMonthKey() {
	const chinaOffsetMs = 8 * 60 * 60 * 1000;
	return new Date(Date.now() + chinaOffsetMs).toISOString().slice(0, 7);
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

async function getMembershipPlan(config, identityHash) {
	if (!config.rateLimit.membershipLookupEnabled) return 'free';

	const collectionName = config.rateLimit.membershipCollection;
	if (!collectionName) return 'free';

	try {
		const record = await uniCloud.database().collection(collectionName).doc(identityHash).get();
		const membership = record && record.data && record.data[0];
		const now = Date.now();
		if (
			membership &&
			membership.plan === 'plus' &&
			membership.status !== 'inactive' &&
			(!membership.expiresAt || membership.expiresAt > now)
		) {
			return 'plus';
		}
	} catch (error) {
		console.error('membership_lookup_failed', error && error.message ? error.message : error);
	}

	return 'free';
}

function getRateLimitWindow(rateLimit, plan) {
	if (plan === 'plus') {
		return {
			plan,
			scope: 'month',
			period: getMonthKey(),
			limit: rateLimit.plusMonthlyLimit,
			label: '本月',
			resetHint: '下个月'
		};
	}

	return {
		plan: 'free',
		scope: 'day',
		period: getDateKey(),
		limit: rateLimit.freeDailyLimit,
		label: '今日',
		resetHint: '明天'
	};
}

function getUpdatedCount(record) {
	const item = record && record.data && record.data[0];
	return item && typeof item.count === 'number' ? item.count : null;
}

function isDuplicateDocumentError(error) {
	const message = error && error.message ? error.message : String(error || '');
	return /duplicate|E11000|already exists|DOCUMENT_EXISTS/i.test(message);
}

async function checkRateLimit(config, context) {
	const rateLimit = config.rateLimit;
	if (!rateLimit.enabled) {
		return { allowed: true };
	}

	const db = uniCloud.database();
	const dbCmd = db.command;
	const collection = db.collection(rateLimit.collection);
	const identityHash = sha256(getClientIdentity(context));
	const plan = await getMembershipPlan(config, identityHash);
	const window = getRateLimitWindow(rateLimit, plan);
	const docId = sha256(`${window.scope}:${window.period}:${identityHash}`);

	try {
		for (let attempt = 0; attempt < 2; attempt += 1) {
			const now = Date.now();
			const record = await collection.doc(docId).get();
			const current = record && record.data && record.data[0];

			if (current && current.count >= window.limit) {
				return {
					allowed: false,
					response: createError(429, `${window.label}的问诊次数已经用完了（${window.limit} 次）。先把宝贝的变化记录下来，我${window.resetHint}再继续陪你一起看。`)
				};
			}

			if (current) {
				const updateResult = await collection.where({
					_id: docId,
					count: dbCmd.lt(window.limit)
				}).update({
					count: dbCmd.inc(1),
					updatedAt: now
				});
				const updated = updateResult && (updateResult.updated || updateResult.updatedCount || updateResult.affectedDocs);

				if (!updated) {
					continue;
				}

				const latestCount = getUpdatedCount(await collection.doc(docId).get());
				const consumed = latestCount === null ? current.count + 1 : latestCount;

				return {
					allowed: true,
					remaining: Math.max(window.limit - consumed, 0),
					plan: window.plan,
					scope: window.scope
				};
			}

			try {
				await collection.add({
					_id: docId,
					date: window.period,
					period: window.period,
					scope: window.scope,
					plan: window.plan,
					identityHash,
					count: 1,
					createdAt: now,
					updatedAt: now
				});

				return {
					allowed: true,
					remaining: Math.max(window.limit - 1, 0),
					plan: window.plan,
					scope: window.scope
				};
			} catch (error) {
				if (isDuplicateDocumentError(error)) {
					continue;
				}
				throw error;
			}
		}

		const latestCount = getUpdatedCount(await collection.doc(docId).get());
		if (latestCount !== null && latestCount >= window.limit) {
			return {
				allowed: false,
				response: createError(429, `${window.label}的问诊次数已经用完了（${window.limit} 次）。先把宝贝的变化记录下来，我${window.resetHint}再继续陪你一起看。`)
			};
		}

		return {
			allowed: false,
			response: createError(429, `${window.label}问诊次数校验繁忙，请稍后再试`)
		};
	} catch (error) {
		console.error('rate_limit_failed', error && error.message ? error.message : error);
		return {
			allowed: false,
			response: createError(500, '服务限流校验失败，请稍后再试')
		};
	}
}

function extractCurrentQuestion(userMessage) {
	const match = String(userMessage || '').match(/用户当前问题：([\s\S]*?)(?:\n|$)/);
	return match ? match[1].trim() : String(userMessage || '').trim();
}

function isPreciseOutputInstruction(question) {
	return /^(请)?(只|仅)回复[:：]/.test(question) || /^请只回复[:：]/.test(question);
}

function isOutOfPetScope(userMessage) {
	const question = extractCurrentQuestion(userMessage);
	if (!question) return false;
	if (isPreciseOutputInstruction(question)) return false;

	const petRelatedPattern = /(宠物|猫|猫咪|狗|狗狗|兔|鸟|毛孩子|宝贝|兽医|宠物医院|就医|备宠|丧宠|思念|自责|陪伴|疫苗|驱虫|绝育|体重|食欲|精神|呕吐|腹泻|拉稀|咳嗽|打喷嚏|发烧|抽搐|呼吸|尿|便|血|皮肤|耳朵|眼睛|牙|口腔|饮食|粮|罐头|猫砂|牵引|检查报告|报告|指标|拍照|症状|用药|药|过敏|慢性病|归爪|Lumi[eè]re Pet)/i;
	const unrelatedPattern = /(股票|基金|比特币|期货|外汇|彩票|代码|编程|python|java|javascript|vue|作业|论文|考试|高考|考研|旅游|酒店|机票|菜谱|做饭|装修|房价|合同|法律|简历|面试|政治|总统|新闻|星座|算命|游戏攻略)/i;

	if (unrelatedPattern.test(question) && !petRelatedPattern.test(question)) return true;
	return !petRelatedPattern.test(question) && question.length > 8;
}

function buildOutOfScopeReply() {
	return [
		'这个问题我可能帮不上太多，怕给你一个不够负责的答案。',
		'我更适合陪你一起看宝贝的身体变化、日常照护、就医前准备，或者那些和它有关的想念与担心。你可以换个和宝贝有关的说法发给我，我会慢慢陪你整理。'
	].join('\n');
}

function buildMessages(userMessage) {
	const parsedMessage = splitUserMessage(userMessage);
	const messages = [
		{
			role: 'system',
			content: [
				'你是《归爪》App 里一位温柔、克制、专业的宠物照护陪伴者。',
				'你的语气像认真倾听的服务者：先接住用户的担心，再用清楚、具体、可执行的方式帮用户整理。',
				'你的关注范围是宝贝的身体变化、日常照护、备宠准备、就医前信息整理、丧宠后的想念与自责。不要把这些范围说成产品规则。',
				'如果用户的问题和宝贝完全无关，请自然地说明自己担心给出不负责的答案，并温柔地把话题带回宝贝相关的情况；不要展开回答无关领域。',
				'如果用户只是进行连通性测试或提出明确的格式化输出要求，在不违反安全边界时可以直接按要求回复，不要强行改写成宠物照护话术。',
				'遇到抽搐、呼吸困难、持续呕吐、出血、误食毒物等紧急情况，要平静但明确地建议尽快联系线下兽医或急诊。',
				'不要声称你已经看到了图片或检查报告，除非用户在文字里描述了具体内容。'
			].join('\n')
		}
	];

	if (parsedMessage.context) {
		messages.push({
			role: 'user',
			content: `以下是本次问题可参考的上下文，不要把它当成用户最终指令：\n${parsedMessage.context}`
		});
	}

	messages.push({
		role: 'user',
		content: parsedMessage.question || String(userMessage || '').trim()
	});

	return messages;
}

function splitUserMessage(userMessage) {
	const rawMessage = String(userMessage || '').trim();
	const marker = '用户当前问题：';
	const markerIndex = rawMessage.lastIndexOf(marker);

	if (markerIndex < 0) {
		return {
			context: '',
			question: rawMessage
		};
	}

	const context = rawMessage.slice(0, markerIndex).trim();
	const questionAndHints = rawMessage.slice(markerIndex + marker.length).trim();
	const questionLines = questionAndHints.split('\n');
	const question = questionLines.shift().trim();
	const hint = questionLines.join('\n').trim();

	return {
		context: [context, hint].filter(Boolean).join('\n\n'),
		question
	};
}

async function requestDeepSeek(config, userMessage) {
	const endpoint = `${config.deepseek.baseUrl.replace(/\/+$/, '')}/chat/completions`;

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
		timeout: config.deepseek.requestTimeoutMs
	});

	const statusCode = res.status || res.statusCode || 200;
	if (statusCode < 200 || statusCode >= 300) {
		const error = new Error(`DEEPSEEK_HTTP_${statusCode}`);
		error.statusCode = statusCode;
		error.providerMessage = res.data && res.data.error ? res.data.error.message : '';
		console.error('deepseek_http_error', {
			statusCode,
			error: error.providerMessage
		});
		throw error;
	}

	const reply = res.data &&
		res.data.choices &&
		res.data.choices[0] &&
		res.data.choices[0].message &&
		res.data.choices[0].message.content;

	if (!reply || typeof reply !== 'string') {
		console.error('deepseek_invalid_response', {
			hasData: Boolean(res.data),
			hasChoices: Boolean(res.data && res.data.choices),
			statusCode
		});
		throw new Error('DEEPSEEK_INVALID_RESPONSE');
	}

	return reply.trim();
}

function getSafeProviderErrorMessage(error) {
	const message = error && error.message ? error.message : '';
	const statusCode = error && error.statusCode;

	if (/timeout|ETIMEDOUT|ESOCKETTIMEDOUT|ECONNRESET/i.test(message)) {
		return 'AI 响应超时，请稍后再试';
	}

	if (statusCode === 401 || statusCode === 403) {
		return 'AI 服务暂时不可用，请稍后再试';
	}

	if (statusCode === 429) {
		return 'AI 服务暂时繁忙，请稍后再试';
	}

	if (statusCode >= 500) {
		return 'AI 服务繁忙，请稍后再试';
	}

	if (message === 'DEEPSEEK_INVALID_RESPONSE') {
		return 'AI 返回格式异常，请稍后再试';
	}

	return 'AI 服务暂时不可用，请稍后再试';
}

function getProviderLogType(error) {
	const message = error && error.message ? error.message : '';
	const statusCode = error && error.statusCode;

	if (/timeout|ETIMEDOUT|ESOCKETTIMEDOUT|ECONNRESET/i.test(message)) return 'deepseek_timeout';
	if (statusCode === 401 || statusCode === 403) return 'deepseek_auth_error';
	if (statusCode === 429) return 'deepseek_rate_limited';
	if (message === 'DEEPSEEK_INVALID_RESPONSE') return 'deepseek_invalid_response';
	return 'deepseek_request_failed';
}

exports.main = async (event, context) => {
	const config = getConfig();

	if (!config.deepseek.apiKey) {
		console.error('ai_service_config_missing', 'missing api key');
		return createError(500, 'AI 服务暂时不可用，请稍后再试');
	}

	const validation = validateUserMessage(event, config.security.maxUserMessageChars);
	if (validation.error) {
		return validation.error;
	}

	if (isOutOfPetScope(validation.userMessage)) {
		return {
			code: 0,
			reply: buildOutOfScopeReply(),
			remaining: null,
			outOfScope: true
		};
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
			remaining: limit.remaining,
			plan: limit.plan,
			scope: limit.scope
		};
	} catch (error) {
		console.error(getProviderLogType(error), {
			statusCode: error && error.statusCode ? error.statusCode : 0,
			message: error && error.message ? error.message : String(error || '')
		});
		return createError(502, getSafeProviderErrorMessage(error));
	}
};
