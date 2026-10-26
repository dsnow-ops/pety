'use strict';
const crypto=require('crypto');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};
const COLLECTION='product_feedback_uploads',MAX_BYTES=2*1024*1024;
function createMediaService(db,{prefix,inspect,clock=Date.now}){
 const c=db.collection(COLLECTION);
 async function owned(uid,id){if(!uid||typeof id!=='string'||!/^[a-f0-9]{48}$/.test(id))fail('FEEDBACK_IMAGE_NOT_OWNED');const r=(await c.doc(id).get())?.data?.[0];if(!r||r.owner!==hash(uid))fail('FEEDBACK_IMAGE_NOT_OWNED');return r;}
 return{
  async issue(uid,extension){
   if(!uid)fail('FEEDBACK_IMAGE_LOGIN_REQUIRED');if(!['png','jpg','jpeg'].includes(extension)||!/^cloud:\/\/[^/?#]+\/$/.test(prefix))fail('FEEDBACK_INVALID_IMAGES');
   const id=crypto.randomBytes(24).toString('hex'),owner=hash(uid),cloudPath=`pety-private-v3/product-feedback/v2/${owner}/${id}.${extension}`;
   await c.add({_id:id,owner,cloudPath,fileId:prefix+cloudPath,state:'issued',expiresAt:clock()+15*60000,createdAt:clock()});return{ticketId:id,cloudPath};
  },
  async complete(uid,id,fileId){const row=await owned(uid,id);if(row.fileId!==fileId)fail('FEEDBACK_IMAGE_NOT_OWNED');if(row.state==='ready')return{fileId};if(row.expiresAt<=clock())fail('FEEDBACK_IMAGE_EXPIRED');
   const image=await inspect(fileId);if(!image||image.bytes>MAX_BYTES||image.bytes<=0||!['png','jpeg'].includes(image.format)||!/^[a-f0-9]{64}$/.test(image.sha256))fail('FEEDBACK_INVALID_IMAGES');
   const r=await c.where({_id:id,owner:row.owner,state:'issued'}).update({state:'ready',sha256:image.sha256,bytes:image.bytes,readyAt:clock()});
   if(Number(r?.updated||r?.updatedCount||r?.affectedDocs||r?.modifiedCount)!==1){const current=await owned(uid,id);if(current.state!=='ready'||current.sha256!==image.sha256)fail('FEEDBACK_IMAGE_NOT_OWNED');}
   return{fileId};
  },
  async validate(uid,fileIds){for(const fileId of fileIds){const match=typeof fileId==='string'&&fileId.match(/^cloud:\/\/[^/?#]+\/(?:pety-private-v3\/)?product-feedback\/v2\/[a-f0-9]{64}\/([a-f0-9]{48})\.(?:png|jpe?g)$/);if(!match)fail('FEEDBACK_IMAGE_NOT_OWNED');const r=await owned(uid,match[1]);if(r.state!=='ready'||r.fileId!==fileId)fail('FEEDBACK_IMAGE_NOT_OWNED');}return true;}
 };
}
async function inspect(fileId){
 const response=await uniCloud.getTempFileURL({fileList:[fileId]});const url=response?.fileList?.[0]?.tempFileURL;if(!url)fail('FEEDBACK_INVALID_IMAGES');
 const bytes=await require('./safe-image-download').downloadHttps(url,2,MAX_BYTES);let image,format;
 if(bytes.length>=24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){const w=bytes.readUInt32BE(16),h=bytes.readUInt32BE(20);if(!w||!h||w>8192||h>8192||w*h>16*1024*1024)fail('FEEDBACK_INVALID_IMAGES');image=require('pngjs').PNG.sync.read(bytes);format='png';}
 else if(bytes[0]===255&&bytes[1]===216){image=require('jpeg-js').decode(bytes,{maxResolutionInMP:16,maxMemoryUsageInMB:128});format='jpeg';}
 else fail('FEEDBACK_INVALID_IMAGES');
 if(!image?.width||!image?.height)fail('FEEDBACK_INVALID_IMAGES');return{format,bytes:bytes.length,sha256:hash(bytes)};
}
function service(db,context={}){
 // Only platform cloud context can select the storage space. Match requestId
 // when an instance handles concurrent requests; never select a client event.
 const infos=uniCloud.getCloudInfos?.()||[];
 const current=context.SPACEINFO||(context.requestId?infos.find(info=>info.requestId===context.requestId):(infos.length===1?infos[0]:null));
 const space=current?.spaceId;
 if(!/^[a-zA-Z0-9_-]+$/.test(space||'')||current.provider&&current.provider!=='alipay')fail('FEEDBACK_MEDIA_UNAVAILABLE');
 return createMediaService(db,{prefix:`cloud://${space}/`,inspect});
}
module.exports={createMediaService,service,COLLECTION,inspect};
