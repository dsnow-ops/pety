const FLAG_SOURCE = 'VITE_ALLOW_MULTI_PET_TESTING';

function readViteEnvironment() {
  try {
    return import.meta && import.meta.env ? import.meta.env : {};
  } catch (error) {
    return {};
  }
}

function readProcessEnvironment() {
  try {
    return typeof process !== 'undefined' && process.env ? process.env : {};
  } catch (error) {
    return {};
  }
}

function resolveEnvironment() {
  const viteEnvironment = readViteEnvironment();
  const processEnvironment = readProcessEnvironment();
  const mode = String(
    viteEnvironment.MODE ||
    processEnvironment.NODE_ENV ||
    'unknown'
  ).toLowerCase();
  const isDevelopment = viteEnvironment.DEV === true || mode === 'development';
  const rawFlag = viteEnvironment[FLAG_SOURCE] !== undefined
    ? viteEnvironment[FLAG_SOURCE]
    : processEnvironment[FLAG_SOURCE];
  const explicitlyEnabled = String(rawFlag || '').toLowerCase() === 'true';

  return Object.freeze({
    mode,
    isDevelopment,
    source: FLAG_SOURCE,
    allowMultiPetTesting: isDevelopment && explicitlyEnabled
  });
}

export const DEV_ENVIRONMENT = resolveEnvironment();

export const DEV_MULTI_PET_LIMIT = 3;

export const DEV_FLAGS = Object.freeze({
  allowMultiPetTesting: DEV_ENVIRONMENT.allowMultiPetTesting
});

let hasLoggedDiagnostics = false;

export function isDevelopmentEnvironment() {
  return DEV_ENVIRONMENT.isDevelopment;
}

export function logDevFlagDiagnosticsOnce() {
  if (!DEV_ENVIRONMENT.isDevelopment || hasLoggedDiagnostics) return;

  console.info(`[DEV FLAGS] mode=${DEV_ENVIRONMENT.mode}`);
  console.info(`[DEV FLAGS] allowMultiPetTesting=${DEV_FLAGS.allowMultiPetTesting}`);
  console.info(`[DEV FLAGS] source=${DEV_ENVIRONMENT.source}`);
  hasLoggedDiagnostics = true;
}

export function isMultiPetTestingEnabled() {
  logDevFlagDiagnosticsOnce();
  return DEV_FLAGS.allowMultiPetTesting;
}
