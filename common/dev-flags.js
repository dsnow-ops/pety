const isDevelopment = PETY_IS_DEVELOPMENT === true;
const allowMultiPetTesting =
  isDevelopment &&
  PETY_ALLOW_MULTI_PET_TESTING === true;

export const DEV_ENVIRONMENT = Object.freeze({
  mode: isDevelopment ? 'development' : 'production',
  isDevelopment,
  source: 'vite.define',
  allowMultiPetTesting
});

export const DEV_MULTI_PET_LIMIT = 3;

export const DEV_FLAGS = Object.freeze({
  allowMultiPetTesting
});

let hasLoggedDiagnostics = false;

export function isDevelopmentEnvironment() {
  return isDevelopment;
}

export function logDevFlagDiagnosticsOnce() {
  if (!isDevelopment || hasLoggedDiagnostics) return;

  console.info(`[DEV FLAGS] allowMultiPetTesting=${allowMultiPetTesting}`);
  hasLoggedDiagnostics = true;
}

export function isMultiPetTestingEnabled() {
  logDevFlagDiagnosticsOnce();
  return allowMultiPetTesting;
}
