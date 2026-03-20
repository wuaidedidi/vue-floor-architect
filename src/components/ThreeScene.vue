<template>
  <div class="three-scene-container" ref="containerRef">
    <canvas ref="canvasRef" class="three-canvas"></canvas>

    <!-- 绘制辅助提示 -->
    <div class="drawing-hints" v-if="showHints">
      <div class="hint" v-if="editorStore.mode === 'draw-floor' && editorStore.currentFloorPoints.length > 0">
        <span class="hint-icon">💡</span>
        <span>已标记 {{ editorStore.currentFloorPoints.length }} 个点，双击完成绘制</span>
      </div>
      <div class="hint" v-if="editorStore.mode === 'draw-wall' && editorStore.currentWallStart">
        <span class="hint-icon">💡</span>
        <span>已设置起点，双击设置终点完成墙体</span>
      </div>
    </div>

    <!-- 快捷键提示 -->
    <div class="shortcuts-hint">
      <div class="shortcut-item"><kbd>左键</kbd> 旋转</div>
      <div class="shortcut-item"><kbd>右键</kbd> 平移</div>
      <div class="shortcut-item"><kbd>滚轮</kbd> 缩放</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useEditorStore } from "../stores/editorStore";
import type { Point3D, FloorPlanImage } from "../types";
import { DEFAULT_MODEL_PARAMS, generateId } from "../types";
import {
  createShapeFromPoints,
  distanceXZ,
  calculateAngleXZ,
  midpoint,
  createPointMarker,
  createLineGeometry,
} from "../utils/geometryUtils";
import { createTransitionShaderMaterial, updateTransitionShader, STAGE_COLORS } from "../utils/shaders";

const emit = defineEmits<{
  (e: "scene-ready"): void;
}>();

const editorStore = useEditorStore();
const containerRef = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);

// Three.js 对象 - 使用普通变量，完全避免 Vue 响应式
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let groundPlane: THREE.Mesh;
let animationId: number | null = null;

// 临时绘制对象
let tempFloorMarkers: THREE.Mesh[] = [];
let tempFloorLine: THREE.Line | null = null;
let floorPreviewLine: THREE.Line | null = null;
let wallStartMarker: THREE.Mesh | null = null;
let wallPreviewLine: THREE.Line | null = null;

// 墙体材质动画相关
let wallMeshes: THREE.Mesh[] = [];
let animationFrameId: number | null = null;

const showHints = computed(() => {
  return (
    (editorStore.mode === "draw-floor" && editorStore.currentFloorPoints.length > 0) ||
    (editorStore.mode === "draw-wall" && editorStore.currentWallStart)
  );
});

// ================== 初始化 Three.js ==================
function initThree() {
  if (!canvasRef.value) return;

  const canvas = canvasRef.value;
  const container = canvas.parentElement || document.body;
  const width = container.clientWidth;
  const height = container.clientHeight;

  // 创建场景
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);

  // 创建相机
  camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 2000);
  camera.position.set(50, 80, 100);
  camera.lookAt(0, 0, 0);

  // 创建渲染器
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = true;

  // 创建控制器
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 10;
  controls.maxDistance = 500;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;

  // 添加灯光
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(50, 100, 50);
  directionalLight.castShadow = true;
  scene.add(directionalLight);

  // 添加网格
  const grid = new THREE.GridHelper(200, 40, 0x444466, 0x333344);
  (grid.material as THREE.Material).opacity = 0.6;
  (grid.material as THREE.Material).transparent = true;
  scene.add(grid);

  // 创建地面平面（用于射线检测）
  const planeGeo = new THREE.PlaneGeometry(1000, 1000);
  const planeMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
  groundPlane = new THREE.Mesh(planeGeo, planeMat);
  groundPlane.rotation.x = -Math.PI / 2;
  groundPlane.position.y = 0;
  groundPlane.name = "ground-plane";
  scene.add(groundPlane);

  // 开始动画循环
  animate();
  emit("scene-ready");
}

