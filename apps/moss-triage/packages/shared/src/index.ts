/**
 * Browser-safe contracts shared by the data registration package and frontend.
 * Keep each record aligned with its decorated entity in @rayfin-app/data.
 */
export interface TicketAssignmentRecord {
  id: string;
  ticketId: string;
  memberId: string;
  level: 'N1' | 'N2';
  assignedAt: Date;
  assignedBy: string;
}

export interface TicketEventRecord {
  id: string;
  ticketId: string;
  type: 'asignado' | 'escalado' | 'respuesta' | 'resuelto';
  text: string;
  createdAt: Date;
  author: string;
}

export type UniversalAppSchema = {
  TicketAssignment: TicketAssignmentRecord;
  TicketEvent: TicketEventRecord;
};
