import { Client } from './Client';
import { Player } from './Player';

export interface PlayerOptions {
  guildId: string;
  nodeName?: string;
}

export class PlayMan {
  public readonly client: Client;
  public readonly players: Map<string, Player>;

  constructor(client: Client) {
    this.client = client;
    this.players = new Map();
  }

  public create(options: PlayerOptions) {
    let player = this.players.get(options.guildId);
    if (player) return player;

    const node = options.nodeName ? this.client.node.get(options.nodeName) : this.client.node.best();
    if (!node) throw new Error('No available Lavalink nodes');

    player = new Player(node, options.guildId);
    this.players.set(options.guildId, player);
    this.client.events.emit('playerCreate', player);
    return player;
  }

  public get(guildId: string) {
    return this.players.get(guildId);
  }

  public destroy(guildId: string) {
    const player = this.players.get(guildId);
    if (player) {
      player.destroy();
      this.players.delete(guildId);
      this.client.events.emit('playerDestroy', player);
    }
  }

  public handleVoiceUpdate(data: any) {
    const player = this.players.get(data.guild_id);
    if (player) {
      player.voice.update(data);
    }
  }
}