function animate() {
  animationId = requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function handleResize() {
  if (!canvasRef.value) return;
  const container = canvasRef.value.parentElement || document.body;
  const width = container.clientWidth;
  const height = container.clientHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

// ================== 射线检测 ==================
function getGroundPoint(event: MouseEvent): THREE.Vector3 | null {
  if (!canvasRef.value) return null;

  const rect = canvasRef.value.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(groundPlane);

  return intersects.length > 0 ? intersects[0].point : null;
}

// ================== 地板绘制 ==================
function handleFloorClick(event: MouseEvent) {
  const point = getGroundPoint(event);
  if (!point) return;

  const p: Point3D = { x: point.x, y: 0.1, z: point.z };
  editorStore.addFloorPoint(p);

  // 添加点标记
  const marker = createPointMarker(p, 0.8);
  marker.name = "floor-marker";
  scene.add(marker);
  tempFloorMarkers.push(marker);

  updateFloorDrawingLine();
}

function handleFloorDoubleClick() {
  if (editorStore.currentFloorPoints.length < 3) {
    editorStore.updateStatusMessage("需要至少3个点来创建地板区域");
    return;
  }

  // 完成多边形
  const points = [...editorStore.currentFloorPoints];
  editorStore.completeFloorPolygon();

  // 创建闭合线条
  const lastPolygon = editorStore.floorPolygons[editorStore.floorPolygons.length - 1];
  if (lastPolygon) {
    const geometry = createLineGeometry(lastPolygon.points, true);
    const material = new THREE.LineBasicMaterial({ color: 0x4ade80, linewidth: 2 });
    const line = new THREE.Line(geometry, material);
    line.name = `floor-polygon-${lastPolygon.id}`;
    scene.add(line);
    lastPolygon.lineMesh = line;
  }

  clearFloorTempObjects();
}

function updateFloorDrawingLine() {
  // 移除旧线条
  if (tempFloorLine) {
    scene.remove(tempFloorLine);
    tempFloorLine.geometry.dispose();
    (tempFloorLine.material as THREE.Material).dispose();
  }

  if (editorStore.currentFloorPoints.length < 2) return;

  const geometry = createLineGeometry(editorStore.currentFloorPoints);
  const material = new THREE.LineBasicMaterial({ color: 0x00ff88 });
  tempFloorLine = new THREE.Line(geometry, material);
  tempFloorLine.name = "floor-temp-line";
  scene.add(tempFloorLine);
}

function clearFloorTempObjects() {
  tempFloorMarkers.forEach((m) => {
    scene.remove(m);
    m.geometry.dispose();
    (m.material as THREE.Material).dispose();
  });
  tempFloorMarkers = [];

  if (tempFloorLine) {
    scene.remove(tempFloorLine);
    tempFloorLine.geometry.dispose();
    (tempFloorLine.material as THREE.Material).dispose();
    tempFloorLine = null;
  }

  if (floorPreviewLine) {
    scene.remove(floorPreviewLine);
    floorPreviewLine.geometry.dispose();
    (floorPreviewLine.material as THREE.Material).dispose();
    floorPreviewLine = null;
  }
}

// ================== 墙体绘制 ==================
function handleWallDoubleClick(event: MouseEvent) {
  const point = getGroundPoint(event);
  if (!point) return;

  const p: Point3D = { x: point.x, y: 0.1, z: point.z };

  if (!editorStore.currentWallStart) {
    // 设置起点
    editorStore.setWallStart(p);

    // 创建起点标记
    const geo = new THREE.SphereGeometry(0.6, 16, 16);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff9f43 });
    wallStartMarker = new THREE.Mesh(geo, mat);
    wallStartMarker.position.set(p.x, p.y, p.z);
    scene.add(wallStartMarker);
  } else {
    // 完成墙体
    editorStore.completeWallSegment(p);

    // 创建墙体线条
    const lastWall = editorStore.wallSegments[editorStore.wallSegments.length - 1];
    if (lastWall) {
      const geometry = createLineGeometry([lastWall.start, lastWall.end]);
      const material = new THREE.LineBasicMaterial({ color: 0xf59e0b });
      const line = new THREE.Line(geometry, material);
      line.name = `wall-segment-${lastWall.id}`;
      scene.add(line);
      lastWall.lineMesh = line;

      // 端点标记
      const startMk = new THREE.Mesh(new THREE.SphereGeometry(0.4), new THREE.MeshBasicMaterial({ color: 0xf59e0b }));
      startMk.position.set(lastWall.start.x, lastWall.start.y, lastWall.start.z);
      scene.add(startMk);

      const endMk = new THREE.Mesh(new THREE.SphereGeometry(0.4), new THREE.MeshBasicMaterial({ color: 0xf59e0b }));
      endMk.position.set(lastWall.end.x, lastWall.end.y, lastWall.end.z);
      scene.add(endMk);
    }

    clearWallTempObjects();
  }
}

