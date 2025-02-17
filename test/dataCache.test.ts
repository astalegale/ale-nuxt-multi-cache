import { fileURLToPath } from 'node:url'
import { setup, $fetch } from '@nuxt/test-utils'
import { describe, expect, test } from 'vitest'
import { NuxtMultiCacheOptions } from '../src/runtime/types'
import purgeAll from './__helpers__/purgeAll'
import purgeByKey from './__helpers__/purgeByKey'

describe('The data cache feature', async () => {
  const multiCache: NuxtMultiCacheOptions = {
    component: {
      enabled: true,
    },
    data: {
      enabled: true,
    },
    route: {
      enabled: true,
    },
    cdn: {
      enabled: true,
    },
    api: {
      enabled: true,
      authorization: false,
      cacheTagInvalidationDelay: 5000,
    },
  }
  const nuxtConfig: any = {
    multiCache,
  }
  await setup({
    server: true,
    logLevel: 0,
    runner: 'vitest',
    build: true,
    // browser: true,
    rootDir: fileURLToPath(new URL('../playground', import.meta.url)),
    nuxtConfig,
  })

  test('Works on a page', async () => {
    await purgeAll()

    // First call puts it into cache.
    const first = await $fetch('/dataCache', {
      method: 'get',
    })

    // Second call should get it from cache.
    const second = await $fetch('/dataCache', {
      method: 'get',
    })

    expect(first).toEqual(second)
  })

  test('Works in a server handler', async () => {
    await purgeAll()

    // First call puts it into cache.
    const first = await $fetch('/api/dataCache', {
      method: 'get',
    })

    // Second call should get it from cache.
    const second = await $fetch('/api/dataCache', {
      method: 'get',
    })

    expect(first).toEqual(second)
  })

  test('has its cache entries invalidated correctly', async () => {
    await purgeAll()

    // First call puts it into cache.
    const first = await $fetch('/api/dataCache', {
      method: 'get',
    })

    // Second call should get it from cache.
    const second = await $fetch('/api/dataCache', {
      method: 'get',
    })

    expect(first).toEqual(second)

    await purgeByKey('data', 'apiDataCacheTest')

    // Third call should not use cached entry.
    const third = await $fetch('/api/dataCache', {
      method: 'get',
    })

    expect(third).not.toEqual(first)
    expect(third).not.toEqual(second)
  })
})
