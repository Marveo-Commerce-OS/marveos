import { appendAuditLog } from '@/lib/adminStore';
import { getWooCommerceRestBase } from '@/src/lib/endpoints';
import type { UpdateOrderStatusInput } from './types';

const WC = getWooCommerceRestBase();
const AUTH = `consumer_key=${process.env.WOOCOMMERCE_CONSUMER_KEY ?? ''}&consumer_secret=${process.env.WOOCOMMERCE_CONSUMER_SECRET ?? ''}`;

export async function updateOrderStatus(input: UpdateOrderStatusInput): Promise<{ ok: true; data: unknown } | { ok: false; status: number; error: string }> {
  if (!WC) {
    return { ok: false, status: 503, error: 'WooCommerce API URL is not configured' };
  }

  const response = await fetch(`${WC}/orders/${input.id}?${AUTH}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${input.token}` },
    body: JSON.stringify({ status: input.status }),
  });

  if (!response.ok) {
    return { ok: false, status: response.status, error: 'WC update failed' };
  }

  const updated = await response.json();
  await appendAuditLog({
    actorEmail: input.actorEmail || 'unknown',
    action: 'order.updated',
    target: `order:${input.id}`,
    details: `Status changed to ${input.status}`,
  });

  return { ok: true, data: updated };
}
