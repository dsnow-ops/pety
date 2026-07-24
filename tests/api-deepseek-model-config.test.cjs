'use strict';

const assert = require('node:assert/strict');
const {
	buildDeepSeekRequestPayload,
	resolveDeepSeekModelConfig
} = require('../uniCloud-alipay/cloudfunctions/api_deepseek/model-config');

const chatAlias = resolveDeepSeekModelConfig('deepseek-chat', { type: 'enabled' });
assert.equal(chatAlias.resolvedModel, 'deepseek-v4-flash');
assert.equal(chatAlias.thinkingType, 'disabled');
assert.equal(chatAlias.legacyAliasApplied, true);

const reasonerAlias = resolveDeepSeekModelConfig('deepseek-reasoner', { type: 'disabled' });
assert.equal(reasonerAlias.resolvedModel, 'deepseek-v4-flash');
assert.equal(reasonerAlias.thinkingType, 'enabled');
assert.equal(reasonerAlias.legacyAliasApplied, true);

const flash = resolveDeepSeekModelConfig('deepseek-v4-flash', { type: 'disabled' });
assert.equal(flash.resolvedModel, 'deepseek-v4-flash');
assert.equal(flash.thinkingType, 'disabled');
assert.equal(flash.legacyAliasApplied, false);

const pro = resolveDeepSeekModelConfig('deepseek-v4-pro', { type: 'enabled' });
assert.equal(pro.resolvedModel, 'deepseek-v4-pro');
assert.equal(pro.thinkingType, 'enabled');
assert.equal(pro.legacyAliasApplied, false);

assert.throws(
	() => resolveDeepSeekModelConfig('deepseek-unknown', { type: 'disabled' }),
	error => error && error.code === 'DEEPSEEK_MODEL_UNSUPPORTED'
);

const payload = buildDeepSeekRequestPayload({
	deepseek: {
		model: chatAlias.resolvedModel,
		thinking: chatAlias.thinking,
		temperature: 0.7,
		maxTokens: 500
	}
}, [{ role: 'user', content: 'test' }]);
assert.equal(payload.model, 'deepseek-v4-flash');
assert.deepEqual(payload.thinking, { type: 'disabled' });
assert.equal(JSON.stringify(payload).includes('deepseek-chat'), false);

console.log('api-deepseek model config tests passed');
