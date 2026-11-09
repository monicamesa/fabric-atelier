import { UserDataFunctions, type RayfinContext } from '@microsoft/fabric-user-data-functions';
import type { AgentJurySchema } from '../../data/schema.js';
import { readTokenClaims } from './caller-identity.js';

const udf = new UserDataFunctions();

export interface WhoAmIResult {
  claimNames: string[];
  subMatches: boolean;
  emailMatches: boolean;
}

// Spike S-A (identity): compares the caller's token claims with the session the client reports.
// Returns only names and booleans, never claim values or the token.
udf.func(
  'whoAmI',
  (expectedSub: string, expectedEmail: string, ctx: RayfinContext<AgentJurySchema>): WhoAmIResult => {
    const claims = readTokenClaims(ctx.accessToken);
    const email = typeof claims.email === 'string' ? claims.email : '';
    return {
      claimNames: Object.keys(claims).sort(),
      subMatches: typeof claims.sub === 'string' && claims.sub === expectedSub,
      emailMatches: email !== '' && email.toLowerCase() === expectedEmail.toLowerCase(),
    };
  },
  [],
);
