const express = require('express');
const { Client, GatewayIntentBits, Partials, Collection, EmbedBuilder, PermissionFlagsBits, ChannelType, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const ms = require('ms');

// Keep bot alive with web server
const app = express();
app.get('/', (req, res) => res.send('Bot is online! 🟢'));
app.listen(3000, () => console.log('Keep-alive server running on port 3000'));

// Bot setup
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildModeration
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember, Partials.User]
});

client.commands = new Collection();
client.cooldowns = new Collection();
client.logChannels = new Map();

// Config
const config = {
    colors: {
        default: "#5865F2",
        success: "#57F287",
        error: "#ED4245",
        warning: "#FEE75C",
        messageDelete: "#ED4245",
        messageEdit: "#FEE75C",
        memberJoin: "#57F287",
        memberLeave: "#ED4245"
    }
};

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

// ==================== COMMANDS ====================

// Ping command
client.commands.set('ping', {
    data: { name: 'ping', description: 'Shows bot latency' },
    async execute(interaction) {
        const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        const apiLatency = Math.round(client.ws.ping);
        
        const embed = new EmbedBuilder()
            .setColor(config.colors.default)
            .setTitle('🏓 Pong!')
            .addFields(
                { name: 'Bot Latency', value: `${latency}ms`, inline: true },
                { name: 'API Latency', value: `${apiLatency}ms`, inline: true }
            );
        
        await interaction.editReply({ content: '', embeds: [embed] });
    }
});

// Server info command
client.commands.set('server', {
    data: { name: 'server', description: 'Shows server information' },
    async execute(interaction) {
        const { guild } = interaction;
        const owner = await guild.fetchOwner();
        const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
        const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
        
        const embed = new EmbedBuilder()
            .setColor(config.colors.default)
            .setTitle(guild.name)
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .addFields(
                { name: '👑 Owner', value: owner.user.tag, inline: true },
                { name: '👥 Members', value: `${guild.memberCount}`, inline: true },
                { name: '💬 Channels', value: `Text: ${textChannels} | Voice: ${voiceChannels}`, inline: true },
                { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true }
            );
        
        await interaction.reply({ embeds: [embed] });
    }
});

// User info command
client.commands.set('user', {
    data: { 
        name: 'user', 
        description: 'Shows user information',
        options: [{
            name: 'target',
            type: 6,
            description: 'User to check',
            required: false
        }]
    },
    async execute(interaction) {
        const target = interaction.options.getUser('target') || interaction.user;
        const member = interaction.guild.members.cache.get(target.id);
        
        const embed = new EmbedBuilder()
            .setColor(member?.displayHexColor || config.colors.default)
            .setTitle(target.tag)
            .setThumbnail(target.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '🆔 ID', value: target.id, inline: true },
                { name: '📅 Account Created', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '🤖 Bot', value: target.bot ? 'Yes' : 'No', inline: true }
            );
        
        if (member) {
            embed.addFields(
                { name: '📥 Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true }
            );
        }
        
        await interaction.reply({ embeds: [embed] });
    }
});

// Kick command
client.commands.set('kick', {
    data: { 
        name: 'kick', 
        description: 'Kick a user',
        options: [
            { name: 'target', type: 6, description: 'User to kick', required: true },
            { name: 'reason', type: 3, description: 'Reason', required: false }
        ]
    },
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
            return interaction.reply({ content: '❌ You need Kick Members permission!', ephemeral: true });
        }
        
        const target = interaction.options.getMember('target');
        const reason = interaction.options.getString('reason') || 'No reason';
        
        if (!target) return interaction.reply({ content: 'User not found!', ephemeral: true });
        if (!target.kickable) return interaction.reply({ content: 'I cannot kick this user!', ephemeral: true });
        
        await target.kick(reason);
        
        const embed = new EmbedBuilder()
            .setColor(config.colors.success)
            .setTitle('👢 User Kicked')
            .setDescription(`**User:** ${target.user.tag}\n**Reason:** ${reason}\n**By:** ${interaction.user.tag}`);
        
        await interaction.reply({ embeds: [embed] });
    }
});

// Ban command
client.commands.set('ban', {
    data: { 
        name: 'ban', 
        description: 'Ban a user',
        options: [
            { name: 'target', type: 6, description: 'User to ban', required: true },
            { name: 'reason', type: 3, description: 'Reason', required: false }
        ]
    },
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return interaction.reply({ content: '❌ You need Ban Members permission!', ephemeral: true });
        }
        
        const target = interaction.options.getMember('target');
        const reason = interaction.options.getString('reason') || 'No reason';
        
        if (!target) return interaction.reply({ content: 'User not found!', ephemeral: true });
        if (!target.bannable) return interaction.reply({ content: 'I cannot ban this user!', ephemeral: true });
        
        await target.ban({ reason });
        
        const embed = new EmbedBuilder()
            .setColor(config.colors.error)
            .setTitle('🔨 User Banned')
            .setDescription(`**User:** ${target.user.tag}\n**Reason:** ${reason}\n**By:** ${interaction.user.tag}`);
        
        await interaction.reply({ embeds: [embed] });
    }
});

