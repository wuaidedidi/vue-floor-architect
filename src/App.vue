<template>
  <div class="app-container">
    <Toolbar @upload="handleUpload" @load-default="handleLoadDefault" @generate="handleGenerate" @clear="handleClear" />

    <div class="main-content">
      <ThreeScene ref="threeSceneRef" @scene-ready="onSceneReady" />
      <ConstructionTimeline @phase-change="handlePhaseChange" @progress-change="handleProgressChange" />
    </div>

    <StatusBar />

    <Teleport to="body">
      <Transition name="toast">
        <div v-if="showToast" class="toast" :class="toastType">
          <span class="toast-icon">{{ toastIcon }}</span>
          <span class="toast-message">{{ toastMessage }}</span>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useEditorStore } from "./stores/editorStore";
import Toolbar from "./components/Toolbar.vue";
import ThreeScene from "./components/ThreeScene.vue";
import StatusBar from "./components/StatusBar.vue";
import ConstructionTimeline from "./components/ConstructionTimeline.vue";
import type { ConstructionPhase } from "./types";

const editorStore = useEditorStore();
const threeSceneRef = ref<InstanceType<typeof ThreeScene> | null>(null);

// Toast状态
const showToast = ref(false);
const toastMessage = ref("");
const toastType = ref<"success" | "error" | "info">("info");
let toastTimeout: number | null = null;

const toastIcon = computed(() => {
  switch (toastType.value) {
    case "success":
      return "✓";
    case "error":
      return "✕";
    default:
      return "ℹ";
  }
});

function displayToast(message: string, type: "success" | "error" | "info" = "info") {
  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }

  toastMessage.value = message;
  toastType.value = type;
  showToast.value = true;

  toastTimeout = window.setTimeout(() => {
    showToast.value = false;
  }, 3000);
}

function onSceneReady() {
  displayToast("场景已就绪，可以开始操作", "success");
}

async function handleUpload(file: File) {
  if (threeSceneRef.value) {
    const success = await threeSceneRef.value.uploadFloorPlan(file);
    if (success) {
      displayToast("平面图上传成功", "success");
    } else {
      displayToast("平面图上传失败", "error");
    }
  }
}

async function handleLoadDefault() {
  displayToast("正在加载默认平面图...", "info");
  try {
    // 从public目录获取默认平面图
    const response = await fetch("/sample-floor-plan.svg");
    if (!response.ok) throw new Error("加载失败");

    const blob = await response.blob();
    const file = new File([blob], "sample-floor-plan.svg", { type: "image/svg+xml" });

    if (threeSceneRef.value) {
      const success = await threeSceneRef.value.uploadFloorPlan(file);
      if (success) {
        displayToast("默认平面图加载成功！", "success");
      } else {
        displayToast("平面图加载失败", "error");
      }
    }
  } catch (error) {
    console.error("加载默认平面图失败:", error);
    displayToast("加载默认平面图失败", "error");
  }
}

function handleGenerate() {
  if (threeSceneRef.value) {
    threeSceneRef.value.generateModels();
    displayToast("3D模型生成成功！", "success");
  }
}

function handleClear() {
  if (threeSceneRef.value) {
    threeSceneRef.value.clearScene();
    displayToast("已清空所有内容", "info");
  }
}

function handlePhaseChange(phase: ConstructionPhase) {
  console.log("Phase changed to:", phase);
}

function handleProgressChange(progress: number) {
  console.log("Progress changed to:", progress);
}

watch(
  () => editorStore.statusMessage,
  (message) => {
    if (message.includes("已创建") || message.includes("已生成")) {
      displayToast(message, "success");
    }
  },
);
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: var(--bg-dark);
}

.main-content {
  flex: 1;
  position: relative;
  overflow: hidden;
}

/* Toast样式 */
.toast {
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 24px;
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: 1000;
  font-size: 14px;
}

.toast.success {
  border-color: var(--success-color);
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, var(--bg-panel) 100%);
}

.toast.success .toast-icon {
  color: var(--success-color);
}

.toast.error {
  border-color: var(--error-color);
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, var(--bg-panel) 100%);
}

.toast.error .toast-icon {
  color: var(--error-color);
}

.toast.info {
  border-color: var(--info-color);
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, var(--bg-panel) 100%);
}

.toast.info .toast-icon {
  color: var(--info-color);
}

.toast-icon {
  font-size: 16px;
  font-weight: bold;
}

.toast-message {
  color: var(--text-primary);
}

/* Toast动画 */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}
</style>
