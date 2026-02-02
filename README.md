# 🔥 lavx

[![npm version](https://img.shields.io/npm/v/lavx.svg)](https://www.npmjs.com/package/lavx)
[![license](https://img.shields.io/github/license/user/lavx.svg)](LICENSE)
[![Discord.js](https://img.shields.io/badge/discord.js-v14-blue.svg)](https://discord.js.org)

**lavx** is a minimal, TypeScript-first, production-grade Lavalink client designed exclusively for **Discord.js**. It provides a clean, manager-driven architecture for handling audio playback across multiple platforms using a plugin-driven approach.

---

## ✨ Features

- 🎯 **Discord.js Only**: Optimized for the most popular Discord library.
- 🧩 **Manager-Driven**: Clean separation of concerns (Nodes, Players, Queues, Sources).
- 🌍 **Multiplatform**: Unified search API and built-in routing for YouTube, Spotify, Deezer, Apple Music, and more via Lavalink plugins.
- ⚡ **Performance**: Native dual ESM/CJS support, zero-dependency core (using standard `ws` and `undici`).
- 🎧 **Advanced Audio**: 15+ filter presets (Bassboost, Nightcore, etc.), fade effects, and custom audio balance.
- 🔄 **Failover & Migration**: Automatic node load balancing and manual player migration.
- 📜 **Queue System**: Advanced control (jump, move, swap, dedupe), ring-buffer history, and smart autoplay.
- 🛡 **Type Safe**: Written entirely in TypeScript with full type definitions.

---

## 🚀 Installation

```bash
npm install lavx discord.js ws undici
```

---

## 🛠 Quick Start

### 1. Initialize the Client

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
  defaultSearchPlatform: 'ytsearch'
});

djs.login('YOUR_TOKEN');
```

### 2. Play Audio

```typescript
client.on('messageCreate', async (message) => {
  if (message.content.startsWith('!play')) {
    const query = message.content.split(' ').slice(1).join(' ');
    const vc = message.member?.voice.channel;

    if (!vc) return message.reply('Join a voice channel!');

    // Get or create player and connect
    const player = lavx.play.get(message.guildId) || lavx.play.create({ guildId: message.guildId });
    if (!player.state.connected) await player.connect(vc.id);

    // Resolve and play
    const res = await lavx.playInput(message.guildId, query, message.author);
    if (res) message.reply(`Added **${res.tracks[0].info.title}** to queue!`);
  }
});
```

---

## 📂 Core Managers

- **`client.node`**: Manage Lavalink nodes, stats, and failover.
- **`client.play`**: Create and manage guild players.
- **`client.queue`**: Access and manage guild playback queues.
- **`client.src`**: Resolve inputs and create unresolved tracks for lazy loading.
- **`client.events`**: Centralized event emitter for node and player updates.

---

## 🎧 Documentation

Full documentation, including API references, event lists, and advanced configuration, is available at:
**[lavx Documentation Website](https://user.github.io/lavx/)**

---

## 🧪 Example Bot

A full-featured example bot is included in the `/Bot` directory, demonstrating:
- Prefix commands
- Filter management
- Queue control (shuffle, skip, previous)
- Audio output mixing
- Autoplay toggling

---

## 🏁 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
