import WebSocket from 'ws';
import { Node } from './NodeMan';

export class Sock {
  public readonly node: Node;
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;

  constructor(node: Node) {
    this.node = node;
  }

  public connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    const { host, port, auth, secure } = this.node.options;
    const protocol = secure ? 'wss' : 'ws';
    const url = `${protocol}://${host}:${port}/v4/websocket`;

    const userId = this.node.client.discord.user?.id;
    if (!userId) {
      // If client is not ready, retry in 5s
      this.reconnect();
      return;
    }

    this.ws = new WebSocket(url, {
      headers: {
        Authorization: auth,
        'User-Id': userId,
        'Client-Name': 'lavx',
      },
    });

    this.ws.on('open', () => this.onOpen());
    this.ws.on('message', (data) => this.onMessage(data));
    this.ws.on('close', (code, reason) => this.onClose(code, reason));
    this.ws.on('error', (err) => this.onError(err));
  }

  private onOpen() {
    this.node.connected = true;
    this.reconnectAttempts = 0;
    this.node.client.events.emit('nodeConnect', this.node);
  }

  private onMessage(data: any) {
    let payload: any;
    try {
      payload = JSON.parse(data.toString());
    } catch (e) {
      return;
    }

    this.node.client.events.emit('raw', payload);

    switch (payload.op) {
      case 'stats':
        this.node.stats = payload;
        break;
      case 'event':
        this.handlePlayerEvent(payload);
        break;
      case 'playerUpdate':
        this.handlePlayerUpdate(payload);
        break;
      case 'ready':
        this.node.sessionId = payload.sessionId;
        this.node.client.events.emit('nodeReady', this.node, payload);
        break;
    }
  }

  private handlePlayerEvent(payload: any) {
    const player = this.node.client.play.get(payload.guildId);
    if (!player) return;

    switch (payload.type) {
      case 'TrackStartEvent':
        this.node.client.events.emit('trackStart', player, payload.track);
        break;
      case 'TrackEndEvent':
        this.node.client.events.emit('trackEnd', player, payload.track, payload.reason);
        player.onTrackEnd(payload);
        break;
      case 'TrackExceptionEvent':
        this.node.client.events.emit('trackError', player, payload.track, payload.exception);
        break;
      case 'TrackStuckEvent':
        this.node.client.events.emit('trackStuck', player, payload.track, payload.thresholdMs);
        break;
      case 'WebSocketClosedEvent':
        this.node.client.events.emit('playerDisconnect', player, payload.code, payload.reason, payload.byRemote);
        break;
    }
  }

  private handlePlayerUpdate(payload: any) {
    const player = this.node.client.play.get(payload.guildId);
    if (player) {
      player.state = { ...player.state, ...payload.state };
    }
  }

  private onClose(code: number, reason: any) {
    this.node.connected = false;
    this.node.sessionId = null;
    this.node.client.events.emit('nodeDisconnect', this.node, code, reason.toString());
    this.reconnect();
  }

  private onError(err: any) {
    this.node.client.events.emit('nodeError', this.node, err);
  }

  private reconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectAttempts++;
    this.reconnectTimeout = setTimeout(() => {
      this.node.client.events.emit('nodeReconnect', this.node);
      this.connect();
    }, Math.min(this.reconnectAttempts * 5000, 30000));
  }

  public send(payload: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  public close() {
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
  }
}
