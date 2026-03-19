<template>
  <div class="toolbar">
    <div class="toolbar-brand">
      <div class="brand-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </div>
      <span class="brand-text">3D建模工具</span>
    </div>

    <div class="toolbar-divider"></div>

    <div class="toolbar-actions">
      <!-- 上传平面图 -->
      <button
        class="toolbar-btn"
        :class="{ active: editorStore.mode === 'upload' }"
        @click="handleUploadClick"
        title="上传平面图">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span>上传平面图</span>
      </button>

      <!-- 加载默认平面图 -->
      <button class="toolbar-btn default-btn" @click="showDefaultConfirm = true" title="加载默认示例平面图">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18" />
          <path d="M9 21V9" />
        </svg>
        <span>默认平面图</span>
      </button>

      <!-- 绘制地面 -->
      <button
        class="toolbar-btn"
        :class="{ active: editorStore.mode === 'draw-floor' }"
        @click="editorStore.setMode('draw-floor')"
        title="绘制地面区域">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
          <line x1="8" y1="2" x2="8" y2="18" />
          <line x1="16" y1="6" x2="16" y2="22" />
        </svg>
        <span>绘制地面</span>
      </button>

      <!-- 绘制墙体 -->
      <button
        class="toolbar-btn"
        :class="{ active: editorStore.mode === 'draw-wall' }"
        @click="editorStore.setMode('draw-wall')"
        title="绘制墙体">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18" />
          <path d="M3 15h18" />
          <path d="M9 3v18" />
          <path d="M15 3v18" />
        </svg>
        <span>绘制墙体</span>
      </button>

      <!-- 生成模型 -->
      <button
        class="toolbar-btn generate-btn"
        :class="{ disabled: !editorStore.canGenerate }"
        :disabled="!editorStore.canGenerate"
        @click="handleGenerate"
        title="生成3D模型">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
        <span>生成模型</span>
      </button>

      <div class="toolbar-divider"></div>

      <!-- 第一人称漫游 -->
      <button
        class="toolbar-btn fp-btn"
        :class="{ active: isFPModeActive }"
        @click="handleToggleFPMode"
        title="第一人称室内漫游">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v4" />
          <path d="M12 18v4" />
          <path d="M2 12h4" />
          <path d="M18 12h4" />
        </svg>
        <span>{{ isFPModeActive ? "退出漫游" : "室内漫游" }}</span>
      </button>
    </div>

    <div class="toolbar-spacer"></div>

    <!-- 清空按钮 -->
    <button class="toolbar-btn clear-btn" @click="handleClear" title="清空所有内容">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
      </svg>
      <span>清空</span>
    </button>

    <!-- 隐藏的文件输入 -->
    <input ref="fileInput" type="file" accept="image/*" style="display: none" @change="handleFileChange" />

    <!-- 确认加载默认平面图的对话框 -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showDefaultConfirm" class="modal-overlay" @click.self="showDefaultConfirm = false">
          <div class="confirm-dialog">
            <div class="dialog-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18" />
                <path d="M9 21V9" />
              </svg>
            </div>
            <h3 class="dialog-title">加载默认平面图</h3>
            <p class="dialog-message">
              是否加载示例平面图？<br />
              <small>这将显示一个包含客厅、卧室、厨房等房间的户型图</small>
            </p>
            <div class="dialog-actions">
              <button class="dialog-btn cancel-btn" @click="showDefaultConfirm = false">取消</button>
              <button class="dialog-btn confirm-btn" @click="loadDefaultFloorPlan">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                是，加载
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useEditorStore } from "../stores/editorStore";

const emit = defineEmits<{
  (e: "upload", file: File): void;
  (e: "load-default"): void;
  (e: "generate"): void;
  (e: "clear"): void;
  (e: "toggle-fp-mode"): void;
}>();

const props = defineProps<{
  isFPModeActive?: boolean;
}>();

const editorStore = useEditorStore();
const fileInput = ref<HTMLInputElement | null>(null);
const showDefaultConfirm = ref(false);

function handleUploadClick() {
  editorStore.setMode("upload");
  fileInput.value?.click();
}

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    emit("upload", file);
  }
  // 重置input，允许重复选择同一文件
  target.value = "";
}

function loadDefaultFloorPlan() {
  showDefaultConfirm.value = false;
  emit("load-default");
}

function handleGenerate() {
  if (editorStore.canGenerate) {
    emit("generate");
  }
}

function handleClear() {
  emit("clear");
}

function handleToggleFPMode() {
  emit("toggle-fp-mode");
}
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border-color);
  box-shadow: var(--shadow-md);
  z-index: 100;
}

.toolbar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-gradient);
  border-radius: var(--radius-md);
  color: white;
}

.brand-icon svg {
  width: 20px;
  height: 20px;
}

.brand-text {
  font-size: 16px;
  font-weight: 600;
  background: var(--primary-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.toolbar-divider {
  width: 1px;
  height: 32px;
  background: var(--border-color);
  margin: 0 8px;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.toolbar-btn svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.toolbar-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--primary-color);
}

.toolbar-btn.active {
  background: var(--primary-gradient);
  color: white;
  border-color: transparent;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.3);
}

.toolbar-btn.default-btn {
  background: rgba(139, 92, 246, 0.1);
  color: #a78bfa;
  border-color: rgba(139, 92, 246, 0.3);
}

.toolbar-btn.default-btn:hover {
  background: rgba(139, 92, 246, 0.2);
  border-color: #a78bfa;
  color: #c4b5fd;
}

.toolbar-btn.generate-btn {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border-color: transparent;
}

.toolbar-btn.generate-btn:hover:not(.disabled) {
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.3);
  transform: translateY(-1px);
}

.toolbar-btn.generate-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.toolbar-btn.clear-btn {
  background: rgba(239, 68, 68, 0.1);
  color: var(--error-color);
  border-color: rgba(239, 68, 68, 0.3);
}

.toolbar-btn.clear-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: var(--error-color);
}

.toolbar-btn.fp-btn {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  border-color: transparent;
}

.toolbar-btn.fp-btn:hover {
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.3);
  transform: translateY(-1px);
}

.toolbar-btn.fp-btn.active {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.3);
}

.toolbar-spacer {
  flex: 1;
}

/* 确认对话框样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.confirm-dialog {
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 32px;
  width: 100%;
  max-width: 400px;
  text-align: center;
  box-shadow: var(--shadow-xl);
}

.dialog-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(102, 126, 234, 0.2));
  border-radius: 50%;
  color: #a78bfa;
}

.dialog-icon svg {
  width: 32px;
  height: 32px;
}

.dialog-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 12px;
}

.dialog-message {
  font-size: 15px;
  color: var(--text-secondary);
  margin: 0 0 24px;
  line-height: 1.6;
}

.dialog-message small {
  color: var(--text-muted);
  font-size: 13px;
}

.dialog-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.dialog-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  border: none;
}

.dialog-btn svg {
  width: 16px;
  height: 16px;
}

.cancel-btn {
  background: var(--bg-card);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.cancel-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.confirm-btn {
  background: linear-gradient(135deg, #8b5cf6, #667eea);
  color: white;
}

.confirm-btn:hover {
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.3);
  transform: translateY(-1px);
}

/* Modal动画 */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: all 0.25s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .confirm-dialog,
.modal-fade-leave-to .confirm-dialog {
  transform: scale(0.95);
  opacity: 0;
}

@media (max-width: 900px) {
  .toolbar-btn span {
    display: none;
  }

  .toolbar-btn {
    padding: 10px;
  }

  .brand-text {
    display: none;
  }
}
</style>
