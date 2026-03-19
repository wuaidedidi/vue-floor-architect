import { ref, shallowRef } from "vue";
import * as THREE from "three";
import type { MaterialPreset, FurnitureObject, MaterialType } from "../types";
import { MATERIAL_PRESETS } from "../types";

// 存储家具对象
const furnitureObjects = shallowRef<FurnitureObject[]>([]);
const selectedFurniture = shallowRef<FurnitureObject | null>(null);
const isAnimating = ref(false);

/**
 * 根据材质预设创建Three.js材质
 */
export function createMaterialFromPreset(preset: MaterialPreset): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial({
    color: preset.color,
    roughness: preset.roughness,
    metalness: preset.metalness,
    side: THREE.DoubleSide,
    envMapIntensity: 3.0, // 大幅增强环境光反射强度
    reflectivity: 1.0, // 增强反射率
    transparent: true,
    opacity: 1.0,
  });

  // 设置清漆效果（用于皮革）
  if (preset.clearcoat !== undefined) {
    material.clearcoat = preset.clearcoat;
    material.clearcoatRoughness = preset.clearcoatRoughness || 0;
  }

  return material;
}

/**
 * 注册家具对象
 */
export function registerFurniture(furniture: FurnitureObject): void {
  furnitureObjects.value.push(furniture);
}

/**
 * 移除家具对象
 */
export function unregisterFurniture(furnitureId: string): void {
  const index = furnitureObjects.value.findIndex((f) => f.id === furnitureId);
  if (index !== -1) {
    const furniture = furnitureObjects.value[index];
    // 清理聚光灯
    if (furniture.spotlight) {
      furniture.spotlight.dispose();
    }
    if (furniture.spotlightHelper) {
      furniture.spotlightHelper.dispose();
    }
    furnitureObjects.value.splice(index, 1);
  }
}

/**
 * 获取所有家具
 */
export function getAllFurniture(): FurnitureObject[] {
  return furnitureObjects.value;
}

/**
 * 获取选中的家具
 */
export function getSelectedFurniture(): FurnitureObject | null {
  return selectedFurniture.value;
}

/**
 * 为家具添加聚光灯
 */
function addSpotlightToFurniture(furniture: FurnitureObject, scene: THREE.Scene): void {
  // 计算家具的包围盒来确定位置
  const box = new THREE.Box3().setFromObject(furniture.mesh);
  const center = new THREE.Vector3();
  box.getCenter(center);
  const size = new THREE.Vector3();
  box.getSize(size);

  // 主聚光灯 - 超强度暖光，更大角度
  const spotlight = new THREE.SpotLight(0xfff5e6, 12, 200, Math.PI / 3, 0.1, 2.0);
  spotlight.position.set(center.x, center.y + Math.max(size.y, 10) + 18, center.z);

  // 创建一个空对象作为聚光灯目标
  const targetObj = new THREE.Object3D();
  targetObj.position.copy(center);
  scene.add(targetObj);
  spotlight.target = targetObj;

  spotlight.castShadow = true;
  spotlight.shadow.mapSize.width = 2048;
  spotlight.shadow.mapSize.height = 2048;
  spotlight.shadow.camera.near = 1;
  spotlight.shadow.camera.far = 300;
  spotlight.shadow.bias = -0.001;

  scene.add(spotlight);

  // 添加多个辅助光源从不同角度照射
  // 前上方补光 - 冷色调补充
  const fillLight1 = new THREE.SpotLight(0xe6f0ff, 6, 150, Math.PI / 2.5, 0.15, 1.5);
  fillLight1.position.set(center.x + 25, center.y + 25, center.z + 25);
  fillLight1.target = targetObj;
  scene.add(fillLight1);

  // 左侧补光
  const fillLight2 = new THREE.PointLight(0xffffff, 4, 100);
  fillLight2.position.set(center.x - 30, center.y + 20, center.z);
  scene.add(fillLight2);

  // 右侧补光
  const fillLight3 = new THREE.PointLight(0xffffff, 4, 100);
  fillLight3.position.set(center.x + 30, center.y + 20, center.z);
  scene.add(fillLight3);

  // 背光/轮廓光 - 增强物体边缘轮廓
  const rimLight = new THREE.SpotLight(0xffffff, 8, 150, Math.PI / 3, 0.1, 1.8);
  rimLight.position.set(center.x, center.y + Math.max(size.y, 10) + 12, center.z - 35);
  rimLight.target = targetObj;
  scene.add(rimLight);

  // 顶部额外补光
  const topLight = new THREE.PointLight(0xfffaf0, 5, 100);
  topLight.position.set(center.x, center.y + 40, center.z);
  scene.add(topLight);

  // 存储所有光源对象引用以便清理
  (spotlight as any).targetObject = targetObj;
  (spotlight as any).fillLights = [fillLight1, fillLight2, fillLight3, rimLight, topLight];
  furniture.spotlight = spotlight;
}

/**
 * 移除家具的聚光灯
 */
