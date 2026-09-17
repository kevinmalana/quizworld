import { savedPlayerSchema, type SavedPlayer } from "./live";
export function playerStore(adapter: {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}) {
  const key = "quizworld.live-player.v1";
  let tail: Promise<unknown> = Promise.resolve();
  const serialize = <T>(action: () => Promise<T>) => {
    const next = tail.then(action, action);
    tail = next.catch(() => {});
    return next;
  };
  return {
    load: () =>
      serialize(async () => {
        const raw = await adapter.get(key);
        return raw === null ? null : savedPlayerSchema.parse(JSON.parse(raw));
      }),
    save: (value: SavedPlayer) =>
      serialize(() =>
        adapter.set(key, JSON.stringify(savedPlayerSchema.parse(value))),
      ),
    clear: () => serialize(() => adapter.remove(key)),
  };
}
