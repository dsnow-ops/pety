'use strict';
const { verifyRequest, authErrorResult } = require('pety-auth');

const MEMBERSHIP_COLLECTION = 'pety_memberships';

const { readMembershipRecord, normalizeMembership } = require('pety-membership-orders/membership-state');

async function getMembership(userId) {
	if (!userId) return normalizeMembership(null);

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
	let membership;
	try { membership = await getMembership(userId); }
	catch (_) { return { errCode: 'pety-membership-unavailable', errMsg: '会员状态暂时无法查询，请稍后重试。' }; }

	return {
		loggedIn: !!userId,
		plan: membership.plan,
		status: membership.status,
		entitlements: membership.entitlements,
		serverTime: Date.now()
	};
};
