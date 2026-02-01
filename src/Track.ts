export interface Track {
  track: string;
  info: TrackInfo;
  src: string;
  requester?: any;
}

export interface TrackInfo {
  identifier: string;
  isSeekable: boolean;
  author: string;
  length: number;
  isStream: boolean;
  position: number;
  title: string;
  uri: string;
  artworkUrl?: string;
  isrc?: string;
  sourceName: string;
  /**
   * The duration of the track in milliseconds. Alias for length.
   */
  duration: number;
}
