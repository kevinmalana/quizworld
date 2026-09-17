import * as SecureStore from 'expo-secure-store';
import type { CredentialStore } from './auth';
const key = 'quizworld.auth.refresh.v1';
// Only the small refresh capability is persisted; never the full JWT/user JSON.
export const credentialStore: CredentialStore = {
  get: () => SecureStore.getItemAsync(key),
  set: token => SecureStore.setItemAsync(key, token, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
  remove: () => SecureStore.deleteItemAsync(key),
};
