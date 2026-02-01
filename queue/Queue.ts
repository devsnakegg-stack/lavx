import { Track } from './Track';

export enum LoopMode {
  None = 'none',
  Track = 'track',
  Queue = 'queue',
}

export class Queue {
  public tracks: Track[] = [];
  public current: Track | null = null;
  public previous: Track[] = [];
  public loop: LoopMode = LoopMode.None;

  public add(track: Track | Track[]) {
    if (Array.isArray(track)) {
      this.tracks.push(...track);
    } else {
      this.tracks.push(track);
    }
    if (!this.current) {
      this.current = this.tracks.shift() || null;
    }
  }

  public next() {
    if (this.current) {
      if (this.loop === LoopMode.Track) {
        // stay on current
        return true;
      }
      this.previous.push(this.current);
      if (this.loop === LoopMode.Queue) {
        this.tracks.push(this.current);
      }
    }

    this.current = this.tracks.shift() || null;
    return !!this.current;
  }

  public skip() {
    return this.next();
  }

  public shuffle() {
    for (let i = this.tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tracks[i], this.tracks[j]] = [this.tracks[j], this.tracks[i]];
    }
  }

  public clear() {
    this.tracks = [];
    this.current = null;
    this.previous = [];
  }
}
