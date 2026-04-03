interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
  promise?: Promise<T>;
}

const DEFAULT_STALE_MS = 5 * 60 * 1000;
const cache = new Map<string, CacheEntry<unknown>>();

export function getCachedResource<T>(key: string): T | undefined {
  return cache.get(key)?.data as T | undefined;
}

export async function loadCachedResource<T>(
  key: string,
  loader: () => Promise<T>,
  options?: { force?: boolean; staleMs?: number },
): Promise<T> {
  const force = options?.force ?? false;
  const staleMs = options?.staleMs ?? DEFAULT_STALE_MS;
  const entry = cache.get(key) as CacheEntry<T> | undefined;

  if (!force && entry) {
    if (entry.promise) return entry.promise;
    if (Date.now() - entry.fetchedAt < staleMs) return entry.data;
  }

  const promise = loader()
    .then((data) => {
      cache.set(key, { data, fetchedAt: Date.now() });
      return data;
    })
    .finally(() => {
      const current = cache.get(key) as CacheEntry<T> | undefined;
      if (current?.promise) {
        cache.set(key, {
          data: current.data,
          fetchedAt: current.fetchedAt,
        });
      }
    });

  cache.set(key, {
    data: entry?.data as T,
    fetchedAt: entry?.fetchedAt ?? 0,
    promise,
  });

  return promise;
}
