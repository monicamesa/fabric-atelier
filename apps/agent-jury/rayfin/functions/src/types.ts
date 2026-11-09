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
  clerkExecute: {
    input: { requestId: string };
    output: { code: 200 | 400 | 403 | 404 | 409 | 422 | 500; outcome: 'done' | 'rejected'; reason: 'ok' | 'unknown_request' | 'expired' | 'not_admin' | 'unknown_action' | 'invalid_payload' | 'self_protection' | 'already_exists' | 'not_found' | 'already_processed' | 'server_error'; detail: string; log?: undefined | { requestId: string; action: string; payload: string; requesterEmail: string; outcome: 'done' | 'rejected'; reason: string; detail: string; processedAt: string; automatedCheck: boolean }[] };
  };
};
