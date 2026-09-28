const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
  New: ["Processing", "Cancelled"],
  Processing: ["Packed", "Cancelled"],
  Packed: ["Shipped", "Cancelled"],
  Shipped: ["Completed", "Returned"],
  Completed: ["Returned"],
  Cancelled: [],
  Returned: [],
};

// Mirrors the API state machine so the admin only sees legal next steps.
export function allowedOrderStatuses(current: string): string[] {
  const next = ORDER_STATUS_TRANSITIONS[current] ?? [];
  return [current, ...next.filter((value) => value !== current)];
}
