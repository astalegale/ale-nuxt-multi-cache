import { defineEventHandler, setResponseHeaders } from 'h3'
import {
  getMultiCacheContext,
  getCacheKeyWithPrefix,
} from './../helpers/server'
import { RouteCacheItem } from './../types'

/**
 * Route cache event handler. Returns a cached response if available.
 */
export default defineEventHandler(async (event) => {
  if (!event.path) {
    return
  }

  const multiCache = getMultiCacheContext(event)
  if (!multiCache?.route) {
    return
  }

  try {
    // Check if there is a cache entry for this path.
    const fullKey = getCacheKeyWithPrefix(multiCache.cacheKeyPrefix, event.path)
    const cached = await multiCache.route.getItem(fullKey)
    if (cached && typeof cached === 'object') {
      const { data, headers, statusCode, expires } = cached as RouteCacheItem

      // Check if the item is stale.
      if (expires) {
        const now = Date.now() / 1000
        if (now >= expires) {
          return
        }
      }

      if (headers) {
        setResponseHeaders(event, headers)
      }
      if (statusCode) {
        event.node.res.statusCode = statusCode
      }
      return data
    }
  } catch (e) {
    if (e instanceof Error) {
      console.debug(e.message)
    }
  }
})
