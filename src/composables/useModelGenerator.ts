import { type Ref } from 'vue';
import * as THREE from 'three';
import { useEditorStore } from '../stores/editorStore';
import type { ThreeSceneContext } from './useThreeScene';
import { DEFAULT_MODEL_PARAMS, type Point3D } from '../types';
import { createShapeFromPoints, distanceXZ, calculateAngleXZ, midpoint } from '../utils/geometryUtils';

export function useModelGenerator(contextRef: Ref<ThreeSceneContext | null>) {
  const store = useEditorStore();
  
  // 存储生成的模型
  const generatedMeshes: THREE.Mesh[] = [];

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

      // 创建材质
      const material = new THREE.MeshPhongMaterial({
        color: DEFAULT_MODEL_PARAMS.wallColor,
        side: THREE.DoubleSide,
        shininess: 30
      });

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

      // 存储引用
      wall.mesh = mesh;
    });
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
    regenerateModels
  };
}
