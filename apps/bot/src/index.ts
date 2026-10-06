import {
  Client,
  Collection,
  EmbedBuilder,
  GatewayIntentBits,
  Message,
  Partials,
  PermissionsBitField,
  Role,
  Snowflake,
  User,
} from 'discord.js';
import { DEFAULT_PREFIX, buildCommandMetadata, canModerateTarget, parseDurationToMs, type CommandDefinition, type PermissionCheck } from '@ripo/shared';
import { prisma } from '@ripo/database';
import { createErrorEmbed, createHelpEmbed, createInfoEmbed, createModerationEmbed, createSuccessEmbed, createWarningEmbed } from './lib/embeds.js';
import { tokenize } from './utils/parse-command.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildIntegrations,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember, Partials.User],
});

const commands = new Collection<string, CommandDefinition & { execute: (ctx: CommandContext) => Promise<void> }>();

type CommandContext = {
  client: Client;
  message: Message;
  args: string[];
  guildId?: string;
  prefix: string;
};

function createPrefixCommand(name: string, definition: Omit<CommandDefinition, 'name'>, execute: (ctx: CommandContext) => Promise<void>) {
  commands.set(name, { ...buildCommandMetadata({ name, ...definition }), execute });
}

function getTargetMember(message: Message, input: string) {
  const target = message.mentions.members?.first() ?? message.guild?.members.cache.get(input);

  if (target) return target;

  const member = message.guild?.members.cache.find((candidate) =>
    candidate.user.username.toLowerCase() === input.toLowerCase() ||
    `${candidate.user.username}#${candidate.user.discriminator}`.toLowerCase() === input.toLowerCase(),
  );

  return member ?? null;
}

function missingPermissionError(action: string): EmbedBuilder {
  return createErrorEmbed('Missing permission', `You cannot ${action.toLowerCase()} with the current role and permission setup.`);
}

function isGuildOwner(member: any): boolean {
  return member?.guild?.ownerId === member?.id;
}

function isAdministrator(member: any): boolean {
  return member?.permissions?.has(PermissionsBitField.Flags.Administrator) ?? false;
}

function isRipoManager(member: any): boolean {
  return member?.roles?.cache?.some((role: Role) => role.name.toLowerCase() === 'ripo manager') ?? false;
}

function isRipoModerator(member: any): boolean {
  return member?.roles?.cache?.some((role: Role) => role.name.toLowerCase() === 'ripo moderator') ?? false;
}

function getPermissionSummary(member: any): PermissionCheck {
  return {
    isGuildOwner: isGuildOwner(member),
    isAdministrator: isAdministrator(member),
    isRipoManager: isRipoManager(member),
    isRipoModerator: isRipoModerator(member),
  };
}

async function ensureGuildRecord(guildId: string) {
  return prisma.guild.upsert({
    where: { id: guildId },
    update: {},
    create: { id: guildId, prefix: DEFAULT_PREFIX },
  });
}

async function getGuildPrefix(guildId?: string): Promise<string> {
  if (!guildId) return DEFAULT_PREFIX;
  const guild = await prisma.guild.findUnique({ where: { id: guildId } });
  return guild?.prefix ?? DEFAULT_PREFIX;
}

createPrefixCommand('ping', { description: 'Check bot latency.', category: 'Info', usage: 'ping', module: 'core', cooldown: 3 }, async ({ message }) => {
  const latency = Date.now() - message.createdTimestamp;
  const ws = client.ws.ping;
  const embed = createInfoEmbed('Pong!', `API latency: ${latency}ms\nWebSocket latency: ${ws}ms`);
  await message.reply({ embeds: [embed] });
});

