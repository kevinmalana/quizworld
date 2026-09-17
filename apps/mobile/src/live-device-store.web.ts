import { playerStore } from "./live-store";
// Browser-preview-only tab storage, not native encrypted storage.
const adapter = {
  get: async (key: string) => sessionStorage.getItem(key),
  set: async (key: string, value: string) => sessionStorage.setItem(key, value),
  remove: async (key: string) => sessionStorage.removeItem(key),
};
const stores = new Map<string, ReturnType<typeof playerStore>>();
export function livePlayerStoreFor(accountId?: string) {
  const scope = accountId || 'guest';
  if (!stores.has(scope)) stores.set(scope, playerStore(adapter, accountId));
  return stores.get(scope)!;
}
export const livePlayerStore = livePlayerStoreFor();
