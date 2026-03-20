<template>
  <div class="construction-timeline" :class="{ visible: editorStore.hasGeneratedModel }">
    <div class="timeline-header">
      <div class="header-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      </div>
      <span class="header-title">施工阶段还原</span>
      <span class="current-phase">{{ currentPhaseLabel }}</span>
    </div>

    <div class="timeline-track">
      <div class="track-line"></div>
      
      <div 
        v-for="(phase, index) in phases" 
        :key="phase.id"
        class="phase-marker"
        :class="{ 
          active: phase.id === editorStore.currentPhase,
          completed: index < editorStore.currentPhaseIndex,
          transitioning: editorStore.isTransitioning && phase.id === editorStore.currentPhase
        }"
        :style="{ left: `${(index / (phases.length - 1)) * 100}%` }"
        @click="handlePhaseClick(phase.id)"
      >
        <div class="marker-dot">
          <div class="dot-inner"></div>
          <div class="dot-ring"></div>
        </div>
        <div class="marker-label">
          <span class="label-text">{{ phase.label }}</span>
          <span class="label-desc">{{ phase.description }}</span>
        </div>
      </div>

      <div 
        class="progress-indicator"
        :style="{ 
          left: `${progressPosition}%`,
          top: '-8px'
        }"
      >
        <div class="indicator-thumb"></div>
      </div>
    </div>

    <div class="timeline-slider">
      <input
        type="range"
        min="0"
        max="100"
        :value="editorStore.phaseProgress"
        @input="handleSliderChange"
        class="phase-slider"
        :disabled="!editorStore.hasGeneratedModel"
      />
      <div class="slider-labels">
        <span>毛坯</span>
        <span>水电</span>
        <span>硬装</span>
        <span>软装</span>
      </div>
    </div>

    <div class="phase-info" v-if="editorStore.currentPhaseConfig">
      <div class="info-item">
        <span class="info-label">当前阶段</span>
        <span class="info-value">{{ editorStore.currentPhaseConfig.label }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">墙面状态</span>
        <span class="info-value">{{ getWallStatus(editorStore.currentPhase) }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">地面状态</span>
        <span class="info-value">{{ getFloorStatus(editorStore.currentPhase) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useEditorStore } from '../stores/editorStore';
import { CONSTRUCTION_PHASES, type ConstructionPhase } from '../types';

const editorStore = useEditorStore();
const phases = CONSTRUCTION_PHASES;

const currentPhaseLabel = computed(() => {
  return editorStore.currentPhaseConfig?.label || '';
});

const progressPosition = computed(() => {
  return editorStore.phaseProgress;
});

function handleSliderChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const value = parseInt(target.value, 10);
  editorStore.setPhaseProgress(value);
  
  const phaseIndex = Math.floor(value / 25);
  const newPhase = editorStore.getPhaseByIndex(phaseIndex);
  if (newPhase !== editorStore.currentPhase) {
    editorStore.setCurrentPhase(newPhase);
  }
  
  emit('progress-change', value);
}

function handlePhaseClick(phaseId: ConstructionPhase) {
  if (!editorStore.hasGeneratedModel) return;
  
  const index = phases.findIndex(p => p.id === phaseId);
  const progress = index * 25;
  editorStore.setPhaseProgress(progress);
  editorStore.setCurrentPhase(phaseId);
  emit('phase-change', phaseId);
}

function getWallStatus(phase: ConstructionPhase): string {
  const statusMap: Record<ConstructionPhase, string> = {
    rough: '裸露混凝土',
    plumbing: '开槽布线',
    hardfinish: '腻子乳胶漆',
    softfinish: '装饰完成'
  };
  return statusMap[phase] || '';
}

function getFloorStatus(phase: ConstructionPhase): string {
  const statusMap: Record<ConstructionPhase, string> = {
    rough: '水泥毛面',
    plumbing: '管线铺设',
    hardfinish: '瓷砖地板',
    softfinish: '完整装饰'
  };
  return statusMap[phase] || '';
}

const emit = defineEmits<{
  (e: 'phase-change', phase: ConstructionPhase): void;
  (e: 'progress-change', progress: number): void;
}>();
</script>

<style scoped>
.construction-timeline {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%) translateY(100px);
  width: 90%;
  max-width: 800px;
  background: rgba(26, 26, 46, 0.95);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 20px 24px;
  backdrop-filter: blur(12px);
  box-shadow: var(--shadow-xl);
  z-index: 100;
  opacity: 0;
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}

.construction-timeline.visible {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
  pointer-events: auto;
}

.timeline-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.header-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f59e0b, #d97706);
  border-radius: var(--radius-md);
  color: white;
}

