import { Node } from './NodeManager';
import { Voice } from './Voice';
import { isUnresolvedTrack, Track } from './Track';

export enum DestroyReason {
  ChannelDeleted = 'CHANNEL_DELETED',
  Disconnected = 'DISCONNECTED',
  PlayerDestroyed = 'PLAYER_DESTROYED',
  NodeDestroyed = 'NODE_DESTROYED',
  LoadFailed = 'LOAD_FAILED',
}

export class Player {
  public node: Node;
  public readonly guildId: string;
  public readonly voice: Voice;
  public playing: boolean = false;
  public paused: boolean = false;
  public state: {
    time: number;
    position: number;
    connected: boolean;
    ping: number;
  } = {
    time: 0,
    position: 0,
    connected: false,
    ping: -1,
  };
  public volume: number = 100;
  public filters: any = {};
  public options: {
      autoRecover: boolean;
      autoResume: boolean;
      gapless: boolean;
      smartBuffer: boolean;
  } = {
      autoRecover: false,
      autoResume: false,
      gapless: false,
      smartBuffer: false,
  };

  private fadeInterval: NodeJS.Timeout | null = null;

  constructor(node: Node, guildId: string) {
    this.node = node;
    this.guildId = guildId;
    this.voice = new Voice(this);
  }

  public async play(options: { track?: string; startTime?: number; endTime?: number; noReplace?: boolean } = {}) {
    const queue = this.node.client.queue.get(this.guildId);

    if (!options.track && (!queue.current || isUnresolvedTrack(queue.current))) {
        const next = queue.current || queue.tracks[0];
        if (next && isUnresolvedTrack(next)) {
            const resolved = await next.resolve(this);
            if (!resolved) {
                queue.tracks.shift();
                return this.onTrackEnd({ reason: 'loadFailed' });
            }
            if (!queue.current) queue.current = queue.tracks.shift() as Track;
        }
    }

    const track = options.track || queue.current?.track;
    if (!track) throw new Error('No track to play');

    await this.node.rest.updatePlayer(this.guildId, {
      encodedTrack: track,
      position: options.startTime,
      endTime: options.endTime,
    }, options.noReplace);

    this.playing = true;
    this.paused = false;
  }

  public async stop() {
    await this.node.rest.updatePlayer(this.guildId, { encodedTrack: null });
    this.playing = false;
    this.paused = false;
  }

  public async pause(state: boolean = true) {
    await this.node.rest.updatePlayer(this.guildId, { paused: state });
    this.paused = state;
  }

  public async resume() {
    await this.pause(false);
  }

  public async seek(position: number) {
    await this.node.rest.updatePlayer(this.guildId, { position });
  }

  public async rewind(ms: number) {
      const newPos = Math.max(0, this.state.position - ms);
      await this.seek(newPos);
  }

  public async forward(ms: number) {
      await this.seek(this.state.position + ms);
  }

  public async restart() {
      await this.seek(0);
  }

  public async setVolume(volume: number) {
    await this.node.rest.updatePlayer(this.guildId, { volume });
    this.volume = volume;
  }

  public async fadeIn(ms: number) {
      if (this.fadeInterval) clearInterval(this.fadeInterval);
      const targetVolume = this.volume;
      let currentVolume = 0;
      await this.setVolume(currentVolume);

      const step = targetVolume / (ms / 100);
      this.fadeInterval = setInterval(async () => {
          currentVolume += step;
          if (currentVolume >= targetVolume) {
              currentVolume = targetVolume;
              clearInterval(this.fadeInterval!);
              this.fadeInterval = null;
          }
          await this.setVolume(Math.round(currentVolume));
      }, 100);
  }

  public async fadeOut(ms: number) {
      if (this.fadeInterval) clearInterval(this.fadeInterval);
      const startVolume = this.volume;
      let currentVolume = startVolume;

      const step = startVolume / (ms / 100);
      this.fadeInterval = setInterval(async () => {
          currentVolume -= step;
          if (currentVolume <= 0) {
              currentVolume = 0;
              clearInterval(this.fadeInterval!);
              this.fadeInterval = null;
          }
          await this.setVolume(Math.round(currentVolume));
      }, 100);
  }

  public async setFilters(filters: any) {
    await this.node.rest.updatePlayer(this.guildId, { filters });
    this.filters = { ...this.filters, ...filters };
  }

  public async clearFilters() {
      await this.node.rest.updatePlayer(this.guildId, {
          filters: {
              equalizer: [],
              timescale: null,
              karaoke: null,
              tremolo: null,
              vibrato: null,
              rotation: null,
              distortion: null,
              channelMix: null,
              lowPass: null
          }
      });
      this.filters = {};
  }

