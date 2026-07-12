import { ResponseUtils } from "./utils";

const CACHE_PREFIX = "motajs-service-worker:";
const CACHE_VERSION = `${import.meta.env.PACKAGE_VERSION ?? "1"}:${import.meta.env.VITE_DEPLOY_REVISION ?? "dev"}`;
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;
const fetchCachePromise = caches.open(CACHE_NAME);

const fetchAndUpdate = async (request: Request) => {
  const networkResponse = await fetch(request);
  if (networkResponse.ok) {
    const fetchCache = await fetchCachePromise;
    fetchCache.put(request, networkResponse.clone());
  }
  return networkResponse;
};

const matchCache = async (request: Request) => {
  const fetchCache = await fetchCachePromise;
  return await fetchCache.match(request);
};

export const networkFirst = async (request: Request) => {
  return fetchAndUpdate(request)
    .catch(async () => {
      const cachedResponse = await matchCache(request);
      return cachedResponse ?? Response.error();
    });
};

export const cacheFirstWithRefresh = async (request: Request) => {
  const fetchResponsePromise = fetchAndUpdate(request);
  const cachedResponse = await matchCache(request);
  return cachedResponse ?? fetchResponsePromise.catch(() => Response.error());
};

export const cacheFirst = async (request: Request) => {
  const cachedResponse = await matchCache(request);
  return cachedResponse ?? fetchAndUpdate(request).catch(() => ResponseUtils.create404());
};

export const cleanupCaches = async () => {
  const names = await caches.keys();
  await Promise.all(names
    .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
    .map((name) => caches.delete(name)));
};