function removeSpotlightFromFurniture(furniture: FurnitureObject, scene: THREE.Scene): void {
  if (furniture.spotlight) {
    // 移除聚光灯目标对象
    const targetObj = (furniture.spotlight as any).targetObject;
    if (targetObj) {
      scene.remove(targetObj);
    }

    // 移除所有辅助光源
    const fillLights = (furniture.spotlight as any).fillLights;
    if (fillLights && Array.isArray(fillLights)) {
      fillLights.forEach((light: THREE.Light) => {
        scene.remove(light);
        light.dispose();
      });
    }

    scene.remove(furniture.spotlight);
    furniture.spotlight.dispose();
    furniture.spotlight = undefined;
  }
}

/**
 * 弹跳动画效果
 */
async function bounceAnimation(mesh: THREE.Mesh | THREE.Group): Promise<void> {
  if (isAnimating.value) return;
  isAnimating.value = true;

  const originalScale = mesh.scale.clone();
  const targetScale = originalScale.clone().multiplyScalar(1.1);
  const duration = 150; // ms
  const startTime = Date.now();

  return new Promise((resolve) => {
    function animate() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // 使用easeOutElastic缓动函数
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const bounce = progress < 0.5 ? easeOut * 2 : 2 - easeOut * 2;

      const scale = originalScale.clone().lerp(targetScale, bounce);
      mesh.scale.copy(scale);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        mesh.scale.copy(originalScale);
        isAnimating.value = false;
        resolve();
      }
    }
    animate();
  });
}

/**
 * 选择家具
 */
export async function selectFurniture(furniture: FurnitureObject, scene: THREE.Scene): Promise<void> {
  // 如果之前有选中的，移除聚光灯
  if (selectedFurniture.value && selectedFurniture.value.id !== furniture.id) {
    removeSpotlightFromFurniture(selectedFurniture.value, scene);
    // 移除之前选中家具的高亮材质
    removeHighlight(selectedFurniture.value);
  }

  selectedFurniture.value = furniture;

  // 添加高亮效果到材质
  applyHighlight(furniture);

  // 添加弹跳动画
  await bounceAnimation(furniture.mesh);

  // 添加聚光灯
  addSpotlightToFurniture(furniture, scene);
}

/**
 * 应用高亮效果到家具材质
 */
function applyHighlight(furniture: FurnitureObject): void {
  if (furniture.mesh instanceof THREE.Group) {
    furniture.mesh.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh && child.material) {
        // 保存原始材质
        if (!child.userData.highlightSaved) {
          child.userData.originalMaterialBeforeHighlight = child.material;
          child.userData.highlightSaved = true;
        }

        // 创建高亮材质副本
        const highlightMaterial = (child.material as THREE.MeshPhysicalMaterial).clone();
        highlightMaterial.emissive = new THREE.Color(0x444444);
        highlightMaterial.emissiveIntensity = 0.3;
        highlightMaterial.needsUpdate = true;
        child.material = highlightMaterial;
      }
    });
  } else if (furniture.mesh instanceof THREE.Mesh) {
    const mesh = furniture.mesh as THREE.Mesh;
    if (!mesh.userData.highlightSaved) {
      mesh.userData.originalMaterialBeforeHighlight = mesh.material;
      mesh.userData.highlightSaved = true;
    }

    const highlightMaterial = (mesh.material as THREE.MeshPhysicalMaterial).clone();
    highlightMaterial.emissive = new THREE.Color(0x444444);
    highlightMaterial.emissiveIntensity = 0.3;
    highlightMaterial.needsUpdate = true;
    mesh.material = highlightMaterial;
  }
}

/**
 * 移除家具的高亮效果
 */
function removeHighlight(furniture: FurnitureObject): void {
  if (furniture.mesh instanceof THREE.Group) {
    furniture.mesh.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh && child.userData.highlightSaved) {
        const oldMaterial = child.material;
        child.material = child.userData.originalMaterialBeforeHighlight;
        child.userData.highlightSaved = false;
        // 清理高亮材质
        if (oldMaterial !== child.userData.originalMaterialBeforeHighlight) {
          if (Array.isArray(oldMaterial)) {
            oldMaterial.forEach((m) => m.dispose());
          } else {
            oldMaterial.dispose();
          }
        }
      }
    });
  } else if (furniture.mesh instanceof THREE.Mesh) {
    const mesh = furniture.mesh as THREE.Mesh;
    if (mesh.userData.highlightSaved) {
      const oldMaterial = mesh.material;
      mesh.material = mesh.userData.originalMaterialBeforeHighlight;
      mesh.userData.highlightSaved = false;
      if (oldMaterial !== mesh.userData.originalMaterialBeforeHighlight) {
        if (Array.isArray(oldMaterial)) {
          oldMaterial.forEach((m) => m.dispose());
        } else {
          oldMaterial.dispose();
        }
      }
    }
  }
}

/**
 * 取消选择家具
 */
export function deselectFurniture(scene: THREE.Scene): void {
  if (selectedFurniture.value) {
    removeSpotlightFromFurniture(selectedFurniture.value, scene);
    // 移除高亮效果
    removeHighlight(selectedFurniture.value);
    selectedFurniture.value = null;
  }
}

