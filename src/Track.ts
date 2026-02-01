export type SourceNames =
  | "youtube" | "youtubemusic" | "soundcloud" | "bandcamp" | "twitch"
  | "deezer" | "spotify" | "applemusic" | "yandexmusic" | "flowery-tts"
  | "vkmusic" | "tidal" | "qobuz" | "pandora" | "jiosaavn" | string;

export interface TrackInfo {
  identifier: string;
  isSeekable: boolean;
  author: string;
  length: number;
  duration: number;
  isStream: boolean;
  position: number;
  title: string;
  uri: string;
  artworkUrl?: string;
  isrc?: string;
  sourceName: SourceNames;
}

export interface PluginInfo {
  type?: string;
  albumName?: string;
  albumUrl?: string;
  albumArtUrl?: string;
  artistUrl?: string;
  artistArtworkUrl?: string;
  previewUrl?: string;
  isPreview?: boolean;
  totalTracks?: number;
  [key: string]: any;
}

export interface Track {
  track: string;
  info: TrackInfo;
  pluginInfo: PluginInfo;
  src: string;
  requester?: any;
  userData?: any;
  isAutoplay?: boolean;
}

export interface UnresolvedTrack extends Partial<Track> {
  resolve: (player: any) => Promise<boolean>;
}

export function isUnresolvedTrack(track: any): track is UnresolvedTrack {
  return typeof track.resolve === 'function';
}
