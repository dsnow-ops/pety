const test = require('node:test'), assert = require('node:assert/strict');
const {validatePaidEvidence} = require('../uniCloud-alipay/cloudfunctions/common/pety-membership-orders/payment-evidence');
function sample() {
  return [{_id:'business',userId:'A',currency:'CNY',amountFen:1234,paymentAttempt:{outTradeNo:'pay',provider:'wxpay',payType:'app',appId:'app',merchantId:'merchant'}},
    {order_no:'business',user_id:'A',out_trade_no:'pay',type:'pety_membership',provider:'wxpay',provider_pay_type:'app',provider_appid:'app',status:1,total_fee:1234,refund_fee:0,transaction_id:'tx',pay_date:1000},
    {outTradeNo:'pay',appId:'app',totalFee:1234,transactionId:'tx',resultCode:'SUCCESS'},
    {currency:'CNY',merchantId:'merchant',provider:'wxpay',payType:'app'}];
}
test('payment acceptance matches business order, official receipt and verified amount, not transport success', () => {
  const values=sample(); assert.equal(validatePaidEvidence(...values).transactionId,'tx');
  for (const [part, field, value] of [[1,'user_id','B'],[1,'total_fee',1],[1,'type','test'],[1,'status',0],[1,'refund_fee',1],
    [1,'transaction_id','other'],[1,'out_trade_no','other'],[2,'totalFee',1],[2,'appId','other'],[2,'resultCode',undefined],
    [3,'merchantId','other'],[3,'currency','USD'],[3,'merchantId',undefined]]) {
    const args=sample(); args[part][field]=value;args[2].returnCode='SUCCESS';
    assert.throws(()=>validatePaidEvidence(...args),{code:'PAYMENT_EVIDENCE_MISMATCH'},`${part}:${field}`);
  }
});