.header-icon svg {
  width: 20px;
  height: 20px;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.current-phase {
  margin-left: auto;
  padding: 4px 12px;
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.2));
  border: 1px solid rgba(245, 158, 11, 0.4);
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  color: #fbbf24;
}

.timeline-track {
  position: relative;
  height: 60px;
  margin-bottom: 16px;
}

.track-line {
  position: absolute;
  top: 20px;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--border-color);
  border-radius: 2px;
}

.phase-marker {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  cursor: pointer;
  transition: all 0.3s ease;
}

.marker-dot {
  position: relative;
  width: 24px;
  height: 24px;
  margin: 0 auto 8px;
}

.dot-inner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 12px;
  height: 12px;
  background: var(--bg-card);
  border: 2px solid var(--border-color);
  border-radius: 50%;
  transition: all 0.3s ease;
}

.dot-ring {
  position: absolute;
  top: 0;
  left: 0;
  width: 24px;
  height: 24px;
  border: 2px solid transparent;
  border-radius: 50%;
  transition: all 0.3s ease;
}

.phase-marker:hover .dot-inner {
  border-color: #f59e0b;
  background: rgba(245, 158, 11, 0.2);
}

.phase-marker.active .dot-inner {
  background: #f59e0b;
  border-color: #f59e0b;
  box-shadow: 0 0 12px rgba(245, 158, 11, 0.5);
}

.phase-marker.active .dot-ring {
  border-color: rgba(245, 158, 11, 0.3);
  animation: pulse 2s infinite;
}

.phase-marker.completed .dot-inner {
  background: #10b981;
  border-color: #10b981;
}

.phase-marker.transitioning .dot-inner {
  animation: transitionPulse 0.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.7;
  }
}

@keyframes transitionPulse {
  0%, 100% {
    box-shadow: 0 0 12px rgba(245, 158, 11, 0.5);
  }
  50% {
    box-shadow: 0 0 24px rgba(245, 158, 11, 0.8);
  }
}

.marker-label {
  text-align: center;
  white-space: nowrap;
}

.label-text {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  transition: color 0.3s ease;
}

.phase-marker.active .label-text {
  color: #fbbf24;
}

.phase-marker.completed .label-text {
  color: #10b981;
}

.label-desc {
  display: block;
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.progress-indicator {
  position: absolute;
  transform: translateX(-50%);
  transition: left 0.3s ease;
}

.indicator-thumb {
  width: 16px;
  height: 16px;
  background: #f59e0b;
  border: 3px solid white;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.timeline-slider {
  margin-bottom: 16px;
}

.phase-slider {
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--border-color);
  border-radius: 3px;
  outline: none;
  cursor: pointer;
}

.phase-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  background: linear-gradient(135deg, #f59e0b, #d97706);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);
  transition: transform 0.2s ease;
}

.phase-slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}

.phase-slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  background: linear-gradient(135deg, #f59e0b, #d97706);
  border-radius: 50%;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);
}

.phase-slider:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 11px;
  color: var(--text-muted);
}

.phase-info {
  display: flex;
  gap: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-value {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

@media (max-width: 600px) {
  .construction-timeline {
    width: 95%;
    padding: 16px;
  }

  .phase-info {
    flex-wrap: wrap;
    gap: 12px;
  }

  .label-desc {
    display: none;
  }
}
</style>
