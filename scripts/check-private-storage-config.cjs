'use strict';
// Local metadata only: no cloud SDK, network, secret output or file writes.
const fs = require('fs');
const { checkPrivateStorageConfig } = require('../uniCloud-alipay/cloudfunctions/common/pety-auth/private-storage');
const file = 'uniCloud-alipay/cloudfunctions/common/uni-config-center/pety-storage/config.json';
const exists = fs.existsSync(file);
let config = {}, parseError = false;
if (exists) {
  try { config = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (_) { parseError = true; }
}
console.log(JSON.stringify({ file, exists, parseError, ...checkPrivateStorageConfig(config),
  limits: 'Local fields only. Remote credentials, RAM, ACL, policy, versioning, CORS, SDK and phone are unverified.' }, null, 2));
