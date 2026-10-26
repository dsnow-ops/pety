const assert = require('node:assert/strict');
const clientUni = { getStorageSync: key => key === 'uni_id_token' ? 'isolated-client-token' : null };
function ownedMediaCloud(resolve) {
  return {
    getTempFileURL() { throw Error('Client storage signing must not bypass owned media endpoint'); },
    async callFunction({ name, data }) {
      assert.equal(name, 'api_pet_avatar');
      assert.ok(['getOwnedMediaUrls', 'getAvatarDisplayUrls'].includes(data.action));
      const response = await resolve({ fileList: data.fileIds, petId: data.petId });
      return { result: { code: 0, ...response } };
    }
  };
}
module.exports = { ownedMediaCloud, clientUni };
