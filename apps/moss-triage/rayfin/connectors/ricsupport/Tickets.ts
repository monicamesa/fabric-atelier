import { boolean, date, entity, int, role, text } from '@microsoft/rayfin-core';
import { Source } from '@microsoft/rayfin-connectors';

@role('authenticated', ['read'])
@entity()
export class Tickets extends Source({
  schema: 'dbo',
  table: 'tickets',
  primaryKey: [],
}) {
  @text({ column: 'ticket_id', max: 8000, optional: true })
  ticketId?: string;

  @text({ column: 'customer_id', max: 8000, optional: true })
  customerId?: string;

  @date({ column: 'created_at', optional: true })
  createdAt?: Date;

  @text({ max: 8000, optional: true })
  category?: string;

  @text({ max: 8000, optional: true })
  subject?: string;

  @text({ max: 8000, optional: true })
  description?: string;

  @text({ max: 8000, optional: true })
  priority?: string;

  @text({ max: 8000, optional: true })
  channel?: string;

  @int({ column: 'sla_hours', optional: true })
  slaHours?: number;

  @int({ column: 'first_response_minutes', optional: true })
  firstResponseMinutes?: number;

  @text({ max: 8000, optional: true })
  status?: string;

  @text({ column: 'assigned_to', max: 8000, optional: true })
  assignedTo?: string;

  @date({ column: 'resolved_at', optional: true })
  resolvedAt?: Date;

  @boolean({ column: 'sla_breached', optional: true })
  slaBreached?: boolean;
}
