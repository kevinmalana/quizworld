import type { CredentialStore } from './auth';
const key = 'quizworld.auth.refresh.v1';
// Browser preview only: tab storage is NOT native encrypted credential storage.
export const credentialStore: CredentialStore = {
  get: async () => sessionStorage.getItem(key),
  set: async token => { sessionStorage.setItem(key, token); },
  remove: async () => { sessionStorage.removeItem(key); },
};
