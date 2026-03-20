<template>
  <div class="weather-controls">
    <div class="weather-title">
      <span class="weather-icon">🌤️</span>
      <span>天气效果</span>
    </div>
    
    <div class="weather-buttons">
      <button
        v-for="weather in weatherOptions"
        :key="weather.type"
        class="weather-btn"
        :class="{ active: currentWeather === weather.type }"
        @click="selectWeather(weather.type)"
        :disabled="isTransitioning"
      >
        <span class="btn-icon">{{ weather.icon }}</span>
        <span class="btn-label">{{ weather.label }}</span>
      </button>
    </div>
    
    <div class="weather-info" v-if="currentConfig">
      <div class="info-item">
        <span class="info-label">环境光:</span>
        <span class="info-value">{{ Math.round(currentConfig.ambientIntensity * 100) }}%</span>
        <div class="info-bar">
          <div class="info-fill" :style="{ width: currentConfig.ambientIntensity * 100 + '%', background: '#' + currentConfig.ambientColor.toString(16).padStart(6, '0') }"></div>
        </div>
      </div>
      <div class="info-item">
        <span class="info-label">室内灯:</span>
        <span class="info-value">{{ Math.round(currentConfig.indoorLightIntensity * 100) }}%</span>
        <div class="info-bar">
          <div class="info-fill warm" :style="{ width: currentConfig.indoorLightIntensity * 100 + '%' }"></div>
        </div>
      </div>
      <div class="info-item">
        <span class="info-label">雾气:</span>
        <span class="info-value">{{ Math.round(currentConfig.fogDensity * 1000) }}%</span>
        <div class="info-bar">
          <div class="info-fill fog" :style="{ width: Math.min(currentConfig.fogDensity * 5000, 100) + '%' }"></div>
        </div>
      </div>
    </div>
    
    <div class="transition-indicator" v-if="isTransitioning">
      <div class="spinner"></div>
      <span>切换中...</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { WeatherType, WeatherConfig } from '../composables/useWeatherEffects';

interface WeatherOption {
  type: WeatherType;
  label: string;
  icon: string;
}

const weatherOptions: WeatherOption[] = [
  { type: 'sunny', label: '晴天', icon: '☀️' },
  { type: 'cloudy', label: '多云', icon: '☁️' },
  { type: 'rainy', label: '雨天', icon: '🌧️' },
  { type: 'night', label: '夜晚', icon: '🌙' },
];

const props = defineProps<{
  currentWeather: WeatherType;
  currentConfig: WeatherConfig | null;
  isTransitioning: boolean;
}>();

const emit = defineEmits<{
  (e: 'change', weather: WeatherType): void;
}>();

function selectWeather(weather: WeatherType) {
  if (props.isTransitioning || props.currentWeather === weather) return;
  emit('change', weather);
}
</script>

<style scoped>
.weather-controls {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(20, 20, 35, 0.9);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 16px;
  min-width: 200px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  z-index: 100;
}

.weather-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.weather-icon {
  font-size: 18px;
}

.weather-buttons {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.weather-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  color: rgba(255, 255, 255, 0.7);
}

.weather-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

.weather-btn.active {
  background: rgba(99, 102, 241, 0.3);
  border-color: rgba(99, 102, 241, 0.5);
  color: #fff;
}

.weather-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon {
  font-size: 24px;
}

.btn-label {
  font-size: 12px;
  font-weight: 500;
}

.weather-info {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.info-label {
  color: rgba(255, 255, 255, 0.5);
  min-width: 50px;
}

.info-value {
  color: rgba(255, 255, 255, 0.8);
  min-width: 35px;
  text-align: right;
}

.info-bar {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.info-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.5s ease;
}

.info-fill.warm {
  background: linear-gradient(90deg, #ffaa66, #ffdd88);
}

.info-fill.fog {
  background: linear-gradient(90deg, #718096, #a0aec0);
}

.transition-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: rgba(99, 102, 241, 0.8);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
