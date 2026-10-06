import { describe, expect, it } from 'vitest';
import { canModerateTarget, isRipoManagerCheck } from '@ripo/shared';

describe('permission checks', () => {
  it('allows moderation for managers and admins', () => {
    expect(canModerateTarget({ isGuildOwner: false, isAdministrator: true, isRipoManager: false, isRipoModerator: false })).toBe(true);
    expect(isRipoManagerCheck({ isGuildOwner: false, isAdministrator: false, isRipoManager: true, isRipoModerator: false })).toBe(true);
  });

  it('rejects moderation for empty permissions', () => {
    expect(canModerateTarget({ isGuildOwner: false, isAdministrator: false, isRipoManager: false, isRipoModerator: false })).toBe(false);
  });
});