  public async setEQ(bands: { band: number; gain: number }[]) {
      await this.setFilters({ equalizer: bands });
  }

  public async setAudioOutput(output: 'left' | 'right' | 'mono' | 'stereo') {
    if (output === 'left') await this.balance(1.0, 0.0);
    else if (output === 'right') await this.balance(0.0, 1.0);
    else if (output === 'mono') await this.mono();
    else if (output === 'stereo') await this.stereo();
  }

  public async balance(left: number, right: number) {
      await this.setFilters({
          channelMix: {
              leftToLeft: left,
              leftToRight: 1.0 - left,
              rightToLeft: 1.0 - right,
              rightToRight: right,
          }
      });
  }

  public async mono() {
      await this.setFilters({
          channelMix: {
              leftToLeft: 0.5,
              leftToRight: 0.5,
              rightToLeft: 0.5,
              rightToRight: 0.5,
          }
      });
  }

  public async stereo() {
      await this.setFilters({
          channelMix: {
              leftToLeft: 1.0,
              leftToRight: 0.0,
              rightToLeft: 0.0,
              rightToRight: 1.0,
          }
      });
  }

  public async bassboost(level: number = 1) {
      const gains = [0.2, 0.4, 0.6, 0.8, 1.0];
      const gain = gains[Math.min(level, gains.length) - 1] || 0.6;
      await this.setFilters({
          equalizer: [
              { band: 0, gain },
              { band: 1, gain: gain * 0.8 },
              { band: 2, gain: gain * 0.5 }
          ]
      });
  }

  public async nightcore() {
      await this.setFilters({ timescale: { speed: 1.1, pitch: 1.2, rate: 1.0 } });
  }

  public async vaporwave() {
      await this.setFilters({ timescale: { speed: 0.85, pitch: 0.8 } });
  }

  public async autoplay() {
      const queue = this.node.client.queue.get(this.guildId);
      queue.autoplay = !queue.autoplay;
      return queue.autoplay;
  }

  public async autoRecover() {
      this.options.autoRecover = !this.options.autoRecover;
  }

  public async autoResume() {
      this.options.autoResume = !this.options.autoResume;
  }

  public async preloadNext() {
      const queue = this.node.client.queue.get(this.guildId);
      const next = queue.tracks[0];
      if (next && isUnresolvedTrack(next)) {
          await next.resolve(this);
      }
  }

  public async moveToNode(toNode: Node) {
    if (this.node === toNode) return;
    const position = this.state.position;
    this.node = toNode;
    if (this.playing || this.paused) {
      await this.play({ startTime: position });
    }
  }

  public async moveToChannel(channelId: string, options: { mute?: boolean; deaf?: boolean } = {}) {
    await this.connect(channelId, options);
  }

  public async connect(channelId: string, options: { mute?: boolean; deaf?: boolean } = {}) {
    this.node.client.sendGatewayPayload(this.guildId, {
      op: 4,
      d: {
        guild_id: this.guildId,
        channel_id: channelId,
        self_mute: options.mute ?? false,
        self_deaf: options.deaf ?? false,
      },
    });
  }

  public async disconnect() {
    this.node.client.sendGatewayPayload(this.guildId, {
      op: 4,
      d: {
        guild_id: this.guildId,
        channel_id: null,
        self_mute: false,
        self_deaf: false,
      },
    });

    await this.stop();
  }

  public async onTrackEnd(payload: any) {
    this.playing = false;
    if (payload.reason !== 'replaced' && payload.reason !== 'stopped') {
      const queue = this.node.client.queue.get(this.guildId);
      if (await queue.next()) {
        await this.play();
      } else if (queue.autoplay) {
          const last = await queue.history.last();
          if (last) await this.handleAutoplay(last);
          else this.node.client.events.emit('queueEnd', this);
      } else {
        this.node.client.events.emit('queueEnd', this);
      }
    }
  }

