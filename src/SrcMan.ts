import { Client } from './Client';
import { PlatformMap } from './Map';
import { Track } from './Track';

export interface ResolveResult {
  type: 'track' | 'playlist' | 'search' | 'error';
  tracks: Track[];
  playlistName?: string;
}

export class SrcMan {
  public readonly client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  public async resolve(input: string): Promise<ResolveResult> {
    const node = this.client.node.best();
    if (!node) throw new Error('No available nodes');

    let identifier = input;

    if (!this.isUrl(input)) {
      const defaultSearch = this.client.options.defaultSearchPlatform || 'ytsearch';
      identifier = `${defaultSearch}:${input}`;
    }

    const data: any = await node.rest.loadTracks(identifier);

    switch (data.loadType) {
      case 'track':
        return { type: 'track', tracks: [this.mapTrack(data.data)] };
      case 'playlist':
        return {
          type: 'playlist',
          tracks: data.data.tracks.map((t: any) => this.mapTrack(t)),
          playlistName: data.data.info.name,
        };
      case 'search':
        return { type: 'search', tracks: data.data.map((t: any) => this.mapTrack(t)) };
      case 'error':
        return { type: 'error', tracks: [] };
      case 'empty':
        // Try fallback if it was a URL that failed
        if (this.isUrl(input) && !input.includes(':')) {
           // Maybe try without prefix if prefix failed? Or just return empty
        }
        return { type: 'search', tracks: [] };
      default:
        return { type: 'error', tracks: [] };
    }
  }

  private isUrl(input: string) {
    try {
      new URL(input);
      return true;
    } catch {
      return false;
    }
  }

  private detectPlatform(url: string) {
    if (url.includes('spotify.com')) return 'spotify';
    if (url.includes('music.apple.com')) return 'apple';
    if (url.includes('deezer.com')) return 'deezer';
    if (url.includes('music.yandex.ru')) return 'yandex';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('music.youtube.com')) return 'youtube music';
    if (url.includes('soundcloud.com')) return 'soundcloud';
    return null;
  }

  private mapTrack(data: any): Track {
    return {
      track: data.encoded,
      info: data.info,
      src: data.info.sourceName,
    };
  }
}
