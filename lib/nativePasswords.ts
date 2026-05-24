import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const PASSWORD_SCHEME = 'PWD_V1';

export function encodePasswordEntry(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${PASSWORD_SCHEME}:${salt}:${hash}`;
}

export function verifyPasswordEntry(password: string, encoded: string): boolean {
  const [scheme, salt, expectedHash] = String(encoded).split(':');
  if (scheme !== PASSWORD_SCHEME || !salt || !expectedHash) return false;
  const actualHash = scryptSync(password, salt, 64).toString('hex');
  const actualBuffer = Buffer.from(actualHash, 'hex');
  const expectedBuffer = Buffer.from(expectedHash, 'hex');
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export function upsertPasswordEntries(currentEntries: string[] | undefined, password: string): string[] {
  const base = Array.isArray(currentEntries)
    ? currentEntries.filter((entry) => !String(entry).startsWith(`${PASSWORD_SCHEME}:`))
    : [];
  base.push(encodePasswordEntry(password));
  return base;
}

export function getPasswordEntry(entries: string[] | undefined): string | null {
  if (!Array.isArray(entries)) return null;
  const match = entries.find((entry) => String(entry).startsWith(`${PASSWORD_SCHEME}:`));
  return match || null;
}

export function generateTempPassword(): string {
  // 12 chars base64url-ish, no confusing characters.
  const raw = randomBytes(9).toString('base64url');
  return raw.replace(/[_-]/g, '').slice(0, 12);
}

