# 📖 lavx Documentation

`lavx` is a minimal, TypeScript, Discord.js-only, multiplatform Lavalink client.

---

## 🚀 Getting Started

### Installation

```bash
npm install lavx discord.js ws undici
```

### Initializing the Client

```typescript
import { Client as DjsClient, GatewayIntentBits } from 'discord.js';
import { Client as LavxClient } from 'lavx';

const djs = new DjsClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
});

const lavx = new LavxClient(djs, {
  nodes: [
    {
      name: 'main',
      host: 'localhost',
      port: 2333,
      auth: 'youshallnotpass',
      secure: false
    }
  ]
});

djs.login('YOUR_TOKEN');
```

---

## 🏗 Core API

### Client

The main entry point of the library.

#### `playInput(guildId: string, input: string, requester?: any)`
Resolves an input and automatically starts playback if the queue was empty.
- **guildId**: The Discord guild ID.
- **input**: A search query or URL (YouTube, Spotify, etc.).
- **requester**: Optional data to attach to the tracks.

```typescript
await lavx.playInput(message.guildId, 'never gonna give you up', message.author);
```

#### `sendGatewayPayload(guildId: string, payload: any)`
Sends a raw payload to the Discord gateway. Used internally for voice connectivity.

---

### Node Management (`client.node`)

#### `add(options: NodeOptions)`
Adds a new Lavalink node.

#### `get(name: string)`
Gets a node by name.

#### `best()`
Returns the most available node based on current player load.

#### `destroy(name: string)`
Disconnects and removes a node.

---

### Player API (`client.play`)

#### `create(options: PlayerOptions)`
Creates or returns an existing player for a guild.

#### `get(guildId: string)`
Gets the player for a guild.

#### `destroy(guildId: string)`
Destroys the player and cleans up resources.

#### `Player` instance methods:
- `play(options?)`: Starts playing the current track in the queue.
- `stop()`: Stops playback.
- `pause(state: boolean)`: Pauses or resumes playback.
- `resume()`: Shorthand for `pause(false)`.
- `seek(position: number)`: Seeks to a specific position (ms).
- `setVolume(volume: number)`: Sets player volume (0-1000).
- `setFilters(filters: any)`: Applies Lavalink filters.
- `connect(channelId: string, options?)`: Joins a voice channel.
- `disconnect()`: Leaves the voice channel.

---

### Queue API (`client.queue`)

#### `get(guildId: string)`
Gets the queue for a guild.

#### `Queue` instance properties/methods:
- `tracks`: The array of upcoming tracks.
- `current`: The currently playing track.
- `previous`: An array of previously played tracks.
- `loop`: Loop mode (`none`, `track`, `queue`).
- `add(track)`: Adds track(s) to the queue.
- `next()`: Moves to the next track.
- `skip()`: Shorthand for `next()`.
- `shuffle()`: Shuffles the upcoming tracks.
- `clear()`: Clears the entire queue.

---

### Events (`client.events`)

Listen to events using `lavx.events.on(eventName, callback)`.

| Event | Description |
|---|---|
| `nodeConnect` | When a node successfully connects. |
| `nodeDisconnect` | When a node disconnects. |
| `nodeError` | When a node encounters an error. |
| `nodeReady` | When a node is ready (session ID received). |
| `playerCreate` | When a new player is created. |
| `playerDestroy` | When a player is destroyed. |
| `trackStart` | When a track starts playing. |
| `trackEnd` | When a track finishes. |
| `trackError` | When a track encounters an exception. |
| `trackStuck` | When a track gets stuck. |
| `queueEnd` | When the queue has no more tracks to play. |

---

## 🌍 Multiplatform Support

`lavx` routes inputs based on their content:

- **Plain Text**: Defaults to YouTube Search (`ytsearch:`).
- **YouTube/SoundCloud URL**: Loaded directly as a URL.
- **Spotify/Apple/Deezer URL**: Automatically prefixed with search identifiers (e.g., `spsearch:`) for Lavalink plugins to handle.

Requires Lavalink plugins like **LavaSrc** or **LavaSearch** on the server side for non-direct platforms.
