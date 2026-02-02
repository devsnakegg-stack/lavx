import { Client } from './Client';
import { Track, UnresolvedTrack } from './Track';

export interface ResolveResult {
  type: 'track' | 'playlist' | 'search' | 'error';
  tracks: (Track | UnresolvedTrack)[];
  playlistName?: string;
  playlistArtworkUrl?: string;
}

export class SrcManager {
  public readonly client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  public async search(query: string, platform?: string, requester?: any): Promise<ResolveResult> {
    const prefix = platform || this.client.options.defaultSearchPlatform || 'ytsearch';
    return this.resolve(`${prefix}:${query}`, requester);
  }

  public async resolve(input: string, requester?: any): Promise<ResolveResult> {
    if (!this.validateInput(input)) {
        return { type: 'error', tracks: [] };
    }

    const node = this.client.node.best();
    if (!node) throw new Error('No available nodes');

    let identifier = input;

    if (!this.isUrl(input)) {
      const hasPrefix = /^[a-z]+search:/.test(input) || /^[a-z]+rec:/.test(input) || input.includes(':');
      if (!hasPrefix) {
        const defaultSearch = this.client.options.defaultSearchPlatform || 'ytsearch';
        identifier = `${defaultSearch}:${input}`;
      }
    }

    let data: any = await node.rest.loadTracks(identifier);

    if ((data.loadType === 'empty' || data.loadType === 'error') && this.isUrl(input)) {
      const defaultSearch = this.client.options.defaultSearchPlatform || 'ytsearch';
      data = await node.rest.loadTracks(`${defaultSearch}:${input}`);
    }

    switch (data.loadType) {
      case 'track':
        return { type: 'track', tracks: [this.mapTrack(data.data, requester)] };
      case 'playlist':
        return {
          type: 'playlist',
          tracks: data.data.tracks.map((t: any) => this.mapTrack(t, requester)),
          playlistName: data.data.info.name,
          playlistArtworkUrl: data.data.pluginInfo?.artworkUrl || data.data.info?.artworkUrl,
        };
      case 'search':
        return { type: 'search', tracks: data.data.map((t: any) => this.mapTrack(t, requester)) };
      case 'error':
        return { type: 'error', tracks: [] };
      case 'empty':
        return { type: 'search', tracks: [] };
      default:
        return { type: 'error', tracks: [] };
    }
  }

  public detectSource(url: string): string {
      if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
      if (url.includes('spotify.com')) return 'spotify';
      if (url.includes('deezer.com')) return 'deezer';
      if (url.includes('apple.com')) return 'applemusic';
      if (url.includes('soundcloud.com')) return 'soundcloud';
      return 'unknown';
  }

  public async fallbackSearch(query: string, requester?: any): Promise<ResolveResult> {
      const defaultSearch = this.client.options.defaultSearchPlatform || 'ytsearch';
      return this.resolve(`${defaultSearch}:${query}`, requester);
  }

  public async bestSource(track: Track): Promise<Track> {
      // Logic to find the best quality source for a track
      // For now, we'll just return the track as is,
      // but in a real implementation we could try to resolve it on other platforms.
      return track;
  }

  public createUnresolved(query: string, requester?: any): UnresolvedTrack {
      const track: UnresolvedTrack = {
          resolve: async (player) => {
              const res = await this.resolve(query, requester);
              if (res.tracks.length > 0 && !('resolve' in res.tracks[0])) {
                  const resolved = res.tracks[0] as Track;
                  Object.assign(track, resolved);
                  const queue = player.node.client.queue.get(player.guildId);
                  if (queue.current === track) {
                      queue.current = track as Track;
                  }
                  return true;
              }
              return false;
          },
          info: { title: query } as any,
          requester
      };
      return track;
  }

  private validateInput(input: string): boolean {
    const { whitelist, blacklist } = this.client.options;
    if (whitelist && whitelist.length > 0) {
        return whitelist.some(domain => input.includes(domain));
    }
    if (blacklist && blacklist.length > 0) {
        return !blacklist.some(domain => input.includes(domain));
    }
    return true;
  }

  private isUrl(input: string) {
    try {
      new URL(input);
      return true;
    } catch {
      return false;
    }
  }

  private mapTrack(data: any, requester?: any): Track {
    if (data.info && !data.info.duration && data.info.length) {
      data.info.duration = data.info.length;
    }

    if (data.info && !data.info.artworkUrl && data.pluginInfo?.artworkUrl) {
      data.info.artworkUrl = data.pluginInfo.artworkUrl;
    }

    if (data.info && !data.info.artworkUrl && data.info.image) {
        data.info.artworkUrl = data.info.image;
    }

    return {
      track: data.encoded,
      info: data.info,
      pluginInfo: data.pluginInfo || {},
      src: data.info.sourceName,
      requester
    };
  }
}
