'use strict';
const { verifyRequest, authErrorResult } = require('pety-auth');

const MEMBERSHIP_COLLECTION = 'pety_memberships';

const { readMembershipRecord, normalizeMembership } = require('pety-membership-orders/membership-state');

async function getUserProfile(userId) {
	try {
		const record = await uniCloud.database().collection('uni-id-users').doc(userId).get();
		const user = record && record.data && record.data[0];
		if (!record || ['errCode','code'].some(key => ![undefined,null,'',0,'0'].includes(record[key])) || !Array.isArray(record.data) || record.data.length !== 1 || !user || typeof user !== 'object' || Array.isArray(user) || user._id !== undefined && user._id !== userId) throw new Error('PROFILE_LOOKUP_INVALID');
		if (['nickname','username','avatar'].some(key => user[key] != null && typeof user[key] !== 'string') || user.avatar_file != null && (typeof user.avatar_file !== 'object' || Array.isArray(user.avatar_file) || user.avatar_file.url != null && typeof user.avatar_file.url !== 'string')) throw new Error('PROFILE_FIELDS_INVALID');
		return {
			nickname: user.nickname || user.username || null,
			avatar: user.avatar || (user.avatar_file && user.avatar_file.url) || null
		};
	} catch (error) {
		// A failed lookup is not evidence that the user removed their name/avatar.
		// Avoid logging raw database diagnostics which may include private fields.
		console.error('user_profile_lookup_failed');
		throw Object.assign(new Error('Profile temporarily unavailable'), { errCode: 'pety-profile-unavailable' });
	}
}

async function getMembership(userId) {
	try {
		const db = uniCloud.database();
		const byUserId = await db.collection(MEMBERSHIP_COLLECTION).where({ userId }).limit(1).get();
		let record = readMembershipRecord(byUserId, userId);
		if (process.env.PETY_PAID_MEMBERSHIP_ENABLED === 'true') {
			record = await require('pety-membership-orders/effective-membership').readEffectiveMembership(db, userId, record);
		}
		return normalizeMembership(record);
	} catch (error) {
		console.error('membership_lookup_failed');
		throw Object.assign(new Error('Membership temporarily unavailable'), { errCode: 'pety-membership-unavailable' });
	}
}

exports.main = async (event, context) => {
	let userId;
	try { userId = (await verifyRequest(event, context)).uid; }
	catch (error) { return authErrorResult(error); }

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

	let profile, membership;
	try {
		[profile, membership] = await Promise.all([getUserProfile(userId), getMembership(userId)]);
	} catch (error) {
		// Keep an established official session and its last display snapshot; this
		// is not evidence of expiry and must not publish a fabricated free plan.
		if (error?.errCode === 'pety-profile-unavailable') return { errCode: 'pety-profile-unavailable', errMsg: '账号资料暂时无法查询，请稍后重试。' };
		return { errCode: 'pety-membership-unavailable', errMsg: '会员状态暂时无法查询，请稍后重试。' };
	}

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
