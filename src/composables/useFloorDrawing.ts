import { ref, watch, type Ref } from 'vue';
import * as THREE from 'three';
import { useEditorStore } from '../stores/editorStore';
import type { ThreeSceneContext } from './useThreeScene';
import type { Point3D } from '../types';
import { mouseToNDC, getGroundIntersection, createLineMaterial } from '../utils/threeHelpers';
import { createPointMarker, createLineGeometry } from '../utils/geometryUtils';

export function useFloorDrawing(
  contextRef: Ref<ThreeSceneContext | null>,
  canvasRef: Ref<HTMLCanvasElement | null>
) {
  const store = useEditorStore();
  
  // 临时绘制对象
  const tempMarkers = ref<THREE.Mesh[]>([]);
  const tempLine = ref<THREE.Line | null>(null);
  const previewLine = ref<THREE.Line | null>(null);
  
  // 鼠标位置跟踪
  const currentMousePosition = ref<Point3D | null>(null);

  /**
   * 处理点击事件 - 添加顶点
   */
  function handleClick(event: MouseEvent) {
    if (store.mode !== 'draw-floor') return;
    if (!contextRef.value || !canvasRef.value) return;

    const { camera, groundPlane, scene } = contextRef.value;
    const mouse = mouseToNDC(event, canvasRef.value);
    const intersection = getGroundIntersection(mouse, camera, groundPlane);

    if (intersection) {
      const point: Point3D = {
        x: intersection.x,
        y: 0.1, // 稍微抬高，便于可视化
        z: intersection.z
      };

      // 添加点到store
      store.addFloorPoint(point);

      // 创建点标记
      const marker = createPointMarker(point, 0.8);
      marker.name = 'floor-marker';
      scene.add(marker);
      tempMarkers.value.push(marker);

      // 更新绘制线条
      updateDrawingLine();
    }
  }

  /**
   * 处理双击事件 - 完成绘制
   */
  function handleDoubleClick(event: MouseEvent) {
    if (store.mode !== 'draw-floor') return;
    if (store.currentFloorPoints.length < 3) {
      store.updateStatusMessage('需要至少3个点来创建地板区域');
      return;
    }

    // 完成多边形
    store.completeFloorPolygon();

    // 创建闭合线条显示
    createClosedPolygonLine();

    // 清理临时对象
    clearTempObjects();
  }

  /**
   * 处理鼠标移动 - 预览线条
   */
  function handleMouseMove(event: MouseEvent) {
    if (store.mode !== 'draw-floor') return;
    if (!contextRef.value || !canvasRef.value) return;
    if (store.currentFloorPoints.length === 0) return;

    const { camera, groundPlane, scene } = contextRef.value;
    const mouse = mouseToNDC(event, canvasRef.value);
    const intersection = getGroundIntersection(mouse, camera, groundPlane);

    if (intersection) {
      currentMousePosition.value = {
        x: intersection.x,
        y: 0.1,
        z: intersection.z
      };

      // 更新预览线条
      updatePreviewLine(scene);
    }
  }

  /**
   * 更新绘制中的线条
   */
  function updateDrawingLine() {
    if (!contextRef.value) return;
    const { scene } = contextRef.value;

    // 移除旧线条
    if (tempLine.value) {
      scene.remove(tempLine.value);
      tempLine.value.geometry.dispose();
      (tempLine.value.material as THREE.Material).dispose();
    }

    if (store.currentFloorPoints.length < 2) return;

    // 创建新线条
    const geometry = createLineGeometry(store.currentFloorPoints);
    const material = createLineMaterial(0x00ff88);
    tempLine.value = new THREE.Line(geometry, material);
    tempLine.value.name = 'floor-temp-line';
    scene.add(tempLine.value);
  }

  /**
   * 更新预览线条（从最后一个点到鼠标位置）
   */
  function updatePreviewLine(scene: THREE.Scene) {
    // 移除旧预览线
    if (previewLine.value) {
      scene.remove(previewLine.value);
      previewLine.value.geometry.dispose();
      (previewLine.value.material as THREE.Material).dispose();
    }

    if (!currentMousePosition.value || store.currentFloorPoints.length === 0) return;

    const lastPoint = store.currentFloorPoints[store.currentFloorPoints.length - 1];
    const points = [lastPoint, currentMousePosition.value];

    // 如果有多于2个点，也显示回到起点的预览
    if (store.currentFloorPoints.length >= 2) {
      points.push(store.currentFloorPoints[0]);
    }

    const geometry = createLineGeometry(points);
    const material = new THREE.LineDashedMaterial({
      color: 0x00ff88,
      dashSize: 2,
      gapSize: 1,
      transparent: true,
      opacity: 0.6
    });
    
    previewLine.value = new THREE.Line(geometry, material);
    previewLine.value.computeLineDistances();
    previewLine.value.name = 'floor-preview-line';
    scene.add(previewLine.value);
  }

  /**
   * 创建闭合多边形显示线条
   */
  function createClosedPolygonLine() {
    if (!contextRef.value) return;
    const { scene } = contextRef.value;

    const lastPolygon = store.floorPolygons[store.floorPolygons.length - 1];
    if (!lastPolygon) return;

    const geometry = createLineGeometry(lastPolygon.points, true);
    const material = createLineMaterial(0x4ade80);
    const line = new THREE.Line(geometry, material);
    line.name = `floor-polygon-${lastPolygon.id}`;
    scene.add(line);

    // 存储引用
    lastPolygon.lineMesh = line;
  }

  /**
   * 清理临时绘制对象
   */
  function clearTempObjects() {
    if (!contextRef.value) return;
    const { scene } = contextRef.value;

    // 清理点标记
    tempMarkers.value.forEach(marker => {
      scene.remove(marker);
      marker.geometry.dispose();
      (marker.material as THREE.Material).dispose();
    });
    tempMarkers.value = [];

    // 清理临时线条
    if (tempLine.value) {
      scene.remove(tempLine.value);
      tempLine.value.geometry.dispose();
      (tempLine.value.material as THREE.Material).dispose();
      tempLine.value = null;
    }

    // 清理预览线条
    if (previewLine.value) {
      scene.remove(previewLine.value);
      previewLine.value.geometry.dispose();
      (previewLine.value.material as THREE.Material).dispose();
      previewLine.value = null;
    }

    currentMousePosition.value = null;
  }

  /**
   * 取消当前绘制
   */
  function cancelDrawing() {
    store.cancelCurrentDrawing();
    clearTempObjects();
  }

  // 监听模式变化，切换模式时清理
  watch(() => store.mode, (newMode) => {
    if (newMode !== 'draw-floor') {
      clearTempObjects();
    }
  });

  return {
    handleClick,
    handleDoubleClick,
    handleMouseMove,
    cancelDrawing,
    clearTempObjects
  };
}
