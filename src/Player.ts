import { Node } from './NodeMan';
import { Voice } from './Voice';

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

  constructor(node: Node, guildId: string) {
    this.node = node;
    this.guildId = guildId;
    this.voice = new Voice(this);
  }

  public async play(options: { track?: string; startTime?: number; endTime?: number; noReplace?: boolean } = {}) {
    const queue = this.node.client.queue.get(this.guildId);
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

  public async setVolume(volume: number) {
    await this.node.rest.updatePlayer(this.guildId, { volume });
    this.volume = volume;
  }

  public async setFilters(filters: any) {
    await this.node.rest.updatePlayer(this.guildId, { filters });
    this.filters = filters;
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
      if (queue.next()) {
        await this.play();
      } else if (queue.autoplay && queue.previous.length > 0) {
        await this.handleAutoplay(queue.previous[queue.previous.length - 1]);
      } else {
        this.node.client.events.emit('queueEnd', this);
      }
    }
  }

  private async handleAutoplay(lastTrack: any) {
    const query = `https://www.youtube.com/watch?v=${lastTrack.info.identifier}&list=RD${lastTrack.info.identifier}`;
    const res = await this.node.client.src.resolve(query);
    if (res && res.tracks.length > 1) {
      // Add the second track (first is usually the same one)
      const track = res.tracks.find(t => t.info.identifier !== lastTrack.info.identifier) || res.tracks[1];
      const queue = this.node.client.queue.get(this.guildId);
      queue.add(track);
      await this.play();
    } else {
      this.node.client.events.emit('queueEnd', this);
    }
  }

  public filterPresets = {
    bassboost: { equalizer: [{ band: 0, gain: 0.6 }, { band: 1, gain: 0.67 }, { band: 2, gain: 0.67 }, { band: 3, gain: 0 }] },
    nightcore: { timescale: { speed: 1.1, pitch: 1.2, rate: 1.0 } },
    vaporwave: { timescale: { speed: 0.85, pitch: 0.8 } },
    pop: { equalizer: [{ band: 0, gain: 0.65 }, { band: 1, gain: 0.45 }, { band: 2, gain: -0.45 }, { band: 3, gain: -0.65 }, { band: 4, gain: 0.7 }, { band: 5, gain: 0.45 }, { band: 6, gain: 0.45 }, { band: 7, gain: 0.45 }, { band: 8, gain: 0.45 }, { band: 9, gain: 0.45 }, { band: 10, gain: 0.45 }, { band: 11, gain: 0.45 }, { band: 12, gain: 0.45 }, { band: 13, gain: 0.45 }, { band: 14, gain: 0.45 }] },
    soft: { equalizer: [{ band: 0, gain: 0 }, { band: 1, gain: 0 }, { band: 2, gain: 0 }, { band: 3, gain: 0 }, { band: 4, gain: 0 }, { band: 5, gain: 0 }, { band: 6, gain: 0 }, { band: 7, gain: 0 }, { band: 8, gain: -0.25 }, { band: 9, gain: -0.25 }, { band: 10, gain: -0.25 }, { band: 11, gain: -0.25 }, { band: 12, gain: -0.25 }, { band: 13, gain: -0.25 }, { band: 14, gain: -0.25 }] },
  };

  public destroy() {
    this.node.rest.request('DELETE', `/sessions/${this.node.sessionId}/players/${this.guildId}`);
  }
}
