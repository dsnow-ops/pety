'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const functionDir = path.join(projectRoot, 'uniCloud-aliyun', 'cloudfunctions', 'api_deepseek');
const localConfigPath = path.join(functionDir, 'config.json');
const commonConfigPath = path.join(
	projectRoot,
	'uniCloud-aliyun',
	'cloudfunctions',
	'common',
	'uni-config-center',
	'api_deepseek',
	'config.json'
);

if (fs.existsSync(localConfigPath) || fs.existsSync(commonConfigPath)) {
	console.error('Refusing to run because a real config.json exists. Move it aside before smoke testing.');
	process.exit(1);
}

const providerNamePattern = /DeepSeek|DEEPSEEK|deepseek/i;
const state = {
	collections: new Map(),
	dbWrites: 0,
	membershipReads: 0,
	httpCalls: 0,
	httpStatusCode: 200
};

function resetState() {
	state.collections = new Map();
	state.dbWrites = 0;
	state.membershipReads = 0;
	state.httpCalls = 0;
	state.httpStatusCode = 200;
}

function writeConfig(config) {
	fs.writeFileSync(localConfigPath, JSON.stringify(config, null, 2), 'utf8');
}

function getCollectionStore(name) {
	if (!state.collections.has(name)) {
		state.collections.set(name, new Map());
	}
	return state.collections.get(name);
}

function clone(value) {
	return JSON.parse(JSON.stringify(value));
}

function applyUpdate(doc, update) {
	for (const [key, value] of Object.entries(update)) {
		if (value && value.__op === 'inc') {
			doc[key] = (doc[key] || 0) + value.value;
		} else {
			doc[key] = value;
		}
	}
}

global.uniCloud = {
	database() {
		const command = {
			inc(value) {
				return { __op: 'inc', value };
			},
			lt(value) {
				return { __op: 'lt', value };
			}
		};

		return {
			command,
			collection(name) {
				const store = getCollectionStore(name);

				return {
					doc(id) {
						return {
							async get() {
								if (name === 'pety_memberships') state.membershipReads += 1;
								const record = store.get(id);
								return { data: record ? [clone(record)] : [] };
							},
							async update(update) {
								const record = store.get(id);
								if (!record) return { updated: 0 };
								applyUpdate(record, update);
								state.dbWrites += 1;
								return { updated: 1 };
							}
						};
					},
					where(query) {
						return {
							async update(update) {
								const record = store.get(query._id);
								if (!record) return { updated: 0 };
								if (query.count && query.count.__op === 'lt' && !(record.count < query.count.value)) {
									return { updated: 0 };
								}
								applyUpdate(record, update);
								state.dbWrites += 1;
								return { updated: 1 };
							}
						};
					},
					async add(doc) {
						if (store.has(doc._id)) {
							const error = new Error('DOCUMENT_EXISTS');
							error.code = 'DOCUMENT_EXISTS';
							throw error;
						}
						store.set(doc._id, clone(doc));
						state.dbWrites += 1;
						return { id: doc._id };
					}
				};
			}
		};
	},
	httpclient: {
		async request() {
			state.httpCalls += 1;
			if (state.httpStatusCode >= 400) {
				return {
					statusCode: state.httpStatusCode,
					data: { error: { message: 'provider denied' } }
				};
			}
			return {
				statusCode: 200,
				data: {
					choices: [
						{ message: { content: 'ok' } }
					]
				}
			};
		}
	}
};

const originalConsoleError = console.error;
console.error = () => {};
const api = require(path.join(functionDir, 'index.js'));

async function call(userMessage, context = { OPENID: 'smoke-openid' }, extra = {}) {
	return api.main({ userMessage, ...extra }, context);
}

function assertNoProviderName(result) {
	const text = JSON.stringify(result);
	assert(!providerNamePattern.test(text), `provider name leaked in user-visible response: ${text}`);
}

async function run() {
	try {
		resetState();
		writeConfig({
			deepseek: {
				provider: 'deepseek',
				apiKey: '',
				baseUrl: 'https://example.invalid',
				model: 'deepseek-chat'
			},
			rateLimit: { enabled: true, freeDailyLimit: 3, plusMonthlyLimit: 300, membershipLookupEnabled: false }
		});
		let result = await call('猫咪今天不吃饭');
		assert.strictEqual(result.code, 500);
		assert(result.msg.includes('AI 服务暂时不可用'));
		assertNoProviderName(result);

		resetState();
		writeConfig({
			deepseek: {
				provider: 'deepseek',
				apiKey: 'SMOKE_FAKE',
				baseUrl: 'https://example.invalid',
				model: 'deepseek-chat'
			},
			rateLimit: { enabled: true, freeDailyLimit: 3, plusMonthlyLimit: 300, membershipLookupEnabled: false }
		});
		result = await call('用户当前问题：股票今天怎么买');
		assert.strictEqual(result.code, 0);
		assert.strictEqual(result.outOfScope, true);
		assert.strictEqual(state.dbWrites, 0);
		assert.strictEqual(state.httpCalls, 0);

		resetState();
		for (let index = 0; index < 3; index += 1) {
			result = await call('猫咪今天不吃饭', { OPENID: 'free-default' });
			assert.strictEqual(result.code, 0);
			assert.strictEqual(result.plan, 'free');
		}
		result = await call('猫咪今天不吃饭', { OPENID: 'free-default' });
		assert.strictEqual(result.code, 429);
		assert.strictEqual(state.httpCalls, 3);
		assertNoProviderName(result);

		resetState();
		writeConfig({
			deepseek: {
				provider: 'deepseek',
				apiKey: 'SMOKE_FAKE',
				baseUrl: 'https://example.invalid',
				model: 'deepseek-chat'
			},
			rateLimit: { enabled: true, freeDailyLimit: 1, plusMonthlyLimit: 300, membershipLookupEnabled: false }
		});
		result = await call('猫咪今天不吃饭', { OPENID: 'free-one' });
		assert.strictEqual(result.code, 0);
		result = await call('猫咪今天不吃饭', { OPENID: 'free-one' });
		assert.strictEqual(result.code, 429);

		resetState();
		writeConfig({
			deepseek: {
				provider: 'deepseek',
				apiKey: 'SMOKE_FAKE',
				baseUrl: 'https://example.invalid',
				model: 'deepseek-chat'
			},
			rateLimit: { enabled: true, freeDailyLimit: 3, plusMonthlyLimit: 300, membershipLookupEnabled: false }
		});
		for (let index = 0; index < 4; index += 1) {
			result = await call('猫咪今天不吃饭', { OPENID: 'frontend-plus' }, { localPlan: 'plus', isPlus: true });
		}
		assert.strictEqual(result.code, 429);
		assert.strictEqual(state.membershipReads, 0);

		resetState();
		state.httpStatusCode = 401;
		result = await call('猫咪今天不吃饭', { OPENID: 'provider-error' });
		assert.strictEqual(result.code, 502);
		assertNoProviderName(result);

		console.error = originalConsoleError;
		console.log('api_deepseek smoke tests passed');
	} finally {
		console.error = originalConsoleError;
		if (fs.existsSync(localConfigPath)) {
			fs.unlinkSync(localConfigPath);
		}
	}
}

run().catch(error => {
	console.error = originalConsoleError;
	console.error(error && error.stack ? error.stack : error);
	if (fs.existsSync(localConfigPath)) {
		fs.unlinkSync(localConfigPath);
	}
	process.exit(1);
});
