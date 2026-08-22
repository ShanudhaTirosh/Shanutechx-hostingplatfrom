import { OrderItem } from './types';

/**
 * OrderItem can be backed by either the legacy `service` relation or the
 * new `plan` relation (see Phase 1 migration notes) — never both on a
 * freshly created item, but historical rows may have `service` only.
 * Use this everywhere instead of reaching into `item.service.*` directly,
 * so pages don't break once an item is Plan-based.
 */
export function orderItemName(item: OrderItem): string {
  if (item.plan?.product?.name && item.plan?.name) {
    return `${item.plan.product.name} — ${item.plan.name}`;
  }
  if (item.plan?.product?.name) return item.plan.product.name;
  if (item.plan?.name) return item.plan.name;
  if (item.service?.name) return item.service.name;

  const config = (item.configJson || {}) as Record<string, any>;
  if (config.name) return String(config.name);
  if (config.productName) return String(config.productName);
  if (config.title) return String(config.title);
  if (config.serviceType) return String(config.serviceType).replace(/_/g, ' ');

  if (item.planId) return `Subscription Plan (${item.planId.slice(0, 8)})`;
  if (item.serviceId) return `Service (${item.serviceId.slice(0, 8)})`;

  return 'Cloud Hosting Subscription';
}

export function orderItemUnitPrice(item: OrderItem): number {
  return item.plan?.price ?? item.service?.price ?? 0;
}

export function orderItemCurrency(item: OrderItem): string {
  return item.plan?.currency ?? item.service?.currency ?? 'LKR';
}

export function orderItemLineTotal(item: OrderItem): number {
  return orderItemUnitPrice(item) * item.quantity;
}

/** e.g. "Pro — monthly" for a Plan-based item, or just the service type for legacy items. */
export function orderItemSubtitle(item: OrderItem): string {
  if (item.plan) {
    return `${item.plan.name} — ${item.plan.billingType.replace('_', ' ')}`;
  }
  return item.service?.type.replace(/_/g, ' ') ?? '';
}
