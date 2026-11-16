import { TicketAssignment } from './TicketAssignment.js';
import { TicketEvent } from './TicketEvent.js';
import type { UniversalAppSchema } from '@rayfin-app/shared';

export type { UniversalAppSchema };
export { TicketAssignment, TicketEvent };

export const schema = [TicketAssignment, TicketEvent];
