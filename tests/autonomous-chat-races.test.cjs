'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const root = path.resolve(__dirname, '..');
const testScope = Object.freeze({namespace:'guest:local',version:0,ready:true});
function loadPage(bindings = {}) {
  const script = fs.readFileSync(path.join(root, 'pages/chat/chat.vue'), 'utf8').match(/<script[^>]*>([\s\S]*?)<\/script>/)[1]
    .replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g, '').replace('export default', 'return');
  const runtimeBindings = {
    carePhotoMixin: {}, CarePhotoComposer: {}, CarePhotoResult: {},
    PetAvatarImage: {},
    captureDataScope: () => testScope,
    isDataScopeCurrent: scope => scope === testScope,
    t: key => key === 'chat.requestInterrupted'
      ? 'This response stopped when the page changed.'
      : key,
    ...bindings
  };
  return Function(...Object.keys(runtimeBindings), script)(...Object.values(runtimeBindings));
}
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
test('summary storage failure leaves the received reply intact and reports local save failure',()=>{
 const notices=[],page=loadPage({AiDataConsentSheet:{},saveConsultationRecord:()=>{throw Error('TEST disk full');},uni:{showToast:x=>notices.push(x)},console:{warn(){}}});
 const context={activePetId:'TEST-P1',contextBadges:[],messageList:[{type:'ai',content:'TEST received reply'}]};
 assert.equal(page.methods.saveConsultationSummary.call(context,'TEST question','TEST answer',{level:'normal',terms:[]}),false);
 assert.equal(context.messageList.length,1);assert.equal(context.messageList[0].content,'TEST received reply');assert.match(notices[0].title,/摘要未保存/);
});
const contextId = (pet, stage) => `${pet}:${stage}`;
function makeMethods(extra = {}) {
  const page = loadPage({ AiDataConsentSheet: {}, MEMORIAL_OWNER_CALL_OPTIONS: [], isReduceMotionEnabled: () => false });
  return Object.assign({}, page.methods, {
    isSending: false, inputText: 'hello', activePetId: 'A', activePet: { id: 'A' }, activeStatus: 'current',
    loadedChatContextId: 'A:current', pageVisible: true, interactionSession: 0, requestSequence: 0,
    loadedDataScope: testScope,
    detectUrgentRisk: () => ({ level: 'normal', terms: [] })
  }, extra);
}
test('the first tap locks chat before async risk confirmation', async () => {
  const wait = deferred(); let confirmations = 0;
  const vm = makeMethods({ confirmRiskIfNeeded() { confirmations++; return wait.promise; } });
  global.uni = { showToast() {} };
  global.hasAiConsent = () => true;
  global.getPetRelationshipStage = () => 'current';
  global.getChatContextId = contextId;
  const first = vm.sendMessage();
  const second = vm.sendMessage();
  assert.equal(vm.isSending, true); assert.equal(confirmations, 1);
  wait.resolve(false); await Promise.all([first, second]);
  assert.equal(vm.isSending, false);
});
test('a stale confirmation cannot unlock a newer pet request', async () => {
  const wait = deferred();
  const vm = makeMethods({ confirmRiskIfNeeded: () => wait.promise });
  global.uni = { showToast() {} };
  global.hasAiConsent = () => true;
  global.getPetRelationshipStage = () => 'current';
  global.getChatContextId = contextId;
  const old = vm.sendMessage();
  vm.interactionSession += 1; vm.activePetId = 'B'; vm.activePet = { id: 'B' };
  vm.loadedChatContextId = 'B:current'; vm.isSending = true;
  wait.resolve(false); await old;
  assert.equal(vm.isSending, true);
});
test('a late similar-case result is persisted only to its owning pet session', () => {
  const sessions = new Map([['A', [{ id: 'case-A', petId: 'A', relationshipStage: 'current', type: 'ai', replySource: 'similar_case_search', similarCaseJobId: 'job', createdAt: 1 }]]]);
  const page = loadPage({
    AiDataConsentSheet: {}, MEMORIAL_OWNER_CALL_OPTIONS: [], isReduceMotionEnabled: () => false,
    getChatContextId: contextId,
    loadChatSession: pet => sessions.get(pet) || [],
    saveChatSession: (pet, stage, messages) => sessions.set(pet, messages)
  });
  const vm = Object.assign({}, page.methods, { loadedDataScope:testScope, pageVisible: true, activePetId: 'B', activeStatus: 'current', loadedChatContextId: 'B:current' });
  const message = { ...sessions.get('A')[0], similarCaseJobStatus: 'SUCCEEDED', similarCaseResult: { state: 'NO_RESULTS', cases: [] } };
  vm.persistSimilarCaseMessage(message);
  assert.equal(sessions.get('A')[0].similarCaseJobStatus, 'SUCCEEDED');
  assert.equal(sessions.has('B'), false);
});
test('an older failed poll cannot overwrite a newer successful result', async () => {
  const first = deferred();
  const second = deferred();
  let calls = 0;
  global.uniCloud = { callFunction: () => (++calls === 1 ? first.promise : second.promise) };
  const vm = makeMethods({
    similarCopy: { searching: 'searching', failed: 'failed', timeout: 'timeout' },
    isMemorialMode: false,
    messageList: [],
    persistSimilarCaseMessage() {},
    scrollToBottom() {},
    scheduleSimilarCasePoll() {},
    startSimilarCaseProcessor() {}
  });
  global.getChatContextId = contextId;
  const message = {
    id: 'case-race', petId: 'A', relationshipStage: 'current', replySource: 'similar_case_search',
    similarCaseJobId: 'job-race', similarCaseJobStatus: 'RUNNING', similarCaseState: 'SEARCHING', createdAt: Date.now()
  };
  vm.messageList = [message];
  const oldPoll = vm.pollSimilarCaseSearch(message);
  const newPoll = vm.pollSimilarCaseSearch(message);
  second.resolve({ result: { code: 0, status: 'SUCCEEDED', similarCaseResult: { state: 'NO_RESULTS', summary: '', cases: [] } } });
  await newPoll;
  first.resolve({ result: { code: 0, status: 'FAILED', errorCode: 'FAILED_OLD' } });
  await oldPoll;
  assert.equal(message.similarCaseJobStatus, 'SUCCEEDED');
  assert.equal(message.similarCaseState, 'NO_RESULTS');
});
test('similar-case retry keeps the original query', () => {
  let captured = null;
  const vm = makeMethods({ searchSimilarCases(query, message) { captured = { query, message }; } });
  const message = { id: 'failed', similarCaseState: 'FAILED', similarCaseQuery: 'vomited twice' };
  vm.retrySimilarCaseSearch(message);
  assert.deepEqual(captured, { query: 'vomited twice', message });
});
test('leaving during a request persists a recoverable interruption state', () => {
  const userMessage = { id: 'request-A', petId: 'A', relationshipStage: 'current', type: 'user', content: 'Is this normal?' };
  let saved = null;
  global.t = () => 'Request stopped. Send it again.';
  const vm = makeMethods({
    locale: 'en', activeRequestUserId: 'request-A', messageList: [userMessage],
    saveChatHistory() { saved = this.messageList.map(message => ({ ...message })); }
  });
  vm.markActiveRequestInterrupted();
  assert.equal(vm.activeRequestUserId, '');
  assert.equal(saved.length, 2);
  assert.equal(saved[0].excludeFromHistory, true);
  assert.equal(saved[1].replySource, 'error');
  assert.match(saved[1].content, /stopped/i);
});
