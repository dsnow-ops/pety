test('release read-only transaction API probe',async()=>{
 expect(process.env.UNICLOUD_TEST_MODE).toBe('integration');
 await uniCloudTest.seed(async db=>{
  expect(JSON.parse(process.env.UNICLOUD_SPACE_INFO||'{}').spaceId).toBe('env-00jy6ft635sf');
  const tx=await db.startTransaction();
  try{const c=tx.collection('pety_memberships');console.info('PETY_TRANSACTION_API',JSON.stringify({where:typeof c.where,doc:typeof c.doc,add:typeof c.add}));}
  finally{await tx.rollback();}
 });
},30000);
