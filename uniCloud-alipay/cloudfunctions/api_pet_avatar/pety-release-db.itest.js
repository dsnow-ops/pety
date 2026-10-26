// Run only through the official HBuilderX integration runner, against the
// explicitly authorized test space. This tests DB semantics, not client login.
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
const require = createRequire(import.meta.url);
const { createQuotaLedger, ledgerId } = require('./avatar-quota-ledger.js');

test('release isolated quota: actual cloud CAS, idempotent settlement and owner separation', async () => {
  expect(process.env.UNICLOUD_TEST_MODE).toBe('integration');
  expect(process.env.UNICLOUD_TEST_PROVIDER).toBe('alipay');
  const marker = `pety-release-20261013-${randomUUID()}`;
  const a = {owner:marker+'-A',pet:'synthetic-cat',pool:'free',cycle:'free-lifetime'};
  const b = {...a,owner:marker+'-B'};
  const allowedIds = new Set([ledgerId(a),ledgerId(b)]);
  let operations = 0;
  await uniCloudTest.seed(async db => {
    // The CLI's test-space label is a placeholder. The official runtime sets
    // this public metadata from the actual selected space before this callback.
    const target=JSON.parse(process.env.UNICLOUD_SPACE_INFO || '{}');
    expect(target.provider).toBe('alipay');
    expect(target.spaceId).toBe('env-00jy6ft635sf');
    const real = db.collection('pety_avatar_quota_ledgers');
    const checked = id => {if(!allowedIds.has(id))throw Error('TEST_SCOPE_VIOLATION');if(++operations>90)throw Error('TEST_OPERATION_BUDGET');};
    const collection = {
      doc(id) { return {get:async()=>{checked(id);return real.doc(id).get();}}; },
      async add(row) {checked(row._id);if(![a.owner,b.owner].includes(row.owner))throw Error('TEST_SCOPE_VIOLATION');return real.add({...row,releaseTest:marker});},
      where(filter) {return {update:async patch=>{checked(filter._id);if(![a.owner,b.owner].includes(filter.owner))throw Error('TEST_SCOPE_VIOLATION');return real.where(filter).update(patch);}};}
    };
    const ledger=createQuotaLedger(collection,async()=>[],value=>db.command.set(value));
    // Initialise serially so the test is specifically about concurrent CAS.
    expect(await ledger.read(a)).toEqual({used:0,reserved:0});
    const reservations=await Promise.allSettled(['r0','r1','r2','r3'].map(key=>ledger.reserve(a,key)));
    const accepted=reservations.flatMap((r,i)=>r.status==='fulfilled'?['r'+i]:[]);
    expect(accepted.length).toBe(3);
    expect(reservations.filter(r=>r.status==='rejected').map(r=>r.reason.code)).toEqual(['AVATAR_QUOTA_EXCEEDED']);
    expect(await ledger.read(a)).toEqual({used:0,reserved:3});
    await ledger.consume(a,accepted[0]);await ledger.consume(a,accepted[0]);await ledger.release(a,accepted[0]);
    expect(await ledger.read(a)).toEqual({used:1,reserved:2});
    await ledger.release(a,accepted[1]);
    expect(await ledger.read(a)).toEqual({used:1,reserved:1});
    const recovered=createQuotaLedger(collection,async()=>{throw Error('EXISTING_LEDGER_MUST_NOT_RESEED');},value=>db.command.set(value));
    expect((await recovered.reserve(a,accepted[2])).fresh).toBe(false);
    expect(await recovered.read(a)).toEqual({used:1,reserved:1});
    await ledger.reserve(b,'r0');expect(await ledger.read(b)).toEqual({used:0,reserved:1});
    expect(await ledger.read(a)).toEqual({used:1,reserved:1});
  });
  // Keep two clearly marked synthetic rows for evidence. No deletes or users.
  console.info('PETY_RELEASE_DB_RESULT',JSON.stringify({pass:true,operations,testRows:2,providerCalls:0,deletedRows:0,verification:'local-official-runtime-with-real-test-database'}));
}, 60000);
