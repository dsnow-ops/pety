const {
  ERROR
} = require('../../common/error')
const {
  isExtStorageEnabled,
  getExtStorageManager
} = require('../../lib/utils/ext-storage')

/**
 * 获取 uni-id 范围内文件的临时访问链接
 * 内置存储 (cloud://) 由前端 uniCloud.getTempFileURL 直接换链，无需走该接口
 * 扩展存储 (qiniu:// 等) 必须经云端 extStorageManager.getTempFileURL
 * @param {Object} params
 * @param {String} params.fileID  文件 fileID（扩展存储 URI 或 cloud://）
 * @returns {Object} { errCode, tempFileURL }
 */
module.exports = async function ({ fileID } = {}) {
  if (typeof fileID !== 'string' || !fileID) {
    throw {
      errCode: ERROR.INVALID_PARAM
    }
  }

  const uid = this.authInfo && this.authInfo.uid
  const record = uid && await uniCloud.database().collection('uni-id-users').doc(uid).field({ avatar_file: true }).get()
  const avatar = record && record.data && record.data[0] && record.data[0].avatar_file
  if (!avatar || avatar.url !== fileID) {
    throw { errCode: 'pety-file-access-denied', errMsg: '无法访问该文件。' }
  }
  // A writable avatar pointer is not proof that an arbitrary storage object is
  // owned. Bind signed objects to the server's per-user upload path as well.
  if (!/^https?:\/\//.test(fileID)) {
    const match = fileID.match(/^[a-z][a-z0-9-]*:\/\/[^/?#]+\/([^?#]+)$/i)
    const path = match && match[1]
    const ownPath = typeof uid === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(uid) && path &&
      (path.startsWith(`user/avatar/${uid}/`) || path.startsWith(`user/${uid}/`) || new RegExp(`^${uid}[0-9]{13}\\.(png|jpe?g)$`, 'i').test(path))
    if (!ownPath || path.split('/').some(part => !part || part === '.' || part === '..' || /[%\\]/.test(part))) {
      throw { errCode: 'pety-file-access-denied', errMsg: '无法访问该文件。' }
    }
  }

  let tempFileURL
  if (fileID.startsWith('cloud://')) {
    const res = await uniCloud.getTempFileURL({ fileList: [fileID] })
    tempFileURL = res && res.fileList && res.fileList[0] && res.fileList[0].tempFileURL
  } else if (fileID.startsWith('http://') || fileID.startsWith('https://')) {
    tempFileURL = fileID
  } else {
    const storageConfig = this.config && this.config.service && this.config.service.storage
    if (!isExtStorageEnabled(storageConfig)) {
      throw new Error(`无法解析 fileID "${fileID}": 未配置使用扩展存储 (service.storage.mode !== "ext")`)
    }
    const extStorageManager = getExtStorageManager(storageConfig)
    const res = await extStorageManager.getTempFileURL({ fileList: [fileID] })
    tempFileURL = res && res.fileList && res.fileList[0] && res.fileList[0].tempFileURL
  }

  return {
    errCode: 0,
    tempFileURL
  }
}
