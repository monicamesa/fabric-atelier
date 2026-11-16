import {
  authenticated,
  date,
  entity,
  set,
  text,
  uuid,
} from '@microsoft/rayfin-core';

@entity()
@authenticated(['read', 'create', 'update'])
export class TicketAssignment {
  @uuid() id!: string;
  @text({ max: 200, unique: true }) ticketId!: string;
  @text({ max: 200 }) memberId!: string;
  @set('N1', 'N2') level!: 'N1' | 'N2';
  @date() assignedAt!: Date;
  @text({ max: 200 }) assignedBy!: string;
}
