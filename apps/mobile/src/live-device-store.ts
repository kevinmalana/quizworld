import * as SecureStore from "expo-secure-store";
import { playerStore } from "./live-store";
// Native player capabilities never enter AsyncStorage, practice exports or logs.
export const livePlayerStore = playerStore({
  get: (key) => SecureStore.getItemAsync(key),
  set: (key, value) =>
    SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }),
  remove: (key) => SecureStore.deleteItemAsync(key),
});
