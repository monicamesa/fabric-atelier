import { entity, role, text } from '@microsoft/rayfin-core';
import { Source } from '@microsoft/rayfin-connectors';

@role('authenticated', ['read'])
@entity()
export class SupportTeam extends Source({
  schema: 'dbo',
  table: 'support_team',
  primaryKey: [],
}) {
  @text({ column: 'member_id', max: 8000, optional: true })
  memberId?: string;

  @text({ column: 'member_name', max: 8000, optional: true })
  memberName?: string;

  @text({ max: 8000, optional: true })
  role?: string;
}
