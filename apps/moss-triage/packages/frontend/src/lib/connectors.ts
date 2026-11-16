// #region rayfin:app-owned — copied verbatim by the Rayfin CLI; edit freely.
//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type {
  ConnectorConfig,
  ConnectorsRuntime,
} from '@microsoft/rayfin-connectors';
// #endregion rayfin:app-owned

import { connectorConfig as ricSupportConfig } from '../../../../rayfin/connectors/ricsupport/schema';
import type { RicsupportSchema } from '../../../../rayfin/connectors/ricsupport/schema';

export type AppConnectorsSchema = {
  ricsupport: RicsupportSchema;
};

export const connectorConfigs: Record<string, ConnectorConfig> = {
  ricsupport: ricSupportConfig,
};

export const connectorRuntimes: ConnectorsRuntime = {};
