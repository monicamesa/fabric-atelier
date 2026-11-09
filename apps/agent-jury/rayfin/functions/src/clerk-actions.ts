// Pure rules for clerkExecute, shared with the frontend (no Node or mssql imports).
// The Function enforces them; the UI uses the same rules only to hide actions.

export const JUROR_ROLES = ['expert', 'approver', 'admin'] as const;
export type JurorRole = (typeof JUROR_ROLES)[number];

export const CLERK_ACTIONS = [
  'swearInJuror',
  'setJurorRole',
  'setJurorActive',
  'registerAgent',
  'setAgentActive',
  'readAdminLog',
] as const;
export type ClerkAction = (typeof CLERK_ACTIONS)[number];

export type ClerkCommand =
  | { action: 'swearInJuror'; email: string; displayName?: string; team?: string; role: JurorRole }
  | { action: 'setJurorRole'; jurorId: string; role: JurorRole }
  | { action: 'setJurorActive'; jurorId: string; active: boolean }
  | { action: 'registerAgent'; name: string; workspaceId: string; itemId: string }
  | { action: 'setAgentActive'; agentId: string; active: boolean }
  | { action: 'readAdminLog'; limit: number };

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
  | 'server_error';

export type ClerkCode = 200 | 400 | 403 | 404 | 409 | 422 | 500;

export interface AdminLogEntry {
  requestId: string;
  action: string;
  payload: string;
  requesterEmail: string;
  outcome: 'done' | 'rejected';
  reason: string;
  detail: string;
  processedAt: string;
}

export interface ClerkResult {
  code: ClerkCode;
  outcome: 'done' | 'rejected';
  reason: ClerkReason;
  detail: string;
  log?: AdminLogEntry[];
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
    }
  } catch (error) {
    if (error instanceof PayloadError) {
      return { ok: false, reason: 'invalid_payload', detail: error.message };
    }
    throw error;
  }
  return { ok: false, reason: 'unknown_action', detail: 'Unknown action.' };
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
