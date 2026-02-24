<template>
  <div class="bg-gray-50 flex flex-col min-h-screen">
    <header class="px-6 py-4 bg-white bg-white/80 w-full shadow-sm top-0 fixed z-10 backdrop-blur-md">
      <div class="mx-auto flex max-w-7xl items-center justify-between">
        <div class="flex gap-2 items-center">
          <div class="i-logos:vue h-8 w-8" />
          <h1 class="text-xl text-transparent font-bold from-green-600 to-blue-600 bg-gradient-to-r bg-clip-text">
            Vue Starter
          </h1>
        </div>
        <nav class="text-sm text-gray-600 font-medium flex gap-6">
          <router-link to="/" class="transition-colors hover:text-green-600">
            Home
          </router-link>
          <a href="https://github.com/powerfulyang/vue-starter-template" target="_blank" class="flex gap-1 transition-colors items-center hover:text-green-600">
            <div class="i-carbon:logo-github h-4 w-4" />
            GitHub
          </a>
        </nav>
      </div>
    </header>

    <main class="mt-16 pb-12 pt-6 flex-1">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>

    <footer class="px-6 py-8 border-t border-gray-100 bg-white">
      <div class="text-sm text-gray-500 mx-auto text-center max-w-7xl">
        <p>© {{ new Date().getFullYear() }} Vue Starter Template. Built with ❤️</p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
