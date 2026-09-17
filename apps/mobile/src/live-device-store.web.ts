import { playerStore } from "./live-store";
// Browser-preview-only tab storage, not native encrypted storage.
export const livePlayerStore = playerStore({
  get: async (key) => sessionStorage.getItem(key),
  set: async (key, value) => sessionStorage.setItem(key, value),
  remove: async (key) => sessionStorage.removeItem(key),
});
