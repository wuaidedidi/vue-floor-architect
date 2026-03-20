<template>
  <div class="app-container">
    <WeatherScene />
  </div>
</template>

<script setup lang="ts">
import WeatherScene from './components/WeatherScene.vue'
</script>

<style scoped>
.app-container {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
</style>
