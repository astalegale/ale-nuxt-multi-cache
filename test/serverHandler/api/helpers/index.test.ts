import { describe, expect, test, vi } from 'vitest'
import {
  checkAuth,
  getCacheInstance,
} from './../../../../src/runtime/serverHandler/api/helpers/index'

vi.mock('#imports', () => {
  return {
    useRuntimeConfig: () => {
      return {
        multiCache: {},
      }
    },
  }
})

vi.mock('./../../../../src/runtime/serverHandler/helpers/index', () => {
  return {
    getModuleConfig: () => {
      return {
        api: {
          authorization: false,
        },
      }
    },
  }
})

describe('checkAuth', () => {
  test('Skips auth check if defined in config', async () => {
    expect(
      await checkAuth({} as any, {
        api: {
          authorization: false,
        },
      }),
    ).toBeUndefined()
  })

  test('Loads config if not provided.', async () => {
    expect(await checkAuth({} as any)).toBeUndefined()
  })

  test('Performs custom auth check provided in config', async () => {
    expect(
      await checkAuth({} as any, {
        api: {
          authorization: () => {
            return Promise.resolve(true)
          },
        },
      }),
    ).toBeUndefined()

    expect(
      checkAuth({} as any, {
        api: {
          authorization: () => {
            return Promise.resolve(false)
          },
        },
      }),
    ).rejects.toThrowErrorMatchingInlineSnapshot('"Unauthorized"')
  })

  test('Performs auth check via header token', async () => {
    expect(
      await checkAuth(
        {
          node: {
            req: {
              headers: {
                'x-nuxt-multi-cache-token': 'token',
              },
            },
          },
        } as any,
        {
          api: {
            authorization: 'token',
          },
        },
      ),
    ).toBeUndefined()

    expect(
      checkAuth(
        {
          node: {
            req: {
              headers: {
                'x-nuxt-multi-cache-token': 'invalid_token',
              },
            },
          },
        } as any,
        {
          api: {
            authorization: 'token',
          },
        },
      ),
    ).rejects.toThrowErrorMatchingInlineSnapshot('"Unauthorized"')

    expect(
      checkAuth(
        {
          node: {
            req: {
              headers: {
                'x-nuxt-multi-cache-token': '',
              },
            },
          },
        } as any,
        {
          api: {
            authorization: 'token',
          },
        },
      ),
    ).rejects.toThrowErrorMatchingInlineSnapshot('"Unauthorized"')
  })

  test('Throws error if no authorization config is provided.', () => {
    expect(
      checkAuth(
        {} as any,
        {
          api: {},
        } as any,
      ),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      '"No authorization configuration option provided."',
    )
  })
})

describe('getCacheInstance', () => {
  test('Returns the cache instance from the event.', () => {
    expect(
      getCacheInstance({
        context: {
          __MULTI_CACHE: {
            data: {},
          },
          params: {
            cacheName: 'data',
          },
        },
      } as any),
    ).toEqual({})

    expect(() =>
      getCacheInstance({
        context: {
          params: {
            cacheName: 'data',
          },
        },
      } as any),
    ).toThrowErrorMatchingInlineSnapshot('"Failed to load cache context."')

    expect(() =>
      getCacheInstance({
        context: {
          __MULTI_CACHE: {
            data: {},
          },
          params: {
            cacheName: 'invalid_cache',
          },
        },
      } as any),
    ).toThrowErrorMatchingInlineSnapshot(
      '"The given cache \\"invalid_cache\\" is not available."',
    )
  })
})
