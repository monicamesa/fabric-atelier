import { authenticated, date, entity, set, text, uuid } from '@microsoft/rayfin-core';

@entity()
@authenticated(['read', 'create'])
export class TicketEvent {
  @uuid() id!: string;
  @text({ max: 200 }) ticketId!: string;
  @set('asignado', 'escalado', 'respuesta', 'resuelto')
  type!: 'asignado' | 'escalado' | 'respuesta' | 'resuelto';
  @text({ max: 2000 }) text!: string;
  @date() createdAt!: Date;
  @text({ max: 200 }) author!: string;
}
