import { describe, expect, it } from 'vitest';
import { parseDurationToMs, parseDurationLabel } from '@ripo/shared';

describe('duration parsing', () => {
  it('parses human readable durations', () => {
    expect(parseDurationToMs('30s')).toBe(30_000);
    expect(parseDurationToMs('10m')).toBe(600_000);
    expect(parseDurationToMs('2h')).toBe(7_200_000);
    expect(parseDurationToMs('2 days')).toBe(172_800_000);
  });

  it('formats labels sensibly', () => {
    expect(parseDurationLabel(90000)).toBe('1m 30s');
    expect(parseDurationLabel(0)).toBe('Permanent');
  });
});
