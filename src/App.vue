<script setup lang="ts">
// No script needed for now
</script>

<template>
  <ErrorBoundary>
    <ReloadPrompt />
    <router-view v-slot="{ Component }">
      <keep-alive>
        <component :is="Component" v-if="$route.meta?.keepAlive" :key="$route.path" />
      </keep-alive>
      <!-- please keep attention to the key, querystring change will not trigger component unmount -->
      <component :is="Component" v-if="!$route.meta?.keepAlive" :key="$route.path" />
    </router-view>
  </ErrorBoundary>
</template>

<style>
/* Global transitions or styles can go here */
#app {
  height: 100vh;
}
</style>
