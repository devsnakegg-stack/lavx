# 📖 lavx Documentation

`lavx` is a minimal, TypeScript, Discord.js-only, multiplatform Lavalink client.

---

## 🚀 Getting Started

### Installation

```bash
npm install lavx discord.js ws undici
```

---

## 🏗 Core API

### Client

The main entry point of the library.

#### `playInput(guildId: string, input: string, requester?: any)`
Resolves an input and automatically starts playback if the queue was empty.

#### `search(query: string, platform?: string, requester?: any)`
Searches for tracks on a specific platform (default: ytsearch). Returns a `ResolveResult`.

---

### Player API (`client.play`)

#### `Player` instance methods:
- `play(options?)`: Starts playing the current track.
- `stop()`: Stops playback.
- `pause(state: boolean)`: Pauses or resumes playback.
- `resume()`: Shorthand for `pause(false)`.
- `seek(position: number)`: Seeks to a specific position (ms).
- `rewind(ms: number)`: Rewind by ms.
- `forward(ms: number)`: Forward by ms.
- `restart()`: Restart current track.
- `setVolume(volume: number)`: Sets volume (0-1000).
- `fadeIn(ms: number)`: Fade in audio.
- `fadeOut(ms: number)`: Fade out audio.
- `setEQ(bands: { band: number; gain: number }[])`: Set equalizer bands.
- `setFilters(filters: any)`: Applies Lavalink filters.
- `clearFilters()`: Resets all filters.
- `balance(left, right)`: Set audio balance.
- `mono()`: Set mono output.
- `stereo()`: Set stereo output.
- `bassboost(level?)`: Apply bassboost (1-5).
- `nightcore()`: Apply nightcore filter.
- `vaporwave()`: Apply vaporwave filter.
- `connect(channelId: string, options?)`: Joins a voice channel.
- `disconnect()`: Leaves the voice channel.
- `moveToNode(toNode: Node)`: Migrate to a different node.
- `destroy(reason?)`: Destroys the player.

#### Smart Systems
- `autoplay()`: Toggle autoplay.
- `autoRecover()`: Toggle auto recovery.
- `autoResume()`: Toggle auto resume.
- `preloadNext()`: Pre-resolve the next track.

---

### Queue API (`client.queue`)

#### `Queue` instance methods:
- `add(track)`: Add tracks to queue.
- `addNext(track)`: Add tracks to play next.
- `insert(index, track)`: Insert track at index.
- `next()`: Move to next track.
- `skip()`: Skip current track.
- `previous()`: Play previous track from history.
- `jump(index)`: Jump to a specific index.
- `move(from, to)`: Move track position.
- `swap(i1, i2)`: Swap two tracks.
- `dedupe()`: Remove duplicates.
- `shuffle()`: Shuffle queue.
- `clear()`: Clear queue and history.
- `remove(index)`: Remove track by index.

---

### History System (`queue.history`)

- `get(max?)`: Get last played tracks.
- `clear()`: Clear history.
- `last()`: Get last played track.
- `size()`: Get history size.

---

### Source Management (`client.src`)

- `resolve(input)`: Resolve query/URL.
- `search(query, platform?, requester?)`: Search with specific platform prefix.
- `detectSource(url)`: Detect platform from URL.
- `fallbackSearch(query)`: Search using default platform.
- `bestSource(track)`: Find best quality source.
- `createUnresolved(query)`: Create a lazy-loading track.
