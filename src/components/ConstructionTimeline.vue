<template>
  <div class="construction-timeline">
    <div class="timeline-header">
      <span class="timeline-title">施工阶段</span>
      <span class="current-phase">{{ currentPhaseLabel }}</span>
    </div>

    <div class="timeline-slider-container">
      <div class="phase-labels">
        <span
          v-for="(phase, index) in phases"
          :key="phase.value"
          :class="['phase-label', { active: currentPhaseIndex >= index }]"
          @click="setPhase(index)">
          {{ phase.label }}
        </span>
      </div>

      <div class="slider-wrapper">
        <input
          type="range"
          min="0"
          max="3"
          step="0.01"
          v-model="progressValue"
          class="timeline-slider"
          @input="onSliderInput" />
        <div class="slider-track">
          <div class="slider-progress" :style="{ width: progressPercent + '%' }"></div>
          <div
            v-for="(phase, index) in phases"
            :key="phase.value"
            class="phase-marker"
            :class="{ active: currentPhaseIndex >= index }"
            :style="{ left: (index / 3) * 100 + '%' }"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useEditorStore } from "../stores/editorStore";
import type { ConstructionPhase } from "../types";

const store = useEditorStore();

const phases = [
  { label: "毛坯", value: "rough" as ConstructionPhase },
  { label: "水电", value: "plumbing" as ConstructionPhase },
  { label: "硬装", value: "hard" as ConstructionPhase },
  { label: "软装", value: "soft" as ConstructionPhase },
];

const progressValue = ref(0);

const currentPhaseIndex = computed(() => Math.floor(progressValue.value));
const currentPhaseLabel = computed(() => phases[currentPhaseIndex.value]?.label || "毛坯");
const progressPercent = computed(() => (progressValue.value / 3) * 100);

function onSliderInput() {
  const phaseIndex = Math.floor(progressValue.value);
  const phaseProgress = progressValue.value - phaseIndex;
  store.setConstructionPhase(phases[phaseIndex]?.value || "rough", phaseProgress);
}

function setPhase(index: number) {
  progressValue.value = index;
  store.setConstructionPhase(phases[index].value, 0);
}

watch(
  () => store.constructionPhase,
  (newPhase) => {
    const index = phases.findIndex((p) => p.value === newPhase);
    if (index !== -1 && Math.abs(progressValue.value - index) > 0.5) {
      progressValue.value = index + store.constructionProgress;
    }
  },
);
</script>

<style scoped>
.construction-timeline {
  background: rgba(30, 30, 46, 0.95);
  border-radius: 12px;
  padding: 16px 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  min-width: 320px;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.timeline-title {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.current-phase {
  font-size: 13px;
  color: #4fc3f7;
  font-weight: 500;
  padding: 4px 10px;
  background: rgba(79, 195, 247, 0.15);
  border-radius: 12px;
}

.timeline-slider-container {
  position: relative;
}

.phase-labels {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  padding: 0 2px;
}

.phase-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: all 0.3s ease;
  padding: 2px 6px;
  border-radius: 4px;
}

.phase-label:hover {
  color: rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.05);
}

.phase-label.active {
  color: #4fc3f7;
  font-weight: 500;
}

.slider-wrapper {
  position: relative;
  height: 24px;
  display: flex;
  align-items: center;
}

.timeline-slider {
  position: absolute;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  z-index: 10;
  margin: 0;
}

.slider-track {
  position: relative;
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: visible;
}

.slider-progress {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: linear-gradient(90deg, #8d6e63 0%, #b0bec5 33%, #e0e0e0 66%, #ffffff 100%);
  border-radius: 2px;
  transition: width 0.1s ease;
}

.phase-marker {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 12px;
  height: 12px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.phase-marker.active {
  background: #4fc3f7;
  box-shadow: 0 0 8px rgba(79, 195, 247, 0.5);
  border-color: rgba(255, 255, 255, 0.3);
}
</style>
