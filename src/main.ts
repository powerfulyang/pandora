import { setupLayouts } from 'virtual:generated-layouts'
import { ViteSSG } from 'vite-ssg'
import { routes } from 'vue-router/auto-routes'
import { setupAssets } from '@/assets'
import { setupPlugins } from '@/plugins'
import { setupRouter } from '@/router'
import { setupStore } from '@/stores'
import { setupVueQuery } from '@/vue-query/setupVueQuery'
import App from './App.vue'
import 'reflect-metadata'

setupPlugins()
setupAssets()

export const createApp = ViteSSG(
  App,
  {
    routes: setupLayouts([...routes]),
    base: import.meta.env.BASE_URL,
  },
  ({ app, router }) => {
    // Global Error Handling
    app.config.errorHandler = (err, instance, info) => {
      console.error('[@Error]', err)
      console.log('[@Instance]', instance)
      console.log('[@Info]', info)
    }

    setupVueQuery(app)
    setupStore(app)
    setupRouter(router)
  },
)