// Purge command
client.commands.set('purge', {
    data: { 
        name: 'purge', 
        description: 'Delete messages',
        options: [{ name: 'amount', type: 4, description: 'Number (1-100)', required: true, minValue: 1, maxValue: 100 }]
    },
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({ content: '❌ You need Manage Messages permission!', ephemeral: true });
        }
        
        const amount = interaction.options.getInteger('amount');
        await interaction.deferReply({ ephemeral: true });
        
        const messages = await interaction.channel.messages.fetch({ limit: amount });
        const twoWeeksAgo = Date.now() - 1209600000;
        const deletable = messages.filter(m => m.createdTimestamp > twoWeeksAgo);
        
        if (deletable.size === 0) {
            return interaction.editReply({ content: 'No deletable messages found (messages older than 14 days cannot be bulk deleted).' });
        }
        
        const deleted = await interaction.channel.bulkDelete(deletable, true);
        
        const embed = new EmbedBuilder()
            .setColor(config.colors.success)
            .setTitle('🧹 Messages Purged')
            .setDescription(`Deleted ${deleted.size} message(s)`);
        
        await interaction.editReply({ embeds: [embed] });
    }
});

// Set log channel command
client.commands.set('setlogchannel', {
    data: { 
        name: 'setlogchannel', 
        description: 'Set logging channel (Admin only)',
        options: [{ name: 'channel', type: 7, description: 'Channel for logs', required: true }]
    },
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Administrator only!', ephemeral: true });
        }
        
        const channel = interaction.options.getChannel('channel');
        if (!channel.isTextBased()) {
            return interaction.reply({ content: '❌ Select a text channel!', ephemeral: true });
        }
        
        client.logChannels.set(interaction.guild.id, channel.id);
        
        // Save to file
        const filePath = path.join(logsDir, 'channels.json');
        let data = {};
        if (fs.existsSync(filePath)) {
            data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
        data[interaction.guild.id] = channel.id;
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        
        const embed = new EmbedBuilder()
            .setColor(config.colors.success)
            .setTitle('✅ Log Channel Set')
            .setDescription(`Logs will be sent to ${channel}`);
        
        await interaction.reply({ embeds: [embed] });
    }
});

// 8ball command
client.commands.set('8ball', {
    data: { 
        name: '8ball', 
        description: 'Ask the magic 8ball',
        options: [{ name: 'question', type: 3, description: 'Your question', required: true }]
    },
    async execute(interaction) {
        const responses = ['It is certain.', 'It is decidedly so.', 'Without a doubt.', 'Yes definitely.', 'You may rely on it.', 'As I see it, yes.', 'Most likely.', 'Outlook good.', 'Yes.', 'Signs point to yes.', 'Reply hazy, try again.', 'Ask again later.', 'Better not tell you now.', 'Cannot predict now.', 'Concentrate and ask again.', 'Don\'t count on it.', 'My reply is no.', 'My sources say no.', 'Outlook not so good.', 'Very doubtful.'];
        const question = interaction.options.getString('question');
        const answer = responses[Math.floor(Math.random() * responses.length)];
        
        const embed = new EmbedBuilder()
            .setColor(config.colors.default)
            .setTitle('🎱 Magic 8-Ball')
            .addFields(
                { name: 'Question', value: question },
                { name: 'Answer', value: answer }
            );
        
        await interaction.reply({ embeds: [embed] });
    }
});

// Roll dice command
client.commands.set('roll', {
    data: { 
        name: 'roll', 
        description: 'Roll a dice',
        options: [{ name: 'sides', type: 4, description: 'Number of sides (default: 6)', required: false, minValue: 2, maxValue: 100 }]
    },
    async execute(interaction) {
        const sides = interaction.options.getInteger('sides') || 6;
        const result = Math.floor(Math.random() * sides) + 1;
        
        const embed = new EmbedBuilder()
            .setColor(config.colors.default)
            .setTitle('🎲 Dice Roll')
            .setDescription(`Rolled **${result}** on a ${sides}-sided dice!`);
        
        await interaction.reply({ embeds: [embed] });
    }
});

// ==================== EVENTS ====================

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    console.log(`Serving ${client.guilds.cache.size} guilds`);
    client.user.setActivity('your commands', { type: ActivityType.Listening });
    
    // Load saved log channels
    const filePath = path.join(logsDir, 'channels.json');
    if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        for (const [guildId, channelId] of Object.entries(data)) {
            client.logChannels.set(guildId, channelId);
        }
        console.log('Loaded log channels');
    }
});

// Message delete logging
client.on('messageDelete', async (message) => {
    if (message.author?.bot || !message.guild) return;
    if (!message.content && !message.attachments.size) return;
    
    const logChannelId = client.logChannels.get(message.guild.id);
    if (!logChannelId) return;
    
    const logChannel = await client.channels.fetch(logChannelId).catch(() => null);
    if (!logChannel) return;
    
    const embed = new EmbedBuilder()
        .setColor(config.colors.messageDelete)
        .setTitle('🗑️ Message Deleted')
        .setDescription(`**Author:** ${message.author.tag}\n**Channel:** ${message.channel}`)
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
        .setTimestamp();
    
    if (message.content) {
        embed.addFields({ name: 'Content', value: message.content.substring(0, 1024) });
    }
    
    await logChannel.send({
