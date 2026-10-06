# Ripo

Ripo is a modular Discord moderation, management, automation, and community bot platform. It is designed as a monorepo with a persistent Discord bot worker and a Next.js dashboard that uses Discord OAuth2 and PostgreSQL-backed persistence.

## Features

- Prefix-based bot commands using `?` by default
- Guild-scoped configuration and module registry
- Moderation framework with cases, warnings, notes, and timed punishments
- Discord embed-first responses
- Guild dashboard with Discord OAuth and server authorization
- Automod, custom commands, tags, autoroles, welcome/leave flows, tickets, forms, giveaways, levels, reminders, and starboard support
- Prisma-backed PostgreSQL schema and background job support

## Architecture

- `apps/bot`: Discord worker and bot runtime
- `apps/web`: Next.js dashboard and OAuth API layer
- `packages/shared`: common constants, types, helper logic
- `packages/database`: Prisma schema and client
- `packages/ui`: reusable UI primitives

## Required intents and permissions

The bot should be configured with the gateway intents needed for prefix commands, moderation, and logging.

Required intents:

- Guilds
- GuildMembers
- GuildBans
- GuildEmojisAndStickers
- GuildIntegrations
- GuildWebhooks
- GuildInvites
- GuildVoiceStates
- GuildMessages
- GuildMessageReactions
- DirectMessages
- MessageContent

Recommended bot permissions:

- View Channels
- Send Messages
- Manage Messages
- Read Message History
- Embed Links
- Attach Files
- Add Reactions
- Manage Roles
- Kick Members
- Ban Members
- Moderate Members
- Manage Channels
- Manage Nicknames
- View Audit Log

## Local development

1. Copy `.env.example` to `.env` and fill in values.
2. Install dependencies:
   `npm install`
3. Generate Prisma client:
   `npm run db:generate`
4. Start the database and apply migrations:
   `npm run db:push`
5. Start the bot:
   `npm run dev:bot`
6. Start the dashboard:
   `npm run dev:web`

## Dashboard setup

The dashboard uses NextAuth with the Discord provider. Configure the OAuth application in the Discord developer portal and add the redirect URL:

`http://localhost:3000/api/auth/callback/discord`

## Production deployment

- Deploy the dashboard to Vercel.
- Run the Discord bot as a persistent Node.js service or container in a host environment.
- Keep the bot and the dashboard separate: the bot must not run as a serverless function.

## License

This project is a starter platform for a realistic Discord bot ecosystem. It is intended for local development and deployment with your own Discord application and infrastructure.
