const {
  logout
} = require('../../lib/utils/logout')

/**
 * 用户退出登录
 * @tutorial https://uniapp.dcloud.net.cn/uniCloud/uni-id-pages.html#logout
 * @returns
 */
module.exports = async function () {
  const sessions=require('pety-auth/sessions');if(sessions.enabled())await sessions.service().logout(this.authInfo.uid,this.petySessionProof)
  await logout.call(this)
  return {
    errCode: 0
  }
}
