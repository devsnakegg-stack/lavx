import { EventEmitter } from 'events';
import { Client } from './Client';
import { Node } from './NodeMan';
import { Player } from './Player';
import { Track } from './Track';

export interface LavxEvents {
  nodeConnect: (node: Node) => void;
  nodeDisconnect: (node: Node, code: number, reason: string) => void;
  nodeError: (node: Node, error: Error) => void;
  nodeReconnect: (node: Node) => void;
  nodeReady: (node: Node, payload: any) => void;
  playerCreate: (player: Player) => void;
  playerDestroy: (player: Player) => void;
  playerMove: (player: Player, oldChannelId: string | null, newChannelId: string | null) => void;
  playerDisconnect: (player: Player, code: number, reason: string, byRemote: boolean) => void;
  trackStart: (player: Player, track: string) => void;
  trackEnd: (player: Player, track: string, reason: string) => void;
  trackError: (player: Player, track: string, exception: any) => void;
  trackStuck: (player: Player, track: string, thresholdMs: number) => void;
  queueEnd: (player: Player) => void;
  raw: (payload: any) => void;
}

export class EvtMan extends EventEmitter {
  public readonly client: Client;

  constructor(client: Client) {
    super();
    this.client = client;
  }

  public override emit<K extends keyof LavxEvents>(event: K, ...args: Parameters<LavxEvents[K]>): boolean {
    return super.emit(event, ...args);
  }

  public override on<K extends keyof LavxEvents>(event: K, listener: LavxEvents[K]): this {
    return super.on(event, listener);
  }

  public override once<K extends keyof LavxEvents>(event: K, listener: LavxEvents[K]): this {
    return super.once(event, listener);
  }
}
