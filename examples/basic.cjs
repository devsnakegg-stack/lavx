const { Client: LavxClient } = require('../dist/index');
const { Client: DjsClient, GatewayIntentBits } = require('discord.js');

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

console.log('Lavx CJS initialized');
