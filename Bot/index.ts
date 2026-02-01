import { Client as DjsClient, GatewayIntentBits, Message, EmbedBuilder } from 'discord.js';
import { Client as LavxClient, LoopMode } from '../src/Index';

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
  defaultSearchPlatform: 'ytsearch',
  maxReconnectAttempts: 5,
});

const prefix = '!';

client.on('ready', () => {
  console.log(`Bot logged in as ${client.user?.tag}`);
});

lavx.events.on('nodeConnect', (node) => console.log(`Node ${node.name} connected`));
lavx.events.on('nodeDisconnect', (node, code, reason) => console.log(`Node ${node.name} disconnected: ${code} ${reason}`));
lavx.events.on('trackStart', (player, track) => console.log(`Started track in ${player.guildId}`));
lavx.events.on('playerMove', (player, oldId, newId) => console.log(`Player in ${player.guildId} moved from ${oldId} to ${newId}`));
lavx.events.on('queueEnd', (player) => console.log(`Queue ended in ${player.guildId}`));
lavx.events.on('nodeReady', (node) => console.log(`Node ${node.name} ready`));
lavx.events.on('playerDestroy', (player, reason) => console.log(`Player in ${player.guildId} destroyed: ${reason}`));

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

    const track = res.tracks[0];
    const embed = new EmbedBuilder()
        .setTitle(res.type === 'playlist' ? `Playlist: ${res.playlistName}` : (track.info?.title || 'Unknown Title'))
        .setURL(track.info?.uri || null)
        .setThumbnail(res.playlistArtworkUrl || track.info?.artworkUrl || null)
        .setDescription(res.type === 'playlist' ? `Added ${res.tracks.length} tracks` : `Added **${track.info?.title || 'Unknown'}** by **${track.info?.author || 'Unknown'}**`);

    message.reply({ embeds: [embed] });
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
    await queue.skip();
    if (queue.current) {
        await player.play();
        message.reply(`Skipped to: ${queue.current.info?.title || 'Unknown'}`);
    } else {
        await player.stop();
        message.reply('Skipped, no more tracks');
    }
  }

  if (command === 'previous') {
    const prev = await queue.previous();
    if (!prev) return message.reply('No previous tracks');

    // For simplicity in this bot, we'll just search for the track again
    const res = await lavx.playInput(message.guild!.id, prev.uri, message.author);
    if (res && res.tracks.length) {
        if (queue.current) await queue.addNext(queue.current);
        queue.current = res.tracks[0] as any;
        await player?.play();
        message.reply(`Playing previous: ${prev.title}`);
    } else {
        message.reply('Could not resolve previous track');
    }
  }

  if (command === 'shuffle') {
    await queue.shuffle();
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

  if (command === 'autoplay') {
    queue.autoplay = !queue.autoplay;
    const platform = args[0];
    if (platform) {
        lavx.options.defaultSearchPlatform = platform;
        message.reply(`Autoplay is now ${queue.autoplay ? 'enabled' : 'disabled'} using platform \`${platform}\``);
    } else {
        message.reply(`Autoplay is now ${queue.autoplay ? 'enabled' : 'disabled'}`);
    }
  }

  if (command === 'filter') {
    if (!player) return message.reply('No player found');
    const filter = args[0]?.toLowerCase();
    if (filter === 'reset') {
      await player.setFilters({ equalizer: [], timescale: null, karaoke: null, tremolo: null, vibrato: null, rotation: null, distortion: null, lowPass: null });
      return message.reply('Filters reset');
    }
    const preset = (player.filterPresets as any)[filter || ''];
    if (preset) {
      await player.setFilters(preset);
      message.reply(`Applied filter: ${filter}`);
    } else {
      message.reply(`Available filters: ${Object.keys(player.filterPresets).join(', ')}, reset`);
    }
  }

  if (command === 'output') {
      if (!player) return message.reply('No player found');
      const mode = args[0]?.toLowerCase() as any;
      if (['left', 'right', 'mono', 'stereo'].includes(mode)) {
          await player.setAudioOutput(mode);
          message.reply(`Audio output set to \`${mode}\``);
      } else {
          message.reply('Invalid mode. Use: left, right, mono, stereo');
      }
  }

  if (command === 'status') {
    const nodes = Array.from(lavx.node.nodes.values());
    const status = nodes.map(n => `**${n.name}**: ${n.connected ? '✅ Connected' : '❌ Disconnected'} (${n.stats?.players || 0} players)`).join('\n');
    message.reply(`**Node Status:**\n${status}`);
  }

  if (command === 'gapless') {
      if (!player) return message.reply('No player found');
      player.options.gapless = !player.options.gapless;
      message.reply(`Gapless playback is now ${player.options.gapless ? 'enabled' : 'disabled'}`);
  }

  if (command === 'smartbuffer') {
      if (!player) return message.reply('No player found');
      player.options.smartBuffer = !player.options.smartBuffer;
      message.reply(`Smart buffering is now ${player.options.smartBuffer ? 'enabled' : 'disabled'}`);
  }

  if (command === 'move') {
    if (!player) return message.reply('No player found');
    const from = parseInt(args[0]);
    const to = parseInt(args[1]);
    if (!isNaN(from) && !isNaN(to)) {
        await queue.move(from - 1, to - 1);
        return message.reply(`Moved track from ${from} to ${to}`);
    }
  }

  if (command === 'botmove') {
      if (!player) return message.reply('No player found');
      const newChannelId = args[0];
      if (!newChannelId) return message.reply('Please provide a new channel ID');
      const oldChannelId = player.voice.channelId;
      await player.moveToChannel(newChannelId);
      message.reply(`Moved from <#${oldChannelId}> to <#${newChannelId}>`);
  }

  if (command === 'jump') {
      if (!player) return message.reply('No player found');
      const index = parseInt(args[0]);
      if (isNaN(index)) return message.reply('Invalid index');
      await queue.jump(index - 1);
      await player.play();
      message.reply(`Jumped to track ${index}`);
  }

  if (command === 'insert') {
      if (!player) return message.reply('No player found');
      const index = parseInt(args[0]);
      const query = args.slice(1).join(' ');
      if (isNaN(index) || !query) return message.reply('Usage: !insert <index> <query>');
      const res = await lavx.playInput(message.guild!.id, query, message.author);
      if (res && res.tracks.length) {
          await queue.insert(index - 1, res.tracks[0]);
          message.reply(`Inserted **${res.tracks[0].info?.title}** at position ${index}`);
      } else {
          message.reply('No results found');
      }
  }

  if (command === 'addnext') {
      const query = args.join(' ');
      if (!query) return message.reply('Please provide an input');
      const res = await lavx.playInput(message.guild!.id, query, message.author);
      if (res && res.tracks.length) {
          await queue.addNext(res.tracks[0]);
          message.reply(`Added **${res.tracks[0].info?.title}** to play next`);
      } else {
          message.reply('No results found');
      }
  }

  if (command === 'swap') {
      if (!player) return message.reply('No player found');
      const i1 = parseInt(args[0]);
      const i2 = parseInt(args[1]);
      if (isNaN(i1) || isNaN(i2)) return message.reply('Invalid indices');
      await queue.swap(i1 - 1, i2 - 1);
      message.reply(`Swapped tracks ${i1} and ${i2}`);
  }

  if (command === 'dedupe') {
      if (!player) return message.reply('No player found');
      await queue.dedupe();
      message.reply('Queue deduped');
  }

  if (command === 'history') {
      const history = await queue.history.get();
      if (!history.length) return message.reply('History is empty');
      const list = history.map((t, i) => `${i + 1}. ${t.title}`).join('\n');
      message.reply(`**Last Played:**\n${list}`);
  }

  if (command === 'bassboost') {
      if (!player) return message.reply('No player found');
      const level = parseInt(args[0]) || 3;
      await player.bassboost(level);
      message.reply(`Bassboost set to level ${level}`);
  }

  if (command === 'nightcore') {
      if (!player) return message.reply('No player found');
      await player.nightcore();
      message.reply('Nightcore enabled');
  }

  if (command === 'vaporwave') {
      if (!player) return message.reply('No player found');
      await player.vaporwave();
      message.reply('Vaporwave enabled');
  }

  if (command === 'fadein') {
      if (!player) return message.reply('No player found');
      await player.fadeIn(5000);
      message.reply('Fading in (5s)...');
  }

  if (command === 'fadeout') {
      if (!player) return message.reply('No player found');
      await player.fadeOut(5000);
      message.reply('Fading out (5s)...');
  }

  if (command === 'rewind') {
      if (!player) return message.reply('No player found');
      await player.rewind(10000);
      message.reply('Rewound 10s');
  }

  if (command === 'forward') {
      if (!player) return message.reply('No player found');
      await player.forward(10000);
      message.reply('Forwarded 10s');
  }

  if (command === 'restart') {
      if (!player) return message.reply('No player found');
      await player.restart();
      message.reply('Restarted track');
  }

  if (command === 'clearfilters') {
      if (!player) return message.reply('No player found');
      await player.clearFilters();
      message.reply('Filters cleared');
  }

  if (command === 'balance') {
      if (!player) return message.reply('No player found');
      const left = parseFloat(args[0]) || 0.5;
      const right = parseFloat(args[1]) || 0.5;
      await player.balance(left, right);
      message.reply(`Balance set to L:${left} R:${right}`);
  }

  if (command === 'mono') {
      if (!player) return message.reply('No player found');
      await player.mono();
      message.reply('Mono output enabled');
  }

  if (command === 'stereo') {
      if (!player) return message.reply('No player found');
      await player.stereo();
      message.reply('Stereo output enabled');
  }

  if (command === 'autorecover') {
      if (!player) return message.reply('No player found');
      await player.autoRecover();
      message.reply(`Auto-recover is now ${player.options.autoRecover ? 'enabled' : 'disabled'}`);
  }

  if (command === 'autoresume') {
      if (!player) return message.reply('No player found');
      await player.autoResume();
      message.reply(`Auto-resume is now ${player.options.autoResume ? 'enabled' : 'disabled'}`);
  }

  if (command === 'preload') {
      if (!player) return message.reply('No player found');
      await player.preloadNext();
      message.reply('Preloading next track...');
  }

  if (command === 'queue') {
    const sub = args[0]?.toLowerCase();
    if (sub === 'clear') {
        await queue.clear();
        message.reply('Queue cleared');
    } else if (sub === 'remove') {
        const index = parseInt(args[1]);
        if (isNaN(index)) return message.reply('Invalid index');
        const removed = await queue.remove(index - 1);
        message.reply(removed ? `Removed ${removed.info?.title || 'Unknown'}` : 'Track not found');
    } else {
        const list = queue.tracks.map((t, i) => `${i + 1}. ${t.info?.title || 'Unknown'}`).join('\n') || 'Empty';
        message.reply(`**Current:** ${queue.current?.info?.title || 'None'}\n**Upcoming:**\n${list.slice(0, 1500)}`);
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
