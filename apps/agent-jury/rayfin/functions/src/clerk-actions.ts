// Pure rules for clerkExecute, shared with the frontend (no Node or mssql imports).
// The Function enforces them; the UI uses the same rules only to hide actions.
import { HEARING_MAX_CASES, HEARING_STAGES, type HearingStage } from './hearing-rules.js';

export const JUROR_ROLES = ['expert', 'approver', 'admin'] as const;
export type JurorRole = (typeof JUROR_ROLES)[number];

export const CLERK_ACTIONS = [
  'swearInJuror',
  'setJurorRole',
  'setJurorActive',
  'editJurorDetails',
  'registerAgent',
  'setAgentActive',
  'readAdminLog',
  'readFeedback',
  'launchHearing',
  'cancelHearing',
  'checkWithFabric',
] as const;
export type ClerkAction = (typeof CLERK_ACTIONS)[number];

export type ClerkCommand =
  | { action: 'swearInJuror'; email: string; displayName?: string; team?: string; role: JurorRole }
  | { action: 'setJurorRole'; jurorId: string; role: JurorRole }
  | { action: 'setJurorActive'; jurorId: string; active: boolean }
  // Empty or missing values clear the field. Allowed on any juror, including yourself.
  | { action: 'editJurorDetails'; jurorId: string; displayName?: string; team?: string }
  | { action: 'registerAgent'; name: string; workspaceId: string; itemId: string }
  | { action: 'setAgentActive'; agentId: string; active: boolean }
  | { action: 'readAdminLog'; limit: number }
  // The juror feedback (newest first). Only admins reach it: the Feedback entity is not readable by other users.
  | { action: 'readFeedback'; limit: number }
  // Starts a hearing over the chosen ruled cases of one agent (limits and cooldown enforced by the Function).
  | { action: 'launchHearing'; agentId: string; stage: HearingStage; caseIds: string[] }
  | { action: 'cancelHearing'; hearingId: string }
  // One job-status call to Fabric, for a hearing that has gone quiet.
  | { action: 'checkWithFabric'; hearingId: string };

export type ClerkReason =
  | 'ok'
  | 'unknown_request'
  | 'expired'
  | 'not_admin'
  | 'unknown_action'
  | 'invalid_payload'
  | 'self_protection'
  | 'already_exists'
  | 'not_found'
  | 'already_processed'
  | 'limit_exceeded'
  | 'no_cases'
  | 'hearing_in_progress'
  | 'cooldown'
  | 'fabric_error'
  | 'server_error';

export type ClerkCode = 200 | 400 | 403 | 404 | 409 | 422 | 500 | 502;

export interface AdminLogEntry {
  requestId: string;
  action: string;
  payload: string;
  requesterEmail: string;
  outcome: 'done' | 'rejected';
  reason: string;
  detail: string;
  processedAt: string;
  /** Sent by the deployed checks (payload source "check" from an active admin, or before LEGACY_CHECK_CUTOFF_UTC). */
  automatedCheck: boolean;
}

export interface FeedbackEntry {
  id: string;
  type: 'idea' | 'confusing' | 'bug' | 'other';
  message: string;
  page: string;
  canContact: boolean;
  createdAt: string;
  /** Only when the juror ticked "You can contact me" (and the Function could tell who they are); never an email. */
  authorName?: string;
}

/** The name admins see for a juror who agreed to be contacted: the display name, else the part of the email before the @. */
export function contactName(displayName: string | null | undefined, email: string | null | undefined): string | undefined {
  const name = displayName?.trim();
  if (name) return name;
  const local = email?.trim().split('@')[0]?.trim();
  return local ? local : undefined;
}

export interface ClerkResult {
  code: ClerkCode;
  outcome: 'done' | 'rejected';
  reason: ClerkReason;
  detail: string;
  log?: AdminLogEntry[];
  feedback?: FeedbackEntry[];
  /** launchHearing: the new hearing. cancelHearing and checkWithFabric: the hearing asked about. */
  hearingId?: string;
  /** checkWithFabric: the job status Fabric reported. */
  jobStatus?: string;
}

export const MAX_LOG_ENTRIES = 200;
const DEFAULT_LOG_ENTRIES = 50;

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ParseResult =
  | { ok: true; command: ClerkCommand }
  | { ok: false; reason: 'unknown_action' | 'invalid_payload'; detail: string };

class PayloadError extends Error {}

function requiredText(payload: Record<string, unknown>, field: string, max: number): string {
  const value = payload[field];
  if (typeof value !== 'string' || value.trim() === '' || value.trim().length > max) {
    throw new PayloadError(`${field} must be text of 1 to ${max} characters.`);
  }
  return value.trim();
}

function optionalText(payload: Record<string, unknown>, field: string, max: number): string | undefined {
  const value = payload[field];
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    return undefined;
  }
  return requiredText(payload, field, max);
}

function guid(payload: Record<string, unknown>, field: string): string {
  const value = payload[field];
  if (typeof value !== 'string' || !GUID.test(value)) {
    throw new PayloadError(`${field} must be a GUID.`);
  }
  return value.toLowerCase();
}

function flag(payload: Record<string, unknown>, field: string): boolean {
  const value = payload[field];
  if (typeof value !== 'boolean') {
    throw new PayloadError(`${field} must be true or false.`);
  }
  return value;
}

