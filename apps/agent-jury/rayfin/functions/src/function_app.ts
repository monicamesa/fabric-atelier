import { UserDataFunctions, AudienceType, type RayfinContext } from '@microsoft/fabric-user-data-functions';
import type { AgentJurySchema } from '../../data/schema.js';
import { readTokenClaims } from './caller-identity.js';
import { runSqlSpike, type SpikeSqlResult } from './spike-sql.js';

const udf = new UserDataFunctions();

export interface WhoAmIResult {
  claimNames: string[];
  audience: string;
  identityType: string;
  subMatches: boolean;
  emailMatches: boolean;
}

// Spike S-A (identity): compares the caller's token claims with the session the client reports.
// Returns claim names, booleans and two non-personal claims (aud, idtyp); never the token or user values.
udf.func(
  'whoAmI',
  (expectedSub: string, expectedEmail: string, ctx: RayfinContext<AgentJurySchema>): WhoAmIResult => {
    const claims = readTokenClaims(ctx.accessToken);
    const email = typeof claims.email === 'string' ? claims.email : '';
    return {
      claimNames: Object.keys(claims).sort(),
      audience: typeof claims.aud === 'string' ? claims.aud : '',
      identityType: typeof claims.idtyp === 'string' ? claims.idtyp : '',
      subMatches: typeof claims.sub === 'string' && claims.sub === expectedSub,
      emailMatches: email !== '' && email.toLowerCase() === expectedEmail.toLowerCase(),
    };
  },
  [],
);

// Spike S-A (T-SQL): writes and reads a Juror with the app identity, never with the caller's data client.
udf.func(
  'spikeSqlJuror',
  async (ctx: RayfinContext<AgentJurySchema, AudienceType.Sql>): Promise<SpikeSqlResult> => {
    return runSqlSpike({
      server: ctx.Secrets.APP_SQL_SERVER,
      database: ctx.Secrets.APP_SQL_DATABASE,
      token: ctx.Tokens.Sql,
    });
  },
  [],
);