function clearWallTempObjects() {
  if (wallStartMarker) {
    scene.remove(wallStartMarker);
    wallStartMarker.geometry.dispose();
    (wallStartMarker.material as THREE.Material).dispose();
    wallStartMarker = null;
  }

  if (wallPreviewLine) {
    scene.remove(wallPreviewLine);
    wallPreviewLine.geometry.dispose();
    (wallPreviewLine.material as THREE.Material).dispose();
    wallPreviewLine = null;
  }
}

// ================== 施工阶段动画 ==================
function updateWallMaterials() {
  const { constructionStage, materialTransition } = editorStore;

  wallMeshes.forEach((mesh) => {
    const material = mesh.material as THREE.ShaderMaterial;
    if (material && material.uniforms) {
      updateTransitionShader(
        material,
        constructionStage,
        materialTransition.progress,
        materialTransition.fromStage,
        materialTransition.toStage,
      );
    }
  });
}

// 持续更新着色器时间
function startShaderAnimation() {
  function animate() {
    updateWallMaterials();
    animationFrameId = requestAnimationFrame(animate);
  }
  animate();
}

function stopShaderAnimation() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

// ================== 模型生成 ==================
function generateModels() {
  console.log("开始生成模型，地板多边形数量:", editorStore.floorPolygons.length);

  // 生成地板模型
  editorStore.floorPolygons.forEach((polygon, index) => {
    console.log(`处理地板 ${index}:`, polygon.points);
    if (polygon.points.length < 3) {
      console.warn("地板顶点不足3个，跳过");
      return;
    }

    // 创建 Shape - 我们需要在 XY 平面创建形状，然后整体旋转
    // Shape 的坐标系: X → X, Y → -Z (因为旋转后Y轴变为-Z方向)
    const shape = new THREE.Shape();
    // 第一个点
    shape.moveTo(polygon.points[0].x, -polygon.points[0].z);
    // 后续点
    for (let i = 1; i < polygon.points.length; i++) {
      shape.lineTo(polygon.points[i].x, -polygon.points[i].z);
    }
    shape.closePath();

    // 挤出设置
    const extrudeSettings = {
      depth: DEFAULT_MODEL_PARAMS.floorThickness,
      bevelEnabled: false,
    };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    // 旋转使平面从 XY 变为 XZ（地面平面）
    // 旋转后: X不变, Y → Z, Z → -Y
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshPhongMaterial({
      color: DEFAULT_MODEL_PARAMS.floorColor,
      transparent: true,
      opacity: DEFAULT_MODEL_PARAMS.floorOpacity,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    // 地板顶面略高于平面图 (平面图在 Y=0.01)
    mesh.position.y = 0.02;
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    mesh.name = `floor-model-${polygon.id}`;
    scene.add(mesh);
    polygon.mesh = mesh;

    console.log("地板模型已添加到场景:", mesh.name);
  });

  // 清空之前的墙体网格
  wallMeshes.forEach((mesh) => {
    scene.remove(mesh);
    mesh.geometry?.dispose();
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((m) => m.dispose());
    } else {
      (mesh.material as THREE.Material)?.dispose();
    }
  });
  wallMeshes = [];

  // 生成墙体模型 - 使用着色器材质实现动态效果
  editorStore.wallSegments.forEach((wall) => {
    const length = distanceXZ(wall.start, wall.end);
    if (length < 0.1) return;

    const geometry = new THREE.BoxGeometry(length, DEFAULT_MODEL_PARAMS.wallHeight, DEFAULT_MODEL_PARAMS.wallThickness);
    const material = createTransitionShaderMaterial(DEFAULT_MODEL_PARAMS.wallHeight, editorStore.constructionStage, 1);
    const mesh = new THREE.Mesh(geometry, material);

    const center = midpoint(wall.start, wall.end);
    mesh.position.set(center.x, DEFAULT_MODEL_PARAMS.wallHeight / 2, center.z);

    const angle = calculateAngleXZ(wall.start, wall.end);
    mesh.rotation.y = -angle;

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `wall-model-${wall.id}`;
    scene.add(mesh);
    wall.mesh = mesh;
    wallMeshes.push(mesh);
  });

  editorStore.setGeneratedModel(true);
  editorStore.updateStatusMessage("3D模型已生成！使用鼠标旋转查看");

  // 启动着色器动画
  startShaderAnimation();
}

// ================== 平面图上传 ==================
async function uploadFloorPlan(file: File): Promise<boolean> {
  if (!file.type.startsWith("image/")) {
    editorStore.updateStatusMessage("请上传图片文件 (JPG/PNG)");
    return false;
  }

  try {
    const imageUrl = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = imageUrl;
    });

    // 计算尺寸
    const maxSize = 150;
    const aspectRatio = img.width / img.height;
    let planeWidth = aspectRatio > 1 ? maxSize : maxSize * aspectRatio;
    let planeHeight = aspectRatio > 1 ? maxSize / aspectRatio : maxSize;

    const textureLoader = new THREE.TextureLoader();
    const texture = await new Promise<THREE.Texture>((resolve, reject) => {
      textureLoader.load(imageUrl, resolve, undefined, reject);
    });

    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.01;
    mesh.name = "floor-plan-image";
    scene.add(mesh);

    editorStore.setFloorPlan({ url: imageUrl, width: img.width, height: img.height, mesh });
    return true;
  } catch (error) {
    console.error("图片加载失败:", error);
    editorStore.updateStatusMessage("图片加载失败，请重试");
    return false;
  }
}

