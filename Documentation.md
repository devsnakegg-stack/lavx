# 📖 lavx Documentation

`lavx` is a minimal, TypeScript, Discord.js-only, multiplatform Lavalink client.

---

## 🚀 Getting Started

### Installation

```bash
npm install lavx discord.js ws undici
```

### Module Support

#### ESM (ES Modules)
```typescript
import { Client as LavxClient } from 'lavx';
```

#### CJS (CommonJS)
```javascript
const { Client: LavxClient } = require('lavx');
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
  ],
  defaultSearchPlatform: 'ytsearch' // Default search prefix
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

---

### Node Management (`client.node`)

#### `best()`
Returns the most available node based on current player load. Automatically filters for connected and ready nodes.

#### `migrate(fromNode: Node, toNode?: Node)`
Migrates all players from one node to another (e.g., during maintenance).

---

### Player API (`client.play`)

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
- `moveToChannel(channelId: string, options?)`: Moves the player to a different voice channel.
- `moveToNode(toNode: Node)`: Moves the player to a different Lavalink node mid-playback.

#### Filter Presets
Common presets available on `player.filterPresets`:
- `bassboost`
- `nightcore`
- `vaporwave`
- `pop`
- `soft`

Example:
```typescript
await player.setFilters(player.filterPresets.bassboost);
```

---

### Queue API (`client.queue`)

#### `Queue` instance properties/methods:
- `tracks`: The array of upcoming tracks.
- `current`: The currently playing track.
- `previous`: An array of previously played tracks (history).
- `loop`: Loop mode (`none`, `track`, `queue`).
- `autoplay`: Boolean. If enabled, it will fetch related tracks when the queue ends.
- `add(track)`: Adds track(s) to the queue.
- `next()`: Moves to the next track.
- `skip()`: Shorthand for `next()`.
- `shuffle()`: Shuffles the upcoming tracks.
- `clear()`: Clears the entire queue.
- `remove(index)`: Removes a specific track by index.

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
| `playerMove` | When a player moves to a different voice channel. |
| `trackStart` | When a track starts playing. |
| `trackEnd` | When a track finishes. |
| `trackError` | When a track encounters an exception. |
| `trackStuck` | When a track gets stuck. |
| `queueEnd` | When the queue has no more tracks to play. |

---

## 🌍 Multiplatform Support

`lavx` routes inputs based on their content:

- **Plain Text**: Defaults to `defaultSearchPlatform` (default: `ytsearch:`).
- **URLs**: Automatically handled. If a specific plugin (like LavaSrc) is missing, it falls back to searching via the default platform.

Requires Lavalink plugins like **LavaSrc** or **LavaSearch** on the server side for optimized platform metadata.
