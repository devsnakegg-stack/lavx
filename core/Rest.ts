import { fetch } from 'undici';
import { Node } from './NodeMan';

export class Rest {
  public readonly node: Node;

  constructor(node: Node) {
    this.node = node;
  }

  private get url() {
    const { host, port, secure } = this.node.options;
    return `${secure ? 'https' : 'http'}://${host}:${port}/v4`;
  }

  public async request(method: string, path: string, body?: any) {
    const res = await fetch(`${this.url}${path}`, {
      method,
      headers: {
        Authorization: this.node.options.auth,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status >= 400) {
      const error: any = await res.json().catch(() => null);
      const message = error?.message || error?.error || JSON.stringify(error) || 'Unknown error';
      throw new Error(`Lavalink REST error: ${res.status} - ${message}`);
    }

    if (res.status === 204) return null;
    return res.json();
  }

  public async loadTracks(identifier: string) {
    return this.request('GET', `/loadtracks?identifier=${encodeURIComponent(identifier)}`);
  }

  public async decodeTrack(track: string) {
    return this.request('GET', `/decodetrack?track=${track}`);
  }

  public async decodeTracks(tracks: string[]) {
    return this.request('POST', `/decodetracks`, tracks);
  }

  public async getStats() {
    return this.request('GET', `/stats`);
  }

  public async getInfo() {
    return this.request('GET', `/info`);
  }

  public async updatePlayer(guildId: string, data: any, noReplace: boolean = false) {
    if (!this.node.sessionId) throw new Error('Node session ID not available');
    return this.request('PATCH', `/sessions/${this.node.sessionId}/players/${guildId}?noReplace=${noReplace}`, data);
  }
}
