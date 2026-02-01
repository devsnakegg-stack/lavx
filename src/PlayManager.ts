import { Client } from './Client';
import { Player, DestroyReason } from './Player';

export interface PlayerOptions {
  guildId: string;
  nodeName?: string;
}

export class PlayManager {
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

  public destroy(guildId: string, reason: DestroyReason = DestroyReason.PlayerDestroyed) {
    const player = this.players.get(guildId);
    if (player) {
      player.destroy(reason);
      this.players.delete(guildId);
    }
  }

  public handleVoiceUpdate(data: any) {
    const player = this.players.get(data.guild_id);
    if (player) {
      player.voice.update(data);
    }
  }
}
