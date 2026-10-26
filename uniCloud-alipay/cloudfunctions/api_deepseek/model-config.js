'use strict';

const SUPPORTED_MODELS = new Set(['deepseek-v4-flash', 'deepseek-v4-pro']);
const SUPPORTED_THINKING_TYPES = new Set(['disabled', 'enabled']);

function normalizeThinkingType(value, fallback = 'disabled') {
	const rawType = value && typeof value === 'object' ? value.type : value;
	const type = String(rawType || fallback).trim().toLowerCase();
	return SUPPORTED_THINKING_TYPES.has(type) ? type : fallback;
}

function resolveDeepSeekModelConfig(configuredModel, configuredThinking) {
	const model = String(configuredModel || '').trim();
	let resolvedModel = model;
	let thinkingType = normalizeThinkingType(configuredThinking);
	let legacyAliasApplied = false;

	if (model === 'deepseek-chat') {
		resolvedModel = 'deepseek-v4-flash';
		thinkingType = 'disabled';
		legacyAliasApplied = true;
	} else if (model === 'deepseek-reasoner') {
		resolvedModel = 'deepseek-v4-flash';
		thinkingType = 'enabled';
		legacyAliasApplied = true;
	}

	if (!SUPPORTED_MODELS.has(resolvedModel)) {
		const error = new Error('DEEPSEEK_MODEL_UNSUPPORTED');
		error.code = 'DEEPSEEK_MODEL_UNSUPPORTED';
		error.configuredModel = model;
		throw error;
	}

	return {
		configuredModel: model,
		resolvedModel,
		thinking: {
			type: thinkingType
		},
		thinkingType,
		legacyAliasApplied
	};
}

function buildDeepSeekRequestPayload(config, messages) {
	return {
		model: config.deepseek.model,
		messages,
		temperature: config.deepseek.temperature,
		max_tokens: config.deepseek.maxTokens,
		thinking: {
			type: config.deepseek.thinking.type
		}
	};
}

module.exports = {
	buildDeepSeekRequestPayload,
	resolveDeepSeekModelConfig
};
