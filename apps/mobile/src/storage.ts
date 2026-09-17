import type { StudyState } from './study/types';
import { emptyState } from './study/model';
import { stateSchema } from './schema';
export const STORAGE_KEY = 'quizworld:guest-study:v1';
export const MAX_STORAGE_BYTES = 2_000_000;
export type StorageAdapter = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
export function createRepository(storage: StorageAdapter) {
  return {
    async load(): Promise<StudyState> {
      const raw = await storage.getItem(STORAGE_KEY);
      if (raw === null) return emptyState();
      try {
        if (raw.length * 2 > MAX_STORAGE_BYTES) throw new Error('Too large');
        return stateSchema.parse(JSON.parse(raw));
      } catch { throw new Error('Saved practice could not be read. Retry, or explicitly reset this device. Your existing data has not been overwritten.'); }
    },
    async save(state: StudyState): Promise<void> {
      const parsed = stateSchema.safeParse(state);
      if (!parsed.success) throw new Error('Practice limit reached or data is invalid. Clear older review items in Review to continue.');
      const raw = JSON.stringify(parsed.data);
      if (raw.length * 2 > MAX_STORAGE_BYTES) throw new Error('Device practice storage limit reached. Clear review items to continue.');
      // One whole-state write. Callers await success before publishing state.
      await storage.setItem(STORAGE_KEY, raw);
    },
  };
}
