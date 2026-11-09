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
  adminExecute: {
    input: { requestId: string };
    output: { code: 200 | 403 | 404 | 409; outcome: 'done' | 'rejected'; detail: string };
  };
  echoSync: {
    input: { text: string };
    output: string;
  };
  echoAsync: {
    input: { text: string };
    output: string;
  };
  echoAsyncCtx: {
    input: { text: string };
    output: string;
  };
  echoRequestId: {
    input: { requestId: string };
    output: string;
  };
  echoUnion: {
    input: { text: string };
    output: { code: 200 | 404; detail?: undefined | string };
  };
  echoSqlInput: {
    input: { text: string };
    output: string;
  };
  dataPing: {
    input: Record<string, never>;
    output: { ok: boolean; detail?: undefined | string };
  };
};
