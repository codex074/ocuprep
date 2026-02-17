export const today = (): string => new Date().toISOString().split('T')[0];

export const fmtDate = (d: string | null): string => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
};

export const fmtDateTime = (d: string | null): string => {
  if (!d) return '-';
  return new Date(d).toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const fmtShort = (d: string | null): string => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

// If n < 0, it means hours (e.g. -4 means 4 hours)
export const addDays = (d: string, n: number): string => {
  const x = new Date(d);
  if (n < 0) {
    x.setHours(x.getHours() + Math.abs(n));
    return x.toISOString(); // Full ISO string for hours
  }
  x.setDate(x.getDate() + n);
  return x.toISOString().split('T')[0]; // Just date for days
};

// Returns [start, end] of the current month in YYYY-MM-DD format
export const getMonthRange = (): [string, string] => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  // Add timezone offset to ensure we get local date string correct, or just use simpler formatting
  const fmt = (d: Date) => d.toLocaleDateString('en-CA'); // YYYY-MM-DD
  return [fmt(start), fmt(end)];
};

export const genLot = (nextId: number): string => {
  const now = new Date();
  return `LOT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(nextId).padStart(3, '0')}`;
};
