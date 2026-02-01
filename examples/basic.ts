import { Client as DjsClient, GatewayIntentBits } from 'discord.js';
import { Client as LavxClient } from '../index';

const djs = new DjsClient({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

const lavx = new LavxClient(djs, {
  nodes: [
    {
      host: 'localhost',
      port: 2333,
      auth: 'youshallnotpass',
    },
  ],
});

lavx.events.on('nodeConnect', (node) => {
  console.log(`Node ${node.name} connected`);
});

lavx.events.on('trackStart', (player, track) => {
  console.log(`Started playing ${track} in guild ${player.guildId}`);
});

djs.on('ready', () => {
  console.log(`Logged in as ${djs.user?.tag}`);
});

// Example usage:
// await lavx.playInput(guildId, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
