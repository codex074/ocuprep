# CLAUDE.md — YATA

Project context for AI-assisted development. Read this before making changes.

---

## What This Project Is

A **Progressive Web App** for the Pharmacy Department of Uttaradit Hospital to record, track, and report the production of extemporaneous (custom-compounded) eye drops.

- **Frontend:** React 19 + TypeScript + Vite — hosted on GitHub Pages
- **Backend:** Firebase Firestore (direct SDK, no server) — `src/lib/api.ts`
- **Database:** Firestore — collections: `users`, `formulas`, `preps`, `action_logs`, `meta`

---

## Commands

```bash
# TypeScript type check (npm not in PATH in Claude sessions — use full paths)
/usr/local/bin/node ./node_modules/.bin/tsc -b --noEmit

# Dev server
/usr/local/bin/node ./node_modules/.bin/vite --port 5173

# Production build
/usr/local/bin/node ./node_modules/.bin/vite build

# Preview prod build
/usr/local/bin/node ./node_modules/.bin/vite preview --port 4173
```

> `npm` is not available in PATH during Claude Code sessions. Always use
> `/usr/local/bin/node ./node_modules/.bin/<tool>` or standard tools.

---

## Key Files

| File | Purpose |
|---|---|
| `src/lib/api.ts` | **Entire backend client** — Firestore CRUD for users/formulas/preps, action log writes, ID allocation via `meta/counters` transaction |
| `src/lib/firebase.ts` | Firebase app + Firestore `db` instance |
| `src/lib/resourceCache.ts` | In-memory cache — `getCachedResource`, `setCachedResource`, `invalidateCachedResource`, `loadCachedResource` (5 min stale) |
| `src/hooks/usePreps.ts` | Fetch/create/update/delete preps — optimistic updates, `toDateOnly()` normalization |
| `src/hooks/useFormulas.ts` | Fetch/CRUD formulas — cached in client |
| `src/hooks/useUsers.ts` | Fetch/CRUD users |
| `src/hooks/useFirestoreInit.ts` | Pings Firestore once on boot to verify connectivity |
| `src/hooks/useAppWarmup.ts` | Pre-fetches formulas on startup |
| `src/contexts/AuthContext.tsx` | Login, logout, station selection — session in `localStorage` key `ed-extemp-session`, 1-hour TTL |
| `src/pages/DashboardPage.tsx` | Central hub: month/location filter, 6 stat cards, recent list (shows `short_name`), formula summary, workload analysis + Export Excel |
| `src/pages/HistoryPage.tsx` | Full audit log — filter modal ("ตั้งค่าการกรอง") with draft state, active filter chips, shows `short_name`, pagination, Export Excel |
| `src/pages/FormulasPage.tsx` | Formula list (table view) — click row to open edit/detail modal |
| `src/pages/PreparePage.tsx` | Record a new prep — auto lot number, chemical lot modal, label printing |
| `src/lib/print.ts` | Generates browser-printable HTML for labels and batch sheets |
| `src/lib/utils.ts` | Date helpers (`today`, `fmtDate`, `fmtShort`, `fmtTime`, `addDays`, `getMonthRange`, etc.) |
| `src/types/index.ts` | `User`, `Formula`, `Prep` interfaces |

---

## Routing

Uses **`HashRouter`** (not `BrowserRouter`) because GitHub Pages only serves `index.html` and cannot handle deep paths.

```
/dashboard    DashboardPage  (default)
/prepare      PreparePage
/history      HistoryPage
/formulas     FormulasPage
/users        UsersPage      (admin only)
/profile      ProfilePage
/login        LoginPage      (public)
/station-select              (requires auth, no station yet)
/force-change-password       (requires auth, must_change_password=true)
```

Route guards: `ProtectedRoute` (requires login) → `RequireStation` (requires station selection) → `Layout`.

---

## Firestore Backend — Key Notes

### ID allocation
IDs are integers allocated via a Firestore transaction on `meta/counters`:
```typescript
// allocateId('preps') → atomically increments counters.preps, returns next int
const id = await allocateId('preps');
```

