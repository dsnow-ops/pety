const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const file='uni_modules/uni-id-pages/uniCloud/cloudfunctions/uni-id-co/index.obj.js';
function load(){
 const module={exports:{}};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{module,require:name=>name==='./common/utils'?{getType:v=>v instanceof Error?'error':typeof v}:name==='./common/error'?{isUniIdError:code=>String(code).startsWith('uni-id-')}:{} });
 return module.exports;
}
test('official cloud after hook preserves numeric success for account info and login',()=>{
 const co=load();
 for(const result of [{errCode:0,isPasswordSet:true,isMobileBound:false},{errCode:0,uid:'synthetic',petyIssuedToken:{token:'synthetic-only'}}]){
  const response=co._after.call({response:{},petySessionProof:{version:2}},null,result);
  assert.equal(response.errCode,0);assert.equal(response.sessionVersion,undefined);
  assert.equal(response.isPasswordSet,result.isPasswordSet);
 }
});
test('after hook retains revocation metadata without swallowing unrelated server failures',()=>{
 const co=load(),ctx={response:{},petySessionProof:{version:2},t:code=>code};
 for(const result of [{errCode:'pety-session-revoked'}, {errCode:'pety-session-required'}]){
  assert.equal(co._after.call(ctx,null,result).sessionVersion,2);
  assert.equal(co._after.call(ctx,{...result}).errCode,result.errCode);
 }
 assert.equal(co._after.call(ctx,{errCode:'uni-id-token-expired'}).errCode,'uni-id-token-expired');
 const failure=Error('synthetic backend failure');assert.throws(()=>co._after.call(ctx,failure),e=>e===failure);
});
