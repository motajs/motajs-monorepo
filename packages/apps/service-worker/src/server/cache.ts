import { ResponseUtils } from "./utils";

const fetchCachePromise = caches.open("fetch");

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
