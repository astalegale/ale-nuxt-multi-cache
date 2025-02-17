import { fileURLToPath } from 'node:url'
import { setup, $fetch } from '@nuxt/test-utils'
import { describe, expect, test } from 'vitest'
import { NuxtMultiCacheOptions } from '../src/runtime/types'
import purgeAll from './__helpers__/purgeAll'
import { sleep } from './__helpers__'

describe('The component cache feature', async () => {
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

  test('Caches a component', async () => {
    await purgeAll()
    // First call puts it into cache.
    const htmlBefore = await $fetch('/test?v=foobar', {
      method: 'get',
    })
    expect(htmlBefore).toContain('The query value is: foobar')

    // Second call gets it from cache with the old query value.
    const htmlAfter = await $fetch('/test?v=totally-new-value', {
      method: 'get',
    })
    expect(htmlAfter).toContain('The query value is: foobar')
  })

  test('Rerenders purged components', async () => {
    await purgeAll()

    // First call puts it into cache.
    expect(await $fetch('/test?v=foobar')).toContain(
      'The query value is: foobar',
    )

    // Second call gets it from cache with the old query value.
    expect(await $fetch('/test?v=refreshed')).toContain(
      'The query value is: foobar',
    )

    // Remove component from cache.
    await $fetch('/__nuxt_multi_cache/purge/component', {
      method: 'post',
      body: ['QueryValue::one'],
    })

    // Third call should render it again with the new value.
    expect(await $fetch('/test?v=refreshed')).toContain(
      'The query value is: refreshed',
    )
  })

  test('Purges components by cache tags', async () => {
    await purgeAll()

    // First call puts it into cache.
    expect(await $fetch('/test?v=foobar')).toContain(
      'The query value is: foobar',
    )

    // Second call gets it from cache with the old query value.
    expect(await $fetch('/test?v=refreshed')).toContain(
      'The query value is: foobar',
    )

    // Remove component from cache by invalidating tag.
    await $fetch('/__nuxt_multi_cache/purge/tags', {
      method: 'post',
      body: ['tag1'],
    })

    // Third call gets it from cache with the old query value because the delay
    // has not yet passed.
    expect(await $fetch('/test?v=refreshed')).toContain(
      'The query value is: foobar',
    )

    await sleep(6000)

    // After the delay, component is rendered again.
    expect(await $fetch('/test?v=refreshed')).toContain(
      'The query value is: refreshed',
    )
  }, 9000)

  test('Respects noCache prop to disable caching', async () => {
    await purgeAll()

    // First call should not put it in cache.
    expect(await $fetch('/noCache?v=one')).toContain('The query value is: one')

    // Second call contains rerendered markup.
    expect(await $fetch('/noCache?v=two')).toContain('The query value is: two')
  })

  test('Caches payload along component if asyncDataKeys provided.', async () => {
    await purgeAll()

    const first = await $fetch('/payloadData')
    // Component is rendered correctly in first time.
    expect(first).toContain(
      '<div id="with-async-data">This is data from the API.</div>',
    )
    expect(first).toContain(`withAsyncData:{api:"This is data from the API."`)

    // Even after caching the page contains the payload.
    const second = await $fetch('/payloadData')
    // Component is rendered correctly.
    expect(first).toContain(
      '<div id="with-async-data">This is data from the API.</div>',
    )
    expect(first).toContain(`withAsyncData:{api:"This is data from the API."`)
  })
})
