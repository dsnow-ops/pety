import {localEventDate} from './narrative-store.js';
export const COMPANION_PROPOSALS=Array.from({length:24},(_,i)=>({id:`p${i+1}`,species:i<8?'cat':i<16?'dog':'any',tag:['habit','favoriteThing','first','ordinary'][i%4],kind:'life'}));
export function currentProposal(store,species,today=localEventDate()){
 const state=store.read().proposals;if(state.closed)return null;
 const options=COMPANION_PROPOSALS.filter(p=>(p.species==='any'||p.species===species)&&!(state.unsuitable||[]).includes(p.id));
 if(!options.length)return null;
 const current=options.find(p=>p.id===state.current);
 if(current&&state.day===today)return current;
 const next=options.find(p=>!(state.seen||[]).includes(p.id))||options[0];
 store.updateSection('proposals',{...state,current:next.id,day:today,seen:[...new Set([...(state.seen||[]),next.id])]});return next;
}
export function changeProposal(store,species,action,today=localEventDate()){
 const state=store.read().proposals,current=currentProposal(store,species,today);if(!current)return null;
 if(action==='close'){store.updateSection('proposals',{...state,closed:true});return null;}
 if(action==='save'){store.updateSection('proposals',{...state,saved:[...new Set([...(state.saved||[]),current.id])]});return current;}
 const unsuitable=action==='unsuitable'?[...new Set([...(state.unsuitable||[]),current.id])]:state.unsuitable||[];
 const options=COMPANION_PROPOSALS.filter(p=>(p.species==='any'||p.species===species)&&!unsuitable.includes(p.id));
 const next=options[(options.findIndex(p=>p.id===current.id)+1)%options.length]||null;
 store.updateSection('proposals',{...state,unsuitable,current:next?.id||'',day:today,seen:[...new Set([...(state.seen||[]),current.id,...(next?[next.id]:[])])]});return next;
}
