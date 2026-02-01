// src/Sock.ts
import WebSocket from "ws";
var Sock = class {
  node;
  ws = null;
  reconnectTimeout = null;
  reconnectAttempts = 0;
  constructor(node) {
    this.node = node;
  }
  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    const { host, port, auth, secure } = this.node.options;
    const protocol = secure ? "wss" : "ws";
    const url = `${protocol}://${host}:${port}/v4/websocket`;
    const userId = this.node.client.discord.user?.id;
    if (!userId) {
      this.reconnect();
      return;
    }
    this.ws = new WebSocket(url, {
      headers: {
        Authorization: auth,
        "User-Id": userId,
        "Client-Name": "lavx"
      }
    });
    this.ws.on("open", () => this.onOpen());
    this.ws.on("message", (data) => this.onMessage(data));
    this.ws.on("close", (code, reason) => this.onClose(code, reason));
    this.ws.on("error", (err) => this.onError(err));
  }
  onOpen() {
    this.node.connected = true;
    this.reconnectAttempts = 0;
    this.node.client.events.emit("nodeConnect", this.node);
  }
  onMessage(data) {
    let payload;
    try {
      payload = JSON.parse(data.toString());
    } catch (e) {
      return;
    }
    this.node.client.events.emit("raw", payload);
    switch (payload.op) {
      case "stats":
        this.node.stats = payload;
        break;
      case "event":
        this.handlePlayerEvent(payload);
        break;
      case "playerUpdate":
        this.handlePlayerUpdate(payload);
        break;
      case "ready":
        this.node.sessionId = payload.sessionId;
        this.node.client.events.emit("nodeReady", this.node, payload);
        break;
    }
  }
  handlePlayerEvent(payload) {
    const player = this.node.client.play.get(payload.guildId);
    if (!player) return;
    switch (payload.type) {
      case "TrackStartEvent":
        this.node.client.events.emit("trackStart", player, payload.track);
        break;
      case "TrackEndEvent":
        this.node.client.events.emit("trackEnd", player, payload.track, payload.reason);
        player.onTrackEnd(payload);
        break;
      case "TrackExceptionEvent":
        this.node.client.events.emit("trackError", player, payload.track, payload.exception);
        break;
      case "TrackStuckEvent":
        this.node.client.events.emit("trackStuck", player, payload.track, payload.thresholdMs);
        break;
      case "WebSocketClosedEvent":
        this.node.client.events.emit("playerDisconnect", player, payload.code, payload.reason, payload.byRemote);
        break;
    }
  }
  handlePlayerUpdate(payload) {
    const player = this.node.client.play.get(payload.guildId);
    if (player) {
      player.state = { ...player.state, ...payload.state };
    }
  }
  onClose(code, reason) {
    this.node.connected = false;
    this.node.sessionId = null;
    this.node.client.events.emit("nodeDisconnect", this.node, code, reason.toString());
    this.reconnect();
  }
  onError(err) {
    this.node.client.events.emit("nodeError", this.node, err);
  }
  reconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    const maxAttempts = this.node.client.options.maxReconnectAttempts || 10;
    if (this.reconnectAttempts >= maxAttempts) {
      this.node.client.node.handleNodeFailure(this.node);
      return;
    }
    this.reconnectAttempts++;
    this.reconnectTimeout = setTimeout(() => {
      this.node.client.events.emit("nodeReconnect", this.node);
      this.connect();
    }, Math.min(this.reconnectAttempts * 5e3, 3e4));
  }
  send(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }
  close() {
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
  }
};

