'use strict';

const https = require('https');

if (String(process.env.PETY_RUN_PAID_SIMILAR_CASE_SMOKE || '').toLowerCase() !== 'true') {
	console.error('Paid smoke is disabled. Set PETY_RUN_PAID_SIMILAR_CASE_SMOKE=true to allow one DeepSeek web_search call.');
	process.exit(1);
}

const stores = new Map();

function clone(value) {
	return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function getStore(name) {
	if (!stores.has(name)) stores.set(name, new Map());
	return stores.get(name);
}

function matches(document, query) {
	return Object.entries(query || {}).every(([key, expected]) => {
		if (expected && expected.__operation === 'lt') return Number(document[key]) < expected.value;
		return document[key] === expected;
	});
}

function applyUpdate(document, patch) {
	Object.entries(patch || {}).forEach(([key, value]) => {
		document[key] = value && value.__operation === 'inc'
			? (Number(document[key]) || 0) + value.value
			: clone(value);
	});
}

function collection(name) {
	const store = getStore(name);
	return {
		doc(id) {
			return {
				async get() { return { data: store.has(id) ? [clone(store.get(id))] : [] }; },
				async update(patch) {
					if (!store.has(id)) return { updated: 0 };
					const next = clone(store.get(id)); applyUpdate(next, patch); store.set(id, next); return { updated: 1 };
				},
				async remove() { const existed = store.delete(id); return { deleted: existed ? 1 : 0 }; }
			};
		},
		async add(document) {
			const id = String(document._id || '');
			if (!id || store.has(id)) throw new Error('DOCUMENT_EXISTS');
			store.set(id, clone(document));
			return { id };
		},
		where(query) {
			return {
				async get() { return { data: Array.from(store.values()).filter(item => matches(item, query)).map(clone) }; },
				async update(patch) {
					let updated = 0;
					for (const [id, document] of store.entries()) {
						if (!matches(document, query)) continue;
						const next = clone(document); applyUpdate(next, patch); store.set(id, next); updated += 1;
					}
					return { updated };
				}
			};
		}
	};
}

function request(url, options) {
	return new Promise((resolve, reject) => {
		const body = JSON.stringify(options.data || {});
		const call = https.request(url, {
			method: options.method || 'GET',
			headers: options.headers || {}
		}, response => {
			const chunks = [];
			response.on('data', chunk => chunks.push(chunk));
			response.on('end', () => {
				const text = Buffer.concat(chunks).toString('utf8');
				let data = {};
				try { data = text ? JSON.parse(text) : {}; } catch (error) { return reject(new Error('INVALID_JSON_RESPONSE')); }
				resolve({ status: response.statusCode, statusCode: response.statusCode, data });
			});
		});
		call.setTimeout(options.timeout || 90000, () => call.destroy(new Error('REQUEST_TIMEOUT')));
		call.on('error', reject);
		call.write(body);
		call.end();
	});
}

global.uniCloud = {
	database() {
		return {
			command: {
				lt(value) { return { __operation: 'lt', value }; },
				inc(value) { return { __operation: 'inc', value }; }
			},
			collection
		};
	},
	httpclient: { request }
};

const api = require('../uniCloud-alipay/cloudfunctions/api_deepseek/index.js');
const context = { DEVICEID: 'pety-similar-case-smoke-device' };
const clientRequestId = `smoke_${Date.now()}`;

async function main() {
	const created = await api.main({
		requestType: 'createSimilarCaseSearch',
		relationshipStage: 'current',
		responseLanguage: 'zh-Hans',
		clientRequestId,
		petId: 'smoke-pet',
		userMessage: '我家猫今天吐了一次，精神还可以，公开案例有哪些？'
	}, context);
	if (!created || created.code !== 0 || !created.searchJobId) throw new Error('CREATE_JOB_FAILED');

	const processed = await api.main({
		requestType: 'processSimilarCaseSearch',
		relationshipStage: 'current',
		searchJobId: created.searchJobId
	}, context);
	const status = await api.main({
		requestType: 'getSimilarCaseSearchStatus',
		relationshipStage: 'current',
		searchJobId: created.searchJobId
	}, context);
	const stored = getStore('similar_case_search_jobs').get(created.searchJobId) || {};
	console.log(JSON.stringify({
		ok: ['SUCCEEDED', 'SUCCEEDED_PARTIAL'].includes(status && status.status),
		processStatus: processed && processed.status,
		status: status && status.status,
		providerInvocationCount: stored.providerInvocationCount || 0,
		requestId: stored.providerRequestId || '',
		webSearchExecuted: Boolean(stored.webSearchExecuted),
		linkCount: Number(stored.linkCount) || 0,
		normalizedCaseCount: Number(stored.normalizedCaseCount) || 0
	}, null, 2));
	if (!['SUCCEEDED', 'SUCCEEDED_PARTIAL'].includes(status && status.status) || Number(stored.linkCount) < 1) process.exitCode = 1;
}

main().catch(error => {
	console.error(JSON.stringify({ ok: false, error: error.code || error.message || 'SMOKE_FAILED' }));
	process.exit(1);
});
