import { Player } from './Player';

export class Voice {
  public readonly player: Player;
  public sessionId: string | null = null;
  public token: string | null = null;
  public endpoint: string | null = null;
  public channelId: string | null = null;

  constructor(player: Player) {
    this.player = player;
  }

  public update(data: any) {
    if (data.token) {
      this.token = data.token;
      this.endpoint = data.endpoint;
    } else if (data.session_id) {
      this.sessionId = data.session_id;

      if (data.channel_id !== this.channelId) {
        const oldChannelId = this.channelId;
        this.channelId = data.channel_id;
        this.player.node.client.events.emit('playerMove', this.player, oldChannelId, this.channelId);
      }
    }

    if (this.token && this.sessionId && this.endpoint) {
      this.player.node.rest.updatePlayer(this.player.guildId, {
        voice: {
          token: this.token,
          endpoint: this.endpoint,
          sessionId: this.sessionId,
        },
      });
    }
  }
}