// src/Rest.ts
import { fetch } from "undici";
var Rest = class {
  node;
  constructor(node) {
    this.node = node;
  }
  get url() {
    const { host, port, secure } = this.node.options;
    return `${secure ? "https" : "http"}://${host}:${port}/v4`;
  }
  async request(method, path, body) {
    const res = await fetch(`${this.url}${path}`, {
      method,
      headers: {
        Authorization: this.node.options.auth,
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : void 0
    });
    if (res.status >= 400) {
      const error = await res.json().catch(() => null);
      const message = error?.message || error?.error || JSON.stringify(error) || "Unknown error";
      throw new Error(`Lavalink REST error: ${res.status} - ${message}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }
  async loadTracks(identifier) {
    return this.request("GET", `/loadtracks?identifier=${encodeURIComponent(identifier)}`);
  }
  async decodeTrack(track) {
    return this.request("GET", `/decodetrack?track=${track}`);
  }
  async decodeTracks(tracks) {
    return this.request("POST", `/decodetracks`, tracks);
  }
  async getStats() {
    return this.request("GET", `/stats`);
  }
  async getInfo() {
    return this.request("GET", `/info`);
  }
  async updatePlayer(guildId, data, noReplace = false) {
    if (!this.node.sessionId) throw new Error("Node session ID not available");
    return this.request("PATCH", `/sessions/${this.node.sessionId}/players/${guildId}?noReplace=${noReplace}`, data);
  }
};

// src/NodeMan.ts
var NodeMan = class {
  client;
  nodes;
  constructor(client) {
    this.client = client;
    this.nodes = /* @__PURE__ */ new Map();
  }
  add(options) {
    const name = options.name || `${options.host}:${options.port}`;
    const node = new Node(this.client, name, options);
    this.nodes.set(name, node);
    node.connect();
    return node;
  }
  get(name) {
    return this.nodes.get(name);
  }
  best() {
    return Array.from(this.nodes.values()).filter((n) => n.connected && n.sessionId).sort((a, b) => (a.stats?.players || 0) - (b.stats?.players || 0))[0];
  }
  destroy(name) {
    const node = this.nodes.get(name);
    if (node) {
      node.destroy();
      this.nodes.delete(name);
    }
  }
  async migrate(fromNode, toNode) {
    const targetNode = toNode || this.best();
    if (!targetNode || targetNode === fromNode) return;
    const players = Array.from(this.client.play.players.values()).filter((p) => p.node === fromNode);
    for (const player of players) {
      await player.moveToNode(targetNode);
    }
  }
  async handleNodeFailure(node) {
    await this.migrate(node);
  }
};
var Node = class {
  client;
  name;
  options;
  sock;
  rest;
  connected = false;
  sessionId = null;
  stats = null;
  constructor(client, name, options) {
    this.client = client;
    this.name = name;
    this.options = options;
    this.sock = new Sock(this);
    this.rest = new Rest(this);
  }
  connect() {
    this.sock.connect();
  }
  destroy() {
    this.sock.close();
  }
};

// src/Voice.ts
var Voice = class {
  player;
  sessionId = null;
  token = null;
  endpoint = null;
  channelId = null;
  constructor(player) {
    this.player = player;
  }
  update(data) {
    if (data.token) {
      this.token = data.token;
      this.endpoint = data.endpoint;
    } else if (data.session_id) {
      this.sessionId = data.session_id;
      if (data.channel_id !== this.channelId) {
        const oldChannelId = this.channelId;
        this.channelId = data.channel_id;
        this.player.node.client.events.emit("playerMove", this.player, oldChannelId, this.channelId);
      }
    }
    if (this.token && this.sessionId && this.endpoint) {
      this.player.node.rest.updatePlayer(this.player.guildId, {
        voice: {
          token: this.token,
          endpoint: this.endpoint,
          sessionId: this.sessionId
        }
      });
    }
  }
};

// src/Track.ts
function isUnresolvedTrack(track) {
  return typeof track.resolve === "function";
}

// src/Player.ts
var DestroyReason = /* @__PURE__ */ ((DestroyReason2) => {
  DestroyReason2["ChannelDeleted"] = "CHANNEL_DELETED";
  DestroyReason2["Disconnected"] = "DISCONNECTED";
  DestroyReason2["PlayerDestroyed"] = "PLAYER_DESTROYED";
  DestroyReason2["NodeDestroyed"] = "NODE_DESTROYED";
  DestroyReason2["LoadFailed"] = "LOAD_FAILED";
  return DestroyReason2;
})(DestroyReason || {});
var Player = class {
  node;
  guildId;
  voice;
  playing = false;
  paused = false;
  state = {
    time: 0,
    position: 0,
    connected: false,
    ping: -1
  };
  volume = 100;
  filters = {};
  constructor(node, guildId) {
    this.node = node;
    this.guildId = guildId;
    this.voice = new Voice(this);
  }
  async play(options = {}) {
    const queue = this.node.client.queue.get(this.guildId);
    if (!options.track && (!queue.current || isUnresolvedTrack(queue.current))) {
      const next = queue.current || queue.tracks[0];
      if (next && isUnresolvedTrack(next)) {
        const resolved = await next.resolve(this);
        if (!resolved) {
          queue.tracks.shift();
          return this.onTrackEnd({ reason: "loadFailed" });
        }
        if (!queue.current) queue.current = queue.tracks.shift();
      }
    }
    const track = options.track || queue.current?.track;
    if (!track) throw new Error("No track to play");
    await this.node.rest.updatePlayer(this.guildId, {
      encodedTrack: track,
      position: options.startTime,
      endTime: options.endTime
    }, options.noReplace);
    this.playing = true;
    this.paused = false;
  }
  async stop() {
    await this.node.rest.updatePlayer(this.guildId, { encodedTrack: null });
    this.playing = false;
    this.paused = false;
  }
  async pause(state = true) {
    await this.node.rest.updatePlayer(this.guildId, { paused: state });
    this.paused = state;
  }
  async resume() {
    await this.pause(false);
  }
  async seek(position) {
    await this.node.rest.updatePlayer(this.guildId, { position });
  }
  async setVolume(volume) {
    await this.node.rest.updatePlayer(this.guildId, { volume });
    this.volume = volume;
  }
  async setFilters(filters) {
    await this.node.rest.updatePlayer(this.guildId, { filters });
    this.filters = { ...this.filters, ...filters };
  }
  async setAudioOutput(output) {
    const channelMix = {
      leftToLeft: 1,
      leftToRight: 0,
      rightToLeft: 0,
      rightToRight: 1
    };
    if (output === "left") {
      channelMix.rightToLeft = 1;
      channelMix.rightToRight = 0;
    } else if (output === "right") {
      channelMix.leftToLeft = 0;
      channelMix.leftToRight = 1;
    } else if (output === "mono") {
      channelMix.leftToRight = 1;
      channelMix.rightToLeft = 1;
    }
    await this.setFilters({ channelMix });
  }
  async moveToNode(toNode) {
    if (this.node === toNode) return;
    const position = this.state.position;
    this.node = toNode;
    if (this.playing || this.paused) {
      await this.play({ startTime: position });
    }
  }
  async moveToChannel(channelId, options = {}) {
    await this.connect(channelId, options);
  }
  async connect(channelId, options = {}) {
    this.node.client.sendGatewayPayload(this.guildId, {
      op: 4,
      d: {
        guild_id: this.guildId,
        channel_id: channelId,
        self_mute: options.mute ?? false,
        self_deaf: options.deaf ?? false
      }
    });
  }
  async disconnect() {
    this.node.client.sendGatewayPayload(this.guildId, {
      op: 4,
      d: {
        guild_id: this.guildId,
        channel_id: null,
        self_mute: false,
        self_deaf: false
      }
    });
    await this.stop();
  }
  async onTrackEnd(payload) {
    this.playing = false;
    if (payload.reason !== "replaced" && payload.reason !== "stopped") {
      const queue = this.node.client.queue.get(this.guildId);
      if (await queue.next()) {
        await this.play();
      } else if (queue.autoplay && queue.previous.length > 0) {
        await this.handleAutoplay(queue.previous[queue.previous.length - 1]);
      } else {
        this.node.client.events.emit("queueEnd", this);
      }
    }
  }
  async handleAutoplay(lastTrack) {
    const source = lastTrack.info.sourceName;
    let query = "";
    if (source === "youtube") {
      query = `https://www.youtube.com/watch?v=${lastTrack.info.identifier}&list=RD${lastTrack.info.identifier}`;
    } else if (source === "spotify") {
      query = `sprec:${lastTrack.info.identifier}`;
    } else if (source === "deezer") {
      query = `dzrec:${lastTrack.info.identifier}`;
    } else if (source === "apple-music") {
      query = `amrec:${lastTrack.info.identifier}`;
    } else {
      const defaultSearch = this.node.client.options.defaultSearchPlatform || "ytsearch";
      query = `${defaultSearch}:${lastTrack.info.author} ${lastTrack.info.title} related`;
    }
    let res = await this.node.client.src.resolve(query);
    if ((!res || !res.tracks.length) && query.includes("rec:")) {
      const defaultSearch = this.node.client.options.defaultSearchPlatform || "ytsearch";
      res = await this.node.client.src.resolve(`${defaultSearch}:${lastTrack.info.author} ${lastTrack.info.title} related`);
    }
    if (res && res.tracks.length > 0) {
      const track = res.tracks.find((t) => t.info?.identifier !== lastTrack.info.identifier) || res.tracks[0];
      const queue = this.node.client.queue.get(this.guildId);
      await queue.add(track);
      await this.play();
    } else {
      this.node.client.events.emit("queueEnd", this);
    }
  }
  filterPresets = {
    bassboost: { equalizer: [{ band: 0, gain: 0.6 }, { band: 1, gain: 0.67 }, { band: 2, gain: 0.67 }] },
    nightcore: { timescale: { speed: 1.1, pitch: 1.2, rate: 1 } },
    vaporwave: { timescale: { speed: 0.85, pitch: 0.8 } },
    pop: { equalizer: [{ band: 0, gain: 0.65 }, { band: 1, gain: 0.45 }, { band: 2, gain: -0.45 }, { band: 3, gain: -0.65 }, { band: 4, gain: 0.7 }, { band: 5, gain: 0.45 }] },
    soft: { equalizer: [{ band: 0, gain: 0 }, { band: 8, gain: -0.25 }] },
    electronic: { equalizer: [{ band: 0, gain: 0.375 }, { band: 1, gain: 0.35 }, { band: 2, gain: 0.125 }, { band: 5, gain: -0.125 }, { band: 6, gain: -0.125 }] },
    dance: { equalizer: [{ band: 0, gain: 0.6 }, { band: 1, gain: 0.7 }, { band: 2, gain: 0.2 }, { band: 3, gain: 0 }, { band: 4, gain: 0 }, { band: 5, gain: -0.2 }, { band: 6, gain: -0.5 }, { band: 7, gain: -0.5 }] },
    classical: { equalizer: [{ band: 0, gain: -0.25 }, { band: 1, gain: -0.25 }, { band: 2, gain: -0.25 }, { band: 3, gain: -0.25 }, { band: 4, gain: -0.25 }, { band: 5, gain: -0.25 }, { band: 6, gain: 0 }, { band: 7, gain: 0.25 }, { band: 8, gain: 0.25 }, { band: 9, gain: 0.25 }, { band: 10, gain: 0.25 }, { band: 11, gain: 0.25 }, { band: 12, gain: 0.25 }, { band: 13, gain: 0.25 }, { band: 14, gain: 0.25 }] },
    rock: { equalizer: [{ band: 0, gain: 0.3 }, { band: 1, gain: 0.25 }, { band: 2, gain: 0.2 }, { band: 3, gain: 0.1 }, { band: 4, gain: 0.05 }, { band: 5, gain: -0.05 }, { band: 6, gain: -0.15 }, { band: 7, gain: -0.2 }, { band: 8, gain: -0.25 }, { band: 9, gain: -0.25 }] },
    fullbass: { equalizer: [{ band: 0, gain: 0.25 }, { band: 1, gain: 0.5 }, { band: 2, gain: 0.75 }, { band: 3, gain: 1 }, { band: 4, gain: 0.5 }, { band: 5, gain: 0.25 }] },
    karaoke: { karaoke: { level: 1, monoLevel: 1, filterBand: 220, filterWidth: 100 } },
    tremolo: { tremolo: { frequency: 2, depth: 0.5 } },
    vibrato: { vibrato: { frequency: 2, depth: 0.5 } },
    rotation: { rotation: { rotationHz: 0.2 } },
    distortion: { distortion: { sinOffset: 0, sinScale: 1, cosOffset: 0, cosScale: 1, tanOffset: 0, tanScale: 1, offset: 0, scale: 1 } },
    lowpass: { lowPass: { smoothing: 20 } }
  };
  async destroy(reason = "PLAYER_DESTROYED" /* PlayerDestroyed */) {
    this.node.client.events.emit("playerDestroy", this, reason);
    await this.node.rest.request("DELETE", `/sessions/${this.node.sessionId}/players/${this.guildId}`);
  }
};

// src/PlayMan.ts
var PlayMan = class {
  client;
  players;
  constructor(client) {
    this.client = client;
    this.players = /* @__PURE__ */ new Map();
  }
  create(options) {
    let player = this.players.get(options.guildId);
    if (player) return player;
    const node = options.nodeName ? this.client.node.get(options.nodeName) : this.client.node.best();
    if (!node) throw new Error("No available Lavalink nodes");
    player = new Player(node, options.guildId);
    this.players.set(options.guildId, player);
    this.client.events.emit("playerCreate", player);
    return player;
  }
  get(guildId) {
    return this.players.get(guildId);
  }
  destroy(guildId, reason = "PLAYER_DESTROYED" /* PlayerDestroyed */) {
    const player = this.players.get(guildId);
    if (player) {
      player.destroy(reason);
      this.players.delete(guildId);
    }
  }
  handleVoiceUpdate(data) {
    const player = this.players.get(data.guild_id);
    if (player) {
      player.voice.update(data);
    }
  }
};

// src/Queue.ts
var LoopMode = /* @__PURE__ */ ((LoopMode2) => {
  LoopMode2["None"] = "none";
  LoopMode2["Track"] = "track";
  LoopMode2["Queue"] = "queue";
  return LoopMode2;
})(LoopMode || {});
var MemoryQueueStore = class {
  stores = /* @__PURE__ */ new Map();
  async get(guildId) {
    return this.stores.get(guildId) || null;
  }
  async set(guildId, value) {
    this.stores.set(guildId, value);
  }
  async delete(guildId) {
    this.stores.delete(guildId);
  }
};
var Queue = class {
  tracks = [];
  current = null;
  previous = [];
  loop = "none" /* None */;
  autoplay = false;
  store;
  guildId;
  constructor(guildId, store = new MemoryQueueStore()) {
    this.guildId = guildId;
    this.store = store;
  }
  async add(track) {
    if (Array.isArray(track)) {
      this.tracks.push(...track);
    } else {
      this.tracks.push(track);
    }
    if (!this.current) {
      const next = this.tracks.shift();
      if (next && "resolve" in next) {
        this.tracks.unshift(next);
      } else {
        this.current = next || null;
      }
    }
    await this.save();
  }
  async next() {
    if (this.current) {
      if (this.loop === "track" /* Track */) {
        return true;
      }
      this.previous.push(this.current);
      if (this.previous.length > 100) this.previous.shift();
      if (this.loop === "queue" /* Queue */) {
        this.tracks.push(this.current);
      }
    }
    const next = this.tracks.shift();
    if (next && "resolve" in next) {
      this.tracks.unshift(next);
      this.current = null;
    } else {
      this.current = next || null;
    }
    await this.save();
    return !!this.current || this.tracks.length > 0 && "resolve" in this.tracks[0];
  }
  async skip() {
    return this.next();
  }
  async shuffle() {
    for (let i = this.tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tracks[i], this.tracks[j]] = [this.tracks[j], this.tracks[i]];
    }
    await this.save();
  }
  async clear() {
    this.tracks = [];
    this.current = null;
    this.previous = [];
    await this.save();
  }
  async remove(index) {
    if (index < 0 || index >= this.tracks.length) return null;
    const track = this.tracks.splice(index, 1)[0];
    await this.save();
    return track;
  }
  find(query) {
    return this.tracks.filter(
      (t) => t.info?.title?.toLowerCase().includes(query.toLowerCase()) || t.info?.author?.toLowerCase().includes(query.toLowerCase())
    );
  }
  async save() {
    await this.store.set(this.guildId, {
      current: this.current,
      previous: this.previous,
      tracks: this.tracks
    });
  }
  async load() {
    const data = await this.store.get(this.guildId);
    if (data) {
      this.current = data.current;
      this.previous = data.previous;
      this.tracks = data.tracks;
    }
  }
};

// src/QMan.ts
var QMan = class {
  client;
  queues;
  constructor(client) {
    this.client = client;
    this.queues = /* @__PURE__ */ new Map();
  }
  get(guildId) {
    let queue = this.queues.get(guildId);
    if (!queue) {
      queue = new Queue(guildId);
      this.queues.set(guildId, queue);
    }
    return queue;
  }
  delete(guildId) {
    this.queues.delete(guildId);
  }
};

// src/SrcMan.ts
var SrcMan = class {
  client;
  constructor(client) {
    this.client = client;
  }
  async resolve(input, requester) {
    if (!this.validateInput(input)) {
      return { type: "error", tracks: [] };
    }
    const node = this.client.node.best();
    if (!node) throw new Error("No available nodes");
    let identifier = input;
    if (!this.isUrl(input)) {
      const defaultSearch = this.client.options.defaultSearchPlatform || "ytsearch";
      identifier = `${defaultSearch}:${input}`;
    }
    let data = await node.rest.loadTracks(identifier);
    if ((data.loadType === "empty" || data.loadType === "error") && this.isUrl(input)) {
      const defaultSearch = this.client.options.defaultSearchPlatform || "ytsearch";
      data = await node.rest.loadTracks(`${defaultSearch}:${input}`);
    }
    switch (data.loadType) {
      case "track":
        return { type: "track", tracks: [this.mapTrack(data.data, requester)] };
      case "playlist":
        return {
          type: "playlist",
          tracks: data.data.tracks.map((t) => this.mapTrack(t, requester)),
          playlistName: data.data.info.name,
          playlistArtworkUrl: data.data.pluginInfo?.artworkUrl || data.data.info?.artworkUrl
        };
      case "search":
        return { type: "search", tracks: data.data.map((t) => this.mapTrack(t, requester)) };
      case "error":
        return { type: "error", tracks: [] };
      case "empty":
        return { type: "search", tracks: [] };
      default:
        return { type: "error", tracks: [] };
    }
  }
  createUnresolved(query, requester) {
    const track = {
      resolve: async (player) => {
        const res = await this.resolve(query, requester);
        if (res.tracks.length > 0 && !("resolve" in res.tracks[0])) {
          const resolved = res.tracks[0];
          Object.assign(track, resolved);
          const queue = player.node.client.queue.get(player.guildId);
          if (queue.current === track) {
            queue.current = track;
          }
          return true;
        }
        return false;
      },
      info: { title: query },
      requester
    };
    return track;
  }
  validateInput(input) {
    const { whitelist, blacklist } = this.client.options;
    if (whitelist && whitelist.length > 0) {
      return whitelist.some((domain) => input.includes(domain));
    }
    if (blacklist && blacklist.length > 0) {
      return !blacklist.some((domain) => input.includes(domain));
    }
    return true;
  }
  isUrl(input) {
    try {
      new URL(input);
      return true;
    } catch {
      return false;
    }
  }
  mapTrack(data, requester) {
    if (data.info && !data.info.duration && data.info.length) {
      data.info.duration = data.info.length;
    }
    if (data.info && !data.info.artworkUrl && data.pluginInfo?.artworkUrl) {
      data.info.artworkUrl = data.pluginInfo.artworkUrl;
    }
    if (data.info && !data.info.artworkUrl && data.info.image) {
      data.info.artworkUrl = data.info.image;
    }
    return {
      track: data.encoded,
      info: data.info,
      pluginInfo: data.pluginInfo || {},
      src: data.info.sourceName,
      requester
    };
  }
};

// src/EvtMan.ts
import { EventEmitter } from "events";
var EvtMan = class extends EventEmitter {
  client;
  constructor(client) {
    super();
    this.client = client;
  }
  emit(event, ...args) {
    return super.emit(event, ...args);
  }
  on(event, listener) {
    return super.on(event, listener);
  }
  once(event, listener) {
    return super.once(event, listener);
  }
};

// src/Client.ts
var Client = class {
  discord;
  node;
  play;
  queue;
  src;
  events;
  options;
  constructor(discord, options) {
    this.discord = discord;
    this.options = {
      defaultSearchPlatform: "ytsearch",
      ...options
    };
    this.events = new EvtMan(this);
    this.node = new NodeMan(this);
    this.play = new PlayMan(this);
    this.queue = new QMan(this);
    this.src = new SrcMan(this);
    this.init();
  }
  init() {
    this.discord.on("raw", (packet) => {
      if (packet.t === "VOICE_SERVER_UPDATE" || packet.t === "VOICE_STATE_UPDATE") {
        this.play.handleVoiceUpdate(packet.d);
      }
      if (packet.t === "CHANNEL_DELETE") {
        const guildId = packet.d.guild_id;
        const channelId = packet.d.id;
        const player = this.play.get(guildId);
        if (player && player.voice.channelId === channelId) {
          player.destroy("CHANNEL_DELETED" /* ChannelDeleted */);
        }
      }
    });
    for (const nodeOptions of this.options.nodes) {
      this.node.add(nodeOptions);
    }
    this.events.on("nodeDisconnect", (node) => {
      this.node.migrate(node);
    });
  }
  sendGatewayPayload(guildId, payload) {
    if (this.options.send) {
      this.options.send(guildId, payload);
    } else {
      const guild = this.discord.guilds.cache.get(guildId);
      if (guild) {
        guild.shard.send(payload);
      }
    }
  }
  async playInput(guildId, input, requester) {
    const resolved = await this.src.resolve(input);
    if (!resolved || !resolved.tracks.length) return null;
    const player = this.play.get(guildId) || this.play.create({ guildId });
    const queue = this.queue.get(guildId);
    if (resolved.type === "playlist") {
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
};

// src/Map.ts
var PlatformMap = {
  spotify: "spsearch",
  apple: "amsearch",
  deezer: "dzsearch",
  yandex: "ymsearch",
  youtube: "ytsearch",
  "youtube music": "ytmsearch",
  soundcloud: "scsearch"
};
export {
  Client,
  DestroyReason,
  EvtMan,
  LoopMode,
  MemoryQueueStore,
  Node,
  NodeMan,
  PlatformMap,
  PlayMan,
  Player,
  QMan,
  Queue,
  Rest,
  Sock,
  SrcMan,
  Voice,
  isUnresolvedTrack
};
//# sourceMappingURL=index.mjs.map