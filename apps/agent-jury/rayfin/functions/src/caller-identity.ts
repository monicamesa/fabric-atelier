// Reads the payload of the invocation's Rayfin token. The host has already validated the token
// before the handler runs (checked in spike S-A by invoking without a session).
export function readTokenClaims(accessToken: string): Record<string, unknown> {
  const parts = accessToken.split('.');
  if (parts.length !== 3) {
    throw new Error('The invocation token is not a JWT.');
  }
  const json = Buffer.from(parts[1], 'base64url').toString('utf8');
  const claims: unknown = JSON.parse(json);
  if (typeof claims !== 'object' || claims === null || Array.isArray(claims)) {
    throw new Error('The invocation token payload is not an object.');
  }
  return claims as Record<string, unknown>;
}
