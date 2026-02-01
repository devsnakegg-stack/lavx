import { Client } from './Client';
import { Queue } from './Queue';

export class QMan {
  public readonly client: Client;
  public readonly queues: Map<string, Queue>;

  constructor(client: Client) {
    this.client = client;
    this.queues = new Map();
  }

  public get(guildId: string) {
    let queue = this.queues.get(guildId);
    if (!queue) {
      queue = new Queue(guildId);
      this.queues.set(guildId, queue);
    }
    return queue;
  }

  public delete(guildId: string) {
    this.queues.delete(guildId);
  }
}
