import { describe, expect, test, vi } from 'vitest'
import serveCachedRoute from './../../src/runtime/serverHandler/serveCachedRoute'

const consoleSpy = vi.spyOn(global.console, 'debug')

describe('serveCachedRoutes server handler', () => {
  test('Returns if event.path is empty.', async () => {
    const event: any = {
      context: {},
    }
    expect(await serveCachedRoute(event)).toBeUndefined()
  })

  test('Returns if route cache is not enabled.', async () => {
    const event: any = {
      path: '/test',
      context: {
        __MULTI_CACHE: {},
      },
    }
    expect(await serveCachedRoute(event)).toBeUndefined()
  })

  test('Gets a route from cache.', async () => {
    const event: any = {
      path: '/test',
      context: {
        __MULTI_CACHE: {
          route: {
            getItem(_path: string) {
              return Promise.resolve({ data: '<html></html>' })
            },
          },
        },
      },
    }
    expect(await serveCachedRoute(event)).toEqual('<html></html>')
  })

  test('Checks the cache entry is an object.', async () => {
    const event: any = {
      path: '/test',
      context: {
        __MULTI_CACHE: {
          route: {
            getItem(_path: string) {
              return Promise.resolve('<html></html>')
            },
          },
        },
      },
    }
    expect(await serveCachedRoute(event)).toBeUndefined()
  })

  test('Checks if the cache entry is expired.', async () => {
    const event: any = {
      path: '/test',
      context: {
        __MULTI_CACHE: {
          route: {
            getItem(_path: string) {
              return Promise.resolve({ data: '<html></html>', expires: 1000 })
            },
          },
        },
      },
    }
    expect(await serveCachedRoute(event)).toBeUndefined()
  })

  test('Sets response headers from the cached routes.', async () => {
    const event: any = {
      path: '/test',
      node: {
        res: {
          headers: {} as Record<string, any>,
          setHeader(key: string, value: string) {
            this.headers[key] = value
          },
        },
      },
      context: {
        __MULTI_CACHE: {
          route: {
            getItem(_path: string) {
              return Promise.resolve({
                data: '<html></html>',
                headers: {
                  'x-test': 'foobar',
                },
              })
            },
          },
        },
      },
    }
    await serveCachedRoute(event)
    expect(event.node.res.headers).toMatchInlineSnapshot(`
      {
        "x-test": "foobar",
      }
    `)
  })

  test('Sets status code from cached routes.', async () => {
    const event: any = {
      path: '/test',
      node: {
        res: {},
      },
      context: {
        __MULTI_CACHE: {
          route: {
            getItem(_path: string) {
              return Promise.resolve({ data: '<html></html>', statusCode: 301 })
            },
          },
        },
      },
    }
    await serveCachedRoute(event)

    expect(event.node.res.statusCode).toEqual(301)
  })

  test('Catches errors happening when loading item from cache.', async () => {
    const event: any = {
      path: '/test',
      node: {
        res: {},
      },
      context: {
        __MULTI_CACHE: {
          route: {
            getItem(_path: string) {
              throw new Error('Failed to get item from cache.')
            },
          },
        },
      },
    }
    expect(await serveCachedRoute(event)).toBeUndefined()
    expect(consoleSpy).toHaveBeenCalledWith('Failed to get item from cache.')
  })
})
