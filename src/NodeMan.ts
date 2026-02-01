import { Client, NodeOptions } from './Client';
import { Sock } from './Sock';
import { Rest } from './Rest';
import { Player } from './Player';

export class NodeMan {
  public readonly client: Client;
  public readonly nodes: Map<string, Node>;

  constructor(client: Client) {
    this.client = client;
    this.nodes = new Map();
  }

  public add(options: NodeOptions) {
    const name = options.name || `${options.host}:${options.port}`;
    const node = new Node(this.client, name, options);
    this.nodes.set(name, node);
    node.connect();
    return node;
  }

  public get(name: string) {
    return this.nodes.get(name);
  }

  public best() {
    return Array.from(this.nodes.values())
      .filter((n) => n.connected && n.sessionId)
      .sort((a, b) => (a.stats?.players || 0) - (b.stats?.players || 0))[0];
  }

  public destroy(name: string) {
    const node = this.nodes.get(name);
    if (node) {
      node.destroy();
      this.nodes.delete(name);
    }
  }

  public async migrate(fromNode: Node, toNode?: Node) {
    const targetNode = toNode || this.best();
    if (!targetNode || targetNode === fromNode) return;

    const players = Array.from(this.client.play.players.values()).filter(p => p.node === fromNode);
    for (const player of players) {
      await player.move(targetNode);
    }
  }
}

export class Node {
  public readonly client: Client;
  public readonly name: string;
  public readonly options: NodeOptions;
  public readonly sock: Sock;
  public readonly rest: Rest;
  public connected: boolean = false;
  public sessionId: string | null = null;
  public stats: any = null;

  constructor(client: Client, name: string, options: NodeOptions) {
    this.client = client;
    this.name = name;
    this.options = options;
    this.sock = new Sock(this);
    this.rest = new Rest(this);
  }

  public connect() {
    this.sock.connect();
  }

  public destroy() {
    this.sock.close();
  }
}
