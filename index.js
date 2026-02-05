// Simple Discord Security Bot - Single File Version
const { Client, GatewayIntentBits, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const http = require('http');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ]
});

// Track violations
const warnings = new Map();
const spamTracker = new Map();

client.once('ready', () => {
  console.log(`✅ Bot online: ${client.user.tag}`);
  
  // Register commands
  const commands = [
    new SlashCommandBuilder().setName('ban').setDescription('Ban a user').setDefaultMemberPermissions(PermissionFlagsBits.BanMembers).addUserOption(o => o.setName('user').setDescription('User to ban').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Reason')),
    new SlashCommandBuilder().setName('kick').setDescription('Kick a user').setDefaultMemberPermissions(PermissionFlagsBits.KickMembers).addUserOption(o => o.setName('user').setDescription('User to kick').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Reason')),
    new SlashCommandBuilder().setName('purge').setDescription('Delete messages').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages).addIntegerOption(o => o.setName('amount').setDescription('1-100').setRequired(true)),
    new SlashCommandBuilder().setName('lock').setDescription('Lock channel').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    new SlashCommandBuilder().setName('unlock').setDescription('Unlock channel').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    new SlashCommandBuilder().setName('warn').setDescription('Warn user').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).addUserOption(o => o.setName('user').setDescription('User').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true)),
    new SlashCommandBuilder().setName('help').setDescription('Show commands'),
  ];
  
  client.application.commands.set(commands);
  console.log('✅ Commands registered');
});

// Security: Anti-spam & Anti-invite
client.on('messageCreate', async (msg) => {
  if (msg.author.bot || !msg.guild) return;
  
  // Delete Discord invites
  if (/(discord\.gg\/|discord\.com\/invite\/)/i.test(msg.content)) {
    await msg.delete();
    msg.channel.send(`${msg.author} No invites allowed!`);
    return;
  }
  
  // Anti-spam (5 msgs in 3 sec)
  const now = Date.now();
  const tracker = spamTracker.get(msg.author.id) || [];
  tracker.push(now);
  
  // Remove old messages
  while (tracker.length && tracker[0] < now - 3000) tracker.shift();
  spamTracker.set(msg.author.id, tracker);
  
  if (tracker.length >= 5) {
    spamTracker.delete(msg.author.id);
    await msg.delete();
    msg.channel.send(`${msg.author} Stop spamming!`);
  }
});

// Command handler
client.on('interactionCreate', async (i) => {
  if (!i.isChatInputCommand()) return;
  
  switch(i.commandName) {
    case 'ban': {
      const u = i.options.getUser('user');
      const r = i.options.getString('reason') || 'No reason';
      const m = await i.guild.members.fetch(u.id).catch(() => null);
      if (!m) return i.reply('User not found');
      await m.ban({ reason: r });
      i.reply(`🔨 Banned ${u.tag}`);
      break;
    }
    case 'kick': {
      const u = i.options.getUser('user');
      const r = i.options.getString('reason') || 'No reason';
      const m = await i.guild.members.fetch(u.id).catch(() => null);
      if (!m) return i.reply('User not found');
      await m.kick(r);
      i.reply(`👢 Kicked ${u.tag}`);
      break;
    }
    case 'purge': {
      const n = i.options.getInteger('amount');
      if (n < 1 || n > 100) return i.reply('1-100 only');
      const del = await i.channel.bulkDelete(n, true);
      i.reply({ content: `Deleted ${del.size} messages`, ephemeral: true });
      break;
    }
    case 'lock': {
      await i.channel.permissionOverwrites.set(i.guild.id, { SendMessages: false });
      i.reply('🔒 Channel locked');
      break;
    }
    case 'unlock': {
      await i.channel.permissionOverwrites.delete(i.guild.id);
      i.reply('🔓 Channel unlocked');
      break;
    }
    case 'warn': {
      const u = i.options.getUser('user');
      const r = i.options.getString('reason');
      const w = warnings.get(u.id) || 0;
      warnings.set(u.id, w + 1);
      i.reply(`⚠️ Warned ${u.tag}: ${r}\nWarnings: ${w + 1}`);
      break;
    }
    case 'help': {
      const e = new EmbedBuilder().setColor(0x00FF00).setTitle('Security Bot').addFields(
        { name: 'Moderation', value: '/ban, /kick, /warn, /purge' },
        { name: 'Security', value: '/lock, /unlock' },
        { name: 'Auto', value: 'Anti-spam, Anti-invite' }
      );
      i.reply({ embeds: [e] });
      break;
    }
  }
});

// Web server for UptimeRobot
http.createServer((req, res) => {
  res.writeHead(200);
  res.end(JSON.stringify({ bot: client.user?.tag || 'starting', status: 'online' }));
}).listen(3000);

client.login(process.env.TOKEN);
console.log('🌐 Keep-alive server on port 3000');
