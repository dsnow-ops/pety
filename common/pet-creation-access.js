import { getPetList, isPlusMember } from './pet-store.js';
import {
  DEV_FLAGS,
  DEV_MULTI_PET_LIMIT,
  isDevelopmentEnvironment,
  isMultiPetTestingEnabled
} from './dev-flags.js';

const FREE_PET_LIMIT = 1;
let lastDiagnosticSignature = '';

function normalizePetCount(petCount) {
  const count = Number(petCount);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function membershipAllowsMultiplePets(membership) {
  if (typeof membership === 'boolean') return membership;
  return Boolean(membership && membership.allowsMultiplePets);
}

export function getPetCreationDecision({
  petCount = 0,
  membership = false,
  allowMultiPetTesting = DEV_FLAGS.allowMultiPetTesting
} = {}) {
  const normalizedPetCount = normalizePetCount(petCount);
  const hasMultiPetMembership = membershipAllowsMultiplePets(membership);

  if (allowMultiPetTesting && normalizedPetCount < DEV_MULTI_PET_LIMIT) {
    return {
      allowed: true,
      reason: 'development_bypass',
      limit: DEV_MULTI_PET_LIMIT
    };
  }

  if (hasMultiPetMembership) {
    return {
      allowed: true,
      reason: 'membership',
      limit: Number.POSITIVE_INFINITY
    };
  }

  if (normalizedPetCount < FREE_PET_LIMIT) {
    return {
      allowed: true,
      reason: 'free_allowance',
      limit: FREE_PET_LIMIT
    };
  }

  return {
    allowed: false,
    reason: allowMultiPetTesting ? 'development_limit_reached' : 'membership_required',
    limit: allowMultiPetTesting ? DEV_MULTI_PET_LIMIT : FREE_PET_LIMIT
  };
}

function logPetCreationAccess(context, decision) {
  if (!isDevelopmentEnvironment()) return;

  const diagnostic = {
    petCount: context.petCount,
    isPlus: Boolean(context.membership && context.membership.allowsMultiplePets),
    allowMultiPetTesting: context.allowMultiPetTesting,
    devLimit: DEV_MULTI_PET_LIMIT,
    allowed: decision.allowed,
    reason: decision.reason
  };
  const signature = JSON.stringify(diagnostic);
  if (signature === lastDiagnosticSignature) return;

  console.info('[PET CREATE ACCESS]', diagnostic);
  lastDiagnosticSignature = signature;
}

export function canCreateAnotherPet(options) {
  const context = options || {
    petCount: getPetList().length,
    membership: {
      allowsMultiplePets: isPlusMember()
    },
    allowMultiPetTesting: isMultiPetTestingEnabled()
  };
  const decision = getPetCreationDecision(context);
  logPetCreationAccess(context, decision);
  return decision;
}

export function getCurrentPetCreationAccess() {
  return canCreateAnotherPet();
}
