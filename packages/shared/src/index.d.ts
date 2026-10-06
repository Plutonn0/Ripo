export declare const DEFAULT_PREFIX = "?";
export declare const MODERATION_CATEGORIES: readonly ["Info", "Moderation", "Manager", "Utility", "Roles", "Levels", "Tags", "Fun"];
export type CommandCategory = (typeof MODERATION_CATEGORIES)[number];
export type PermissionCheck = {
    isGuildOwner: boolean;
    isAdministrator: boolean;
    isRipoManager: boolean;
    isRipoModerator: boolean;
};
export type CommandDefinition = {
    name: string;
    aliases?: string[];
    description: string;
    category: CommandCategory;
    usage: string;
    module: string;
    cooldown?: number;
    requiredPermissions?: string[];
};
export declare function parseDurationToMs(value: string): number;
export declare function parseDurationLabel(milliseconds: number): string;
export declare function buildCommandMetadata(config: Partial<CommandDefinition>): CommandDefinition;
export declare function canModerateTarget(target: PermissionCheck): boolean;
export declare function isRipoManagerCheck(check: PermissionCheck): boolean;