### Document keys
Each collection uses a business key as the Firestore document ID (not the numeric `id`):
- `users` → `pha_id` (normalized lowercase)
- `formulas` → `code` (normalized uppercase)
- `preps` → `lot_no` (normalized, prefix `LOT-` stripped)

### Action logs
Every create/update/delete writes to `action_logs` automatically via `createActionLog()`.
Logs older than 90 days are pruned on read (every 15 min interval).

### No environment variables required
Firebase config is hard-coded in `src/lib/firebase.ts`. No `.env` needed.

---

## Client-side Caching

`resourceCache.ts` — in-memory Map, 5-minute stale time.

| Cache key | Contents |
|---|---|
| `formulas` | All formula records |
| `preps` | All prep records (used by HistoryPage and PreparePage) |
| `preps-YYYY-MM` | Monthly slice (used by Dashboard for each selected month) |

**Rules:**
- Dashboard uses `usePreps(startDate, endDate)` → cache key `preps-YYYY-MM`
- History/Prepare use `usePreps()` → cache key `preps` (all records)
- After a mutation on a monthly key, also `invalidateCachedResource('preps')` to force History to refetch

---

## Data Types

```typescript
interface Prep {
  id: number;
  formula_id: number;         // FK → Formula.id
  formula_name: string;       // denormalized for display
  mode: 'patient' | 'stock';
  date: string;               // always "YYYY-MM-DD" after toDateOnly()
  expiry_date: string;        // "YYYY-MM-DD" or ISO for hour-based expiry
  qty: number;
  note: string;
  location: string;           // station/ward — used for location filter
  chemical_lot_no?: string;   // optional lot no. of chemicals used
  created_at?: string;        // ISO timestamp — used for workload time-slot classification
}

interface Formula {
  id: number;
  name: string;
  short_name?: string;        // abbreviated — displayed in Dashboard summary
  expiry_days: number;        // negative = hours (e.g. -4 = 4 hours)
  price: number;              // per bottle — used in production value calculation
}
```

---

## Dashboard — Key Logic

Dashboard is the **combined overview + workload report** page. No separate `/workload` route.

```
Month selector  ←  built from allPreps.map(p => p.date.slice(0,7))
Location filter ← derived from monthPreps (shown only if >1 location)

filteredPreps = monthPreps filtered by location

Stat cards (6):
  - Total bottles (filteredPreps sum qty)
  - Patient bottles
  - Stock bottles
  - Average bottles/active day
  - Busiest day (max totalQty in dailyRows)
  - Production value ฿ (formula.price × qty)

Workload section (bottom):
  - Time-slot proportion bars
  - Daily breakdown table (classifySlot uses created_at)
  - Export Excel button
```

### Time-slot classification

```typescript
function classifySlot(created_at?: string): 'morning' | 'afternoon' | 'overtime' {
  // No timestamp → overtime
  const d = new Date(created_at);
  const dow = d.getDay();
  const min = d.getHours() * 60 + d.getMinutes();
  if (dow === 0 || dow === 6) return 'overtime';          // Sat/Sun
  if (min >= 510  && min < 810)  return 'morning';        // 08:30–13:30
  if (min >= 810  && min < 990)  return 'afternoon';      // 13:30–16:30
  return 'overtime';                                      // before 08:30 or after 16:30
}
```

---

## Optimistic Updates Pattern

```typescript
// createPrep returns: true (success) | string (error message)
const result = await createPrep(data);
if (result === true) {
  toast('สำเร็จ', 'success');
} else {
  toast(result, 'error');
}

// Inside usePreps — after Firestore confirms:
setPreps(prev => {
  const next = [newPrep, ...prev];
  setCachedResource(cacheKey, next);              // update monthly/all cache
  if (cacheKey !== 'preps') invalidateCachedResource('preps'); // stale allPreps
  return next;
});
```

---

## Lot Number Format

Auto-generated in `PreparePage.tsx`:
```
LOT-YYYYMM-NNN
  YYYY = current year
  MM   = current month (2 digits)
  NNN  = max(preps[].id) + 1, padded to 3 digits
```

