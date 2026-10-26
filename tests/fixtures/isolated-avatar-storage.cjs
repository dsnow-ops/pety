const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { createRequire } = require('node:module');
function isolatedStorage(downloadHttps, cloud) {
  const file = path.resolve('uniCloud-alipay/cloudfunctions/api_pet_avatar/storage.js');
  const original = createRequire(file), module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), { module, exports: module.exports, Buffer, console,
    uniCloud: cloud, require: name => name === './safe-download' ? { downloadHttps } : original(name)
  }, { filename: file });
  return module.exports;
}
module.exports = { isolatedStorage };
