import { defineConfig, loadEnv } from 'vite';
import uni from '@dcloudio/vite-plugin-uni';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname);
  const isDevelopment =
    mode === 'development' ||
    process.env.NODE_ENV === 'development';
  const allowMultiPetTesting =
    isDevelopment &&
    String(env.VITE_ALLOW_MULTI_PET_TESTING || '').trim().toLowerCase() === 'true';
  const isAvatarDevelopment = mode === 'development';
  const allowAvatarMemberBypass =
    isAvatarDevelopment &&
    String(env.VITE_PETY_DEV_MEMBER_BYPASS || '').trim().toLowerCase() === 'true';

  return {
    plugins: [uni()],
    define: {
      PETY_IS_DEVELOPMENT: JSON.stringify(isDevelopment),
      PETY_ALLOW_MULTI_PET_TESTING: JSON.stringify(allowMultiPetTesting),
      PETY_AVATAR_IS_DEVELOPMENT: JSON.stringify(isAvatarDevelopment),
      PETY_AVATAR_DEV_MEMBER_BYPASS: JSON.stringify(allowAvatarMemberBypass)
    }
  };
});
