function roleToSignatureLabel(role: string): string {
  const normalized = String(role || '').trim().toUpperCase();

  if (normalized === 'CUSTOMER_SUPPORT') return 'Customer Care - Level 1';
  if (normalized === 'TECHNICAL_SUPPORT') return 'Technical Support - Level 1';
  if (normalized === 'ADMIN') return 'Platform Admin';
  if (normalized === 'SUPER_ADMIN') return 'Platform Operations Lead';
  if (normalized === 'DEPLOYMENT_MANAGER') return 'Deployment Manager';
  if (normalized === 'BILLING_MANAGER') return 'Billing Manager';
  if (normalized === 'CLIENT_OWNER') return 'Client Owner';
  if (normalized === 'CLIENT_STAFF') return 'Client Team';

  const fallback = normalized
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

  return fallback || 'Support Team';
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function normalizeTicketSignature(value: unknown): string {
  const raw = String(value || '').replace(/\r\n?/g, '\n');
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);

  const joined = lines.join('\n');
  return joined.length > 320 ? joined.slice(0, 320).trim() : joined;
}

export function buildDefaultTicketSignature(input: {
  displayName: string;
  role: string;
}): string {
  const displayName = String(input.displayName || '').trim() || 'Support Team';
  const roleLabel = roleToSignatureLabel(input.role);
  return `Best Regards\n${displayName}\n${roleLabel}`;
}

export function resolveTicketSignature(input: {
  storedSignature?: string | null;
  displayName: string;
  role: string;
}): string {
  const stored = normalizeTicketSignature(input.storedSignature || '');
  if (stored) return stored;
  return buildDefaultTicketSignature({
    displayName: input.displayName,
    role: input.role,
  });
}

export function appendSignatureToHtml(messageHtml: string, signature: string): string {
  const base = String(messageHtml || '').trim();
  const normalizedSignature = normalizeTicketSignature(signature);
  if (!normalizedSignature) return base;

  const signatureHtml = normalizedSignature
    .split('\n')
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');

  if (!base) return signatureHtml;
  return `${base}<p></p>${signatureHtml}`;
}
