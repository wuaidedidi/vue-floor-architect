<template>
  <div class="status-bar">
    <div class="status-left">
      <div class="mode-indicator">
        <span class="mode-dot" :class="modeClass"></span>
        <span class="mode-label">{{ editorStore.modeLabel }}</span>
      </div>
    </div>
    
    <div class="status-center">
      <span class="status-message">{{ editorStore.statusMessage }}</span>
    </div>
    
    <div class="status-right">
      <div class="stats-item" v-if="editorStore.floorPolygons.length > 0">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
        </svg>
        <span>地板: {{ editorStore.floorPolygons.length }}</span>
      </div>
      <div class="stats-item" v-if="editorStore.wallSegments.length > 0">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
        </svg>
        <span>墙体: {{ editorStore.wallSegments.length }}</span>
      </div>
      <div class="stats-item generated" v-if="editorStore.hasGeneratedModel">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span>已生成</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useEditorStore } from '../stores/editorStore';

const editorStore = useEditorStore();

const modeClass = computed(() => {
  switch (editorStore.mode) {
    case 'draw-floor': return 'floor';
    case 'draw-wall': return 'wall';
    case 'generate': return 'generate';
    case 'upload': return 'upload';
    default: return 'none';
  }
});
</script>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  background: var(--bg-panel);
  border-top: 1px solid var(--border-color);
  font-size: 13px;
}

.status-left,
.status-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.mode-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--bg-card);
  border-radius: var(--radius-full);
  border: 1px solid var(--border-color);
}

.mode-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
  transition: all var(--transition-fast);
}

.mode-dot.floor {
  background: #10b981;
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
}

.mode-dot.wall {
  background: #f59e0b;
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.5);
}

.mode-dot.generate {
  background: #3b82f6;
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
}

.mode-dot.upload {
  background: #8b5cf6;
  box-shadow: 0 0 8px rgba(139, 92, 246, 0.5);
}

.mode-label {
  color: var(--text-secondary);
  font-weight: 500;
}

.status-center {
  flex: 1;
  text-align: center;
}

.status-message {
  color: var(--text-muted);
  font-style: italic;
}

.stats-item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
}

.stats-item svg {
  width: 14px;
  height: 14px;
}

.stats-item.generated {
  color: var(--success-color);
}

@media (max-width: 768px) {
  .status-center {
    display: none;
  }
}
</style>