  private async handleAutoplay(lastTrack: any) {
    const source = lastTrack.source;
    let query = '';

    if (source === 'youtube') {
      query = `https://www.youtube.com/watch?v=${lastTrack.uri.split('v=')[1] || lastTrack.uri}&list=RD${lastTrack.uri.split('v=')[1] || lastTrack.uri}`;
    } else if (source === 'spotify') {
      query = `sprec:${lastTrack.uri}`;
    } else if (source === 'deezer') {
      query = `dzrec:${lastTrack.uri}`;
    } else if (source === 'apple-music') {
      query = `amrec:${lastTrack.uri}`;
    } else {
      const defaultSearch = this.node.client.options.defaultSearchPlatform || 'ytsearch';
      query = `${defaultSearch}:${lastTrack.author} ${lastTrack.title} related`;
    }

    let res = await this.node.client.src.resolve(query);

    if ((!res || !res.tracks.length) && query.includes('rec:')) {
      const defaultSearch = this.node.client.options.defaultSearchPlatform || 'ytsearch';
      res = await this.node.client.src.resolve(`${defaultSearch}:${lastTrack.author} ${lastTrack.title} related`);
    }

    if (res && res.tracks.length > 0) {
      const track = res.tracks.find(t => t.info?.uri !== lastTrack.uri) || res.tracks[0];
      track.isAutoplay = true;
      const queue = this.node.client.queue.get(this.guildId);
      await queue.add(track);
      await this.play();
    } else {
      this.node.client.events.emit('queueEnd', this);
    }
  }

  public filterPresets = {
    bassboost: { equalizer: [{ band: 0, gain: 0.6 }, { band: 1, gain: 0.67 }, { band: 2, gain: 0.67 }] },
    nightcore: { timescale: { speed: 1.1, pitch: 1.2, rate: 1.0 } },
    vaporwave: { timescale: { speed: 0.85, pitch: 0.8 } },
    pop: { equalizer: [{ band: 0, gain: 0.65 }, { band: 1, gain: 0.45 }, { band: 2, gain: -0.45 }, { band: 3, gain: -0.65 }, { band: 4, gain: 0.7 }, { band: 5, gain: 0.45 }] },
    soft: { equalizer: [{ band: 0, gain: 0 }, { band: 8, gain: -0.25 }] },
    electronic: { equalizer: [{ band: 0, gain: 0.375 }, { band: 1, gain: 0.350 }, { band: 2, gain: 0.125 }, { band: 5, gain: -0.125 }, { band: 6, gain: -0.125 }] },
    dance: { equalizer: [{ band: 0, gain: 0.6 }, { band: 1, gain: 0.7 }, { band: 2, gain: 0.2 }, { band: 3, gain: 0 }, { band: 4, gain: 0 }, { band: 5, gain: -0.2 }, { band: 6, gain: -0.5 }, { band: 7, gain: -0.5 }] },
    classical: { equalizer: [{ band: 0, gain: -0.25 }, { band: 1, gain: -0.25 }, { band: 2, gain: -0.25 }, { band: 3, gain: -0.25 }, { band: 4, gain: -0.25 }, { band: 5, gain: -0.25 }, { band: 6, gain: 0 }, { band: 7, gain: 0.25 }, { band: 8, gain: 0.25 }, { band: 9, gain: 0.25 }, { band: 10, gain: 0.25 }, { band: 11, gain: 0.25 }, { band: 12, gain: 0.25 }, { band: 13, gain: 0.25 }, { band: 14, gain: 0.25 }] },
    rock: { equalizer: [{ band: 0, gain: 0.3 }, { band: 1, gain: 0.25 }, { band: 2, gain: 0.2 }, { band: 3, gain: 0.1 }, { band: 4, gain: 0.05 }, { band: 5, gain: -0.05 }, { band: 6, gain: -0.15 }, { band: 7, gain: -0.2 }, { band: 8, gain: -0.25 }, { band: 9, gain: -0.25 }] },
    fullbass: { equalizer: [{ band: 0, gain: 0.25 }, { band: 1, gain: 0.5 }, { band: 2, gain: 0.75 }, { band: 3, gain: 1 }, { band: 4, gain: 0.5 }, { band: 5, gain: 0.25 }] },
    karaoke: { karaoke: { level: 1.0, monoLevel: 1.0, filterBand: 220.0, filterWidth: 100.0 } },
    tremolo: { tremolo: { frequency: 2.0, depth: 0.5 } },
    vibrato: { vibrato: { frequency: 2.0, depth: 0.5 } },
    rotation: { rotation: { rotationHz: 0.2 } },
    distortion: { distortion: { sinOffset: 0.0, sinScale: 1.0, cosOffset: 0.0, cosScale: 1.0, tanOffset: 0.0, tanScale: 1.0, offset: 0.0, scale: 1.0 } },
    lowpass: { lowPass: { smoothing: 20.0 } },
  };

  public async destroy(reason: DestroyReason = DestroyReason.PlayerDestroyed) {
    this.node.client.events.emit('playerDestroy', this, reason);
    await this.node.rest.request('DELETE', `/sessions/${this.node.sessionId}/players/${this.guildId}`);
  }
}
