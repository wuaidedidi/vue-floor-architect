<template>
  <div class="furniture-dressing-panel">
    <div class="panel-header">
      <h3>🎨 家具一键换装</h3>
      <p class="panel-desc">点击场景中的家具进行选择，然后更换材质</p>
    </div>

    <!-- 添加家具按钮 -->
    <div class="panel-section">
      <h4>添加家具</h4>
      <div class="button-group">
        <button class="btn btn-primary" @click="addTestFurniture">🛋️ 添加测试家具</button>
      </div>
    </div>

    <!-- 选中家具信息 -->
    <div class="panel-section" v-if="selectedFurniture">
      <h4>当前选中</h4>
      <div class="selected-info">
        <div class="selected-name">
          <span class="furniture-icon">{{ getFurnitureIcon(selectedFurniture.type) }}</span>
          <span>{{ selectedFurniture.name }}</span>
        </div>
        <button class="btn btn-secondary btn-small" @click="resetMaterial">🔄 重置材质</button>
      </div>
    </div>

    <!-- 材质选择 -->
    <div class="panel-section" v-if="selectedFurniture">
      <h4>选择材质类型</h4>
      <div class="material-tabs">
        <button
          v-for="type in materialTypes"
          :key="type"
          class="tab-btn"
          :class="{ active: activeMaterialType === type }"
          @click="activeMaterialType = type">
          {{ getMaterialTypeName(type) }}
        </button>
      </div>

      <!-- 材质预设列表 -->
      <div class="material-presets">
        <div
          v-for="preset in getMaterialPresets(activeMaterialType)"
          :key="preset.name"
          class="preset-item"
          :class="{ selected: isPresetSelected(preset) }"
          @click="applyMaterial(preset)">
          <div
            class="preset-color"
            :style="{ backgroundColor: '#' + preset.color.toString(16).padStart(6, '0') }"></div>
          <div class="preset-info">
            <div class="preset-name">{{ preset.name }}</div>
            <div class="preset-props">
              <span>粗糙: {{ preset.roughness.toFixed(2) }}</span>
              <span>金属: {{ preset.metalness.toFixed(2) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div class="empty-state" v-if="!selectedFurniture">
      <div class="empty-icon">👆</div>
      <p>请在场景中点击选择家具</p>
    </div>

    <!-- 使用提示 -->
    <div class="tips-section">
      <h4>💡 使用提示</h4>
      <ul class="tips-list">
        <li>点击家具可选中并显示聚光灯效果</li>
        <li>选中家具会有放大回弹的提示效果</li>
        <li>皮质材质带有真实的清漆反光效果</li>
        <li>木纹材质模拟真实木材的漫反射特性</li>
        <li>点击空白区域可取消选择</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import * as THREE from "three";
import type { MaterialType, MaterialPreset, FurnitureType } from "../types";
import { MATERIAL_PRESETS } from "../types";
import {
  useFurnitureDressing,
  changeFurnitureMaterial,
  resetFurnitureMaterial,
} from "../composables/useFurnitureDressing";

const emit = defineEmits<{
  (e: "add-test-furniture"): void;
}>();

const { selectedFurniture } = useFurnitureDressing();

// 材质类型
const materialTypes: MaterialType[] = ["leather", "wood", "fabric", "metal"];
const activeMaterialType = ref<MaterialType>("leather");

// 获取材质预设
function getMaterialPresets(type: MaterialType): MaterialPreset[] {
  return MATERIAL_PRESETS[type];
}

// 获取材质类型名称
function getMaterialTypeName(type: MaterialType): string {
  const names: Record<MaterialType, string> = {
    leather: "皮革",
    wood: "木纹",
    fabric: "布料",
    metal: "金属",
  };
  return names[type];
}

// 获取家具图标
function getFurnitureIcon(type: FurnitureType): string {
  const icons: Record<FurnitureType, string> = {
    sofa: "🛋️",
    cabinet: "🗄️",
    table: "🪑",
    chair: "💺",
  };
  return icons[type] || "🪑";
}

// 应用材质
function applyMaterial(preset: MaterialPreset) {
  if (selectedFurniture.value) {
    changeFurnitureMaterial(selectedFurniture.value, preset);
  }
}

// 重置材质
function resetMaterial() {
  if (selectedFurniture.value) {
    resetFurnitureMaterial(selectedFurniture.value);
  }
}

// 检查预设是否已选中
function isPresetSelected(preset: MaterialPreset): boolean {
  if (!selectedFurniture.value) return false;
  const material = selectedFurniture.value.currentMaterial as THREE.MeshStandardMaterial;
  return material.color.getHex() === preset.color;
}

// 添加测试家具
function addTestFurniture() {
  emit("add-test-furniture");
}
</script>

<style scoped>
.furniture-dressing-panel {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 16px;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
}

.panel-header {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color);
}

.panel-header h3 {
  margin: 0 0 8px 0;
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 600;
}

.panel-desc {
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.5;
}

.panel-section {
  margin-bottom: 24px;
}

.panel-section h4 {
  margin: 0 0 12px 0;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 600;
}

.button-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.btn {
  padding: 10px 16px;
  border: none;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-primary {
  background: var(--accent-primary);
  color: white;
}

.btn-primary:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
}

.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
  background: var(--bg-hover);
}

.btn-small {
  padding: 6px 12px;
  font-size: 12px;
}

.selected-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
}

.selected-name {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-primary);
  font-weight: 500;
}

.furniture-icon {
  font-size: 20px;
}

.material-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.tab-btn {
  padding: 8px 16px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border-radius: var(--radius-md);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tab-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.tab-btn.active {
  background: var(--accent-primary);
  color: white;
  border-color: var(--accent-primary);
}

.material-presets {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preset-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.preset-item:hover {
  background: var(--bg-hover);
  border-color: var(--accent-primary);
}

.preset-item.selected {
  background: rgba(59, 130, 246, 0.1);
  border-color: var(--accent-primary);
}

.preset-color {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  border: 2px solid var(--border-color);
  flex-shrink: 0;
}

.preset-info {
  flex: 1;
  min-width: 0;
}

.preset-name {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 2px;
}

.preset-props {
  display: flex;
  gap: 12px;
  color: var(--text-muted);
  font-size: 11px;
}

.empty-state {
  text-align: center;
  padding: 32px 16px;
  color: var(--text-muted);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.tips-section h4 {
  margin-bottom: 12px;
}

.tips-list {
  margin: 0;
  padding-left: 20px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.8;
}

.tips-list li {
  margin-bottom: 6px;
}

/* 滚动条样式 */
.furniture-dressing-panel::-webkit-scrollbar {
  width: 6px;
}

.furniture-dressing-panel::-webkit-scrollbar-track {
  background: var(--bg-secondary);
  border-radius: 3px;
}

.furniture-dressing-panel::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

.furniture-dressing-panel::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}
</style>