createPrefixCommand('help', { description: 'View help for Ripo commands.', category: 'Info', usage: 'help [command|category]', module: 'core', cooldown: 3 }, async ({ message, args, prefix }) => {
  const target = args[0]?.toLowerCase();

  if (!target) {
    const categories = new Map<string, string[]>();
    for (const [name, command] of commands) {
      const list = categories.get(command.category) ?? [];
      list.push(`**${prefix}${name}**`);
      categories.set(command.category, list);
    }

    const embed = createHelpEmbed('Ripo Help', 'Use the prefix `?` for the bot.');
    for (const [category, values] of categories.entries()) {
      embed.addFields({ name: category, value: values.join(', ') || '—', inline: false });
    }
    await message.reply({ embeds: [embed] });
    return;
  }

  const match = commands.get(target) ?? [...commands.values()].find((command) => command.aliases?.includes(target));
  if (!match) {
    await message.reply({ embeds: [createErrorEmbed('Unknown command', `I couldn't find a command called ${target}.`)] });
    return;
  }

  const embed = createHelpEmbed(`Command: ${prefix}${match.name}`, match.description);
  embed.addFields(
    { name: 'Usage', value: `${prefix}${match.usage}`, inline: false },
    { name: 'Category', value: match.category, inline: true },
    { name: 'Cooldown', value: `${match.cooldown ?? 3}s`, inline: true },
    { name: 'Aliases', value: match.aliases?.length ? match.aliases.map((a) => `${prefix}${a}`).join(', ') : 'None', inline: false },
  );
  await message.reply({ embeds: [embed] });
});

createPrefixCommand('info', { aliases: ['about'], description: 'Shows bot information.', category: 'Info', usage: 'info', module: 'core', cooldown: 3 }, async ({ message }) => {
  const embed = createInfoEmbed('Ripo', 'A modular Discord moderation and community bot platform.');
  embed.addFields(
    { name: 'Version', value: '0.1.0', inline: true },
    { name: 'Library', value: 'discord.js', inline: true },
    { name: 'Author', value: 'Quirk', inline: true },
    { name: 'Prefix', value: DEFAULT_PREFIX, inline: true },
  );
  await message.reply({ embeds: [embed] });
});

createPrefixCommand('stats', { description: 'Shows bot statistics.', category: 'Info', usage: 'stats', module: 'core', cooldown: 5 }, async ({ message }) => {
  const embed = createInfoEmbed('Bot statistics', 'Current health summary.');
  embed.addFields(
    { name: 'Servers', value: `${client.guilds.cache.size}`, inline: true },
    { name: 'Users', value: `${client.users.cache.size}`, inline: true },
    { name: 'Channels', value: `${client.channels.cache.size}`, inline: true },
    { name: 'Uptime', value: `${Math.floor((client.uptime ?? 0) / 1000)}s`, inline: true },
  );
  await message.reply({ embeds: [embed] });
});

