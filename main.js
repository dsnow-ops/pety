import {sessionDraftMixin} from './common/single-session-client.js'
import App from './App'
import VisualLockContract from './components/VisualLockContract.vue'
import AppButton from './components/AppButton.vue'
import AppSurface from './components/AppSurface.vue'
import AppSegmented from './components/AppSegmented.vue'
import AppSettingsRow from './components/AppSettingsRow.vue'
import { t } from './common/i18n.js'
import { petAppThemeMixin } from './common/pet-app-theme-mixin.js'

// #ifndef VUE3
import Vue from 'vue'
import './uni.promisify.adaptor'
Vue.config.productionTip = false
Vue.prototype.$t = t
Vue.mixin(petAppThemeMixin)
App.mpType = 'app'
const app = new Vue({
  ...App
})
app.$mount()
// #endif

// #ifdef VUE3
import { createSSRApp } from 'vue'
export function createApp() {
  const app = createSSRApp(App)
  if(process.env.NODE_ENV!=='production')app.component('VisualLockContract',VisualLockContract)
  app.component('AppButton',AppButton)
  app.component('AppSurface',AppSurface)
  app.component('AppSegmented',AppSegmented)
  app.component('AppSettingsRow',AppSettingsRow)
  app.mixin(petAppThemeMixin)
  app.mixin(sessionDraftMixin)
  app.config.globalProperties.$t = t
  return {
    app
  }
}
// #endif
