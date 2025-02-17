import { fileURLToPath } from 'url'
import type { NuxtModule } from '@nuxt/schema'
import { defu } from 'defu'
import {
  addServerHandler,
  createResolver,
  defineNuxtModule,
  addComponent,
  addImports,
} from '@nuxt/kit'
import { NuxtMultiCacheOptions } from './runtime/types'
import {
  defaultOptions,
  DEFAULT_CDN_CONTROL_HEADER,
  DEFAULT_CDN_TAG_HEADER,
} from './runtime/settings'

// Nuxt needs this.
export type ModuleOptions = NuxtMultiCacheOptions
export type ModuleHooks = {}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-multi-cache',
    configKey: 'multiCache',
    version: '2.0.1',
    compatibility: {
      nuxt: '^3.0.0',
    },
  },
  defaults: defaultOptions as any,
  async setup(passedOptions, nuxt) {
    const options = defu({}, passedOptions, {}) as ModuleOptions
    const { resolve } = createResolver(import.meta.url)
    const rootDir = nuxt.options.rootDir

    const runtimeDir = fileURLToPath(new URL('./runtime', import.meta.url))
    nuxt.options.build.transpile.push(runtimeDir)
    nuxt.options.runtimeConfig.multiCache = {
      rootDir,
      cdn: {
        cacheControlHeader:
          options.cdn?.cacheControlHeader || DEFAULT_CDN_CONTROL_HEADER,
        cacheTagHeader: options.cdn?.cacheTagHeader || DEFAULT_CDN_TAG_HEADER,
      },
    }

    // @TODO: Why is this needed?!
    nuxt.hook('nitro:config', (nitroConfig) => {
      nitroConfig.externals = defu(
        typeof nitroConfig.externals === 'object' ? nitroConfig.externals : {},
        {
          inline: [resolve('./runtime')],
        },
      )
    })

    // Add composables.
    if (options.data) {
      addImports({
        from: resolve('./runtime/composables/useDataCache'),
        name: 'useDataCache',
      })
    }
    if (options.route) {
      addImports({
        from: resolve('./runtime/composables/useRouteCache'),
        name: 'useRouteCache',
      })
    }
    if (options.cdn) {
      addImports({
        from: resolve('./runtime/composables/useCDNHeaders'),
        name: 'useCDNHeaders',
      })
    }

    nuxt.options.alias['#nuxt-multi-cache/composables'] = resolve(
      'runtime/composables/index',
    )

    // Add RenderCacheable component if feature is enabled.
    if (options.component) {
      await addComponent({
        filePath: resolve('./runtime/components/RenderCacheable/index'),
        name: 'RenderCacheable',
        global: true,
      })
    }

    if (options.component || options.route || options.data) {
      // Add the event handler that attaches the SSR context object to the
      // request event.
      addServerHandler({
        handler: resolve('./runtime/serverHandler/cacheContext'),
        middleware: true,
      })
    }

    // Adds the CDN helper to the event context.
    if (options.cdn?.enabled) {
      addServerHandler({
        handler: resolve('./runtime/serverHandler/cdnHeaders'),
        middleware: true,
      })
    }

    // Serves cached routes.
    if (options.route?.enabled) {
      addServerHandler({
        handler: resolve('./runtime/serverHandler/serveCachedRoute'),
      })
    }

    // Hooks into sending the response and adds route to cache and adds CDN
    // headers.
    if (options.cdn?.enabled || options.route?.enabled) {
      addServerHandler({
        handler: resolve('./runtime/serverHandler/responseSend'),
      })
    }

    // Add cache management API if enabled.
    if (options.api?.enabled) {
      // Prefix is defined in default config.
      const apiPrefix = options.api.prefix as string

      // The prefix for the internal cache management routes.
      const prefix = (path: string) => apiPrefix + '/' + path

      // Add the server API handlers for cache management.
      addServerHandler({
        handler: resolve('./runtime/serverHandler/api/purgeAll'),
        method: 'post',
        route: prefix('purge/all'),
      })
      addServerHandler({
        handler: resolve('./runtime/serverHandler/api/purgeTags'),
        method: 'post',
        route: prefix('purge/tags'),
      })
      addServerHandler({
        handler: resolve('./runtime/serverHandler/api/purgeItem'),
        method: 'post',
        route: prefix('purge/:cacheName'),
      })
      addServerHandler({
        handler: resolve('./runtime/serverHandler/api/stats'),
        method: 'get',
        route: prefix('stats/:cacheName'),
      })
      addServerHandler({
        handler: resolve('./runtime/serverHandler/api/inspectItem'),
        method: 'get',
        route: prefix('inspect/:cacheName'),
      })
    }
  },
}) as NuxtModule<ModuleOptions>
