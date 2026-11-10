import { describe, expect, it } from 'vitest';
import { parseCommand, type ClerkCommand } from './clerk-actions';
import {
  HEARING_MAX_CASES,
  estimateSeconds,
  hearingState,
  isRunning,
  staleAfterSeconds,
  type HearingEventLike,
} from './hearing-rules';

const AGENT = '00000000-0000-4000-8000-000000000023';
const HEARING = '00000000-0000-4000-8000-0000000000d1';
const caseId = (n: number) => `00000000-0000-4000-8000-0000000000a${n}`;

function command(action: string, payload: unknown): ClerkCommand {
  const result = parseCommand(action, JSON.stringify(payload));
  if (!result.ok) throw new Error(result.detail);
  return result.command;
}

describe('hearing actions', () => {
  it('parses launchHearing, lower-casing ids', () => {
    expect(command('launchHearing', { agentId: AGENT.toUpperCase(), stage: 'production', caseIds: [caseId(1).toUpperCase(), caseId(2)] })).toEqual({
      action: 'launchHearing',
      agentId: AGENT,
      stage: 'production',
      caseIds: [caseId(1), caseId(2)],
    });
  });

  it.each([
    ['no cases', { agentId: AGENT, stage: 'production', caseIds: [] }],
    ['too many cases', { agentId: AGENT, stage: 'production', caseIds: Array.from({ length: HEARING_MAX_CASES + 1 }, (_, i) => caseId(i)) }],
    ['a repeated case', { agentId: AGENT, stage: 'production', caseIds: [caseId(1), caseId(1)] }],
    ['a case id that is not a GUID', { agentId: AGENT, stage: 'production', caseIds: ['abc'] }],
    ['an unknown stage', { agentId: AGENT, stage: 'staging', caseIds: [caseId(1)] }],
    ['no agent', { stage: 'sandbox', caseIds: [caseId(1)] }],
    ['caseIds that is not a list', { agentId: AGENT, stage: 'sandbox', caseIds: caseId(1) }],
  ])('rejects launchHearing with %s', (_label, payload) => {
    expect(parseCommand('launchHearing', JSON.stringify(payload))).toMatchObject({ ok: false, reason: 'invalid_payload' });
  });

  it('parses cancelHearing and checkWithFabric by hearing id only', () => {
    expect(command('cancelHearing', { hearingId: HEARING })).toEqual({ action: 'cancelHearing', hearingId: HEARING });
    expect(command('checkWithFabric', { hearingId: HEARING })).toEqual({ action: 'checkWithFabric', hearingId: HEARING });
    expect(parseCommand('cancelHearing', JSON.stringify({ hearingId: 'x' }))).toMatchObject({ ok: false });
  });
});

describe('hearing state (R6: derived from events)', () => {
  const start = new Date('2026-11-10T10:00:00Z');
  const at = (seconds: number) => new Date(start.getTime() + seconds * 1000);
  const hearing = { createdAt: start, caseCount: 4 };
  const events = (...kinds: [HearingEventLike['kind'], number][]): HearingEventLike[] => kinds.map(([kind, s]) => ({ kind, createdAt: at(s) }));

  it('is in progress until a closing event arrives', () => {
    expect(hearingState(hearing, events(['launched', 2], ['started', 60], ['progress', 90]), at(120))).toBe('in_progress');
    expect(isRunning('in_progress')).toBe(true);
  });

  it.each(['completed', 'failed', 'cancelled'] as const)('is %s once that event exists', (kind) => {
    const state = hearingState(hearing, events(['launched', 2], [kind, 200]), at(300));
    expect(state).toBe(kind);
    expect(isRunning(state)).toBe(false);
  });

  it('uses the latest closing event', () => {
    expect(hearingState(hearing, events(['failed', 100], ['completed', 200]), at(300))).toBe('completed');
  });

  it('stops counting as in progress after caseCount x 90 s + 10 min with no news', () => {
    expect(staleAfterSeconds(4)).toBe(4 * 90 + 600);
    expect(hearingState(hearing, events(['launched', 2]), at(staleAfterSeconds(4) - 1))).toBe('in_progress');
    expect(hearingState(hearing, events(['launched', 2]), at(staleAfterSeconds(4) + 1))).toBe('no_news');
  });

  it('quotes two minutes of start-up plus half a minute per question', () => {
    expect(estimateSeconds(4)).toBe(120 + 4 * 30);
  });
});
