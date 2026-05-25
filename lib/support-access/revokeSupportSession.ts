import { revokeSupportSessionById } from './createSupportSession';

export function revokeSupportSession(input: { sessionId: string }) {
  const revoked = revokeSupportSessionById(input.sessionId);
  if (!revoked) {
    return { ok: false as const, reason: 'Support session not found' };
  }

  return { ok: true as const, session: revoked };
}
