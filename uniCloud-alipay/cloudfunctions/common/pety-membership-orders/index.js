'use strict';
const crypto = require('crypto');
const fail = code => { throw Object.assign(new Error(code), { code }); };
const id = value => crypto.createHash('sha256').update(value).digest('hex');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const confirmed = value => object(value) && value.ok !== false && value.success !== false && ['errCode','code'].every(k=>[undefined,null,'',0,'0'].includes(value[k]));
const coreFields = ['_id','userId','skuId','plan','currency','amountFen','durationDays','generationLimit','createdAt','expiresAt'];
const sameCore = (a,b) => coreFields.every(k=>a[k]===b[k]);

// Only a verified server identity and server-owned catalog belong here.
// This module creates business orders, never payment signatures or privileges.
function createMembershipOrders(collection, { catalog = {}, enabled = false, channels = {}, now = Date.now } = {}) {
  const validOwner = uid => { if (typeof uid !== 'string' || !uid || uid.length > 160) fail('ORDER_LOGIN_REQUIRED'); };
  const clock = () => {const stamp=now();if(!Number.isSafeInteger(stamp)||stamp<=0||stamp>Number.MAX_SAFE_INTEGER-30*60*1000)fail('ORDER_CLOCK_INVALID');return stamp;};
  const row = (response,orderId) => {
    if(!confirmed(response)||!Array.isArray(response.data)||response.data.length>1)fail('ORDER_SERVICE_UNAVAILABLE');
    const record=response.data[0];
    if(record===undefined)return null;
    if(!object(record)||record._id!==orderId)fail('ORDER_SERVICE_UNAVAILABLE');
    return record;
  };
  const validate = record => {
    if(typeof record.userId!=='string'||!record.userId||typeof record.skuId!=='string'||!record.skuId||!['plus','pro'].includes(record.plan)||record.currency!=='CNY'||
      !Number.isSafeInteger(record.amountFen)||record.amountFen<=0||record.amountFen>2147483647||!Number.isSafeInteger(record.durationDays)||record.durationDays<=0||record.durationDays>366||record.generationLimit!==10||
      ![record.createdAt,record.updatedAt,record.expiresAt].every(n=>Number.isSafeInteger(n)&&n>0)||record.updatedAt<record.createdAt||record.expiresAt<=record.createdAt||
      ['status','paymentStatus','entitlementStatus'].some(k=>typeof record[k]!=='string'||!record[k]))fail('ORDER_SERVICE_UNAVAILABLE');
    if(record.paymentAttempt!==undefined){const attempt=record.paymentAttempt;if(!object(attempt)||!['alipay','wxpay'].includes(attempt.provider)||attempt.payType!=='app'||attempt.currency!=='CNY'||
      ['channelId','appId','merchantId'].some(k=>typeof attempt[k]!=='string'||!attempt[k])||attempt.outTradeNo!=='pp'+id(record._id).slice(0,26))fail('ORDER_SERVICE_UNAVAILABLE');}
    return record;
  };
  const payable = order => {if(order.status!=='created'||order.expiresAt<=clock())fail('ORDER_NOT_PAYABLE');};
  const lookup = async orderId => {
    let response;try{response=await collection.doc(orderId).get();}catch(_){fail('ORDER_SERVICE_UNAVAILABLE');}
    return row(response,orderId);
  };
  async function read(uid, orderId) {
    validOwner(uid);
    if (!/^pm[0-9a-f]{26}$/.test(orderId || '')) fail('ORDER_NOT_FOUND');
    const record = await lookup(orderId);
    if (!record || record.userId !== uid) fail('ORDER_NOT_FOUND');
    return validate(record);
  }
  async function create(uid, input = {}) {
    validOwner(uid);
    if (!enabled) fail('PAYMENT_NOT_CONFIGURED');
    // Explicitly reject pricing and status injection instead of silently
    // accepting a request that looks as if it set authoritative fields.
    if (!object(input)||Object.keys(input).some(k => !['skuId', 'requestId'].includes(k))) fail('ORDER_INPUT_INVALID');
    const { skuId, requestId } = input;
    if (!/^[A-Za-z0-9_-]{8,100}$/.test(requestId || '') || !/^[A-Za-z0-9_-]{1,64}$/.test(skuId || '')) fail('ORDER_INPUT_INVALID');
    const orderId = 'pm' + id(JSON.stringify([uid, requestId])).slice(0, 26);
    const prior = await lookup(orderId);
    if (prior) {
      if (prior.userId !== uid || prior.skuId !== skuId) fail('ORDER_REQUEST_CONFLICT');
      return validate(prior);
    }
    const sku = Object.prototype.hasOwnProperty.call(catalog, skuId) ? catalog[skuId] : null;
    if (!sku || sku.approved !== true || !['plus', 'pro'].includes(sku.plan) || sku.currency !== 'CNY' ||
        !Number.isSafeInteger(sku.amountFen) || sku.amountFen <= 0 || sku.amountFen > 2147483647 ||
        !Number.isSafeInteger(sku.durationDays) || sku.durationDays <= 0 || sku.durationDays > 366 ||
        sku.generationLimit !== 10) fail('SKU_NOT_AVAILABLE');
    const stamp = clock();
    const record = {
      _id: orderId, userId: uid, skuId, plan: sku.plan, currency: 'CNY',
      amountFen: sku.amountFen, durationDays: sku.durationDays, generationLimit: 10,
      status: 'created', paymentStatus: 'not_started', entitlementStatus: 'not_granted',
      createdAt: stamp, updatedAt: stamp, expiresAt: stamp + 30 * 60 * 1000
    };
    let inserted;
    try { inserted=await collection.add(record); }
    catch (error) {
      // A timeout may have committed, or another retry may have won. Read the
      // unique ID, never create a different order on uncertain acknowledgement.
      const winner = await lookup(orderId);
      if (!winner) fail('ORDER_SERVICE_UNAVAILABLE');
      if (winner.userId !== uid || winner.skuId !== skuId) fail('ORDER_REQUEST_CONFLICT');
      // Concurrent attempts may have observed another clock tick or catalog
      // snapshot. The unique persisted winner owns those immutable fields.
      return validate(winner);
    }
    if(!confirmed(inserted)||![inserted.id,inserted._id].some(v=>v===orderId)||[inserted.id,inserted._id].some(v=>v!==undefined&&v!==orderId))fail('ORDER_SERVICE_UNAVAILABLE');
    const persisted=await lookup(orderId);
    if(!persisted||!sameCore(validate(persisted),record))fail('ORDER_SERVICE_UNAVAILABLE');
    return persisted;
  }
  async function preparePayment(uid, orderId, channelId) {
    // Persist the exact channel/merchant binding before any provider request.
    // An uncertain submission reuses this attempt, never a fresh payment ID.
    const order = await read(uid, orderId);
    if (!enabled) fail('PAYMENT_NOT_CONFIGURED');
    const channel = Object.prototype.hasOwnProperty.call(channels, channelId) ? channels[channelId] : null;
    if (!channel || channel.approved !== true || !['alipay', 'wxpay'].includes(channel.provider) ||
        channel.payType !== 'app' || channel.currency !== 'CNY' ||
        typeof channel.appId !== 'string' || !channel.appId || typeof channel.merchantId !== 'string' || !channel.merchantId) fail('PAYMENT_NOT_CONFIGURED');
    payable(order);
    if (order.paymentAttempt) {
      if (order.paymentAttempt.channelId !== channelId) fail('PAYMENT_ATTEMPT_CONFLICT');
      if(order.paymentStatus!=='prepared')fail('ORDER_NOT_PAYABLE');
      return order;
    }
    if(order.paymentStatus!=='not_started')fail('ORDER_NOT_PAYABLE');
    const paymentAttempt = {
      channelId, provider: channel.provider, payType: 'app', currency: 'CNY',
      appId: channel.appId, merchantId: channel.merchantId,
      outTradeNo: 'pp' + id(orderId).slice(0, 26)
    };
    const updatedAt=clock();let changed;
    try{changed = await collection.where({ _id: orderId, userId: uid, status: 'created', paymentStatus: 'not_started' })
      .update({ paymentAttempt, paymentStatus: 'prepared', updatedAt });}catch(_){fail('ORDER_SERVICE_UNAVAILABLE');}
    if(!confirmed(changed)||![0,1].includes(changed.updated)||['affectedDocs','modifiedCount'].some(k=>changed[k]!==undefined&&changed[k]!==changed.updated))fail('ORDER_SERVICE_UNAVAILABLE');
    const winner=await read(uid,orderId);payable(winner);
    if(!sameCore(winner,order)||winner.paymentStatus!=='prepared'||winner.paymentAttempt?.channelId!==channelId)fail('PAYMENT_ATTEMPT_CONFLICT');
    if(changed.updated===1&&!Object.keys(paymentAttempt).every(k=>winner.paymentAttempt[k]===paymentAttempt[k]))fail('ORDER_SERVICE_UNAVAILABLE');
    return winner;
  }
  return { create, read, preparePayment };
}
module.exports = { createMembershipOrders };
