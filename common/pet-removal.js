const removalError = code => Object.assign(new Error(code), { code });
const objectMap = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const absent = value => value === undefined || value === '' || value === null;

export function assertManagedPetMedia(asset, scope, petId, { nativeSandbox = true } = {}) {
  if(!objectMap(asset)||asset.durable!==true||typeof asset.id!=='string'||!/^[A-Za-z0-9_-]+$/.test(asset.id)||asset.namespace!==scope.namespace||asset.petId!==petId||asset.key!==`${scope.namespace}:${petId}:${asset.id}`||!['indexeddb','sandbox'].includes(asset.backend))throw removalError('MEDIA_OWNER_CHANGED');
  if(asset.backend==='sandbox'&&nativeSandbox){
    const leaf=typeof asset.path==='string'?asset.path.split('/').pop():'';
    if(typeof asset.path!=='string'||asset.path.includes('\\')||asset.path.split('/').includes('..')||!asset.path.includes('/pety-narrative-media/')||![`${asset.id}.png`,`${asset.id}.jpg`,`${asset.id}.jpeg`].includes(leaf))throw removalError('MEDIA_PATH_INVALID');
  }
}

function exactPetKeys(id) {
  return [
    `pet_diaries_${id}`, `pet_diaries_${id}_creative_v1`, `pet_profile_${id}`,
    `consultation_records_${id}`, `memorial_persona_${id}`, `memorial_owner_call_prompt_seen_${id}`,
    `chat_history_${id}`, ...['current','deceased','future'].map(stage=>`chat_history_${id}_${stage}`),
    `chat_history_legacy_${id}`, `chat_history_stage_migrated_${id}`,
    `care_photo_draft_${id}`, `care_photo_session_${id}`, `pet_avatar_job_${id}`,
    `pet_avatar_session_${id}`, `pety_avatar_handoff_${id}`
  ];
}
function petKeys(id, available) {
  const dates=[];
  for(const prefix of [`memorial_reflection_suggestion_${id}_`,`memorial_reflection_requested_${id}_`]) {
    dates.push(...available.filter(key=>key.startsWith(prefix)&&/^\d{4}-\d{2}-\d{2}$/.test(key.slice(prefix.length))));
  }
  return [...new Set([...exactPetKeys(id),...dates])];
}

// Builds only local, owner-scoped changes. Binary disposal occurs later from
// the committed queue; this function never touches files, models or cloud data.
export function createPetRemovalPlan(storage, scope, petId, otherPets, mediaOptions) {
  const info=storage.getStorageInfoSync();
  if(!info||!Array.isArray(info.keys)||info.keys.some(key=>typeof key!=='string'))throw removalError('PET_DELETE_STORAGE_UNAVAILABLE');
  const keys=petKeys(petId,info.keys),values=new Map(keys.map(key=>[key,storage.getStorageSync(key)])),present=new Set(info.keys);
  const protectedKeys=new Set(otherPets.flatMap(pet=>petKeys(pet.id,info.keys)));
  if(keys.some(key=>protectedKeys.has(key)&&(present.has(key)||!absent(values.get(key)))))throw removalError('PET_DELETE_KEY_CONFLICT');

  const media=[];
  const readMap=value=>{if(absent(value))return{};if(!objectMap(value))throw removalError('PET_DELETE_METADATA_INVALID');return value;};
  const addMedia=value=>{if(value===undefined||value===null)return;if(!Array.isArray(value))throw removalError('PET_DELETE_METADATA_INVALID');for(const item of value){if(!objectMap(item))throw removalError('PET_DELETE_METADATA_INVALID');media.push(item);}};
  const snapshots=rows=>{for(const row of Object.values(readMap(rows))){if(!objectMap(row))throw removalError('PET_DELETE_METADATA_INVALID');addMedia(row.media);if(row.renderPayload!==undefined){if(!objectMap(row.renderPayload))throw removalError('PET_DELETE_METADATA_INVALID');addMedia(row.renderPayload.media);}}};
  const diary=readMap(values.get(`pet_diaries_${petId}`));snapshots(diary);
  const creative=readMap(values.get(`pet_diaries_${petId}_creative_v1`));
  if(creative.version!==undefined&&creative.version!==1)throw removalError('PET_DELETE_METADATA_INVALID');
  for(const field of ['drafts','records'])snapshots(creative[field]);
  for(const row of Object.values(readMap(creative.works))){if(!objectMap(row))throw removalError('PET_DELETE_METADATA_INVALID');if(row.snapshot!==undefined)snapshots({snapshot:row.snapshot});}
  for(const [field,child]of [['dailyDrafts','form'],['compositions','payload']]){
    for(const row of Object.values(readMap(creative[field]))){if(!objectMap(row))throw removalError('PET_DELETE_METADATA_INVALID');if(row[child]!==undefined){if(!objectMap(row[child]))throw removalError('PET_DELETE_METADATA_INVALID');addMedia(row[child].media);}}
  }
  addMedia(creative.mediaGarbage);
  const queueKey='pety_creative_media_gc_v1',existing=storage.getStorageSync(queueKey);
  if(!absent(existing)&&!Array.isArray(existing))throw removalError('PET_DELETE_METADATA_INVALID');
  const owned=media.filter(asset=>asset.durable===true);
  for(const asset of owned)assertManagedPetMedia(asset,scope,petId,mediaOptions);
  const queue=new Map();
  for(const asset of [...(existing||[]),...owned]){
    if(!objectMap(asset)||typeof asset.id!=='string'||!asset.id||asset.namespace!==scope.namespace||typeof asset.petId!=='string'||!asset.petId)throw removalError('PET_DELETE_METADATA_INVALID');
    const id=JSON.stringify([asset.namespace,asset.petId,asset.id]),previous=queue.get(id);
    if(previous&&['key','path','backend'].some(key=>previous[key]!==asset[key]))throw removalError('PET_DELETE_MEDIA_CONFLICT');
    if(!previous)queue.set(id,asset);
  }
  const writes=keys.filter(key=>present.has(key)||!absent(values.get(key))).map(key=>({key,remove:true}));
  if(owned.length)writes.unshift({key:queueKey,value:[...queue.values()]});
  return {writes,managedMedia:owned.length};
}
