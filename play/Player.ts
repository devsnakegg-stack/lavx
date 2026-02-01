import { Node } from '../core/NodeMan';
import { Voice } from '../discord/Voice';

export class Player {
  public readonly node: Node;
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

  public onTrackEnd(payload: any) {
    this.playing = false;
    if (payload.reason !== 'replaced' && payload.reason !== 'stopped') {
      const queue = this.node.client.queue.get(this.guildId);
      if (queue.next()) {
        this.play();
      } else {
        this.node.client.events.emit('queueEnd', this);
      }
    }
  }

  public destroy() {
    this.node.rest.request('DELETE', `/sessions/${this.node.sessionId}/players/${this.guildId}`);
  }
}
