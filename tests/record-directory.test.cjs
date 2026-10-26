const test = require('node:test'), assert = require('node:assert/strict');
const { moduleFrom } = require('../scripts/lib/health-recovery-runtime.cjs');
const { buildRecordDirectory, queryRecords } = moduleFrom('common/record-views.js', 'buildRecordDirectory,queryRecords', { eventTimeLabel: r => r.localDate || '时间未详' });
const scope = { namespace: 'account:TEST-A', petId: 'TEST-P1' };
const row = (id, patch = {}) => ({ id, ...scope, original: 'TEST 窗边', kind: 'life', media: [], createdAt: 1, ...patch });
test('month directory preserves uncertain dates, includes all records beyond first page, excludes foreign data and drafts', () => {
 const rows = Array.from({length:45}, (_,i)=>row('r'+i,{localDate:'2026-10-01'}));
 rows.push(row('month',{eventTime:{precision:'month',year:2025,month:9}}),row('year',{eventTime:{precision:'year',year:2024}}),row('unknown'),row('foreign',{petId:'TEST-P2'}),row('account',{namespace:'account:TEST-B'}),row('draft',{_group:'drafts'}),row('care',{kind:'care',original:'private'}));
 const before=JSON.stringify(rows), groups=buildRecordDirectory(rows,scope);
 assert.deepEqual(groups.map(g=>[g.key,g.count]),[['2026-10',45],['2025-09',1],['year:2024',1],['unknown',1]]);
 assert.deepEqual(queryRecords(rows,{...scope,period:'year:2024'}).rows.map(r=>r.id),['year']);
 assert.deepEqual(queryRecords(rows,{...scope,period:'2025-09'}).rows.map(r=>r.id),['month']);
 assert.equal(JSON.stringify(rows),before);
 assert.deepEqual(buildRecordDirectory(rows,{}),[]);
});
test('only durable owner-bound life photos contribute; no private text is copied into directory', () => {
 const photo={id:'photo',...scope,durable:true,purpose:'life'};
 const groups=buildRecordDirectory([row('a',{original:'',media:[photo,{...photo,petId:'OTHER'},{...photo,durable:false}]}),row('b',{note:'TEST 私密健康',media:[photo]})],scope);
 assert.equal(groups[0].photos,1);
 assert.doesNotMatch(JSON.stringify(groups),/私密|窗边|account:|"photo"/);
});