createPrefixCommand('uptime', { description: 'Shows the bot uptime.', category: 'Info', usage: 'uptime', module: 'core', cooldown: 3 }, async ({ message }) => {
  const seconds = Math.floor((client.uptime ?? 0) / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const left = seconds % 60;
  await message.reply({ embeds: [createInfoEmbed('Uptime', `${days}d ${hours}h ${minutes}m ${left}s`)] });
});

createPrefixCommand('prefix', { description: 'View or set the server prefix.', category: 'Manager', usage: 'prefix [new-prefix]', module: 'core', cooldown: 5 }, async ({ message, args, guildId }) => {
  if (!guildId) return;
  if (args.length > 0) {
    const member = message.member;
    if (!member || !(member.permissions.has('ManageGuild') || isAdministrator(member) || isGuildOwner(member))) {
      await message.reply({ embeds: [missingPermissionError('change the prefix')] });
      return;
    }

    const nextPrefix = args.join(' ').trim().slice(0, 3) || DEFAULT_PREFIX;
    await ensureGuildRecord(guildId);
    await prisma.guild.update({ where: { id: guildId }, data: { prefix: nextPrefix } });
    await message.reply({ embeds: [createSuccessEmbed('Prefix updated', `The server prefix is now ${nextPrefix}.`)] });
    return;
  }

  const prefix = await getGuildPrefix(guildId);
  await message.reply({ embeds: [createInfoEmbed('Current prefix', `The active prefix for this server is: ${prefix}`)] });
});

createPrefixCommand('module', { aliases: ['modules'], description: 'Shows or configures the module state.', category: 'Manager', usage: 'module [name]', module: 'core', cooldown: 5 }, async ({ message, args }) => {
  const moduleName = args.join(' ').toLowerCase();
  const enabledModules = ['moderation', 'automod', 'tickets', 'giveaways', 'levels', 'tags', 'welcome', 'fun'];
  if (!moduleName) {
    await message.reply({ embeds: [createInfoEmbed('Modules', enabledModules.map((name) => `**${name}**: enabled`).join('\n'))] });
    return;
  }

  const guild = message.guild;
  if (!guild) return;
  const member = message.member;
  if (!member || !(member.permissions.has('ManageGuild') || isAdministrator(member) || isGuildOwner(member))) {
    await message.reply({ embeds: [missingPermissionError('manage modules')] });
    return;
  }

  const isTopic = enabledModules.includes(moduleName);
  await message.reply({ embeds: [isTopic ? createSuccessEmbed('Module status', `The ${moduleName} module is available.`) : createWarningEmbed('Unknown module', `I don't know the module ${moduleName}.`)] });
});

createPrefixCommand('announce', { description: 'Post a polished announcement to a channel.', category: 'Manager', usage: 'announce #channel message', module: 'core', cooldown: 5 }, async ({ message, args }) => {
  const target = message.mentions.channels.first() ?? message.guild?.channels.cache.get(args[0] ?? '');
  const text = args.slice(target ? 1 : 0).join(' ');

  if (!target || !text) {
    await message.reply({ embeds: [createErrorEmbed('Usage', 'Use `?announce #channel message`')] });
    return;
  }

  const embed = new EmbedBuilder().setColor('#5865F2').setTitle('Announcement').setDescription(text).setTimestamp();
  await (target as any).send({ embeds: [embed] });
  await message.reply({ embeds: [createSuccessEmbed('Announcement sent', `Sent to ${target.toString()}.`)] });
});

createPrefixCommand('ban', { aliases: ['b'], description: 'Ban a user.', category: 'Moderation', usage: 'ban <user> [duration] [reason]', module: 'moderation', cooldown: 5, requiredPermissions: ['BanMembers'] }, async ({ message, args }) => {
  const targetMember = getTargetMember(message, args[0] ?? '');
  const reason = args.slice(1).join(' ');
  if (!targetMember) {
    await message.reply({ embeds: [createErrorEmbed('Missing user', 'Specify a valid user to ban.')] });
    return;
  }

  const permissions = getPermissionSummary(message.member);
  if (!canModerateTarget(permissions)) {
    await message.reply({ embeds: [missingPermissionError('ban members')] });
    return;
  }

  const durationMs = parseDurationToMs(args[1] ?? '');
  await targetMember.ban({ reason: reason || 'No reason provided.' });
  const embed = createModerationEmbed('Member Banned', `User: ${targetMember.user.tag}\nModerator: ${message.author.tag}\nReason: ${reason || 'No reason provided.'}\nDuration: ${durationMs > 0 ? `${durationMs / 1000}s` : 'Permanent'}`);
  await message.reply({ embeds: [embed] });
});

createPrefixCommand('kick', { description: 'Kick a user.', category: 'Moderation', usage: 'kick <user> [reason]', module: 'moderation', cooldown: 5, requiredPermissions: ['KickMembers'] }, async ({ message, args }) => {
  const member = getTargetMember(message, args[0] ?? '');
  if (!member) {
    await message.reply({ embeds: [createErrorEmbed('Missing user', 'Specify a valid user to kick.')] });
    return;
  }

  if (!message.member || !message.member.permissions.has('KickMembers')) {
    await message.reply({ embeds: [missingPermissionError('kick members')] });
    return;
  }

  const reason = args.slice(1).join(' ') || 'No reason provided.';
  await member.kick(reason);
  await message.reply({ embeds: [createModerationEmbed('Member Kicked', `User: ${member.user.tag}\nModerator: ${message.author.tag}\nReason: ${reason}`)] });
});

createPrefixCommand('warn', { description: 'Warn a member and store the case.', category: 'Moderation', usage: 'warn <user> [reason]', module: 'moderation', cooldown: 5 }, async ({ message, args }) => {
  const member = getTargetMember(message, args[0] ?? '');
  const reason = args.slice(1).join(' ') || 'No reason provided.';
  if (!member) {
    await message.reply({ embeds: [createErrorEmbed('Missing user', 'Specify a valid user to warn.')] });
    return;
  }

  if (!message.member || !message.member.permissions.has('ModerateMembers')) {
    await message.reply({ embeds: [missingPermissionError('warn members')] });
    return;
  }

  await prisma.warning.create({
    data: {
      guildId: message.guildId ?? 'unknown',
      userId: member.id,
      moderatorId: message.author.id,
      reason,
    },
  });

  await message.reply({ embeds: [createWarningEmbed('Warning issued', `User: ${member.user.tag}\nModerator: ${message.author.tag}\nReason: ${reason}`)] });
});

createPrefixCommand('warnings', { aliases: ['warns'], description: 'View a member warning summary.', category: 'Moderation', usage: 'warnings [user]', module: 'moderation', cooldown: 5 }, async ({ message, args }) => {
  const member = getTargetMember(message, args[0] ?? message.author.id);
  if (!member) {
    await message.reply({ embeds: [createErrorEmbed('Unknown member', 'I could not find that member.')] });
    return;
  }

  const warnings = await prisma.warning.findMany({ where: { guildId: message.guildId ?? '', userId: member.id } });
  const embed = createInfoEmbed(`Warnings for ${member.user.tag}`, `${warnings.length} warning(s) recorded.`);
  if (warnings.length > 0) {
    warnings.slice(0, 8).forEach((warning: { id: string; reason: string }) => {
      embed.addFields({ name: `Case ${warning.id.slice(0, 8)}`, value: `${warning.reason}`, inline: false });
    });
  }
  await message.reply({ embeds: [embed] });
});

createPrefixCommand('clearwarn', { aliases: ['clearwarns'], description: 'Clear warnings for a user.', category: 'Moderation', usage: 'clearwarn <user>', module: 'moderation', cooldown: 5 }, async ({ message, args }) => {
  const member = getTargetMember(message, args[0] ?? '');
  if (!member) {
    await message.reply({ embeds: [createErrorEmbed('Unknown member', 'I could not find that member.')] });
    return;
  }

  await prisma.warning.deleteMany({ where: { guildId: message.guildId ?? '', userId: member.id } });
  await message.reply({ embeds: [createSuccessEmbed('Warnings cleared', `Warnings for ${member.user.tag} were removed.`)] });
});

createPrefixCommand('mute', { description: 'Timeout a user.', category: 'Moderation', usage: 'mute <user> [duration] [reason]', module: 'moderation', cooldown: 5 }, async ({ message, args }) => {
  const member = getTargetMember(message, args[0] ?? '');
  if (!member) {
    await message.reply({ embeds: [createErrorEmbed('Missing user', 'Specify a valid user to mute.')] });
    return;
  }

  const durationMs = parseDurationToMs(args[1] ?? '10m');
  const reason = args.slice(2).join(' ') || 'No reason provided.';
  await member.timeout(durationMs || 600000, reason);
  await message.reply({ embeds: [createModerationEmbed('Member Timed Out', `User: ${member.user.tag}\nModerator: ${message.author.tag}\nReason: ${reason}\nDuration: ${durationMs > 0 ? `${durationMs / 1000}s` : 'Permanent'}`)] });
});

createPrefixCommand('unmute', { description: 'Remove timeout from a user.', category: 'Moderation', usage: 'unmute <user>', module: 'moderation', cooldown: 5 }, async ({ message, args }) => {
  const member = getTargetMember(message, args[0] ?? '');
  if (!member) {
    await message.reply({ embeds: [createErrorEmbed('Missing user', 'Specify a valid user to unmute.')] });
    return;
  }

  await member.timeout(null, 'Timeout removed by moderator.');
  await message.reply({ embeds: [createSuccessEmbed('Timeout removed', `${member.user.tag} is no longer timed out.`)] });
});

createPrefixCommand('purge', { description: 'Bulk delete messages.', category: 'Moderation', usage: 'purge <amount> [filter]', module: 'moderation', cooldown: 5, requiredPermissions: ['ManageMessages'] }, async ({ message, args }) => {
  const amount = Number.parseInt(args[0] ?? '0', 10);
  if (!amount || amount < 1 || amount > 100) {
    await message.reply({ embeds: [createErrorEmbed('Invalid amount', 'Use `?purge <1-100>`')] });
    return;
  }

  if (!message.member?.permissions.has('ManageMessages')) {
    await message.reply({ embeds: [missingPermissionError('delete messages')] });
    return;
  }

  const channel = message.channel as any;
  const result = await channel.bulkDelete?.(Math.min(amount, 100), true).catch(() => null);
  if (!result) {
    await message.reply({ embeds: [createErrorEmbed('Purge failed', 'I could not delete those messages. Please check channel permissions and age limits.')] });
    return;
  }

  await message.reply({ embeds: [createSuccessEmbed('Messages purged', `Deleted ${result.size} message(s).`)] }).then((msg) => setTimeout(() => msg.delete().catch(() => undefined), 4000));
});

createPrefixCommand('whois', { aliases: ['userinfo'], description: 'Show a member profile.', category: 'Info', usage: 'whois [user]', module: 'core', cooldown: 5 }, async ({ message, args }) => {
  const member = getTargetMember(message, args[0] ?? message.author.id) ?? message.member;
  if (!member) {
    await message.reply({ embeds: [createErrorEmbed('Unknown member', 'I could not find that user.')] });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(member.displayHexColor || '#5865F2')
    .setTitle(`User info - ${member.user.tag}`)
    .setThumbnail(member.user.displayAvatarURL({ extension: 'png', size: 256 }))
    .addFields(
      { name: 'User ID', value: member.id, inline: true },
      { name: 'Joined', value: `<t:${Math.floor(member.joinedTimestamp! / 1000)}:F>`, inline: true },
      { name: 'Account created', value: `<t:${Math.floor((member.user.createdTimestamp ?? Date.now()) / 1000)}:F>`, inline: true },
      { name: 'Roles', value: member.roles.cache.map((role) => role.name).slice(0, 10).join(', ') || 'None', inline: false },
      { name: 'Bot', value: member.user.bot ? 'Yes' : 'No', inline: true },
    );
  await message.reply({ embeds: [embed] });
});

createPrefixCommand('serverinfo', { description: 'Shows information about the current server.', category: 'Info', usage: 'serverinfo', module: 'core', cooldown: 5 }, async ({ message }) => {
  const guild = message.guild;
  if (!guild) return;

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle(guild.name)
    .setThumbnail(guild.iconURL({ extension: 'png', size: 256 }) ?? null)
    .addFields(
      { name: 'Server ID', value: guild.id, inline: true },
      { name: 'Owner', value: `<@${guild.ownerId}>`, inline: true },
      { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: true },
      { name: 'Members', value: `${guild.memberCount}`, inline: true },
      { name: 'Roles', value: `${guild.roles.cache.size}`, inline: true },
      { name: 'Channels', value: `${guild.channels.cache.size}`, inline: true },
    );

  await message.reply({ embeds: [embed] });
});

createPrefixCommand('avatar', { description: 'Show an avatar image.', category: 'Info', usage: 'avatar [user]', module: 'core', cooldown: 5 }, async ({ message, args }) => {
  const user = message.mentions.users.first() ?? message.author;
  const target = args[0] ? (await client.users.fetch(args[0]).catch(() => null)) ?? message.author : user;
  const embed = createInfoEmbed(`${target.username}'s avatar`, `Click to open the image.`);
  embed.setImage(target.displayAvatarURL({ extension: 'png', size: 512 }));
  await message.reply({ embeds: [embed] });
});

createPrefixCommand('membercount', { description: 'Count members in the server.', category: 'Info', usage: 'membercount', module: 'core', cooldown: 3 }, async ({ message }) => {
  const guild = message.guild;
  if (!guild) return;
  const humans = guild.members.cache.filter((member) => !member.user.bot).size;
  const bots = guild.members.cache.filter((member) => member.user.bot).size;
  const embed = createInfoEmbed('Member count', `${guild.memberCount} total members\n${humans} humans\n${bots} bots`);
  await message.reply({ embeds: [embed] });
});

createPrefixCommand('tag', { aliases: ['t'], description: 'Create or fetch a tag.', category: 'Tags', usage: 'tag <name> [content]', module: 'tags', cooldown: 3 }, async ({ message, args }) => {
  if (args.length === 0) {
    await message.reply({ embeds: [createErrorEmbed('Usage', 'Use `?tag <name>` or `?tag create <name> <content>`.')] });
    return;
  }

  const name = args[0]?.toLowerCase();
  if (args[0]?.toLowerCase() === 'create') {
    const tagName = args[1];
    const content = args.slice(2).join(' ');
    if (!tagName || !content) {
      await message.reply({ embeds: [createErrorEmbed('Bad tag', 'Usage: `?tag create <name> <content>`')] });
      return;
    }

    await prisma.tag.upsert({
      where: { guildId_name: { guildId: message.guildId ?? '', name: tagName.toLowerCase() } },
      update: { content },
      create: { guildId: message.guildId ?? '', name: tagName.toLowerCase(), content },
    });

    await message.reply({ embeds: [createSuccessEmbed('Tag saved', `The tag ${tagName} is ready.`)] });
    return;
  }

  const tag = await prisma.tag.findUnique({ where: { guildId_name: { guildId: message.guildId ?? '', name: name ?? '' } } });
  if (!tag) {
    await message.reply({ embeds: [createErrorEmbed('Tag not found', `No tag called ${name} exists in this server.`)] });
    return;
  }

  await message.reply({ embeds: [createInfoEmbed(tag.name, tag.content)] });
});

createPrefixCommand('tags', { description: 'List all tags.', category: 'Tags', usage: 'tags', module: 'tags', cooldown: 5 }, async ({ message }) => {
  const tags = await prisma.tag.findMany({ where: { guildId: message.guildId ?? '' } });
  const embed = createInfoEmbed('Server tags', tags.length ? tags.map((tag: { name: string }) => `**${tag.name}**`).join(', ') : 'No tags saved yet.');
  await message.reply({ embeds: [embed] });
});

createPrefixCommand('remindme', { description: 'Schedule a reminder.', category: 'Utility', usage: 'remindme <duration> <text>', module: 'reminders', cooldown: 3 }, async ({ message, args }) => {
  const duration = parseDurationToMs(args[0] ?? '');
  const reminderText = args.slice(1).join(' ');
  if (!duration || !reminderText) {
    await message.reply({ embeds: [createErrorEmbed('Usage', 'Use `?remindme 2h Check the server`')] });
    return;
  }

  const remindAt = new Date(Date.now() + duration);
  await prisma.reminder.create({
    data: {
      guildId: message.guildId ?? 'unknown',
      userId: message.author.id,
      channelId: message.channelId,
      content: reminderText,
      remindAt,
    },
  });

  await message.reply({ embeds: [createSuccessEmbed('Reminder set', `I will remind you in ${duration / 1000}s.`)] });
});

createPrefixCommand('poll', { description: 'Create a simple poll.', category: 'Utility', usage: 'poll <question>', module: 'core', cooldown: 5 }, async ({ message, args }) => {
  if (args.length === 0) {
    await message.reply({ embeds: [createErrorEmbed('Usage', 'Use `?poll <question>`')] });
    return;
  }

  const question = args.join(' ');
  const embed = createInfoEmbed('Poll', question);
  const sent = await (message.channel as any).send({ embeds: [embed] });
  await sent.react('👍');
  await sent.react('👎');
  await message.reply({ embeds: [createSuccessEmbed('Poll created', `Poll posted in ${message.channel}`)] });
});

createPrefixCommand('roll', { description: 'Roll a die.', category: 'Fun', usage: 'roll [sides]', module: 'fun', cooldown: 3 }, async ({ message, args }) => {
  const sides = Number.parseInt(args[0] ?? '6', 10) || 6;
  const total = Math.floor(Math.random() * Math.max(1, sides)) + 1;
  await message.reply({ embeds: [createInfoEmbed('Roll', `You rolled a **${total}** on a d${sides}.`)] });
});

createPrefixCommand('flip', { description: 'Flip a coin.', category: 'Fun', usage: 'flip', module: 'fun', cooldown: 3 }, async ({ message }) => {
  const outcome = Math.random() > 0.5 ? 'Heads' : 'Tails';
  await message.reply({ embeds: [createInfoEmbed('Coin flip', `It landed on **${outcome}**.`)] });
});

createPrefixCommand('rps', { description: 'Play rock paper scissors.', category: 'Fun', usage: 'rps <rock|paper|scissors>', module: 'fun', cooldown: 3 }, async ({ message, args }) => {
  const moves = ['rock', 'paper', 'scissors'];
  const userMove = (args[0] ?? '').toLowerCase();
  if (!moves.includes(userMove)) {
    await message.reply({ embeds: [createErrorEmbed('Usage', 'Use `?rps rock|paper|scissors`')] });
    return;
  }

  const botMove = moves[Math.floor(Math.random() * moves.length)];
  if (userMove === botMove) {
    await message.reply({ embeds: [createInfoEmbed('Rock Paper Scissors', `You both picked **${userMove}** — draw!`)] });
    return;
  }

  const win =
    (userMove === 'rock' && botMove === 'scissors') ||
    (userMove === 'paper' && botMove === 'rock') ||
    (userMove === 'scissors' && botMove === 'paper');

  await message.reply({ embeds: [createInfoEmbed('Rock Paper Scissors', `You chose **${userMove}**; I chose **${botMove}**. ${win ? 'You win!' : 'I win!'}`)] });
});

client.on('ready', async () => {
  console.log(`Ripo is online as ${client.user?.tag}`);
  await client.user?.setPresence({ activities: [{ name: '?help', type: 3 }], status: 'online' });
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const prefix = await getGuildPrefix(message.guildId ?? undefined);
  if (!message.content.startsWith(prefix)) return;

  const args = tokenize(message.content.slice(prefix.length).trim());
  const trigger = args.shift()?.toLowerCase();
  if (!trigger) return;

  const command = commands.get(trigger) ?? [...commands.values()].find((candidate) => candidate.aliases?.includes(trigger));
  if (!command) return;

  try {
    await command.execute({ client, message, args, guildId: message.guildId ?? undefined, prefix });
  } catch (error) {
    const errorId = `RIPO-${Math.random().toString(16).slice(2, 8).toUpperCase()}`;
    console.error(error);
    await message.reply({ embeds: [createErrorEmbed('Something went wrong', `An unexpected error occurred.\nError ID: ${errorId}`)] });
  }
});

async function start() {
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    throw new Error('DISCORD_TOKEN is not set.');
  }

  try {
    await ensureGuildRecord(process.env.GUILD_ID ?? 'dev-guild');
    await client.login(token);
  } catch (error) {
    console.error('Failed to start bot', error);
  }
}

start();
