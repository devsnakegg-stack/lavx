import { Client as DjsClient } from 'discord.js';
import { NodeManager } from './NodeManager';
import { PlayManager } from './PlayManager';
import { DestroyReason } from './Player';
import { QManager } from './QManager';
import { SrcManager } from './SrcManager';
import { EvtManager } from './EvtManager';

export interface LavxOptions {
  nodes: NodeOptions[];
  send?: (guildId: string, payload: any) => void;
  defaultSearchPlatform?: string;
  maxReconnectAttempts?: number;
  whitelist?: string[];
  blacklist?: string[];
}

export interface NodeOptions {
  name?: string;
  host: string;
  port: number;
  auth: string;
  secure?: boolean;
}

export class Client {
  public readonly discord: DjsClient;
  public readonly node: NodeManager;
  public readonly play: PlayManager;
  public readonly queue: QManager;
  public readonly src: SrcManager;
  public readonly events: EvtManager;
  public readonly options: LavxOptions;

  constructor(discord: DjsClient, options: LavxOptions) {
    this.discord = discord;
    this.options = {
      defaultSearchPlatform: 'ytsearch',
      ...options,
    };

    this.events = new EvtManager(this);
    this.node = new NodeManager(this);
    this.play = new PlayManager(this);
    this.queue = new QManager(this);
    this.src = new SrcManager(this);

    this.init();
  }

  private init() {
    this.discord.on('raw', (packet) => {
      if (packet.t === 'VOICE_SERVER_UPDATE' || packet.t === 'VOICE_STATE_UPDATE') {
        this.play.handleVoiceUpdate(packet.d);
      }
      if (packet.t === 'CHANNEL_DELETE') {
        const guildId = packet.d.guild_id;
        const channelId = packet.d.id;
        const player = this.play.get(guildId);
        if (player && player.voice.channelId === channelId) {
          player.destroy(DestroyReason.ChannelDeleted);
        }
      }
    });

    for (const nodeOptions of this.options.nodes) {
      this.node.add(nodeOptions);
    }

    this.events.on('nodeDisconnect', (node) => {
      this.node.migrate(node);
    });
  }

  public sendGatewayPayload(guildId: string, payload: any) {
    if (this.options.send) {
      this.options.send(guildId, payload);
    } else {
      const guild = this.discord.guilds.cache.get(guildId);
      if (guild) {
        guild.shard.send(payload);
      }
    }
  }

  public async playInput(guildId: string, input: string, requester?: any) {
    const resolved = await this.src.resolve(input);
    if (!resolved || !resolved.tracks.length) return null;

    const player = this.play.get(guildId) || this.play.create({ guildId });
    const queue = this.queue.get(guildId);

    if (resolved.type === 'playlist') {
      for (const track of resolved.tracks) {
        queue.add({ ...track, requester });
      }
    } else {
      queue.add({ ...resolved.tracks[0], requester });
    }

    if (!player.playing && !player.paused && queue.current) {
      await player.play();
    }

    return resolved;
  }
}
