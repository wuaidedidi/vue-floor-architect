<template>
  <div class="timeline-container">
    <div class="timeline-header">
      <h3 class="timeline-title">施工阶段动态还原</h3>
      <div class="stage-badges">
        <span
          v-for="(stage, index) in stages"
          :key="stage.id"
          class="stage-badge"
          :class="{
            active: currentStageIndex >= index,
            current: currentStageIndex === index,
          }">
          {{ stage.name }}
        </span>
      </div>
    </div>

    <div class="timeline-slider-container">
      <input
        type="range"
        v-model="sliderValue"
        :min="0"
        :max="(stages.length - 1) * 100"
        :step="1"
        class="timeline-slider"
        @input="handleSliderChange" />

      <div class="timeline-track">
        <div
          class="timeline-progress"
          :style="{ width: `${(sliderValue / ((stages.length - 1) * 100)) * 100}%` }"></div>
        <div
          v-for="(stage, index) in stages"
          :key="stage.id"
          class="timeline-marker"
          :class="{ active: currentStageIndex >= index }"
          :style="{ left: `${(index / (stages.length - 1)) * 100}%` }">
          <span class="marker-icon">{{ stage.icon }}</span>
        </div>
      </div>
    </div>

    <div class="stage-info">
      <div class="stage-details">
        <h4 class="stage-name">{{ currentStage.name }}</h4>
        <p class="stage-desc">{{ currentStage.description }}</p>
      </div>
      <div class="animation-controls">
        <el-button size="small" :icon="isPlaying ? VideoPause : VideoPlay" circle @click="togglePlay" />
        <el-button size="small" icon="Refresh" circle @click="resetAnimation" />
      </div>
    </div>

    <div class="transition-progress" v-if="isTransitioning">
      <span class="transition-label">材质过渡中...</span>
      <el-progress :percentage="transitionProgress" :show-text="false" stroke-width="4" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { VideoPlay, VideoPause } from "@element-plus/icons-vue";
import { useEditorStore } from "../stores/editorStore";

const editorStore = useEditorStore();

// 施工阶段定义
const stages = [
  { id: "rough", name: "毛坯阶段", icon: "🧱", description: "原始水泥墙面，建筑基础结构" },
  { id: "plumbing", name: "水电阶段", icon: "⚡", description: "水电管线铺设，基础改造完成" },
  { id: "finishing", name: "硬装阶段", icon: "🎨", description: "墙面腻子刮平，基础装修完成" },
  { id: "decoration", name: "软装阶段", icon: "✨", description: "乳胶漆涂刷完成，最终效果呈现" },
];

const sliderValue = ref(0);
const isPlaying = ref(false);
const isTransitioning = ref(false);
const transitionProgress = ref(0);

let animationFrame: number | null = null;
let transitionFrame: number | null = null;

const currentStageIndex = computed(() => {
  return Math.round(sliderValue.value / 100);
});

const currentStage = computed(() => {
  return stages[currentStageIndex.value];
});

// 监听阶段变化
watch(currentStageIndex, (newIndex, oldIndex) => {
  if (newIndex !== oldIndex) {
    editorStore.setConstructionStage(newIndex);
    // 触发材质过渡动画
    startMaterialTransition(oldIndex, newIndex);
  }
});

function handleSliderChange() {
  if (isPlaying.value) {
    isPlaying.value = false;
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  }
}

function startMaterialTransition(fromIndex: number, toIndex: number) {
  isTransitioning.value = true;
  transitionProgress.value = 0;

  const duration = 3000; // 3秒过渡动画，让效果更明显
  const startTime = performance.now();

  function animateTransition(currentTime: number) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // 使用 easeInOutCubic 缓动函数
    const easeProgress = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    transitionProgress.value = easeProgress * 100;

    // 更新材质过渡进度
    editorStore.setMaterialTransitionProgress(easeProgress, fromIndex, toIndex);

    if (progress < 1) {
      transitionFrame = requestAnimationFrame(animateTransition);
    } else {
      isTransitioning.value = false;
      transitionFrame = null;
    }
  }

  if (transitionFrame) {
    cancelAnimationFrame(transitionFrame);
  }

  transitionFrame = requestAnimationFrame(animateTransition);
}

function togglePlay() {
  if (isPlaying.value) {
    isPlaying.value = false;
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  } else {
    isPlaying.value = true;
    playAnimation();
  }
}

function playAnimation() {
  const speed = 0.5; // 调整播放速度

  function animate() {
    sliderValue.value += speed;
    if (sliderValue.value >= (stages.length - 1) * 100) {
      sliderValue.value = 0;
    }
    animationFrame = requestAnimationFrame(animate);
  }

  animate();
}

function resetAnimation() {
  sliderValue.value = 0;
  editorStore.setConstructionStage(0);
}

defineExpose({
  currentStageIndex,
  currentStage,
});
</script>

<style scoped>
.timeline-container {
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95));
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 12px;
  padding: 16px 20px;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.timeline-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #f1f5f9;
  display: flex;
  align-items: center;
  gap: 8px;
}

.timeline-title::before {
  content: "";
  width: 4px;
  height: 16px;
  background: linear-gradient(180deg, #3b82f6, #8b5cf6);
  border-radius: 2px;
}

.stage-badges {
  display: flex;
  gap: 8px;
}

.stage-badge {
  padding: 4px 10px;
  background: rgba(51, 65, 85, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 12px;
  font-size: 11px;
  color: #94a3b8;
  transition: all 0.3s ease;
}

.stage-badge.active {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.4);
  color: #93c5fd;
}

.stage-badge.current {
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  border-color: transparent;
  color: white;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
}

.timeline-slider-container {
  position: relative;
  margin-bottom: 20px;
  padding: 10px 0;
}

.timeline-slider {
  position: absolute;
  width: 100%;
  height: 6px;
  top: 50%;
  transform: translateY(-50%);
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  z-index: 10;
  cursor: pointer;
}

.timeline-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  border: 3px solid #1e293b;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(59, 130, 246, 0.5);
  transition: all 0.2s ease;
}

.timeline-slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 15px rgba(59, 130, 246, 0.7);
}

.timeline-slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  border: 3px solid #1e293b;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(59, 130, 246, 0.5);
  transition: all 0.2s ease;
}

.timeline-track {
  position: relative;
  height: 6px;
  background: rgba(51, 65, 85, 0.5);
  border-radius: 3px;
  margin: 0 10px;
}

.timeline-progress {
  position: absolute;
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
  border-radius: 3px;
  transition: width 0.1s linear;
}

.timeline-marker {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 16px;
  height: 16px;
  background: #334155;
  border: 2px solid #475569;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  z-index: 5;
}

.timeline-marker.active {
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  border-color: transparent;
  box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
}

.marker-icon {
  font-size: 10px;
  display: none;
}

.timeline-marker:hover .marker-icon {
  display: block;
}

.stage-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.stage-details {
  flex: 1;
}

.stage-name {
  margin: 0 0 4px 0;
  font-size: 13px;
  font-weight: 600;
  color: #f1f5f9;
}

.stage-desc {
  margin: 0;
  font-size: 11px;
  color: #94a3b8;
}

.animation-controls {
  display: flex;
  gap: 8px;
}

.transition-progress {
  margin-top: 12px;
  padding: 8px 12px;
  background: rgba(59, 130, 246, 0.1);
  border-radius: 6px;
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.transition-label {
  display: block;
  font-size: 11px;
  color: #93c5fd;
  margin-bottom: 6px;
}

.transition-progress :deep(.el-progress-bar__inner) {
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
}
</style>
