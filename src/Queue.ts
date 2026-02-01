import { Track, UnresolvedTrack } from './Track';
import { History, HistoryStore, MemoryHistoryStore } from './History';

export enum LoopMode {
  None = 'none',
  Track = 'track',
  Queue = 'queue',
}

export interface StoredQueue {
  current: Track | null;
  tracks: (Track | UnresolvedTrack)[];
}

export interface QueueStore {
  get: (guildId: string) => Promise<StoredQueue | null>;
  set: (guildId: string, value: StoredQueue) => Promise<void>;
  delete: (guildId: string) => Promise<void>;
}

export class MemoryQueueStore implements QueueStore {
  private stores = new Map<string, StoredQueue>();
  async get(guildId: string) { return this.stores.get(guildId) || null; }
  async set(guildId: string, value: StoredQueue) { this.stores.set(guildId, value); }
  async delete(guildId: string) { this.stores.delete(guildId); }
}

export class Queue {
  public tracks: (Track | UnresolvedTrack)[] = [];
  public current: Track | null = null;
  public readonly history: History;
  public loop: LoopMode = LoopMode.None;
  public autoplay: boolean = false;
  private store: QueueStore;
  private guildId: string;

  constructor(guildId: string, options: { store?: QueueStore; historyStore?: HistoryStore } = {}) {
    this.guildId = guildId;
    this.store = options.store || new MemoryQueueStore();
    this.history = new History(guildId, { store: options.historyStore });
  }

  public async add(track: (Track | UnresolvedTrack) | (Track | UnresolvedTrack)[]) {
    if (Array.isArray(track)) {
      this.tracks.push(...track);
    } else {
      this.tracks.push(track);
    }
    if (!this.current) {
      const next = this.tracks.shift();
      if (next && 'resolve' in next) {
          this.tracks.unshift(next);
      } else {
          this.current = (next as Track) || null;
      }
    }
    await this.save();
  }

  public async addNext(track: (Track | UnresolvedTrack) | (Track | UnresolvedTrack)[]) {
    if (Array.isArray(track)) {
        this.tracks.unshift(...track);
    } else {
        this.tracks.unshift(track);
    }
    await this.save();
  }

  public async insert(index: number, track: Track | UnresolvedTrack) {
      if (index < 0) index = 0;
      if (index > this.tracks.length) index = this.tracks.length;
      this.tracks.splice(index, 0, track);
      await this.save();
  }

  public async next() {
    if (this.current) {
      if (this.loop === LoopMode.Track) {
        return true;
      }
      await this.history.push(this.current);

      if (this.loop === LoopMode.Queue) {
        this.tracks.push(this.current);
      }
    }

    const next = this.tracks.shift();
    if (next && 'resolve' in next) {
        this.tracks.unshift(next);
        this.current = null;
    } else {
        this.current = (next as Track) || null;
    }
    await this.save();
    return !!this.current || (this.tracks.length > 0 && 'resolve' in this.tracks[0]);
  }

  public async skip() {
    return this.next();
  }

  public async jump(index: number) {
      if (index < 0 || index >= this.tracks.length) return null;
      if (this.current) {
          await this.history.push(this.current);
      }
      const skipped = this.tracks.splice(0, index + 1);
      const next = skipped.pop()!;
      if ('resolve' in next) {
          this.tracks.unshift(next);
          this.current = null;
      } else {
          this.current = next as Track;
      }
      await this.save();
      return this.current;
  }

  public async previous() {
      const last = await this.history.last();
      if (!last) return null;

      // In a real system, we'd need to resolve the URI back to a Track object
      // But here we might just have metadata.
      // User said "Play previous track".
      // I'll need to use SrcMan to resolve the URI again.
      // For now, I'll just mark it as something the Player should handle.
      // Or maybe the history should store the 'track' (encoded) too?
      // User said "Metadata-only storage".
      // Let's assume for 'previous' we use the URI.
      return last;
  }

  public async move(from: number, to: number) {
      if (from < 0 || from >= this.tracks.length) return;
      if (to < 0) to = 0;
      if (to >= this.tracks.length) to = this.tracks.length - 1;

      const track = this.tracks.splice(from, 1)[0];
      this.tracks.splice(to, 0, track);
      await this.save();
  }

  public async swap(i1: number, i2: number) {
      if (i1 < 0 || i1 >= this.tracks.length) return;
      if (i2 < 0 || i2 >= this.tracks.length) return;
      [this.tracks[i1], this.tracks[i2]] = [this.tracks[i2], this.tracks[i1]];
      await this.save();
  }

  public async dedupe() {
      const seen = new Set();
      this.tracks = this.tracks.filter(t => {
          const id = t.track || t.info?.uri;
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
      });
      await this.save();
  }

  public async shuffle() {
    for (let i = this.tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tracks[i], this.tracks[j]] = [this.tracks[j], this.tracks[i]];
    }
    await this.save();
  }

  public async clear() {
    this.tracks = [];
    this.current = null;
    await this.history.clear();
    await this.save();
  }

  public async remove(index: number) {
    if (index < 0 || index >= this.tracks.length) return null;
    const track = this.tracks.splice(index, 1)[0];
    await this.save();
    return track;
  }

  private async save() {
    await this.store.set(this.guildId, {
      current: this.current,
      tracks: this.tracks
    });
  }

  public async load() {
    const data = await this.store.get(this.guildId);
    if (data) {
      this.current = data.current;
      this.tracks = data.tracks;
    }
  }
}