function role(payload: Record<string, unknown>): JurorRole {
  const value = payload.role;
  if (typeof value !== 'string' || !(JUROR_ROLES as readonly string[]).includes(value)) {
    throw new PayloadError(`role must be one of ${JUROR_ROLES.join(', ')}.`);
  }
  return value as JurorRole;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Validates the stored action and its JSON payload. */
export function parseCommand(action: string, payloadText: string): ParseResult {
  if (!(CLERK_ACTIONS as readonly string[]).includes(action)) {
    return { ok: false, reason: 'unknown_action', detail: 'Unknown action.' };
  }
  let payload: unknown;
  try {
    payload = JSON.parse(payloadText);
  } catch {
    return { ok: false, reason: 'invalid_payload', detail: 'The payload is not valid JSON.' };
  }
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return { ok: false, reason: 'invalid_payload', detail: 'The payload must be a JSON object.' };
  }
  const fields = payload as Record<string, unknown>;
  try {
    switch (action as ClerkAction) {
      case 'swearInJuror': {
        const email = normalizeEmail(requiredText(fields, 'email', 254));
        if (!EMAIL.test(email)) {
          throw new PayloadError('email is not a valid email address.');
        }
        return {
          ok: true,
          command: {
            action: 'swearInJuror',
            email,
            displayName: optionalText(fields, 'displayName', 100),
            team: optionalText(fields, 'team', 100),
            role: role(fields),
          },
        };
      }
      case 'setJurorRole':
        return { ok: true, command: { action: 'setJurorRole', jurorId: guid(fields, 'jurorId'), role: role(fields) } };
      case 'setJurorActive':
        return { ok: true, command: { action: 'setJurorActive', jurorId: guid(fields, 'jurorId'), active: flag(fields, 'active') } };
      case 'editJurorDetails':
        return {
          ok: true,
          command: {
            action: 'editJurorDetails',
            jurorId: guid(fields, 'jurorId'),
            displayName: optionalText(fields, 'displayName', 100),
            team: optionalText(fields, 'team', 100),
          },
        };
      case 'registerAgent':
        return {
          ok: true,
          command: {
            action: 'registerAgent',
            name: requiredText(fields, 'name', 200),
            workspaceId: guid(fields, 'workspaceId'),
            itemId: guid(fields, 'itemId'),
          },
        };
      case 'setAgentActive':
        return { ok: true, command: { action: 'setAgentActive', agentId: guid(fields, 'agentId'), active: flag(fields, 'active') } };
      case 'readAdminLog': {
        const limit = fields.limit ?? DEFAULT_LOG_ENTRIES;
        if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > MAX_LOG_ENTRIES) {
          throw new PayloadError(`limit must be a whole number from 1 to ${MAX_LOG_ENTRIES}.`);
        }
        return { ok: true, command: { action: 'readAdminLog', limit } };
      }
      case 'readFeedback': {
        const limit = fields.limit ?? DEFAULT_LOG_ENTRIES;
        if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > MAX_LOG_ENTRIES) {
          throw new PayloadError(`limit must be a whole number from 1 to ${MAX_LOG_ENTRIES}.`);
        }
        return { ok: true, command: { action: 'readFeedback', limit } };
      }
      case 'launchHearing': {
        const stage = fields.stage;
        if (typeof stage !== 'string' || !(HEARING_STAGES as readonly string[]).includes(stage)) {
          throw new PayloadError(`stage must be one of ${HEARING_STAGES.join(', ')}.`);
        }
        const ids = fields.caseIds;
        if (!Array.isArray(ids) || ids.length < 1 || ids.length > HEARING_MAX_CASES) {
          throw new PayloadError(`caseIds must list 1 to ${HEARING_MAX_CASES} case ids.`);
        }
        const caseIds = ids.map((id) => {
          if (typeof id !== 'string' || !GUID.test(id)) throw new PayloadError('every case id must be a GUID.');
          return id.toLowerCase();
        });
        if (new Set(caseIds).size !== caseIds.length) throw new PayloadError('caseIds must not repeat.');
        return { ok: true, command: { action: 'launchHearing', agentId: guid(fields, 'agentId'), stage: stage as HearingStage, caseIds } };
      }
      case 'cancelHearing':
        return { ok: true, command: { action: 'cancelHearing', hearingId: guid(fields, 'hearingId') } };
      case 'checkWithFabric':
        return { ok: true, command: { action: 'checkWithFabric', hearingId: guid(fields, 'hearingId') } };
    }
  } catch (error) {
    if (error instanceof PayloadError) {
      return { ok: false, reason: 'invalid_payload', detail: error.message };
    }
    throw error;
  }
  return { ok: false, reason: 'unknown_action', detail: 'Unknown action.' };
}

/** Parses LEGACY_CHECK_CUTOFF_UTC; empty, missing or not an ISO UTC timestamp means "no cutoff". */
export function parseLegacyCheckCutoff(value: string | undefined): Date | undefined {
  const text = value?.trim();
  if (!text || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z$/.test(text)) return undefined;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** What an admin may do to a juror row. Admins can't deactivate themselves or drop their own admin role. */
export function jurorActionsFor(targetJurorId: string, requesterJurorId: string | undefined) {
  const isSelf = requesterJurorId !== undefined && targetJurorId.toLowerCase() === requesterJurorId.toLowerCase();
  return { canChangeRole: !isSelf, canDeactivate: !isSelf };
}

/** Returns why the command is refused by the self-protection rule, or null if it is allowed. */
export function selfProtectionViolation(command: ClerkCommand, requesterJurorId: string): string | null {
  if (command.action === 'setJurorRole' && command.role !== 'admin' && !jurorActionsFor(command.jurorId, requesterJurorId).canChangeRole) {
    return 'An admin cannot remove their own admin role.';
  }
  if (command.action === 'setJurorActive' && !command.active && !jurorActionsFor(command.jurorId, requesterJurorId).canDeactivate) {
    return 'An admin cannot deactivate themselves.';
  }
  return null;
}
