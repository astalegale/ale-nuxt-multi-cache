import { useSSRContext } from 'vue'
import type { H3Event } from 'h3'
import type { CacheItem } from './../types'
import {
  getExpiresValue,
  getMultiCacheContext,
  getCacheKeyWithPrefix,
  isExpired,
} from './../helpers/server'

type AddToCacheMethod<T> = (
  data: T,
  tags?: string[],
  maxAge?: number,
) => Promise<void>

type CallbackContext<T> = {
  addToCache: AddToCacheMethod<T>
  value?: T
  cacheTags: string[]
  expires?: number
}

export function useDataCache<T>(
  key: string,
  providedEvent?: H3Event,
): Promise<CallbackContext<T>> {
  // Dummy argument for the callback used when something goes wrong accessing
  // the cache or on client side.
  const dummy: CallbackContext<T> = {
    addToCache: (v: T) => {
      return Promise.resolve()
    },
    cacheTags: [] as string[],
  }

  // Code only available on server side.
  if (process.client) {
    return Promise.resolve(dummy)
  }

  try {
    const event: H3Event = (() => {
      // Event provided by user.
      if (providedEvent) {
        return providedEvent
      }

      // SSR context should exist at this point, but TS doesn't know that.
      const ssrContext = useSSRContext()
      if (ssrContext) {
        return ssrContext.event
      }
    })()

    const multiCache = getMultiCacheContext(event)
    // Get the cache storage. If the module is disabled this will be
    // undefined.
    if (!multiCache?.data) {
      return Promise.resolve(dummy)
    }

    // Try to get the item from cache.
    const fullKey = getCacheKeyWithPrefix(multiCache.cacheKeyPrefix, key)
    return multiCache.data.getItem(fullKey).then((v: any) => {
      const item = v as CacheItem | null
      const addToCache: AddToCacheMethod<T> = (
        data: T,
        cacheTags: string[] = [],
        maxAge?: number,
      ) => {
        const item: CacheItem = { data: data as any, cacheTags }
        if (maxAge) {
          item.expires = getExpiresValue(maxAge)
        }
        return multiCache.data!.setItem(fullKey, item)
      }

      if (item && !isExpired(item)) {
        return {
          addToCache,
          // Extract the value. If the item was stored along its cache tags, it
          // will be an object with a cacheTags property.
          value: item.data as T,
          cacheTags: item.cacheTags || [],
          expires: item.expires,
        }
      }

      // Return a dummy item.
      return {
        addToCache,
        cacheTags: [],
      }
    })
  } catch (e) {
    if (e instanceof Error) {
      // For some reason cache is not available.
      console.debug(e.message)
    }
  }

  // Return the dummy object to be used in client bundles.
  return Promise.resolve(dummy)
}
