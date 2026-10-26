// Pety incremental adapter; official password/SMS/provider verification stays upstream.
const sessions=require('pety-auth/sessions');
exports.confirmPetySession=async function({ticket}={}){if(sessions.mode()!=='enforce')throw{errCode:'pety-session-not-enabled'};return sessions.service().confirm(ticket,uid=>this.uniIdCommon.createToken({uid}));};
exports.cancelPetySession=async function({ticket}={}){await sessions.service().cancel(ticket);return{errCode:0};};
exports.getPetySessionStatus=async function(){return{errCode:0,mode:sessions.mode(),enforced:sessions.mode()==='enforce'};};

exports.getPetyProfile=async function(){await this.middleware.auth();const r=await uniCloud.database().collection('uni-id-users').doc(this.authInfo.uid).field({_id:true,mobile:true,nickname:true,username:true,email:true,avatar_file:true}).get();return{errCode:0,profile:r.data[0]};};
exports.updatePetyProfile=async function(data={}){await this.middleware.auth();if(Object.keys(data).some(k=>k!=='nickname')||typeof data.nickname!=='string'||data.nickname.trim().length>40)throw{errCode:'uni-id-param-error'};return sessions.admit(this.authInfo.uid,this.petySessionProof,async tx=>{const r=await tx.collection('uni-id-users').doc(this.authInfo.uid).update({nickname:data.nickname.trim()});return{errCode:0,updated:r.updated};});};
