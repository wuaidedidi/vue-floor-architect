import { ref, type Ref } from 'vue';
import * as THREE from 'three';
import type { 
  Furniture, 
  FurnitureType, 
  MaterialType, 
  MaterialPreset,
  Point3D 
} from '../types';
import { MATERIAL_PRESETS, generateId } from '../types';

export interface FurnitureContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
}

// 存储所有家具
const furnitures = ref<Furniture[]>([]);
const selectedFurniture = ref<Furniture | null>(null);

// 动画相关
let bounceAnimationId: number | null = null;
let spotlight: THREE.SpotLight | null = null;
let spotlightTarget: THREE.Object3D | null = null;

export function useFurniture(contextRef: Ref<FurnitureContext | null>) {
  
  /**
   * 创建沙发
   */
  function createSofa(position: Point3D): Furniture {
    const group = new THREE.Group();
    
    // 沙发底座
    const baseGeo = new THREE.BoxGeometry(24, 6, 12);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x4a3728,
      roughness: 0.6,
      metalness: 0.1,
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 3;
    base.castShadow = true;
    base.receiveShadow = true;
    base.name = 'sofa-base';
    group.add(base);
    
    // 沙发靠背
    const backGeo = new THREE.BoxGeometry(24, 10, 3);
    const backMat = baseMat.clone();
    const back = new THREE.Mesh(backGeo, backMat);
    back.position.set(0, 8, -4.5);
    back.castShadow = true;
    back.receiveShadow = true;
    back.name = 'sofa-back';
    group.add(back);
    
    // 左扶手
    const armGeo = new THREE.BoxGeometry(4, 8, 12);
    const armMat = baseMat.clone();
    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-10, 4, 0);
    leftArm.castShadow = true;
    leftArm.receiveShadow = true;
    leftArm.name = 'sofa-leftArm';
    group.add(leftArm);
    
    // 右扶手
    const rightArm = new THREE.Mesh(armGeo, armMat.clone());
    rightArm.position.set(10, 4, 0);
    rightArm.castShadow = true;
    rightArm.receiveShadow = true;
    rightArm.name = 'sofa-rightArm';
    group.add(rightArm);
    
    // 坐垫
    const cushionGeo = new THREE.BoxGeometry(7, 2, 10);
    const cushionMat = baseMat.clone();
    const cushion1 = new THREE.Mesh(cushionGeo, cushionMat);
    cushion1.position.set(-5.5, 7, 0.5);
    cushion1.castShadow = true;
    cushion1.receiveShadow = true;
    cushion1.name = 'sofa-cushion';
    group.add(cushion1);
    
    const cushion2 = new THREE.Mesh(cushionGeo, cushionMat.clone());
    cushion2.position.set(5.5, 7, 0.5);
    cushion2.castShadow = true;
    cushion2.receiveShadow = true;
    cushion2.name = 'sofa-cushion';
    group.add(cushion2);
    
    group.position.set(position.x, position.y, position.z);
    group.userData = { isFurniture: true, type: 'sofa' };
    
    const furniture: Furniture = {
      id: generateId(),
      type: 'sofa',
      name: '沙发',
      position: { ...position },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      mesh: group,
      currentMaterial: 'leather'
    };
    
    if (contextRef.value) {
      contextRef.value.scene.add(group);
    }
    
    furnitures.value.push(furniture);
    return furniture;
  }
  
  /**
   * 创建柜子
   */
  function createCabinet(position: Point3D): Furniture {
    const group = new THREE.Group();
    
    // 柜体
    const bodyGeo = new THREE.BoxGeometry(16, 20, 8);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x5d4e37,
      roughness: 0.7,
      metalness: 0.0,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 10;
    body.castShadow = true;
    body.receiveShadow = true;
    body.name = 'cabinet-body';
    group.add(body);
    
    // 柜门1
    const doorGeo = new THREE.BoxGeometry(7, 18, 0.5);
    const doorMat = bodyMat.clone();
    const door1 = new THREE.Mesh(doorGeo, doorMat);
    door1.position.set(-3.8, 10, 4.3);
    door1.castShadow = true;
    door1.receiveShadow = true;
    door1.name = 'cabinet-door';
    group.add(door1);
    
    // 柜门2
    const door2 = new THREE.Mesh(doorGeo, doorMat.clone());
    door2.position.set(3.8, 10, 4.3);
    door2.castShadow = true;
    door2.receiveShadow = true;
    door2.name = 'cabinet-door';
    group.add(door2);
    
    // 把手1
    const handleGeo = new THREE.CylinderGeometry(0.3, 0.3, 2);
    const handleMat = new THREE.MeshStandardMaterial({
      color: 0xc0c0c0,
      roughness: 0.2,
      metalness: 0.9,
    });
    const handle1 = new THREE.Mesh(handleGeo, handleMat);
    handle1.rotation.z = Math.PI / 2;
    handle1.position.set(-2, 10, 4.8);
    handle1.castShadow = true;
    group.add(handle1);
    
    // 把手2
    const handle2 = new THREE.Mesh(handleGeo, handleMat.clone());
    handle2.rotation.z = Math.PI / 2;
    handle2.position.set(2, 10, 4.8);
    handle2.castShadow = true;
    group.add(handle2);
    
    // 柜脚
    const legGeo = new THREE.CylinderGeometry(0.5, 0.3, 2);
    const legMat = handleMat.clone();
    const legPositions = [
      [-7, 1, -3.5], [7, 1, -3.5],
      [-7, 1, 3.5], [7, 1, 3.5]
    ];
    legPositions.forEach(pos => {
      const leg = new THREE.Mesh(legGeo, legMat.clone());
      leg.position.set(pos[0], pos[1], pos[2]);
      leg.castShadow = true;
      group.add(leg);
    });
    
    group.position.set(position.x, position.y, position.z);
    group.userData = { isFurniture: true, type: 'cabinet' };
    
    const furniture: Furniture = {
      id: generateId(),
      type: 'cabinet',
      name: '储物柜',
      position: { ...position },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      mesh: group,
      currentMaterial: 'wood'
    };
    
    if (contextRef.value) {
      contextRef.value.scene.add(group);
    }
    
    furnitures.value.push(furniture);
    return furniture;
  }
  
  /**
   * 应用材质到家具
   */
  function applyMaterial(furniture: Furniture, preset: MaterialPreset) {
    if (!furniture.mesh) return;
    
    const newMaterial = new THREE.MeshStandardMaterial({
      color: preset.color,
      roughness: preset.roughness,
      metalness: preset.metalness,
    });
    
    // 皮革材质添加清漆效果
    if (preset.type === 'leather') {
      newMaterial.clearcoat = preset.clearcoat || 0;
      newMaterial.clearcoatRoughness = preset.clearcoatRoughness || 0;
    }
    
    furniture.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // 保留把手等金属部件的材质
        if (child.name.includes('handle') || child.name.includes('leg')) {
          return;
        }
        child.material = newMaterial.clone();
      }
    });
    
    furniture.currentMaterial = preset.type;
  }
  
  /**
   * 选中家具
   */
  function selectFurniture(furniture: Furniture | null) {
    // 取消之前的选中状态
    if (selectedFurniture.value && selectedFurniture.value.mesh) {
      removeSpotlight();
    }
    
    selectedFurniture.value = furniture;
    
    if (furniture && furniture.mesh) {
      // 添加聚光灯
      addSpotlight(furniture);
      // 播放弹跳动画
      playBounceAnimation(furniture);
    }
  }
  
  /**
   * 添加聚光灯
   */
  function addSpotlight(furniture: Furniture) {
    if (!contextRef.value || !furniture.mesh) return;
    
    const { scene } = contextRef.value;
    
    // 移除旧的聚光灯
    removeSpotlight();
    
    // 创建聚光灯目标
    spotlightTarget = new THREE.Object3D();
    const worldPos = new THREE.Vector3();
    furniture.mesh.getWorldPosition(worldPos);
    spotlightTarget.position.copy(worldPos);
    scene.add(spotlightTarget);
    
    // 创建聚光灯
    spotlight = new THREE.SpotLight(0xffffff, 2);
    spotlight.position.set(worldPos.x, worldPos.y + 30, worldPos.z);
    spotlight.target = spotlightTarget;
    spotlight.angle = Math.PI / 6;
    spotlight.penumbra = 0.3;
    spotlight.decay = 1;
    spotlight.distance = 100;
    spotlight.castShadow = true;
    
    scene.add(spotlight);
  }
  
  /**
   * 移除聚光灯
   */
  function removeSpotlight() {
    if (!contextRef.value) return;
    const { scene } = contextRef.value;
    
    if (spotlight) {
      scene.remove(spotlight);
      spotlight.dispose();
      spotlight = null;
    }
    
    if (spotlightTarget) {
      scene.remove(spotlightTarget);
      spotlightTarget = null;
    }
  }
  
  /**
   * 播放弹跳动画
   */
  function playBounceAnimation(furniture: Furniture) {
    if (!furniture.mesh) return;
    
    // 取消之前的动画
    if (bounceAnimationId !== null) {
      cancelAnimationFrame(bounceAnimationId);
    }
    
    const mesh = furniture.mesh;
    const originalScale = mesh.scale.clone();
    const startTime = Date.now();
    const duration = 400; // 动画持续时间（毫秒）
    
    function animate() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // 弹跳效果：先放大到1.1，然后回弹到1.0
      let scaleMultiplier: number;
      if (progress < 0.3) {
        // 放大阶段
        const p = progress / 0.3;
        scaleMultiplier = 1 + 0.1 * Math.sin(p * Math.PI / 2);
      } else if (progress < 0.6) {
        // 回弹阶段
        const p = (progress - 0.3) / 0.3;
        scaleMultiplier = 1.1 - 0.15 * Math.sin(p * Math.PI / 2);
      } else {
        // 稳定阶段
        const p = (progress - 0.6) / 0.4;
        scaleMultiplier = 0.95 + 0.05 * Math.sin(p * Math.PI / 2);
      }
      
      mesh.scale.set(
        originalScale.x * scaleMultiplier,
        originalScale.y * scaleMultiplier,
        originalScale.z * scaleMultiplier
      );
      
      if (progress < 1) {
        bounceAnimationId = requestAnimationFrame(animate);
      } else {
        // 确保最终回到原始大小
        mesh.scale.copy(originalScale);
        bounceAnimationId = null;
      }
    }
    
    animate();
  }
  
  /**
   * 射线检测获取家具
   */
  function getFurnitureFromRaycast(event: MouseEvent, canvas: HTMLCanvasElement): Furniture | null {
    if (!contextRef.value) return null;
    
    const { camera, scene } = contextRef.value;
    
    const rect = canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    
    // 获取所有家具网格
    const furnitureMeshes: THREE.Object3D[] = [];
    furnitures.value.forEach(f => {
      if (f.mesh) furnitureMeshes.push(f.mesh);
    });
    
    const intersects = raycaster.intersectObjects(furnitureMeshes, true);
    
    if (intersects.length > 0) {
      // 找到被点击的家具
      let obj = intersects[0].object;
      while (obj.parent && !obj.userData.isFurniture) {
        obj = obj.parent;
      }
      
      if (obj.userData.isFurniture) {
        return furnitures.value.find(f => f.mesh === obj) || null;
      }
    }
    
    return null;
  }
  
  /**
   * 删除家具
   */
  function removeFurniture(furniture: Furniture) {
    if (!contextRef.value || !furniture.mesh) return;
    
    const { scene } = contextRef.value;
    
    // 如果是当前选中的，先取消选中
    if (selectedFurniture.value?.id === furniture.id) {
      selectFurniture(null);
    }
    
    scene.remove(furniture.mesh);
    
    // 清理资源
    furniture.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    
    const index = furnitures.value.findIndex(f => f.id === furniture.id);
    if (index > -1) {
      furnitures.value.splice(index, 1);
    }
  }
  
  /**
   * 清除所有家具
   */
  function clearAllFurniture() {
    selectFurniture(null);
    
    const furnitureList = [...furnitures.value];
    furnitureList.forEach(f => removeFurniture(f));
  }
  
  return {
    furnitures,
    selectedFurniture,
    createSofa,
    createCabinet,
    applyMaterial,
    selectFurniture,
    getFurnitureFromRaycast,
    removeFurniture,
    clearAllFurniture,
    MATERIAL_PRESETS
  };
}
