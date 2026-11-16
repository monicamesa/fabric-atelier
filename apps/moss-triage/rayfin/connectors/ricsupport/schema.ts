// Source: ricsupport (fabric-sqlanalytics)
import type { GraphQLBackedConnector } from '@microsoft/rayfin-connector-fabric-graphql';
import type { ConnectorConfig } from '@microsoft/rayfin-connectors';

import type { Customers } from './Customers.js';
import type { SupportTeam } from './SupportTeam.js';
import type { Tickets } from './Tickets.js';

export type { Customers } from './Customers.js';
export type { SupportTeam } from './SupportTeam.js';
export type { Tickets } from './Tickets.js';

export const connectorConfig = {
  connector: 'fabric-sqlanalytics',
  operations: ['read'],
  entities: {
    Tickets: [
      'ticketId', 'customerId', 'createdAt', 'category', 'subject',
      'description', 'priority', 'channel', 'slaHours', 'firstResponseMinutes',
      'status', 'assignedTo', 'resolvedAt', 'slaBreached',
    ],
    Customers: ['customerId', 'customerName', 'contactName', 'segment', 'country'],
    SupportTeam: ['memberId', 'memberName', 'role'],
  },
} as const satisfies ConnectorConfig;

export type RicsupportSchema = GraphQLBackedConnector<
  {
    Tickets: typeof Tickets;
    Customers: typeof Customers;
    SupportTeam: typeof SupportTeam;
  },
  typeof connectorConfig
>;