---

## Auth / Session

- Stored in `localStorage` key `ed-extemp-session`
- Structure: `{ user: User, location: string, timestamp: number }`
- Session expires after **1 hour** (checked on load)
- On restore: fetches fresh user data from Firestore via `getUserById`
- **Station selection** is required after login (`RequireStation` guard)

---

## CI/CD

```yaml
# .github/workflows/deploy-pages.yml
# Trigger: push to main OR manual workflow_dispatch
# Steps: checkout → node 20 → npm ci → npm run build → upload artifact → deploy Pages
```

No environment variables are required for the build — Firebase config is bundled in source.

---

## Mobile UI

On `max-width: 768px` the sidebar is **hidden entirely** (`display: none !important`).
Navigation is handled exclusively by the **bottom navigation bar**.

### Bottom Nav Profile Popup
The rightmost item in the bottom nav is an **avatar button** (`bottom-nav-profile-btn`).
Tapping it opens a slide-up popup (`profile-popup`) with:
- User name, role, station
- "โปรไฟล์ของฉัน" → navigates to `/profile`
- "ออกจากระบบ" → Swal confirm → logout

The popup uses a backdrop overlay (`profile-popup-overlay`).
Both elements are `display: none` on desktop and activated via `@media (max-width: 768px)`.

### Header on mobile
- Hamburger button: `display: none` on mobile (sidebar not used)
- `header-user-cluster` (avatar + logout): `display: none !important` on mobile — replaced by bottom nav popup

---

## History Page — Filter Modal

Filters are behind a **"ตั้งค่าการกรอง"** button (magnifying glass icon).

**Draft pattern:** Opening the modal copies current filter state into draft state.
Filters only apply when "ใช้ตัวกรอง" is clicked. Closing without confirming discards changes.

**Room filter values:** Use keys `'IPD'` / `'OPD'` (not raw Thai location strings).
The filter logic maps these to actual location values:
```typescript
if (roomFilter === 'IPD') {
  // matches: 'ห้องจ่ายยาผู้ป่วยในศัลยกรรม' OR 'ห้องยาในศัลยกรรม' (legacy)
} else if (roomFilter === 'OPD') {
  // matches: 'ห้องจ่ายยาผู้ป่วยนอก'
}
```

> ⚠️ Do NOT change option values back to raw Thai strings — it caused a bug where
> IPD Surg filter returned no results because `StationSelectionPage` saves
> `'ห้องจ่ายยาผู้ป่วยในศัลยกรรม'` but the old dropdown had `'ห้องยาในศัลยกรรม'`.

**Active filter chips** appear below the card header. Each chip has an `×` to remove it individually. "ล้างทั้งหมด" resets all filters immediately (bypasses draft).

---

## Formula Display — short_name

Both Dashboard (recent list) and History (table + Excel export) display `short_name` instead of `formula_name`:

```typescript
const shortNameMap = Object.fromEntries(
  formulas.map(f => [f.name, f.short_name ?? f.name])
);
// usage: shortNameMap[p.formula_name] ?? p.formula_name
```

The FormulasPage list table also shows `short_name` as the primary label with `name` below it.

---

## Common Pitfalls

1. **`Math.max(...arr)`** is fine for hundreds of IDs — not a concern at current scale.
2. **HashRouter `#/path`** — all links and redirects must use React Router `<NavLink>` / `navigate()`. Direct `window.location` changes break the router.
3. **`expiry_days < 0` means hours** — `addDays(date, -4)` adds 4 hours and returns a full ISO string. Display via `fmtDate()` still shows a readable date/time.
4. **Room filter values in HistoryPage** — use `'IPD'`/`'OPD'` as option values, never raw Thai location strings. See History Page — Filter Modal section above.
5. **`toDateOnly()` in `usePreps.ts`** — normalizes any date string to `YYYY-MM-DD` in local timezone. Keep this; legacy migrated data may contain UTC ISO strings.
