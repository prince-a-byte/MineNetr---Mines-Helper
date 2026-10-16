/** Display formatting only. Persisted values stay numeric/unformatted. */

/** Indian digit grouping: 2450000 -> "₹ 24,50,000". */
export function inr(n: number): string {
  const s = Math.round(n).toString();
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `₹ ${rest ? rest + ',' + last3 : last3}`;
}

/** "2026-01-12" -> "12 Jan 2026". Pass through anything else untouched. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[3]} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

/** Mask all but last 4: "123412341234" -> "**** **** 1234". */
export function maskAadhaar(last4: string): string {
  return `**** **** ${last4}`;
}

export function maskPhone(phone: string): string {
  if (phone.length <= 4) return phone;
  return `+91 XXXXX ${phone.slice(-5)}`;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

export function fileSize(n?: number): string {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
