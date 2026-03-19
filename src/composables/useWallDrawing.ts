import { ref, watch, type Ref } from 'vue';
import * as THREE from 'three';
import { useEditorStore } from '../stores/editorStore';
import type { ThreeSceneContext } from './useThreeScene';
import type { Point3D } from '../types';
import { mouseToNDC, getGroundIntersection, createLineMaterial } from '../utils/threeHelpers';
import { createPointMarker, createLineGeometry } from '../utils/geometryUtils';

export function useWallDrawing(
  contextRef: Ref<ThreeSceneContext | null>,
  canvasRef: Ref<HTMLCanvasElement | null>
) {
  const store = useEditorStore();
  
  // 临时绘制对象
  const startMarker = ref<THREE.Mesh | null>(null);
  const previewLine = ref<THREE.Line | null>(null);
  
  // 追踪当前鼠标位置
  const currentMousePosition = ref<Point3D | null>(null);

  /**
   * 处理双击事件 - 设置起点或终点
   */
  function handleDoubleClick(event: MouseEvent) {
    if (store.mode !== 'draw-wall') return;
    if (!contextRef.value || !canvasRef.value) return;

    const { camera, groundPlane, scene } = contextRef.value;
    const mouse = mouseToNDC(event, canvasRef.value);
    const intersection = getGroundIntersection(mouse, camera, groundPlane);

    if (!intersection) return;

    const point: Point3D = {
      x: intersection.x,
      y: 0.1,
      z: intersection.z
    };

    if (!store.currentWallStart) {
      // 设置起点
      store.setWallStart(point);
      
      // 创建起点标记
      startMarker.value = createPointMarker(point, 0.6);
      startMarker.value.material = new THREE.MeshBasicMaterial({ 
        color: 0xff9f43,
        transparent: true,
        opacity: 0.9
      });
      startMarker.value.name = 'wall-start-marker';
      scene.add(startMarker.value);
    } else {
      // 设置终点，完成墙体
      store.completeWallSegment(point);
      
      // 创建墙体线条
      createWallLine();
      
      // 清理临时对象
      clearTempObjects();
    }
  }

  /**
   * 处理鼠标移动 - 预览墙体线条
   */
  function handleMouseMove(event: MouseEvent) {
    if (store.mode !== 'draw-wall') return;
    if (!contextRef.value || !canvasRef.value) return;
    if (!store.currentWallStart) return;

    const { camera, groundPlane, scene } = contextRef.value;
    const mouse = mouseToNDC(event, canvasRef.value);
    const intersection = getGroundIntersection(mouse, camera, groundPlane);

    if (intersection) {
      currentMousePosition.value = {
        x: intersection.x,
        y: 0.1,
        z: intersection.z
      };

      updatePreviewLine(scene);
    }
  }

  /**
   * 更新预览线条
   */
  function updatePreviewLine(scene: THREE.Scene) {
    // 移除旧预览线
    if (previewLine.value) {
      scene.remove(previewLine.value);
      previewLine.value.geometry.dispose();
      (previewLine.value.material as THREE.Material).dispose();
    }

    if (!store.currentWallStart || !currentMousePosition.value) return;

    const points = [store.currentWallStart, currentMousePosition.value];
    const geometry = createLineGeometry(points);
    const material = new THREE.LineDashedMaterial({
      color: 0xff9f43,
      dashSize: 2,
      gapSize: 1,
      transparent: true,
      opacity: 0.7
    });
    
    previewLine.value = new THREE.Line(geometry, material);
    previewLine.value.computeLineDistances();
    previewLine.value.name = 'wall-preview-line';
    scene.add(previewLine.value);
  }

  /**
   * 创建墙体显示线条
   */
  function createWallLine() {
    if (!contextRef.value) return;
    const { scene } = contextRef.value;

    const lastWall = store.wallSegments[store.wallSegments.length - 1];
    if (!lastWall) return;

    const points = [lastWall.start, lastWall.end];
    const geometry = createLineGeometry(points);
    const material = createLineMaterial(0xf59e0b);
    const line = new THREE.Line(geometry, material);
    line.name = `wall-segment-${lastWall.id}`;
    scene.add(line);

    // 存储引用
    lastWall.lineMesh = line;

    // 在两端添加小球标记
    const startMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b })
    );
    startMarker.position.set(lastWall.start.x, lastWall.start.y, lastWall.start.z);
    scene.add(startMarker);

    const endMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b })
    );
    endMarker.position.set(lastWall.end.x, lastWall.end.y, lastWall.end.z);
    scene.add(endMarker);
  }

  /**
   * 清理临时绘制对象
   */
  function clearTempObjects() {
    if (!contextRef.value) return;
    const { scene } = contextRef.value;

    if (startMarker.value) {
      scene.remove(startMarker.value);
      startMarker.value.geometry.dispose();
      (startMarker.value.material as THREE.Material).dispose();
      startMarker.value = null;
    }

    if (previewLine.value) {
      scene.remove(previewLine.value);
      previewLine.value.geometry.dispose();
      (previewLine.value.material as THREE.Material).dispose();
      previewLine.value = null;
    }

    currentMousePosition.value = null;
  }

  /**
   * 取消当前墙体绘制
   */
  function cancelDrawing() {
    store.cancelCurrentDrawing();
    clearTempObjects();
  }

  // 监听模式变化
  watch(() => store.mode, (newMode) => {
    if (newMode !== 'draw-wall') {
      clearTempObjects();
    }
  });

  return {
    handleDoubleClick,
    handleMouseMove,
    cancelDrawing,
    clearTempObjects
  };
}
