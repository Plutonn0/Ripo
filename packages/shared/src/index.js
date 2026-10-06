export const DEFAULT_PREFIX = '?';
export const MODERATION_CATEGORIES = ['Info', 'Moderation', 'Manager', 'Utility', 'Roles', 'Levels', 'Tags', 'Fun'];
export function parseDurationToMs(value) {
    const normalized = value.trim().toLowerCase();
    if (!normalized)
        return 0;
    const match = normalized.match(/^((?:\d+\.?\d*)\s*(ms|milliseconds|millisecond|s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|week|weeks))$/i);
    if (!match)
        return 0;
    const amount = Number.parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    const unitMap = {
        ms: 1,
        milliseconds: 1,
        millisecond: 1,
        s: 1000,
        sec: 1000,
        secs: 1000,
        second: 1000,
        seconds: 1000,
        m: 60 * 1000,
        min: 60 * 1000,
        mins: 60 * 1000,
        minute: 60 * 1000,
        minutes: 60 * 1000,
        h: 60 * 60 * 1000,
        hr: 60 * 60 * 1000,
        hrs: 60 * 60 * 1000,
        hour: 60 * 60 * 1000,
        hours: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
        day: 24 * 60 * 60 * 1000,
        days: 24 * 60 * 60 * 1000,
        w: 7 * 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        weeks: 7 * 24 * 60 * 60 * 1000,
    };
    return Math.max(0, Math.floor(amount * (unitMap[unit] ?? 0)));
}
export function parseDurationLabel(milliseconds) {
    if (!Number.isFinite(milliseconds) || milliseconds <= 0)
        return 'Permanent';
    const totalSeconds = Math.floor(milliseconds / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts = [];
    if (days)
        parts.push(`${days}d`);
    if (hours)
        parts.push(`${hours}h`);
    if (minutes)
        parts.push(`${minutes}m`);
    if (seconds || parts.length === 0)
        parts.push(`${seconds}s`);
    return parts.join(' ');
}
export function buildCommandMetadata(config) {
    return {
        name: config.name ?? 'unknown',
        aliases: config.aliases ?? [],
        description: config.description ?? 'No description provided.',
        category: config.category ?? 'Utility',
        usage: config.usage ?? config.name ?? 'unknown',
        module: config.module ?? 'core',
        cooldown: config.cooldown ?? 3,
        requiredPermissions: config.requiredPermissions ?? [],
    };
}
export function canModerateTarget(target) {
    return target.isGuildOwner || target.isAdministrator || target.isRipoModerator;
}
export function isRipoManagerCheck(check) {
    return !!check.isGuildOwner || !!check.isAdministrator || !!check.isRipoManager;
}
//# sourceMappingURL=index.js.map