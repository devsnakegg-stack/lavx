import { Client as DjsClient } from 'discord.js';
import { NodeMan } from './NodeMan';
import { PlayMan } from './PlayMan';
import { QMan } from './QMan';
import { SrcMan } from './SrcMan';
import { EvtMan } from './EvtMan';

export interface LavxOptions {
  nodes: NodeOptions[];
  send?: (guildId: string, payload: any) => void;
  defaultSearchPlatform?: string;
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
  public readonly node: NodeMan;
  public readonly play: PlayMan;
  public readonly queue: QMan;
  public readonly src: SrcMan;
  public readonly events: EvtMan;
  public readonly options: LavxOptions;

  constructor(discord: DjsClient, options: LavxOptions) {
    this.discord = discord;
    this.options = {
      defaultSearchPlatform: 'ytsearch',
      ...options,
    };

    this.events = new EvtMan(this);
    this.node = new NodeMan(this);
    this.play = new PlayMan(this);
    this.queue = new QMan(this);
    this.src = new SrcMan(this);

    this.init();
  }

  private init() {
    this.discord.on('raw', (packet) => {
      if (packet.t === 'VOICE_SERVER_UPDATE' || packet.t === 'VOICE_STATE_UPDATE') {
        this.play.handleVoiceUpdate(packet.d);
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
