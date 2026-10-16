export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 90 + 10)}`;
}

export function nextWorkerId(existing: string[]): string {
  const nums = existing.map((id) => Number(id.replace('WK', ''))).filter((n) => Number.isFinite(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `WK${String(next).padStart(3, '0')}`;
}
