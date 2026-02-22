export const today = (): string => new Date().toISOString().split('T')[0];

export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export function resolvePath(path: string | undefined | null) {
  if (!path) return '';
  if (path.startsWith('http') || path.startsWith('data:')) return path;
  
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // Get base URL from Vite (defaults to / in dev, /ocuprep/ in prod)
  const baseUrl = import.meta.env.BASE_URL;
  
  // Ensure baseUrl ends with slash
  const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  
  return `${cleanBase}${cleanPath}`;
}

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

export const fmtTime = (d: string | null): string => {
  if (!d) return '-';
  // Use TH locale for 24-hour HH:mm
  return new Date(d).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
};

export const isTimeInRange = (d: string, startHr: number, startMin: number, endHr: number, endMin: number): boolean => {
  const date = new Date(d);
  const totalMinutes = date.getHours() * 60 + date.getMinutes();
  const startTotal = startHr * 60 + startMin;
  const endTotal = endHr * 60 + endMin;
  return totalMinutes >= startTotal && totalMinutes <= endTotal;
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

export const getCurrentThaiMonthYear = (): string => {
  const now = new Date();
  return new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric' }).format(now);
};

export const genLot = (nextId: number): string => {
  const now = new Date();
  return `LOT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(nextId).padStart(3, '0')}`;
};
