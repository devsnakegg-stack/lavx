import { Client, NodeOptions } from './Client';
import { Sock } from './Sock';
import { Rest } from './Rest';

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
      .filter((n) => n.connected)
      .sort((a, b) => (a.stats?.players || 0) - (b.stats?.players || 0))[0];
  }

  public destroy(name: string) {
    const node = this.nodes.get(name);
    if (node) {
      node.destroy();
      this.nodes.delete(name);
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
