// Isolated service-verifier stub. Existing pipeline tests still traverse the
// real request-context gate; a bare context.uid no longer grants ownership.
const Module = require('node:module');
module.exports = async function authorize(api, uid, context = {}) {
  const load = Module._load;
  Module._load = function(name, ...args) {
    if (name === 'pety-auth') return { verifyRequest: async event => {
      if (event.uniIdToken !== 'isolated-token') throw Error('invalid test token');
      return { uid };
    } };
    return load.call(this, name, ...args);
  };
  try { return await api.authorizeAvatarContext({ uniIdToken: 'isolated-token' }, context); }
  finally { Module._load = load; }
};
