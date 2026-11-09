/**
 * Function schema types for RayfinClient.
 *
 * AUTO-GENERATED — do not edit manually.
 * Re-generated automatically when function source files change.
 *
 * If this file is not updating automatically, run:
 *   rayfin dev functions apply
 *
 * The schema is a closed object type: only the function names listed
 * below are accepted by RayfinClient.functions.<name>.invoke(...).
 * Adding, renaming, or changing the signature of a udf.func() call
 * regenerates this file and surfaces type errors at every consumer.
 *
 * IMPORTANT: This file must NOT import any Node.js packages — it is
 * resolved by the frontend app's TypeScript compiler.
 */

export type AppFunctionsSchema = {
  whoAmI: {
    input: { expectedSub: string; expectedEmail: string };
    output: { claimNames: string[]; audience: string; identityType: string; subMatches: boolean; emailMatches: boolean };
  };
  spikeSqlJuror: {
    input: Record<string, never>;
    output: { jurorId: string; jurorEmail: string; readBackMatches: boolean; exampleAgentReady: boolean; columns: { [k: string]: string[] }; error?: undefined | string };
  };
};
