import { Track, UnresolvedTrack } from './Track';

export enum LoopMode {
  None = 'none',
  Track = 'track',
  Queue = 'queue',
}

export interface StoredQueue {
  current: Track | null;
  previous: Track[];
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
  public previous: Track[] = [];
  public loop: LoopMode = LoopMode.None;
  public autoplay: boolean = false;
  private store: QueueStore;
  private guildId: string;

  constructor(guildId: string, store: QueueStore = new MemoryQueueStore()) {
    this.guildId = guildId;
    this.store = store;
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
          // We can't resolve here easily without player, Player will handle it
          this.tracks.unshift(next);
      } else {
          this.current = (next as Track) || null;
      }
    }
    await this.save();
  }

  public async next() {
    if (this.current) {
      if (this.loop === LoopMode.Track) {
        return true;
      }
      this.previous.push(this.current);
      if (this.previous.length > 100) this.previous.shift();

      if (this.loop === LoopMode.Queue) {
        this.tracks.push(this.current);
      }
    }

    const next = this.tracks.shift();
    if (next && 'resolve' in next) {
        this.tracks.unshift(next);
        this.current = null; // Player will resolve
    } else {
        this.current = (next as Track) || null;
    }
    await this.save();
    return !!this.current || (this.tracks.length > 0 && 'resolve' in this.tracks[0]);
  }

  public async skip() {
    return this.next();
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
    this.previous = [];
    await this.save();
  }

  public async remove(index: number) {
    if (index < 0 || index >= this.tracks.length) return null;
    const track = this.tracks.splice(index, 1)[0];
    await this.save();
    return track;
  }

  public find(query: string) {
    return this.tracks.filter(t =>
      t.info?.title?.toLowerCase().includes(query.toLowerCase()) ||
      t.info?.author?.toLowerCase().includes(query.toLowerCase())
    );
  }

  private async save() {
    await this.store.set(this.guildId, {
      current: this.current,
      previous: this.previous,
      tracks: this.tracks
    });
  }

  public async load() {
    const data = await this.store.get(this.guildId);
    if (data) {
      this.current = data.current;
      this.previous = data.previous;
      this.tracks = data.tracks;
    }
  }
}
