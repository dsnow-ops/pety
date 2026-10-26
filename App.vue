<script>
 import {checkActiveSession} from './common/single-session-client.js';
	import { installStudioTrace, studioTrace } from './common/card-studio-navigation.js';
	import { restoreUserProfile } from './common/auth-store.js';
	import { initializeAppLocale } from './common/i18n.js';
	// #ifdef APP-PLUS
	import { installNativeAvatarFileCache } from './common/avatar-file-cache-runtime.js';
	// #endif

	export default {
		onLaunch: function(options) {
			installStudioTrace(process.env.NODE_ENV === 'development');
			studioTrace('launch', {route:options?.path||'',parameterKeys:Object.keys(options?.query||{})});
			// #ifdef APP-PLUS
			installNativeAvatarFileCache();
			// #endif
			initializeAppLocale();
			restoreUserProfile().catch(() => {});
		},
		onShow: function() {checkActiveSession();},
		onHide: function() {}
	}
</script>

<style>
	@import './common/pet-app-theme.css';
	@import './common/ui-system-v2.css';
	@import './common/ui-page-roles.css';
	page {background:#25241E;color:#E2E8DC;}
	view,
	text,
	input,
	textarea,
	button {
		box-sizing: border-box;
	}
</style>
