import { describe, expect, it } from 'vitest';
import { jurorActionsFor, parseCommand, selfProtectionViolation, type ClerkCommand } from './clerk-actions';

const ME = '00000000-0000-4000-8000-000000000014';
const OTHER = '00000000-0000-4000-8000-000000000011';
const AGENT = '00000000-0000-4000-8000-000000000021';

function command(action: string, payload: unknown): ClerkCommand {
  const result = parseCommand(action, JSON.stringify(payload));
  if (!result.ok) throw new Error(result.detail);
  return result.command;
}

describe('parseCommand', () => {
  it('normalises a new juror and drops empty optional fields', () => {
    expect(command('swearInJuror', { email: '  Ana.Expert@Example.com ', displayName: ' ', role: 'expert' })).toEqual({
      action: 'swearInJuror',
      email: 'ana.expert@example.com',
      displayName: undefined,
      team: undefined,
      role: 'expert',
    });
  });

  it.each([
    ['swearInJuror', { email: 'not-an-email', role: 'expert' }],
    ['swearInJuror', { email: 'ana@example.com', role: 'judge' }],
    ['swearInJuror', { email: 'ana@example.com', role: 'expert', displayName: 'x'.repeat(101) }],
    ['setJurorRole', { jurorId: 'abc', role: 'admin' }],
    ['setJurorActive', { jurorId: OTHER, active: 'no' }],
    ['registerAgent', { name: '', workspaceId: AGENT, itemId: AGENT }],
    ['registerAgent', { name: 'Sales', workspaceId: 'w', itemId: AGENT }],
    ['setAgentActive', { agentId: AGENT }],
    ['readAdminLog', { limit: 201 }],
    ['readAdminLog', { limit: 1.5 }],
  ])('rejects an invalid %s payload', (action, payload) => {
    const result = parseCommand(action, JSON.stringify(payload));
    expect(result).toMatchObject({ ok: false, reason: 'invalid_payload' });
  });

  it('rejects payloads that are not JSON objects', () => {
    expect(parseCommand('readAdminLog', 'not json')).toMatchObject({ ok: false, reason: 'invalid_payload' });
    expect(parseCommand('readAdminLog', '[]')).toMatchObject({ ok: false, reason: 'invalid_payload' });
  });

  it('rejects unknown actions, including the old probe', () => {
    expect(parseCommand('probe', '{}')).toMatchObject({ ok: false, reason: 'unknown_action' });
    expect(parseCommand('dropTable', '{}')).toMatchObject({ ok: false, reason: 'unknown_action' });
  });

  it('lower-cases ids and defaults the log size', () => {
    expect(command('setAgentActive', { agentId: AGENT.toUpperCase(), active: false })).toEqual({
      action: 'setAgentActive',
      agentId: AGENT,
      active: false,
    });
    expect(command('readAdminLog', {})).toEqual({ action: 'readAdminLog', limit: 50 });
  });
});

describe('self-protection', () => {
  it('stops an admin from removing their own admin role', () => {
    expect(selfProtectionViolation(command('setJurorRole', { jurorId: ME, role: 'expert' }), ME)).toMatch(/own admin role/);
  });

  it('stops an admin from deactivating themselves, whatever the id casing', () => {
    expect(selfProtectionViolation(command('setJurorActive', { jurorId: ME, active: false }), ME.toUpperCase())).toMatch(/deactivate themselves/);
  });

  it('allows the same changes on another juror', () => {
    expect(selfProtectionViolation(command('setJurorRole', { jurorId: OTHER, role: 'expert' }), ME)).toBeNull();
    expect(selfProtectionViolation(command('setJurorActive', { jurorId: OTHER, active: false }), ME)).toBeNull();
  });

  it('allows harmless changes on yourself', () => {
    expect(selfProtectionViolation(command('setJurorRole', { jurorId: ME, role: 'admin' }), ME)).toBeNull();
    expect(selfProtectionViolation(command('setJurorActive', { jurorId: ME, active: true }), ME)).toBeNull();
  });

  it('hides role and deactivation actions on your own row only', () => {
    expect(jurorActionsFor(ME, ME)).toEqual({ canChangeRole: false, canDeactivate: false });
    expect(jurorActionsFor(OTHER, ME)).toEqual({ canChangeRole: true, canDeactivate: true });
  });
});
