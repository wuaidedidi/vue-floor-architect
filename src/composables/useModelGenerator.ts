import { type Ref, watch } from 'vue';
import * as THREE from 'three';
import { useEditorStore } from '../stores/editorStore';
import type { ThreeSceneContext } from './useThreeScene';
import { 
  DEFAULT_MODEL_PARAMS, 
  CONSTRUCTION_PHASES,
  type Point3D
} from '../types';
import { createShapeFromPoints, distanceXZ, calculateAngleXZ, midpoint } from '../utils/geometryUtils';
import { createConstructionMaterial, getPhaseFromProgress } from '../utils/constructionShaders';

export function useModelGenerator(contextRef: Ref<ThreeSceneContext | null>) {
  const store = useEditorStore();
  
  // 存储生成的模型
  const generatedMeshes: THREE.Mesh[] = [];
  const wallMeshes: THREE.Mesh[] = [];

  // 监听施工阶段变化 - 使用时间轴的整体进度值
  watch(
    () => {
      // 将阶段和进度转换为 0-3 的整体进度
      const phaseMap: Record<string, number> = {
        'rough': 0,
        'plumbing': 1,
        'hard': 2,
        'soft': 3
      };
      const baseProgress = phaseMap[store.constructionPhase] || 0;
      const globalProgress = baseProgress + store.constructionProgress;
      return globalProgress;
    },
    (globalProgress) => {
      updateWallMaterials(globalProgress);
    },
    { immediate: false }
  );

  /**
   * 更新墙体材质
   */
  function updateWallMaterials(globalProgress: number) {
    const phaseInfo = getPhaseFromProgress(globalProgress);
    const phaseKeys = ['rough', 'plumbing', 'hard', 'soft'];
    
    const fromPhaseKey = phaseKeys[phaseInfo.fromIndex];
    const toPhaseKey = phaseKeys[phaseInfo.toIndex];
    
    const paramsFrom = CONSTRUCTION_PHASES[fromPhaseKey as keyof typeof CONSTRUCTION_PHASES];
    const paramsTo = CONSTRUCTION_PHASES[toPhaseKey as keyof typeof CONSTRUCTION_PHASES];
    
    wallMeshes.forEach(mesh => {
      const material = mesh.material as THREE.ShaderMaterial;
      if (material && material.uniforms) {
        // 更新颜色
        material.uniforms.uColorFrom.value.setHex(paramsFrom.color);
        material.uniforms.uColorTo.value.setHex(paramsTo.color);
        
        // 更新材质参数
        material.uniforms.uRoughnessFrom.value = paramsFrom.roughness;
        material.uniforms.uRoughnessTo.value = paramsTo.roughness;
        material.uniforms.uMetalnessFrom.value = paramsFrom.metalness;
        material.uniforms.uMetalnessTo.value = paramsTo.metalness;
        material.uniforms.uNoiseScaleFrom.value = paramsFrom.noiseScale;
        material.uniforms.uNoiseScaleTo.value = paramsTo.noiseScale;
        material.uniforms.uNoiseIntensityFrom.value = paramsFrom.noiseIntensity;
        material.uniforms.uNoiseIntensityTo.value = paramsTo.noiseIntensity;
        
        // 更新过渡位置（从上到下）
        // transitionY: 1 = 全部显示from材质, 0 = 全部显示to材质
        material.uniforms.uTransitionY.value = phaseInfo.transitionY;
        material.uniforms.uGlobalProgress.value = globalProgress;
        
        material.needsUpdate = true;
      }
    });
  }

  /**
   * 生成所有3D模型
   */
  function generateModels() {
    if (!contextRef.value) return;

    // 清除之前生成的模型
    clearGeneratedModels();

    // 生成地板模型
    generateFloorModels();

    // 生成墙体模型
    generateWallModels();

    store.setGeneratedModel(true);
    store.updateStatusMessage('3D模型已生成！使用鼠标旋转查看');
  }

  /**
   * 生成地板模型
   */
  function generateFloorModels() {
    if (!contextRef.value) return;
    const { scene } = contextRef.value;

    store.floorPolygons.forEach((polygon) => {
      if (polygon.points.length < 3) return;

      // 创建Shape
      const shape = createShapeFromPoints(polygon.points);

      // 挤出设置
      const extrudeSettings = {
        depth: DEFAULT_MODEL_PARAMS.floorThickness,
        bevelEnabled: false
      };

      // 创建几何体
      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      
      // 旋转使其在XZ平面上（ExtrudeGeometry默认在XY平面）
      geometry.rotateX(-Math.PI / 2);

      // 创建材质
      const material = new THREE.MeshPhongMaterial({
        color: DEFAULT_MODEL_PARAMS.floorColor,
        transparent: true,
        opacity: DEFAULT_MODEL_PARAMS.floorOpacity,
        side: THREE.DoubleSide,
        shininess: 60
      });

      // 创建网格
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = -DEFAULT_MODEL_PARAMS.floorThickness; // 地板底部在y=0
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      mesh.name = `floor-model-${polygon.id}`;

      scene.add(mesh);
      generatedMeshes.push(mesh);

      // 存储引用
      polygon.mesh = mesh;
    });
  }

  /**
   * 生成墙体模型
   */
  function generateWallModels() {
    if (!contextRef.value) return;
    const { scene } = contextRef.value;

    store.wallSegments.forEach((wall) => {
      const length = distanceXZ(wall.start, wall.end);
      if (length < 0.1) return; // 忽略太短的墙

      // 创建墙体几何体
      const geometry = new THREE.BoxGeometry(
        length,
        DEFAULT_MODEL_PARAMS.wallHeight,
        DEFAULT_MODEL_PARAMS.wallThickness
      );

      // 创建施工阶段材质
      const material = createConstructionMaterial(
        DEFAULT_MODEL_PARAMS.wallHeight
      );

      // 创建网格
      const mesh = new THREE.Mesh(geometry, material);

      // 计算墙体位置（中心点）
      const center = midpoint(wall.start, wall.end);
      mesh.position.set(
        center.x,
        DEFAULT_MODEL_PARAMS.wallHeight / 2, // 墙体底部在地面上
        center.z
      );

      // 计算墙体旋转角度
      const angle = calculateAngleXZ(wall.start, wall.end);
      mesh.rotation.y = -angle;

      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = `wall-model-${wall.id}`;

      scene.add(mesh);
      generatedMeshes.push(mesh);
      wallMeshes.push(mesh);

      // 存储引用
      wall.mesh = mesh;
    });
    
    // 初始化材质状态
    const phaseMap: Record<string, number> = {
      'rough': 0,
      'plumbing': 1,
      'hard': 2,
      'soft': 3
    };
    const baseProgress = phaseMap[store.constructionPhase] || 0;
    const globalProgress = baseProgress + store.constructionProgress;
    updateWallMaterials(globalProgress);
  }

  /**
   * 清除生成的模型
   */
  function clearGeneratedModels() {
    if (!contextRef.value) return;
    const { scene } = contextRef.value;

    generatedMeshes.forEach((mesh) => {
      scene.remove(mesh);
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(m => m.dispose());
      } else {
        mesh.material.dispose();
      }
    });

    generatedMeshes.length = 0;
    wallMeshes.length = 0;
    store.setGeneratedModel(false);
  }

  /**
   * 重新生成模型
   */
  function regenerateModels() {
    clearGeneratedModels();
    generateModels();
  }

  return {
    generateModels,
    clearGeneratedModels,
    regenerateModels,
    updateWallMaterials
  };
}
