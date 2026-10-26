'use strict';
const fs=require('node:fs'),test=require('node:test'),assert=require('node:assert/strict');
function client(){
 const disk=new Map([['care_photo_consent_v1',true]]),scope={id:'A'},state={current:scope};
 const code=fs.readFileSync('common/care-photo-client.js','utf8').replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g,'').replace(/export /g,'')+'\nreturn carePhotoMixin;';
 const mixin=Function('scopedStorage','isDataScopeCurrent','hasAiConsent','buildProfileContext','getPetProfile',code)({getStorageSync:k=>disk.get(k),setStorageSync:(k,v)=>disk.set(k,structuredClone(v)),removeStorageSync:k=>disk.delete(k)},s=>s===state.current,()=>true,()=>'',()=>({species:'猫'}));
 const vm={...mixin.data(),...mixin.methods,activePetId:'pet_a',activePet:{},activeStatus:'current',loadedDataScope:scope,loadedChatContextId:'pet_a:current',inputText:'皮肤发红',messageList:[],isSending:false,isMemorialMode:false,buildConversationHistory:()=>[],saveChatHistory(){},scrollToBottom(){},searchSimilarCases(){},$refs:{carePhotoComposer:{clear(){vm.careDraft={images:[],purpose:'photo'};}}}};
 vm.careDraft={images:[{url:'local-photo',base64:'real-bytes-from-ui'}],purpose:'photo'};
 return {vm,state,scope,disk};
}
function pending(){let resolve;return{promise:new Promise(r=>resolve=r),get resolve(){return resolve;}};}
test('double tap invokes once; failed result keeps exact photo and text draft',async()=>{
 const {vm}=client(),p=pending();let calls=0;global.uniCloud={callFunction:()=>{calls++;return p.promise;}};
 const first=vm.sendCarePhotos();await vm.sendCarePhotos();assert.equal(calls,1);assert.equal(vm.careBusy,true);
 p.resolve({result:{code:422,errorCode:'PROVIDER_AUTH',requestId:'request-id'}});await first;
 assert.equal(vm.inputText,'皮肤发红');assert.equal(vm.careDraft.images[0].url,'local-photo');assert.equal(vm.careBusy,false);assert.match(vm.careError,/授权/);
});
test('late analysis cannot overwrite another pet or account',async()=>{
 for(const kind of ['pet','account']){const {vm,state}=client(),p=pending();global.uniCloud={callFunction:()=>p.promise};const request=vm.sendCarePhotos();
 if(kind==='pet'){vm.loadedChatContextId='pet_b:current';vm.activePetId='pet_b';}else state.current={id:'B'};
 vm.inputText='new draft';p.resolve({result:{code:0,analysis:{images:[{}]}}});await request;assert.equal(vm.messageList.length,0);assert.equal(vm.inputText,'new draft');}
});
test('same request id retained on explicit retry; no retry loop',async()=>{
 const {vm}=client(),calls=[];global.uniCloud={callFunction:async args=>{calls.push(args.data);return{result:{code:422,errorCode:'PROVIDER_RATE_LIMIT',requestId:'request-id'}};}};
 await vm.sendCarePhotos();await vm.retryCarePhotos();await vm.retryCarePhotos();assert.equal(calls.length,2);assert.equal(calls[0].clientRequestId,calls[1].clientRequestId);assert.equal(calls[1].retry,true);
});
test('analysis is shown before independent search and images never enter text search',async()=>{
 const {vm}=client();let query='';vm.searchSimilarCases=q=>{query=q;};
 global.uniCloud={callFunction:async()=>({result:{code:0,requestId:'r',analysis:{images:[{imageIndex:1,visible:['皮肤发红'],quality:'usable',purpose:'photo'}],possibleCauses:[],advice:'联系兽医',limitations:'不能确诊',questions:[],urgency:'uncertain',reason:'信息不足',userDescription:'皮肤发红'}}})};
 await vm.sendCarePhotos();assert.equal(vm.messageList.length,2);assert.equal(vm.messageList[0].petId,'pet_a');assert.match(vm.messageList[1].content,/照片观察/);assert.equal(query,'猫 皮肤 发红');assert.equal(vm.inputText,'');assert.equal(vm.careDraft.images.length,0);
});
test('cancelled or stale image selection does not auto-send or import into new context',async()=>{
 const script=fs.readFileSync('components/CarePhotoComposer.vue','utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g,'').replace('export default','return');
 const c=Function('readLocalImageBase64',script)(()=>Promise.resolve('/9j/'));
 let picked;global.uni={chooseImage:opts=>{picked=opts.success;}};const vm={...c.data(),...c.methods,busy:false,$emit(){}};
 const run=vm.choose();vm.clear();picked({tempFilePaths:['old-private-photo']});await run;assert.equal(vm.images.length,0);assert.equal(vm.picking,false);
});
test('switching context preserves its draft and restore never crosses pets',()=>{
 const {vm,disk}=client();vm.persistCareDraft();assert.equal(disk.get('care_photo_draft_pet_a').text,'皮肤发红');
 vm.$refs.carePhotoComposer.clear=()=>vm.updateCareDraft({images:[],purpose:'photo'});vm.clearCareContext();assert.equal(disk.get('care_photo_draft_pet_a').images.length,1);
 let restored=0;vm.$nextTick=fn=>fn();vm.$refs.carePhotoComposer.restore=()=>restored++;
 vm.activePetId='pet_b';vm.loadedChatContextId='pet_b:current';vm.restoreCareDraft();assert.equal(restored,0);
 vm.activePetId='pet_a';vm.loadedChatContextId='pet_a:current';vm.restoreCareDraft();assert.equal(restored,1);assert.equal(vm.inputText,'皮肤发红');
});
