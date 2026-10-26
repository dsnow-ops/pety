import {lifeText,lifePhotos,safeForRecall} from './record-views.js';
import {eventTimeLabel} from './narrative-store.js';
import {normalizeSealTransform} from './seal-transform.js';

const clone=v=>JSON.parse(JSON.stringify(v));
export function recipeCandidates(records) { return records.filter(safeForRecall); }
export function resolveRecordRecipe(source,config) {
  const recipe=config.recipe,comparison=recipe.type==='comparison',conflicts=[],items=[],media=[],refs=[];
  const name=config.requested['identity.petName']!=='hide'?source.fields['identity.petName']?.[0]?.value||'':'';
  for(const item of recipe.items){
    const r=source.recipeRecords.find(r=>r.id===item.recordId);
    if(!r||r.petId!==source.petId||r.namespace!==source.namespace){conflicts.push({key:'source',message:'取材已删除或不再适合自动整理，请重新选择。'});continue;}
    const asset=item.assetId?lifePhotos(r).find(m=>m.id===item.assetId):null;
    if(item.assetId&&!asset){conflicts.push({key:'media.photos',message:'照片来源已变化，请重新选择。'});continue;}
    if(comparison&&!asset){conflicts.push({key:'media.photos',message:'对照需要两张已保存的生活照片。'});continue;}
    const ref={recordId:r.id,revision:r.revision,eventDateLabel:eventTimeLabel(r)};refs.push(ref);
    const text=item.textVersion==='accepted'?(r.lifeEditedText||r.adoptedCandidate&&r.text||lifeText(r)):lifeText(r);
    const page={source:ref,text:item.text===undefined?text:item.text,dateText:config.requested['date.display']==='hide'||item.showDate===false?'':eventTimeLabel(r),caption:item.caption===undefined?asset?.caption||'':item.caption,mediaIndex:-1};
    if(asset&&config.requested['media.photos']!=='hide'){
      page.mediaIndex=media.length;
      media.push({...clone(asset),fit:item.fit||'contain',cropX:Number.isFinite(item.cropX)?item.cropX:.5,cropY:Number.isFinite(item.cropY)?item.cropY:.5});
    }
    items.push(page);
  }
  if(comparison&&(items.length!==2||media.length!==2))conflicts.push({key:'media.photos',message:'请选择两张生活照片；可交换顺序。'});
  if(!items.length||items.every(p=>!p.text?.trim()&&p.mediaIndex<0))conflicts.push({key:'body',message:'请选入真实文字或照片。'});
  const payload={templateId:comparison?'collage':'letter',templateVersion:7,mode:config.mode,petName:name,title:recipe.title||'',blocks:[],media,presentation:clone(config.presentation),recipe:{type:recipe.type,...(recipe.layoutRevision===2?{layoutRevision:2}:{}),items},sourceRefs:refs};
  const seal=config.presentation.seal;
  if(seal.enabled){
    if(!source.seal)conflicts.push({key:'seal',message:'请先在档案制作并确认专属印记。'});
    else if(!name&&source.seal.containsName!==false)conflicts.push({key:'seal',message:'旧印记可能含名字，请关闭印记或使用无名字版。'});
    else payload.seal={asset:clone(source.seal),enabled:true,style:seal.style,position:seal.placement,size:seal.size==='small'?'small':'medium',...(seal.placement==='free'?normalizeSealTransform(seal):{})};
  }
  return {payload,conflicts,states:{'identity.petName':name?'visible':'hidden','date.display':config.requested['date.display']==='hide'?'hidden':'visible','media.photos':media.length?'visible':'hidden'},template:{id:payload.templateId,name:comparison?'两张照片的对照':'几个日子的小册'},sourceRefs:refs};
}
