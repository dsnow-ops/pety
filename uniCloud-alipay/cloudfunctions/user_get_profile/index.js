'use strict';

const MEMBERSHIP_COLLECTION = 'pety_memberships';

const FREE_ENTITLEMENTS = {
	maxPets: 1,
	dailyAiLimit: 3,
	monthlyAiLimit: 0,
	cloudSyncEnabled: false,
	consultationRetentionDays: 30
};

const PLUS_ENTITLEMENTS = {
	maxPets: 20,
	dailyAiLimit: 30,
	monthlyAiLimit: 300,
	cloudSyncEnabled: true,
	consultationRetentionDays: 3650
};

const PRO_ENTITLEMENTS = {
	maxPets: 50,
	dailyAiLimit: 80,
	monthlyAiLimit: 1000,
	cloudSyncEnabled: true,
	consultationRetentionDays: 3650
};

function getDefaultEntitlements(plan) {
	if (plan === 'pro') return PRO_ENTITLEMENTS;
	if (plan === 'plus') return PLUS_ENTITLEMENTS;
	return FREE_ENTITLEMENTS;
}

function normalizeMembership(record) {
	const now = Date.now();
	const plan = ['plus', 'pro'].includes(record && record.plan) ? record.plan : 'free';
	const active = record &&
		record.status === 'active' &&
		(!record.endedAt || record.endedAt > now) &&
		(!record.expiresAt || record.expiresAt > now);

	if (!active) {
		return {
			plan: 'free',
			status: record && record.status === 'expired' ? 'expired' : 'inactive',
			entitlements: FREE_ENTITLEMENTS
		};
	}

	return {
		plan,
		status: 'active',
		entitlements: {
			...getDefaultEntitlements(plan),
			...(record.entitlements || {})
		}
	};
}

function getContextUserId(context) {
	const info = typeof uniCloud.getCurrentUserInfo === 'function'
		? uniCloud.getCurrentUserInfo()
		: null;
	const candidates = [
		info && info.uid,
		info && info.userId,
		context && context.UID,
		context && context.uid,
		context && context.USERID,
		context && context.userId
	];
	const userId = candidates.find(item => typeof item === 'string' && item.trim());
	return userId || null;
}

async function getUserProfile(userId) {
	try {
		const record = await uniCloud.database().collection('uni-id-users').doc(userId).get();
		const user = record && record.data && record.data[0];
		if (!user) return {};
		return {
			nickname: user.nickname || user.username || null,
			avatar: user.avatar || (user.avatar_file && user.avatar_file.url) || null
		};
	} catch (error) {
		console.error('user_profile_lookup_failed', error && error.message ? error.message : error);
		return {};
	}
}

async function getMembership(userId) {
	try {
		const db = uniCloud.database();
		const byUserId = await db.collection(MEMBERSHIP_COLLECTION).where({ userId }).limit(1).get();
		const record = byUserId && byUserId.data && byUserId.data[0];
		return normalizeMembership(record);
	} catch (error) {
		console.error('membership_lookup_failed', error && error.message ? error.message : error);
		return normalizeMembership(null);
	}
}

exports.main = async (event, context) => {
	const userId = getContextUserId(context);

	if (!userId) {
		const membership = normalizeMembership(null);
		return {
			loggedIn: false,
			userId: null,
			nickname: null,
			avatar: null,
			plan: membership.plan,
			status: membership.status,
			entitlements: membership.entitlements,
			message: 'guest'
		};
	}

	const [profile, membership] = await Promise.all([
		getUserProfile(userId),
		getMembership(userId)
	]);

	return {
		loggedIn: true,
		userId,
		nickname: profile.nickname || null,
		avatar: profile.avatar || null,
		plan: membership.plan,
		status: membership.status,
		entitlements: membership.entitlements,
		message: 'ok'
	};
};
