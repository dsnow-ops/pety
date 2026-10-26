// Pety RC: public administrator bootstrap is disabled in every build.
// Existing administrators are unaffected. Provisioning requires an audited operator workflow.
module.exports = async function () {
  return { errCode: 'uni-id-admin-bootstrap-disabled', errMsg: '管理员初始化入口已关闭。' }
}