// ================== 清空场景 ==================
function clearScene() {
  const toRemove: THREE.Object3D[] = [];
  scene.traverse((child) => {
    if (child instanceof THREE.Mesh && child.name !== "ground-plane") {
      toRemove.push(child);
    } else if (child instanceof THREE.Line) {
      toRemove.push(child);
    }
  });

  toRemove.forEach((obj) => {
    scene.remove(obj);
    if (obj instanceof THREE.Mesh) {
      obj.geometry?.dispose();
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => m.dispose());
      } else {
        (obj.material as THREE.Material)?.dispose();
      }
    } else if (obj instanceof THREE.Line) {
      obj.geometry?.dispose();
      (obj.material as THREE.Material)?.dispose();
    }
  });

  tempFloorMarkers = [];
  tempFloorLine = null;
  floorPreviewLine = null;
  wallStartMarker = null;
  wallPreviewLine = null;
  wallMeshes = [];

  editorStore.clearAll();
}

// ================== 事件处理 ==================
function handleClick(event: MouseEvent) {
  if (editorStore.mode === "draw-floor") {
    handleFloorClick(event);
  }
}

function handleDoubleClick(event: MouseEvent) {
  if (editorStore.mode === "draw-floor") {
    handleFloorDoubleClick();
  } else if (editorStore.mode === "draw-wall") {
    handleWallDoubleClick(event);
  }
}

// 暴露方法给父组件
defineExpose({
  generateModels,
  clearScene,
  uploadFloorPlan,
});

onMounted(() => {
  initThree();
  if (canvasRef.value) {
    canvasRef.value.addEventListener("click", handleClick);
    canvasRef.value.addEventListener("dblclick", handleDoubleClick);
  }
  window.addEventListener("resize", handleResize);
});

onUnmounted(() => {
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
  }
  stopShaderAnimation();
  controls?.dispose();
  renderer?.dispose();
  window.removeEventListener("resize", handleResize);
});
</script>

<style scoped>
.three-scene-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--bg-dark);
}

.three-canvas {
  width: 100%;
  height: 100%;
  display: block;
  outline: none;
}

.drawing-hints {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 10;
}

.hint {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: rgba(26, 26, 46, 0.95);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 14px;
  animation: slideUp var(--transition-normal);
  backdrop-filter: blur(8px);
}

.hint-icon {
  font-size: 16px;
}

.shortcuts-hint {
  position: absolute;
  bottom: 20px;
  right: 20px;
  display: flex;
  gap: 12px;
  padding: 10px 16px;
  background: rgba(26, 26, 46, 0.85);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  backdrop-filter: blur(8px);
  z-index: 10;
}

.shortcut-item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
  font-size: 12px;
}

kbd {
  display: inline-block;
  padding: 2px 6px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-family: inherit;
  font-size: 11px;
  color: var(--text-secondary);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}
</style>
