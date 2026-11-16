import { entity, role, text } from '@microsoft/rayfin-core';
import { Source } from '@microsoft/rayfin-connectors';

@role('authenticated', ['read'])
@entity()
export class Customers extends Source({
  schema: 'dbo',
  table: 'customers',
  primaryKey: [],
}) {
  @text({ column: 'customer_id', max: 8000, optional: true })
  customerId?: string;

  @text({ column: 'customer_name', max: 8000, optional: true })
  customerName?: string;

  @text({ column: 'contact_name', max: 8000, optional: true })
  contactName?: string;

  @text({ max: 8000, optional: true })
  segment?: string;

  @text({ max: 8000, optional: true })
  country?: string;
}
