import { getAccountScope, getCurrentUser } from './auth-store.js';
const KEY='pety_current_session_v1',LOCK='pety_session_lock_v1';
export const currentSession=()=>uni.getStorageSync(KEY)||null;
export function acceptSession(proof,uid){uni.removeStorageSync(LOCK);if(proof)uni.setStorageSync(KEY,{...proof,uid});else uni.removeStorageSync(KEY);}
export function clearSession(){uni.removeStorageSync(KEY);uni.removeStorageSync(LOCK);}
export function isSessionLocked(){return !!uni.getStorageSync(LOCK);}
export function observeSessionError(error,requestProof){
 const code=String(error?.errCode||error?.code||'');
 if(!['pety-session-revoked','pety-session-required'].includes(code))return;
 const current=currentSession();
 if(code==='pety-session-required'&&current&&!requestProof&&error.sessionVersion===undefined)return;
 if(requestProof&&(current?.secret!==requestProof.secret||current?.version!==requestProof.version))return;
 if(error.sessionVersion!==undefined&&current&&error.sessionVersion!==current.version)return;
 const uid=current?.uid||getCurrentUser().userId;if(!uid||isSessionLocked())return;
 // Flush synchronously while the old owner's lease is still valid. No guest copy.
 uni.$emit('pety-session-will-lock');
 uni.setStorageSync(LOCK,{uid,reason:code});uni.removeStorageSync(KEY);
 uni.removeStorageSync('uni_id_token');uni.setStorageSync('uni_id_token_expired',0);
 getAccountScope();
 uni.reLaunch({url:'/pages/auth/login?sessionExpired=1'});
 uni.showToast({title:'账号会话已结束，本机草稿仍为原账号保留。',icon:'none',duration:4000});
}
let installed=false;
export function installSessionTransport(){
 if(installed||typeof uniCloud==='undefined')return;installed=true;
 uniCloud.addInterceptor?.('callFunction',{
  invoke(args){const proof=currentSession();if(proof){args.data={...args.data,petySession:{secret:proof.secret,version:proof.version}};}},
  success(response){observeSessionError(response?.result);},fail(error){observeSessionError(error);}
 });
 uniCloud.interceptObject?.({
  invoke({params}){const proof=currentSession();if(proof){if(!params.length)params.push({});if(params[0]&&typeof params[0]==='object')params[0]._petySession={secret:proof.secret,version:proof.version};}},
  success({params,result}){const proof=params?.[0]?._petySession;observeSessionError(result,proof);},
  fail({params,error}){observeSessionError(error?.detail||error,params?.[0]?._petySession);}
 });
}
let checking=false;
export async function checkActiveSession(){
 if(isSessionLocked()){uni.reLaunch({url:'/pages/auth/login?sessionExpired=1'});return;}
 const proof=currentSession(),token=uni.getStorageSync('uni_id_token');
 if(checking||!proof||!token)return;checking=true;
 try{
  const co=uniCloud.importObject('uni-id-co',{customUI:true});
  const status=await co.getPetySessionStatus();
  if(status.enforced&&Number(uni.getStorageSync('uni_id_token_expired'))-Date.now()<3600000){
   const result=await co.refreshToken();
   if(currentSession()?.secret===proof.secret&&uni.getStorageSync('uni_id_token')===token&&result.petyRefreshedToken){
    uni.setStorageSync('uni_id_token',result.petyRefreshedToken.token);uni.setStorageSync('uni_id_token_expired',result.petyRefreshedToken.tokenExpired);
   }
  }
 }catch(error){observeSessionError(error?.detail||error,proof);}finally{checking=false;}
}
export const sessionDraftMixin={
 onLoad(){this._sessionFlush=()=>{this.saveDailyDraft?.();this.flushDraft?.();this.flush?.();};uni.$on('pety-session-will-lock',this._sessionFlush);},
 onUnload(){if(this._sessionFlush)uni.$off('pety-session-will-lock',this._sessionFlush);}
};
installSessionTransport();
