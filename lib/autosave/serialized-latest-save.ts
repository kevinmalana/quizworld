export type AutosaveStatus = "saved" | "dirty" | "saving" | "error";

export type AutosaveSnapshot = {
  status: AutosaveStatus;
  error: Error | null;
};

type Pending<T> = { version: number; value: T };

/** Serializes persistence while retaining only the newest pending state. */
export class SerializedLatestSaveQueue<T> {
  private version = 0;
  private savedVersion = 0;
  private pending: Pending<T> | null = null;
  private running: Promise<void> | null = null;
  private listeners = new Set<(snapshot: AutosaveSnapshot) => void>();
  private snapshot: AutosaveSnapshot = { status: "saved", error: null };

  constructor(private readonly save: (value: T) => Promise<unknown>) {}

  getSnapshot = () => this.snapshot;

  subscribe = (listener: (snapshot: AutosaveSnapshot) => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  enqueue(value: T) {
    this.pending = { version: ++this.version, value };
    this.publish({ status: this.running ? "saving" : "dirty", error: null });
  }

  start() {
    if (!this.running && this.pending) this.running = this.drain();
    return this.running ?? Promise.resolve();
  }

  async flush() {
    while (this.pending || this.running) {
      this.start();
      if (this.running) await this.running;
      if (this.snapshot.status === "error") throw this.snapshot.error ?? new Error("Save failed.");
    }
    if (this.savedVersion === this.version) this.publish({ status: "saved", error: null });
  }

  private async drain() {
    try {
      while (this.pending) {
        const current = this.pending;
        this.pending = null;
        this.publish({ status: "saving", error: null });
        try {
          await this.save(current.value);
          this.savedVersion = current.version;
        } catch (cause) {
          if (!this.pending) this.pending = current;
          this.publish({
            status: "error",
            error: cause instanceof Error ? cause : new Error("Save failed."),
          });
          return;
        }
      }
      this.publish({
        status: this.savedVersion === this.version ? "saved" : "dirty",
        error: null,
      });
    } finally {
      this.running = null;
    }
  }

  private publish(snapshot: AutosaveSnapshot) {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener(snapshot);
  }
}
