<template>
  <div class="furniture-panel">
    <div class="panel-header">
      <h3>家具换装</h3>
      <span class="subtitle">选中家具后切换材质</span>
    </div>
    
    <!-- 添加家具按钮 -->
    <div class="add-section">
      <div class="section-title">添加家具</div>
      <div class="add-buttons">
        <button class="add-btn" @click="emit('addSofa')">
          <span class="icon">🛋️</span>
          <span>沙发</span>
        </button>
        <button class="add-btn" @click="emit('addCabinet')">
          <span class="icon">🗄️</span>
          <span>柜子</span>
        </button>
      </div>
    </div>
    
    <!-- 材质选择 -->
    <div class="material-section" v-if="selectedFurniture">
      <div class="section-title">
        当前选中: {{ selectedFurniture.name }}
        <button class="delete-btn" @click="emit('deleteFurniture')">删除</button>
      </div>
      
      <!-- 材质类型标签 -->
      <div class="material-tabs">
        <button 
          v-for="type in materialTypes" 
          :key="type.value"
          :class="['tab-btn', { active: currentTab === type.value }]"
          @click="currentTab = type.value"
        >
          {{ type.label }}
        </button>
      </div>
      
      <!-- 材质预设列表 -->
      <div class="material-grid">
        <div 
          v-for="preset in currentPresets" 
          :key="preset.name"
          :class="['material-item', { active: isPresetActive(preset) }]"
          @click="emit('applyMaterial', preset)"
        >
          <div class="material-preview" :style="getPreviewStyle(preset)"></div>
          <span class="material-name">{{ preset.name }}</span>
        </div>
      </div>
      
      <!-- 材质参数显示 -->
      <div class="material-params" v-if="activePreset">
        <div class="param-item">
          <span class="param-label">粗糙度</span>
          <div class="param-bar">
            <div class="param-fill" :style="{ width: activePreset.roughness * 100 + '%' }"></div>
          </div>
          <span class="param-value">{{ (activePreset.roughness * 100).toFixed(0) }}%</span>
        </div>
        <div class="param-item">
          <span class="param-label">金属度</span>
          <div class="param-bar">
            <div class="param-fill" :style="{ width: activePreset.metalness * 100 + '%' }"></div>
          </div>
          <span class="param-value">{{ (activePreset.metalness * 100).toFixed(0) }}%</span>
        </div>
        <div class="param-item" v-if="activePreset.clearcoat !== undefined">
          <span class="param-label">清漆层</span>
          <div class="param-bar">
            <div class="param-fill" :style="{ width: activePreset.clearcoat * 100 + '%' }"></div>
          </div>
          <span class="param-value">{{ (activePreset.clearcoat * 100).toFixed(0) }}%</span>
        </div>
      </div>
    </div>
    
    <!-- 未选中提示 -->
    <div class="no-selection" v-else>
      <div class="hint-icon">👆</div>
      <p>点击场景中的家具进行选择</p>
      <p class="sub-hint">选中后会显示聚光灯和弹跳效果</p>
    </div>
    
    <!-- 家具列表 -->
    <div class="furniture-list" v-if="furnitures.length > 0">
      <div class="section-title">场景中的家具 ({{ furnitures.length }})</div>
      <div class="list-items">
        <div 
          v-for="furniture in furnitures" 
          :key="furniture.id"
          :class="['list-item', { active: selectedFurniture?.id === furniture.id }]"
          @click="emit('selectFurniture', furniture)"
        >
          <span class="item-icon">{{ getFurnitureIcon(furniture.type) }}</span>
          <span class="item-name">{{ furniture.name }}</span>
          <span class="item-material">{{ getMaterialLabel(furniture.currentMaterial) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Furniture, MaterialPreset, MaterialType } from '../types';
import { MATERIAL_PRESETS } from '../types';

const props = defineProps<{
  furnitures: Furniture[];
  selectedFurniture: Furniture | null;
}>();

const emit = defineEmits<{
  (e: 'addSofa'): void;
  (e: 'addCabinet'): void;
  (e: 'selectFurniture', furniture: Furniture): void;
  (e: 'applyMaterial', preset: MaterialPreset): void;
  (e: 'deleteFurniture'): void;
}>();

const currentTab = ref<MaterialType>('leather');

const materialTypes = [
  { value: 'leather' as MaterialType, label: '皮质' },
  { value: 'wood' as MaterialType, label: '木纹' },
  { value: 'fabric' as MaterialType, label: '布艺' },
  { value: 'metal' as MaterialType, label: '金属' },
];

const currentPresets = computed(() => {
  return MATERIAL_PRESETS[currentTab.value] || [];
});

const activePreset = computed(() => {
  if (!props.selectedFurniture) return null;
  // 找到当前家具类型的默认预设
  return currentPresets.value[0];
});

function getPreviewStyle(preset: MaterialPreset) {
  const colorHex = '#' + preset.color.toString(16).padStart(6, '0');
  return {
    backgroundColor: colorHex,
    boxShadow: `inset 0 0 10px rgba(0,0,0,${preset.roughness * 0.5})`,
  };
}

function isPresetActive(preset: MaterialPreset): boolean {
  return currentTab.value === preset.type;
}

function getFurnitureIcon(type: string): string {
  const icons: Record<string, string> = {
    sofa: '🛋️',
    cabinet: '🗄️',
    table: '🪑',
    chair: '🪑',
    bed: '🛏️',
  };
  return icons[type] || '📦';
}

function getMaterialLabel(type: string | undefined): string {
  if (!type) return '默认';
  const labels: Record<string, string> = {
    leather: '皮质',
    wood: '木纹',
    fabric: '布艺',
    metal: '金属',
  };
  return labels[type] || '默认';
}
</script>

<style scoped>
.furniture-panel {
  background: linear-gradient(145deg, #1e1e2e 0%, #252535 100%);
  border-radius: 12px;
  padding: 16px;
  color: #e0e0e0;
  min-width: 280px;
  max-width: 320px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.panel-header {
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.panel-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
}

.subtitle {
  font-size: 12px;
  color: #888;
  margin-top: 4px;
  display: block;
}

.section-title {
  font-size: 13px;
  font-weight: 500;
  color: #aaa;
  margin-bottom: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.add-section {
  margin-bottom: 16px;
}

.add-buttons {
  display: flex;
  gap: 8px;
}

.add-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  background: linear-gradient(145deg, #2d2d44 0%, #363650 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #e0e0e0;
  cursor: pointer;
  transition: all 0.2s ease;
}

.add-btn:hover {
  background: linear-gradient(145deg, #3d3d5c 0%, #464668 100%);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.add-btn .icon {
  font-size: 24px;
}

.add-btn span:last-child {
  font-size: 12px;
}

.material-section {
  margin-bottom: 16px;
}

.delete-btn {
  padding: 4px 10px;
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: 4px;
  color: #ef4444;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}

.delete-btn:hover {
  background: rgba(239, 68, 68, 0.4);
}

.material-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.tab-btn {
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #888;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ccc;
}

.tab-btn.active {
  background: linear-gradient(145deg, #4ade80 0%, #22c55e 100%);
  border-color: transparent;
  color: #000;
  font-weight: 500;
}

.material-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.material-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.material-item:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(74, 222, 128, 0.3);
}

.material-item.active {
  border-color: #4ade80;
  background: rgba(74, 222, 128, 0.1);
}

.material-preview {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.material-name {
  font-size: 12px;
  color: #ccc;
}

.material-params {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 12px;
}

.param-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.param-item:last-child {
  margin-bottom: 0;
}

.param-label {
  font-size: 11px;
  color: #888;
  width: 50px;
  flex-shrink: 0;
}

.param-bar {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.param-fill {
  height: 100%;
  background: linear-gradient(90deg, #4ade80 0%, #22c55e 100%);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.param-value {
  font-size: 11px;
  color: #aaa;
  width: 35px;
  text-align: right;
}

.no-selection {
  text-align: center;
  padding: 32px 16px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  margin-bottom: 16px;
}

.hint-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.7;
}

.no-selection p {
  margin: 0;
  font-size: 14px;
  color: #aaa;
}

.sub-hint {
  font-size: 12px !important;
  color: #666 !important;
  margin-top: 8px !important;
}

.furniture-list {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 16px;
}

.list-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 150px;
  overflow-y: auto;
}

.list-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.list-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.list-item.active {
  background: rgba(74, 222, 128, 0.15);
  border: 1px solid rgba(74, 222, 128, 0.3);
}

.item-icon {
  font-size: 16px;
}

.item-name {
  flex: 1;
  font-size: 13px;
  color: #ccc;
}

.item-material {
  font-size: 11px;
  color: #888;
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}
</style>
