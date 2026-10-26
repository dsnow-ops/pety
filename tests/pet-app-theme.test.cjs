const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const read=f=>fs.readFileSync(f,'utf8');
function theme(storage={}){const scope={namespace:'guest:local',version:0,ready:true},store={getStorageSync:k=>storage[k],setStorageSync:(k,v)=>storage[k]=v};store.forScope=()=>store;return Function('scopedStorage','captureDataScope','isDataScopeCurrent','subscribeAccountScope',read('common/pet-app-theme.js').replace(/^import[^;]+;\s*/gm,'').replace(/export /g,'')+';return {setThemePet,rememberPetTheme,getPetTheme,setPetThemeMode,petThemeVariables,buildPetTheme};')(store,()=>scope,s=>s===scope,()=>()=>{});}
const a={id:'A',generatedAvatarFileId:'masterA'},b={id:'B',generatedAvatarFileId:'masterB'};
test('whole-app palette persists by pet/master and never adopts late colors from another owner',()=>{
 const disk={},t=theme(disk);t.setThemePet(a);assert.equal(t.rememberPetTheme(a,{blend:true,backgroundRgb:[168,156,140]}),true);
 const expected=t.petThemeVariables();t.setThemePet(b);assert.notEqual(t.petThemeVariables().backgroundColor,expected.backgroundColor);
 assert.equal(t.rememberPetTheme(a,{blend:true,backgroundRgb:[170,160,150]}),false);
 const restart=theme(disk);restart.setThemePet(a);assert.deepEqual(restart.petThemeVariables(),expected);
 restart.setThemePet({...a,generatedAvatarFileId:'new'});assert.equal(restart.getPetTheme().ready,false);
});
test('studio switch is reversible and dark/saturated/unqualified images cannot tint the app',()=>{
 const t=theme();t.setThemePet(a);
 for(const rgb of [[255,0,255],[30,30,30],[NaN,140,150]])assert.equal(t.rememberPetTheme(a,{blend:true,backgroundRgb:rgb}),false);
 assert.equal(t.rememberPetTheme(a,{blend:false,backgroundRgb:[168,156,140]}),false);
 t.setPetThemeMode('studio');assert.deepEqual(t.petThemeVariables(),{});t.setPetThemeMode('ambient');assert.ok(t.petThemeVariables().backgroundColor);
});
test('small text maintains WCAG AA contrast on all admitted neutral page and surface colors',()=>{
 const t=theme();const lum=h=>{const a=h.match(/[a-f0-9]{2}/gi).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return a[0]*.2126+a[1]*.7152+a[2]*.0722;};
 const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
 for(const rgb of [[116,116,116],[163,140,116],[116,140,163],[210,220,230],[250,250,250]]){const p=t.buildPetTheme(rgb);assert.ok(ratio(p.page,p.ink)>=4.5);assert.ok(ratio(p.surface,p.secondary)>=4.5);assert.ok(ratio(p.primary,'#ffffff')>=4.5);}
});
test('every first-party page joins the shared theme without editing uni_modules',()=>{
 const pages=JSON.parse(read('pages.json').replace(/^\uFEFF/,'')).pages.filter(p=>p.path.startsWith('pages/'));
 for(const {path} of pages){const template=read(path+'.vue').match(/<template>\s*<view[^>]+>/)[0];assert.match(template,/petThemeClass/,path);assert.match(template,/appThemeStyle/,path);}
});
test('candidate C controls luminance independently of the photographic background and preserves A/B',()=>{
 const disk={},t=theme(disk);t.setThemePet(a);t.rememberPetTheme(a,{blend:true,backgroundRgb:[116,132,150]});
 t.setPetThemeMode('space');const cold=t.getPetTheme();
 const channels=hex=>hex.match(/[a-f0-9]{2}/gi).map(x=>parseInt(x,16));
 assert.ok(channels(cold.page).every(v=>v>=238));assert.ok(channels(cold.surface).every(v=>v>=244));
 t.rememberPetTheme(a,{blend:true,backgroundRgb:[230,213,195]});const warm=t.getPetTheme();
 assert.ok(channels(warm.page).every(v=>v>=238));assert.notEqual(warm.page,cold.page);
 assert.ok(channels(warm.ink).every(v=>v<60));assert.equal(warm.primary,'#596650','brand sage stays consistent across pets');
 const restart=theme(disk);restart.setThemePet(a);assert.equal(restart.getPetTheme().mode,'space');assert.equal(restart.getPetTheme().page,warm.page);
 restart.setPetThemeMode('ambient');assert.notEqual(restart.getPetTheme().page,warm.page);
 restart.setPetThemeMode('studio');assert.deepEqual(restart.petThemeVariables(),{});
});