/**
 * 更换家具材质
 */
export function changeFurnitureMaterial(furniture: FurnitureObject, preset: MaterialPreset): void {
  // 保存旧材质以便清理
  const oldMaterial = furniture.currentMaterial;

  // 应用新材质 - 处理Group和Mesh两种情况
  if (furniture.mesh instanceof THREE.Group) {
    // 遍历组中的所有子对象，只更换主体材质（跳过金属件如把手）
    furniture.mesh.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        // 检查是否是主体材质（通过名称或材质颜色判断）
        const childMaterial = child.material as THREE.MeshStandardMaterial;
        // 如果颜色与原始材质颜色相似，或者没有特殊标识，则更换
        const originalColor = (furniture.originalMaterial as THREE.MeshStandardMaterial).color;
        const currentColor = childMaterial.color;

        // 计算颜色相似度（简单判断）
        const colorDiff =
          Math.abs(originalColor.r - currentColor.r) +
          Math.abs(originalColor.g - currentColor.g) +
          Math.abs(originalColor.b - currentColor.b);

        // 如果差异小于0.5或者材质名称匹配，则更换
        if (colorDiff < 0.5 || !child.name.includes("handle")) {
          // 为每个Mesh创建独立的材质实例，避免共享导致的问题
          const newMaterial = createMaterialFromPreset(preset);

          // 只在第一次保存原始材质
          if (!child.userData.originalMaterial) {
            child.userData.originalMaterial = child.material;
          }

          // 先保留旧材质引用
          const oldChildMaterial = child.material;

          // 应用新材质
          child.material = newMaterial;

          // 更新furniture的currentMaterial为最后一个创建的材质
          // 这样可以确保重置时使用正确的材质类型
          furniture.currentMaterial = newMaterial;
        }
      }
    });
  } else {
    const newMaterial = createMaterialFromPreset(preset);
    furniture.mesh.material = newMaterial;
    furniture.currentMaterial = newMaterial;
  }

  // 清理旧材质（如果不是原始材质）
  if (oldMaterial !== furniture.originalMaterial) {
    if (Array.isArray(oldMaterial)) {
      oldMaterial.forEach((m) => m.dispose());
    } else {
      oldMaterial.dispose();
    }
  }
}

/**
 * 通过Mesh查找家具对象
 */
export function findFurnitureByMesh(mesh: THREE.Mesh): FurnitureObject | undefined {
  // 检查当前mesh
  let furniture = furnitureObjects.value.find((f) => f.mesh === mesh);
  if (furniture) return furniture;

  // 检查父对象（处理分组情况）
  return furnitureObjects.value.find((f) => f.mesh === mesh.parent || f.mesh.children.includes(mesh));
}

/**
 * 获取可用的材质预设
 */
export function getMaterialPresets(type?: MaterialType): MaterialPreset[] {
  if (type) {
    return MATERIAL_PRESETS[type];
  }
  // 返回所有预设
  return Object.values(MATERIAL_PRESETS).flat();
}

/**
 * 重置家具材质为原始状态
 */
export function resetFurnitureMaterial(furniture: FurnitureObject): void {
  const oldMaterial = furniture.currentMaterial;

  // 处理Group的情况
  if (furniture.mesh instanceof THREE.Group) {
    // 收集所有需要清理的材质
    const materialsToDispose: THREE.Material[] = [];

    furniture.mesh.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh && child.userData.originalMaterial) {
        // 保存当前材质以便清理
        if (child.material !== child.userData.originalMaterial) {
          materialsToDispose.push(child.material);
        }
        // 恢复原始材质
        child.material = child.userData.originalMaterial;
      }
    });

    // 清理所有替换的材质
    materialsToDispose.forEach((mat) => mat.dispose());
  } else {
    furniture.mesh.material = furniture.originalMaterial;
    // 清理当前材质
    if (oldMaterial !== furniture.originalMaterial) {
      oldMaterial.dispose();
    }
  }

  furniture.currentMaterial = furniture.originalMaterial;
}

/**
 * 清理所有家具资源
 */
export function clearAllFurniture(scene: THREE.Scene): void {
  furnitureObjects.value.forEach((furniture) => {
    if (furniture.spotlight) {
      scene.remove(furniture.spotlight);
      furniture.spotlight.dispose();
    }
    furniture.originalMaterial.dispose();
    if (furniture.currentMaterial !== furniture.originalMaterial) {
      furniture.currentMaterial.dispose();
    }
  });
  furnitureObjects.value = [];
  selectedFurniture.value = null;
}

export function useFurnitureDressing() {
  return {
    furnitureObjects,
    selectedFurniture,
    isAnimating,
    registerFurniture,
    unregisterFurniture,
    getAllFurniture,
    getSelectedFurniture,
    selectFurniture,
    deselectFurniture,
    changeFurnitureMaterial,
    findFurnitureByMesh,
    getMaterialPresets,
    resetFurnitureMaterial,
    clearAllFurniture,
  };
}
