// One unfinished creation form, held only for this app session. Never copy a
// guest pet, photos, records or entitlements into an authenticated account.
let pending = null;
const MAX_AGE = 30 * 60 * 1000;

export function beginPetCreationIntent(form = {}) {
  const id = `create_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  pending = { id, at: Date.now(), form: {
    petName: String(form.petName || '').trim().slice(0, 30),
    petType: ['cat', 'dog', 'other'].includes(form.petType) ? form.petType : 'cat',
    petTypeCustom: String(form.petTypeCustom || '').trim().slice(0, 20),
    petGender: ['male', 'female', 'unknown'].includes(form.petGender) ? form.petGender : 'unknown'
  } };
  return `/pages/welcome/welcome?mode=create&resume=${id}`;
}

export function takePetCreationIntent(id) {
  if (!pending || pending.id !== id) return null;
  const intent = pending;
  pending = null;
  return Date.now() - intent.at <= MAX_AGE ? intent.form : null;
}
