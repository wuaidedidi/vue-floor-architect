<template>
  <Transition name="slide">
    <div v-if="visible" class="furniture-panel">
      <div class="panel-header">
        <h3>家具换装</h3>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
      
      <div class="panel-content">
        <div class="section">
          <h4>添加家具</h4>
          <div class="furniture-types">
            <button
              v-for="(config, type) in furnitureTypes"
              :key="type"
              class="type-btn"
              :class="{ active: currentType === type }"
              @click="selectType(type as FurnitureType)"
            >
              <span class="type-icon">{{ config.icon }}</span>
              <span class="type-name">{{ config.name }}</span>
            </button>
          </div>
          <p class="hint-text">点击场景添加家具</p>
        </div>

        <div v-if="selectedFurniture" class="section selected-section">
          <h4>已选中: {{ selectedFurniture.name }}</h4>
          
          <div class="material-section">
            <h5>材质更换</h5>
            <div class="material-grid">
              <button
                v-for="(preset, type) in materialPresets"
                :key="type"
                class="material-btn"
                :class="{ active: selectedFurniture.materialType === type }"
                @click="changeMaterial(type as MaterialType)"
              >
                <span 
                  class="material-preview" 
                  :style="{ backgroundColor: preset.colorHex }"
                ></span>
                <span class="material-name">{{ preset.name }}</span>
              </button>
            </div>
          </div>

          <div class="material-info">
            <div class="info-item">
              <span class="label">粗糙度:</span>
              <span class="value">{{ currentMaterialPreset?.roughness.toFixed(1) }}</span>
              <div class="bar-container">
                <div class="bar" :style="{ width: `${(currentMaterialPreset?.roughness || 0) * 100}%` }"></div>
              </div>
            </div>
            <div class="info-item">
              <span class="label">金属度:</span>
              <span class="value">{{ currentMaterialPreset?.metalness.toFixed(1) }}</span>
              <div class="bar-container">
                <div class="bar" :style="{ width: `${(currentMaterialPreset?.metalness || 0) * 100}%` }"></div>
              </div>
            </div>
          </div>

          <div class="actions">
            <button class="action-btn delete" @click="deleteFurniture">
              删除家具
            </button>
            <button class="action-btn deselect" @click="deselectFurniture">
              取消选中
            </button>
          </div>
        </div>

        <div v-else class="section empty-section">
          <p class="empty-text">点击场景中的家具进行选中</p>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Furniture, FurnitureType, MaterialType } from '../types';
import { MATERIAL_PRESETS, FURNITURE_DEFAULTS } from '../types';
import { useEditorStore } from '../stores/editorStore';

const props = defineProps<{
  visible: boolean;
  selectedFurniture: Furniture | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'change-material', type: MaterialType): void;
  (e: 'delete'): void;
  (e: 'deselect'): void;
}>();

const editorStore = useEditorStore();

const furnitureTypes = {
  sofa: { name: '沙发', icon: '🛋️' },
  cabinet: { name: '柜子', icon: '🗄️' },
  table: { name: '桌子', icon: '🪑' },
  chair: { name: '椅子', icon: '💺' },
  bed: { name: '床', icon: '🛏️' }
};

const materialPresets = {
  leather: { name: '皮质', colorHex: '#8B4513' },
  wood: { name: '木纹', colorHex: '#DEB887' },
  fabric: { name: '布艺', colorHex: '#4A6741' },
  metal: { name: '金属', colorHex: '#C0C0C0' },
  glass: { name: '玻璃', colorHex: '#E0FFFF' }
};

const currentType = computed(() => editorStore.currentFurnitureType);

const currentMaterialPreset = computed(() => {
  if (!props.selectedFurniture) return null;
  return MATERIAL_PRESETS[props.selectedFurniture.materialType];
});

function selectType(type: FurnitureType) {
  editorStore.setCurrentFurnitureType(type);
}

function changeMaterial(type: MaterialType) {
  emit('change-material', type);
}

function deleteFurniture() {
  emit('delete');
}

function deselectFurniture() {
  emit('deselect');
}
</script>

<style scoped>
.furniture-panel {
  position: absolute;
  top: 60px;
  right: 20px;
  width: 280px;
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  z-index: 100;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, transparent 100%);
  border-bottom: 1px solid var(--border-color);
}

.panel-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 18px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--bg-card);
  color: var(--text-primary);
}

.panel-content {
  padding: 16px;
}

.section {
  margin-bottom: 16px;
}

.section:last-child {
  margin-bottom: 0;
}

.section h4 {
  margin: 0 0 12px 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.furniture-types {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.type-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 8px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
}

.type-btn:hover {
  border-color: var(--primary-color);
  background: rgba(99, 102, 241, 0.1);
}

.type-btn.active {
  border-color: var(--primary-color);
  background: rgba(99, 102, 241, 0.2);
}

.type-icon {
  font-size: 20px;
}

.type-name {
  font-size: 11px;
  color: var(--text-secondary);
}

.hint-text {
  margin: 10px 0 0 0;
  font-size: 11px;
  color: var(--text-muted);
  text-align: center;
}

.selected-section {
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.selected-section h4 {
  color: var(--primary-color);
}

.material-section {
  margin-bottom: 16px;
}

.material-section h5 {
  margin: 0 0 10px 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.material-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.material-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px;
  background: var(--bg-card);
  border: 2px solid var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
}

.material-btn:hover {
  border-color: var(--primary-color);
}

.material-btn.active {
  border-color: var(--primary-color);
  background: rgba(99, 102, 241, 0.15);
}

.material-preview {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);
}

.material-name {
  font-size: 10px;
  color: var(--text-secondary);
}

.material-info {
  margin-bottom: 16px;
  padding: 12px;
  background: var(--bg-card);
  border-radius: var(--radius-md);
}

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.info-item:last-child {
  margin-bottom: 0;
}

.info-item .label {
  font-size: 11px;
  color: var(--text-muted);
  width: 50px;
}

.info-item .value {
  font-size: 11px;
  color: var(--text-secondary);
  width: 24px;
  text-align: right;
}

.bar-container {
  flex: 1;
  height: 4px;
  background: var(--bg-dark);
  border-radius: 2px;
  overflow: hidden;
}

.bar {
  height: 100%;
  background: linear-gradient(90deg, var(--primary-color), var(--accent-color));
  border-radius: 2px;
  transition: width 0.3s ease;
}

.actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: var(--radius-md);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn.delete {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.action-btn.delete:hover {
  background: rgba(239, 68, 68, 0.25);
}

.action-btn.deselect {
  background: var(--bg-card);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.action-btn.deselect:hover {
  border-color: var(--primary-color);
  color: var(--text-primary);
}

.empty-section {
  padding: 20px;
  text-align: center;
}

.empty-text {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.slide-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
