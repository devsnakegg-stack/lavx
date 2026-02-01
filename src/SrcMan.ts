import { Client } from './Client';
import { PlatformMap } from './Map';
import { Track } from './Track';

export interface ResolveResult {
  type: 'track' | 'playlist' | 'search' | 'error';
  tracks: Track[];
  playlistName?: string;
  playlistArtworkUrl?: string;
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

    let data: any = await node.rest.loadTracks(identifier);

    // Fallback if empty or error (might happen if plugin is missing for a URL)
    if ((data.loadType === 'empty' || data.loadType === 'error') && this.isUrl(input)) {
      const defaultSearch = this.client.options.defaultSearchPlatform || 'ytsearch';
      data = await node.rest.loadTracks(`${defaultSearch}:${input}`);
    }

    switch (data.loadType) {
      case 'track':
        return { type: 'track', tracks: [this.mapTrack(data.data)] };
      case 'playlist':
        return {
          type: 'playlist',
          tracks: data.data.tracks.map((t: any) => this.mapTrack(t)),
          playlistName: data.data.info.name,
          playlistArtworkUrl: data.data.pluginInfo?.artworkUrl || data.data.info?.artworkUrl,
        };
      case 'search':
        return { type: 'search', tracks: data.data.map((t: any) => this.mapTrack(t)) };
      case 'error':
        return { type: 'error', tracks: [] };
      case 'empty':
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

  private mapTrack(data: any): Track {
    // Ensure duration is present in info
    if (data.info && !data.info.duration && data.info.length) {
      data.info.duration = data.info.length;
    }

    // Capture artwork if in pluginInfo but not info
    if (data.info && !data.info.artworkUrl && data.pluginInfo?.artworkUrl) {
      data.info.artworkUrl = data.pluginInfo.artworkUrl;
    }

    // captue artwork from some plugins that put it in a different place
    if (data.info && !data.info.artworkUrl && data.info.image) {
        data.info.artworkUrl = data.info.image;
    }

    return {
      track: data.encoded,
      info: data.info,
      src: data.info.sourceName,
    };
  }
}
