const test=require('node:test'),assert=require('node:assert/strict');
const {createPaymentInbox}=require('../uniCloud-alipay/cloudfunctions/common/pety-membership-orders/payment-inbox');
const {createMembershipSchedule}=require('../uniCloud-alipay/cloudfunctions/common/pety-membership-orders/membership-schedule');
const {readEffectiveMembership}=require('../uniCloud-alipay/cloudfunctions/common/pety-membership-orders/effective-membership');
function table(){const rows=new Map();let failUpdate=false;return{rows,failUpdate:()=>failUpdate=true,
 add:async row=>{if(rows.has(row._id))throw Error('duplicate');rows.set(row._id,structuredClone(row));},
 doc:key=>({get:async()=>({data:rows.has(key)?[structuredClone(rows.get(key))]:[]})}),
 where:q=>({update:async patch=>{if(failUpdate){failUpdate=false;throw Error('outage')}const r=rows.get(q._id);if(!r||!Object.entries(q).every(([k,v])=>r[k]===v))return{updated:0};Object.assign(r,patch);return{updated:1}}})};}
function evidence(){return[{_id:'order',userId:'A',currency:'CNY',amountFen:100,plan:'plus',durationDays:30,generationLimit:10,paymentAttempt:{outTradeNo:'pay',provider:'wxpay',payType:'app',appId:'app',merchantId:'merchant'}},
 {order_no:'order',user_id:'A',out_trade_no:'pay',type:'pety_membership',provider:'wxpay',provider_pay_type:'app',provider_appid:'app',status:1,total_fee:100,transaction_id:'tx',pay_date:1000},
 {outTradeNo:'pay',appId:'app',totalFee:100,transactionId:'tx',resultCode:'SUCCESS'},
 {currency:'CNY',merchantId:'merchant',provider:'wxpay',payType:'app'}];}
test('concurrent payment notifications and recovery create one grant source, never claim activation',async()=>{
 const inbox=table(),grants=table(),api=createPaymentInbox(inbox,grants);
 await Promise.all(Array.from({length:10},()=>api.accept(...evidence())));
 const results=await Promise.all(Array.from({length:10},()=>api.apply('order')));
 assert.equal(inbox.rows.size,1);assert.equal(grants.rows.size,1);assert.equal(grants.rows.get('order').generationLimit,10);
 assert.ok(results.every(r=>r.membershipActivated===false));
});
test('restart after grant write but before acknowledgement preserves the same receipt',async()=>{
 const inbox=table(),grants=table();let api=createPaymentInbox(inbox,grants);
 await api.accept(...evidence());inbox.failUpdate();await assert.rejects(api.apply('order'),/outage/);
 assert.equal(inbox.rows.get('order').state,'pending');assert.equal(grants.rows.size,1);
 api=createPaymentInbox(inbox,grants);await api.apply('order');assert.equal(grants.rows.size,1);assert.equal(inbox.rows.get('order').state,'recorded');
 const wrong=evidence();wrong[2].transactionId='other';wrong[1].transaction_id='other';
 await assert.rejects(api.accept(...wrong),{code:'PAYMENT_RECEIPT_CONFLICT'});
});

test('persisted receipt activates through the real schedule and effective membership reader; retries keep one cycle',async()=>{
 const inbox=table(),grants=table(),accounts=table();
 const options={readGrant:async id=>grants.rows.get(id),readLegacy:async()=>null,replaceObject:v=>v,now:()=>2000};
 let schedule=createMembershipSchedule(accounts,options),api=createPaymentInbox(inbox,grants,{schedule,now:()=>2000});
 await api.accept(...evidence());accounts.failUpdate();await assert.rejects(api.activate('order'),/outage/);
 schedule=createMembershipSchedule(accounts,options);api=createPaymentInbox(inbox,grants,{schedule,now:()=>2000});
 const results=await Promise.all(Array.from({length:8},()=>api.activate('order')));
 assert.ok(results.every(r=>r.membershipActivated));assert.equal(Object.keys([...accounts.rows.values()][0].periods).length,1);
 const membership=await readEffectiveMembership({collection:()=>accounts},'A',null,2000);
 assert.equal(membership.entitlementCycleKey,results[0].cycleKey);assert.equal(membership.plan,'plus');
});

test('verified revocation is idempotent and blocks late activation without deleting other order history',async()=>{
 const inbox=table(),grants=table(),accounts=table(),refunds=new Map();
 const schedule=createMembershipSchedule(accounts,{readGrant:async id=>grants.rows.get(id),readLegacy:async()=>null,
  readRefund:async id=>refunds.get(id),replaceObject:v=>v,now:()=>2000});
 const api=createPaymentInbox(inbox,grants,{schedule,now:()=>2000});await api.accept(...evidence());await api.activate('order');
 await assert.rejects(schedule.revoke('A','order'),{code:'REFUND_RECEIPT_INVALID'});
 refunds.set('order',{orderId:'order',userId:'A',source:'official-payment',outcome:'full_refund',receiptId:'refund-1'});
 await Promise.all([schedule.revoke('A','order'),schedule.revoke('A','order')]);
 assert.equal(await readEffectiveMembership({collection:()=>accounts},'A',null,2000),null);
 await assert.rejects(api.activate('order'),{code:'MEMBERSHIP_ORDER_REVOKED'});assert.equal(grants.rows.size,1);
 refunds.set('early',{orderId:'early',userId:'A',source:'official-payment',outcome:'chargeback',receiptId:'reversal-1'});
 await schedule.revoke('A','early');
 grants.rows.set('early',{...grants.rows.get('order'),_id:'early',orderId:'early'});
 await assert.rejects(schedule.activate('A','early'),{code:'MEMBERSHIP_ORDER_REVOKED'});
});
