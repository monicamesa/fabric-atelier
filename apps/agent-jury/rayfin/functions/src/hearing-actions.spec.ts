// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { rulingSnapshot } from './hearing-actions';

const NOW = new Date('2026-11-10T12:00:00Z');
const day = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const JURORS = [
  { email: 'ana.expert@example.com', role: 'expert' as const, active: true },
  { email: 'bruno.expert@example.com', role: 'expert' as const, active: true },
  { email: 'carla.approver@example.com', role: 'approver' as const, active: true },
];

const caseRow = (id: string, authorEmail: string) => ({ id, text: `Question ${id}`, authorUserId: `sub-${authorEmail}`, authorEmail, createdAt: day(10) });
const testimony = (id: string, case_id: string, answer: string, authorEmail: string) => ({ id, case_id, answer, authorUserId: `sub-${authorEmail}`, authorEmail, createdAt: day(9) });
const vote = (id: string, testimony_id: string, voterEmail: string) => ({ id, testimony_id, value: 'for' as const, comment: null, voterUserId: `sub-${voterEmail}`, voterEmail, createdAt: day(8) });

const rows = {
  cases: [caseRow('c1', 'bruno.expert@example.com'), caseRow('c2', 'bruno.expert@example.com'), caseRow('c3', 'stranger@example.com')],
  testimonies: [
    testimony('t1', 'c1', '997', 'bruno.expert@example.com'),
    testimony('t2', 'c2', '245', 'bruno.expert@example.com'),
    testimony('t3', 'c3', '1', 'stranger@example.com'),
  ],
  votes: [
    vote('v1', 't1', 'ana.expert@example.com'),
    vote('v2', 't1', 'carla.approver@example.com'),
    vote('v3', 't2', 'ana.expert@example.com'),
  ],
  dismissals: [],
  jurors: JURORS,
};

describe('rulingSnapshot (R5, R7)', () => {
  it('copies the question and the ruled answer of a ruled, verified case', () => {
    expect(rulingSnapshot(rows, ['c1'], NOW)).toEqual({
      ok: true,
      items: [{ caseId: 'c1', testimonyId: 't1', question: 'Question c1', expectedAnswer: '997' }],
    });
  });

  it('refuses a case that is still under review', () => {
    expect(rulingSnapshot(rows, ['c1', 'c2'], NOW)).toMatchObject({ ok: false });
  });

  it('refuses a case whose author is not an active juror', () => {
    expect(rulingSnapshot(rows, ['c3'], NOW)).toMatchObject({ ok: false });
  });

  it('refuses a dismissed case', () => {
    const dismissed = { ...rows, dismissals: [{ id: 'd1', case_id: 'c1', dismissedByUserId: 'sub-bruno.expert@example.com', dismissedByEmail: 'bruno.expert@example.com', createdAt: day(1) }] };
    expect(rulingSnapshot(dismissed, ['c1'], NOW)).toMatchObject({ ok: false });
  });

  it('refuses a case that belongs to another agent', () => {
    expect(rulingSnapshot(rows, ['unknown'], NOW)).toEqual({ ok: false, detail: 'A chosen case does not belong to this agent.' });
  });
});
