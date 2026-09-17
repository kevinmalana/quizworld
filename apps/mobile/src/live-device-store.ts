import * as SecureStore from "expo-secure-store";
import { playerStore } from "./live-store";
// Native player capabilities never enter AsyncStorage, practice exports or logs.
const adapter = {
  get: (key: string) => SecureStore.getItemAsync(key),
  set: (key: string, value: string) =>
    SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }),
  remove: (key: string) => SecureStore.deleteItemAsync(key),
};
const stores = new Map<string, ReturnType<typeof playerStore>>();
export function livePlayerStoreFor(accountId?: string) {
  const scope = accountId || 'guest';
  if (!stores.has(scope)) stores.set(scope, playerStore(adapter, accountId));
  return stores.get(scope)!;
}
export const livePlayerStore = livePlayerStoreFor();
