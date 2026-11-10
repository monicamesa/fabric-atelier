// Pure rules for hearings, shared by the admin Function and the UI (no Node or mssql imports).

/** D8: the plan says 10 questions per hearing; 5 while the feature is being built. Raise it after measuring. */
export const HEARING_MAX_CASES = 5;

/** Minimum wait after a hearing ends before another can start (shared capacity, D9). */
export const HEARING_COOLDOWN_SECONDS = 10 * 60;

export const HEARING_STAGES = ['sandbox', 'production'] as const;
export type HearingStage = (typeof HEARING_STAGES)[number];

export const HEARING_TERMINAL_KINDS = ['completed', 'failed', 'cancelled'] as const;
export type HearingEventKind = 'launched' | 'started' | 'progress' | 'completed' | 'failed' | 'cancelled';

/** Measured in I3a: 12-18 s of agent time per question plus 5-8 s of overhead per batch of 1, rounded up. */
export const SECONDS_PER_QUESTION = 30;
/** Notebook start, SDK install and sign-in, measured at about two minutes. */
export const HEARING_STARTUP_SECONDS = 120;

/** Time the UI quotes before launching and while it runs. */
export function estimateSeconds(questionCount: number): number {
  return HEARING_STARTUP_SECONDS + questionCount * SECONDS_PER_QUESTION;
}

/** A hearing with no closing event stops counting as in progress after this long (caseCount x 90 s + 10 min). */
export function staleAfterSeconds(caseCount: number): number {
  return caseCount * 90 + 10 * 60;
}

export type HearingState = 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'no_news';

export interface HearingLike {
  createdAt: Date | string;
  caseCount: number;
}

export interface HearingEventLike {
  kind: HearingEventKind;
  createdAt: Date | string;
}

const at = (value: Date | string) => new Date(value).getTime();

/** R6 for hearings: the state comes from the events, never from a stored field. */
export function hearingState(hearing: HearingLike, events: readonly HearingEventLike[], now: Date): HearingState {
  const closing = [...events]
    .filter((event) => (HEARING_TERMINAL_KINDS as readonly string[]).includes(event.kind))
    .sort((a, b) => at(a.createdAt) - at(b.createdAt))
    .pop();
  if (closing) return closing.kind as 'completed' | 'failed' | 'cancelled';
  return (now.getTime() - at(hearing.createdAt)) / 1000 > staleAfterSeconds(hearing.caseCount) ? 'no_news' : 'in_progress';
}

/** Whether new work for the hearing is still expected (drives the re-read of the page). */
export function isRunning(state: HearingState): boolean {
  return state === 'in_progress';
}
