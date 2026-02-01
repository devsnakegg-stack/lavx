import { Client as DjsClient, GatewayIntentBits, Message } from 'discord.js';
import { Client as LavxClient, LoopMode } from '../src/Index'; // Using source for development, but can be dist/index

const client = new DjsClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

const lavx = new LavxClient(client, {
  nodes: [
    {
      name: 'local',
      host: 'localhost',
      port: 2333,
      auth: 'youshallnotpass',
      secure: false,
    },
  ],
});

const prefix = '!';

client.on('ready', () => {
  console.log(`Bot logged in as ${client.user?.tag}`);
});

lavx.events.on('nodeConnect', (node) => console.log(`Node ${node.name} connected`));
lavx.events.on('trackStart', (player, track) => console.log(`Started track in ${player.guildId}`));
lavx.events.on('queueEnd', (player) => console.log(`Queue ended in ${player.guildId}`));

client.on('messageCreate', async (message: Message) => {
  if (message.author.bot || !message.guild || !message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/g);
  const command = args.shift()?.toLowerCase();

  const player = lavx.play.get(message.guild.id);
  const queue = lavx.queue.get(message.guild.id);

  if (command === 'play') {
    const input = args.join(' ');
    if (!input) return message.reply('Please provide an input');

    const vc = message.member?.voice.channel;
    if (!vc) return message.reply('Join a voice channel first');

    const p = lavx.play.get(message.guild.id) || lavx.play.create({ guildId: message.guild.id });
    if (!p.state.connected) await p.connect(vc.id);

    const res = await lavx.playInput(message.guild.id, input, message.author);
    if (!res) return message.reply('No results found');

    if (res.type === 'playlist') {
      message.reply(`Loaded playlist **${res.playlistName}** with ${res.tracks.length} tracks\nURL: ${res.tracks[0].info.uri}`);
    } else {
      message.reply(`Added to queue: **${res.tracks[0].info.title}**\nURL: ${res.tracks[0].info.uri}`);
    }
  }

  if (command === 'defaultsearch') {
    const platform = args[0];
    if (!platform) return message.reply(`Current default search platform: \`${lavx.options.defaultSearchPlatform}\``);
    lavx.options.defaultSearchPlatform = platform;
    message.reply(`Default search platform changed to \`${platform}\``);
  }

  if (command === 'pause') {
    if (!player) return message.reply('No player found');
    await player.pause(true);
    message.reply('Paused');
  }

  if (command === 'resume') {
    if (!player) return message.reply('No player found');
    await player.pause(false);
    message.reply('Resumed');
  }

  if (command === 'stop') {
    if (!player) return message.reply('No player found');
    await player.stop();
    message.reply('Stopped');
  }

  if (command === 'skip') {
    if (!player) return message.reply('No player found');
    queue.skip();
    if (queue.current) {
        await player.play();
        message.reply(`Skipped to: ${queue.current.info.title}`);
    } else {
        await player.stop();
        message.reply('Skipped, no more tracks');
    }
  }

  if (command === 'previous') {
    if (!queue.previous.length) return message.reply('No previous tracks');
    const prev = queue.previous.pop()!;
    queue.tracks.unshift(queue.current!);
    queue.current = prev;
    await player?.play();
    message.reply(`Playing previous: ${queue.current.info.title}`);
  }

  if (command === 'shuffle') {
    queue.shuffle();
    message.reply('Queue shuffled');
  }

  if (command === 'loop') {
    const mode = args[0]?.toLowerCase();
    if (mode === 'track') {
        queue.loop = LoopMode.Track;
        message.reply('Looping current track');
    } else if (mode === 'queue') {
        queue.loop = LoopMode.Queue;
        message.reply('Looping queue');
    } else {
        queue.loop = LoopMode.None;
        message.reply('Looping disabled');
    }
  }

  if (command === 'queue') {
    const sub = args[0]?.toLowerCase();
    if (sub === 'clear') {
        queue.clear();
        message.reply('Queue cleared');
    } else if (sub === 'remove') {
        const index = parseInt(args[1]);
        if (isNaN(index)) return message.reply('Invalid index');
        const removed = queue.tracks.splice(index - 1, 1);
        message.reply(`Removed ${removed[0]?.info.title || 'nothing'}`);
    } else {
        const list = queue.tracks.map((t, i) => `${i + 1}. ${t.info.title}`).join('\n') || 'Empty';
        message.reply(`**Current:** ${queue.current?.info.title || 'None'}\n**Upcoming:**\n${list.slice(0, 1500)}`);
    }
  }

  if (command === 'disconnect') {
    if (!player) return message.reply('No player found');
    await player.disconnect();
    lavx.play.destroy(message.guild.id);
    message.reply('Disconnected');
  }
});

client.login('TOKEN');
