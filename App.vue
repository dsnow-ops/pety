<script>
	export default {
		onLaunch: function() {},
		onShow: function() {},
		onHide: function() {}
	}
</script>

<style>
	page {
		--pety-page-bg: #F5F2EC;
		--pety-surface: #FCFAF6;
		--pety-surface-muted: #EEE9E0;
		--pety-text: #2F2A24;
		--pety-text-secondary: #786F64;
		--pety-rule: #E4DED4;
		--pety-primary: #6D5945;
		--pety-primary-soft: #EAE1D6;
		--pety-accent: #73806C;
		--pety-danger: #A65353;
		--pety-shadow: 0 14rpx 38rpx rgba(58, 49, 39, 0.08);
		--pety-page-gutter: 32rpx;
		--pety-radius: 24rpx;
		--pety-button-height: 88rpx;
		background: #F4F1EA;
		color: #302A23;
		font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
	}

	.theme-current {
		--pety-page-bg: #F5F2EC;
		--pety-surface: #FCFAF6;
		--pety-surface-muted: #EEE9E0;
		--pety-text: #2F2A24;
		--pety-text-secondary: #786F64;
		--pety-rule: #E4DED4;
		--pety-primary: #6D5945;
		--pety-primary-soft: #EAE1D6;
		--pety-accent: #73806C;
		--pety-danger: #A65353;
		--pety-shadow: 0 14rpx 38rpx rgba(58, 49, 39, 0.08);
	}

	.theme-memorial {
		--pety-page-bg: #F2F1F3;
		--pety-surface: #FAF9FB;
		--pety-surface-muted: #E8E7EC;
		--pety-text: #2D2E35;
		--pety-text-secondary: #737580;
		--pety-rule: #DDDDE3;
		--pety-primary: #62677A;
		--pety-primary-soft: #E2E3EA;
		--pety-accent: #8A7968;
		--pety-danger: #9D555B;
		--pety-shadow: 0 14rpx 38rpx rgba(49, 51, 62, 0.08);
	}

	view,
	text,
	input,
	textarea,
	button {
		box-sizing: border-box;
	}
</style>
