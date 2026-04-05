# CLAUDE.md — UTTH ED-Extemp

Project context for AI-assisted development. Read this before making changes.

---

## What This Project Is

A **Progressive Web App** for the Pharmacy Department of Uttaradit Hospital to record, track, and report the production of extemporaneous (custom-compounded) eye drops.

- **Frontend:** React 19 + TypeScript + Vite — hosted on GitHub Pages
- **Backend:** Google Apps Script (`gas/Code.gs`) — serverless, deployed separately
- **Database:** Google Sheets — three sheets: `users`, `formulas`, `preps`

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
| `gas/Code.gs` | **Entire backend** — GAS doGet/doPost handler, CRUD for users/formulas/preps, date normalization, lock handling, formula cache |
| `src/lib/api.ts` | All HTTP calls to GAS — every action is a GET request with query params |
| `src/lib/resourceCache.ts` | In-memory cache — `getCachedResource`, `setCachedResource`, `invalidateCachedResource`, `loadCachedResource` (5 min stale) |
| `src/hooks/usePreps.ts` | Fetch/create/update/delete preps — optimistic updates, `toDateOnly()` normalization |
| `src/hooks/useFormulas.ts` | Fetch/CRUD formulas — cached in client |
| `src/hooks/useUsers.ts` | Fetch/CRUD users |
| `src/hooks/useGasInit.ts` | Pings GAS once on boot to auto-create sheets |
| `src/hooks/useAppWarmup.ts` | Pre-fetches formulas on startup |
| `src/contexts/AuthContext.tsx` | Login, logout, station selection — session in `localStorage` key `ed-extemp-session`, 1-hour TTL |
| `src/pages/DashboardPage.tsx` | Central hub: month/location filter, 6 stat cards, recent list, formula summary, workload analysis + Export Excel |
| `src/pages/HistoryPage.tsx` | Full audit log with search, filters, note column, pagination, Export Excel |
| `src/pages/PreparePage.tsx` | Record a new prep — auto lot number, label printing |
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

## GAS Backend — Critical Notes

### Every API call is a GET request
```typescript
// All calls go through gasGet() in src/lib/api.ts
// Data is JSON.stringify'd into the 'data' query param
GET https://script.google.com/.../exec?action=createPrep&data={"formula_id":1,...}
```

### Deployment is manual
Pushing to GitHub does **NOT** redeploy GAS. After any change to `gas/Code.gs`:
1. Open [script.google.com](https://script.google.com)
2. **Deploy → Manage deployments → ✏️ Edit → New version → Deploy**

The Web App URL never changes. Always remind the user to redeploy after GAS changes.

### Google Sheets auto-converts date strings to Date objects
When GAS writes `"2026-04-04"` via `appendRow`, Sheets converts it to a Date object.
When `getValues()` reads it back, GAS receives a JS `Date` object, NOT a string.
`JSON.stringify(Date)` produces a UTC ISO string: `"2026-04-03T17:00:00.000Z"` (Bangkok midnight = previous UTC day).

**Fix — two layers:**
1. **GAS** `normalizeCell_()` in `getAll_()` — uses `Utilities.formatDate(raw, tz, 'yyyy-MM-dd')` for `date`/`expiry_date` fields, and `raw.toISOString()` for `created_at`.
2. **Frontend** `toDateOnly()` in `usePreps.ts` — converts any ISO datetime string to YYYY-MM-DD in local timezone as a safety layer.

Never remove either layer. This was a hard-to-find bug.

### Lock safety in create_/update_/remove_
```javascript
// CORRECT pattern — tryLock() returns false if lock not acquired
// Calling releaseLock() without a lock throws LockTimeoutException
const lockAcquired = lock.tryLock(10000);
try { ... } finally { if (lockAcquired) lock.releaseLock(); }
```

### Formula cache
`getFormulas` → cached in `CacheService` for 1 hour (key: `formulas_v1`).
Cache is invalidated on every `createFormula`, `updateFormula`, `deleteFormula`.

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
// createPrep returns: true (success) | string (error message from GAS)
const result = await createPrep(data);
if (result === true) {
  toast('สำเร็จ', 'success');
} else {
  toast(result, 'error');   // result is the actual GAS error string
}

// Inside usePreps — after GAS confirms:
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
- On restore: fetches fresh user data from GAS via `getUserById`
- **Station selection** is required after login (`RequireStation` guard)

---

## CI/CD

```yaml
# .github/workflows/deploy-pages.yml
# Trigger: push to main OR manual workflow_dispatch
# Steps: checkout → node 20 → npm ci → npm run build → upload artifact → deploy Pages
```

> ⚠️ The workflow does NOT pass `VITE_GAS_URL` to the build step.
> If the deployed app loses the GAS URL, add it as a **repository variable**
> (`Settings → Secrets and variables → Actions → Variables → VITE_GAS_URL`)
> and add `env: VITE_GAS_URL: ${{ vars.VITE_GAS_URL }}` to the build step.

---

## Common Pitfalls

1. **After any `gas/Code.gs` change** → remind user to manually redeploy GAS.
2. **Never use `String(rawDate)` on a Sheets Date value** — produces non-comparable locale string. Always use `toDateOnly()` (frontend) or `Utilities.formatDate()` (GAS).
3. **`Math.max(...arr)`** is fine for hundreds of IDs but would stack-overflow on 125k+ items — not a concern at current scale.
4. **HashRouter `#/path`** — all links and redirects must use React Router `<NavLink>` / `navigate()`. Direct `window.location` changes break the router.
5. **GAS URL query string limit** — all API calls are GET requests. Very long `note` fields or Thai characters are URL-encoded and handled fine, but keep data payloads reasonable.
6. **`expiry_days < 0` means hours** — `addDays(date, -4)` adds 4 hours and returns a full ISO string. Display via `fmtDate()` still shows a readable date/time.

---

## Google Sheets Column Headers (must match exactly)

```javascript
users:    ['id','name','pha_id','password','role','active','must_change_password','profile_image','created_at']
formulas: ['id','code','name','short_name','description','concentration','expiry_days','category','price','storage','ingredients','method','short_prep','package_size','created_at']
preps:    ['id','formula_id','formula_name','concentration','mode','target','hn','patient_name','dest_room','lot_no','date','expiry_date','qty','note','prepared_by','user_pha_id','location','created_at']
```

`sanitizeData_()` in GAS discards any field not in the header list — this is intentional to prevent arbitrary column injection.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_GAS_URL` | ✅ | Full GAS Web App URL — baked into the build at compile time |

Set in `.env` for local dev. Set as a GitHub Actions Variable for CI deployments.
