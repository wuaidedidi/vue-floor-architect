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

    <!-- 漫游模式提示 -->
    <div class="roam-hints" v-if="editorStore.mode === 'roam'">
      <div class="roam-hint-main" v-if="!editorStore.roamState.isLocked">
        <span class="hint-icon">🖱️</span>
        <span>点击场景进入漫游模式</span>
      </div>
      <div class="roam-controls" v-else>
        <div class="control-group">
          <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>
          <span>移动</span>
        </div>
        <div class="control-group">
          <kbd>Shift</kbd>
          <span>加速</span>
        </div>
        <div class="control-group">
          <kbd>鼠标</kbd>
          <span>视角</span>
        </div>
        <div class="control-group">
          <kbd>ESC</kbd>
          <span>退出</span>
        </div>
      </div>
    </div>

    <!-- 快捷键提示 -->
    <div class="shortcuts-hint" v-if="editorStore.mode !== 'roam'">
      <div class="shortcut-item"><kbd>左键</kbd> 旋转</div>
      <div class="shortcut-item"><kbd>右键</kbd> 平移</div>
      <div class="shortcut-item"><kbd>滚轮</kbd> 缩放</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, shallowRef } from "vue";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useEditorStore } from "../stores/editorStore";
import type { Point3D, FloorPlanImage } from "../types";
import { DEFAULT_MODEL_PARAMS, generateId } from "../types";
import { distanceXZ, calculateAngleXZ, midpoint, createPointMarker, createLineGeometry } from "../utils/geometryUtils";
import { useFirstPersonControls } from "../composables/useFirstPersonControls";
import { useVolumetricLight } from "../composables/useVolumetricLight";
import { useAutoDoor } from "../composables/useAutoDoor";

const emit = defineEmits<{
  (e: "scene-ready"): void;
}>();

const editorStore = useEditorStore();
const containerRef = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let groundPlane: THREE.Mesh;
let animationId: number | null = null;
let clock: THREE.Clock;

const sceneRef = shallowRef<THREE.Scene | null>(null);
const cameraRef = shallowRef<THREE.PerspectiveCamera | null>(null);

const firstPerson = useFirstPersonControls(cameraRef, canvasRef, {
  height: 1.7,
  moveSpeed: 8,
  lookSpeed: 0.002,
  sprintMultiplier: 2,
  collisionRadius: 0.5,
});

const volumetricLight = useVolumetricLight(sceneRef);
const autoDoor = useAutoDoor(sceneRef);

let tempFloorMarkers: THREE.Mesh[] = [];
let tempFloorLine: THREE.Line | null = null;
let floorPreviewLine: THREE.Line | null = null;
let wallStartMarker: THREE.Mesh | null = null;
let wallPreviewLine: THREE.Line | null = null;

const showHints = computed(() => {
  return (
    (editorStore.mode === "draw-floor" && editorStore.currentFloorPoints.length > 0) ||
    (editorStore.mode === "draw-wall" && editorStore.currentWallStart)
  );
});

function initThree() {
  if (!canvasRef.value) return;

  const canvas = canvasRef.value;
  const container = canvas.parentElement || document.body;
  const width = container.clientWidth;
  const height = container.clientHeight;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);
  sceneRef.value = scene;

  camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 2000);
  camera.position.set(50, 80, 100);
  camera.lookAt(0, 0, 0);
  cameraRef.value = camera;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 10;
  controls.maxDistance = 500;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(50, 100, 50);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  scene.add(directionalLight);

  const grid = new THREE.GridHelper(200, 40, 0x444466, 0x333344);
  (grid.material as THREE.Material).opacity = 0.6;
  (grid.material as THREE.Material).transparent = true;
  scene.add(grid);

  const planeGeo = new THREE.PlaneGeometry(1000, 1000);
  const planeMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
  groundPlane = new THREE.Mesh(planeGeo, planeMat);
  groundPlane.rotation.x = -Math.PI / 2;
  groundPlane.position.y = 0;
  groundPlane.name = "ground-plane";
  scene.add(groundPlane);

  clock = new THREE.Clock();

  animate();
  emit("scene-ready");
}

function animate() {
  animationId = requestAnimationFrame(animate);

  const delta = clock.getDelta();

  if (editorStore.mode === "roam" && firstPerson.isEnabled.value) {
    firstPerson.update(delta);

    const state = firstPerson.getState();
    if (state) {
      autoDoor.checkProximity(state.position);
      editorStore.updateRoamState({
        position: { x: state.position.x, y: state.position.y, z: state.position.z },
        isMoving: state.isMoving,
        isLocked: firstPerson.isLocked.value,
      });
    }
    autoDoor.update(delta);
  } else {
    controls.update();

    if (autoDoor.isEnabled.value) {
      autoDoor.checkProximity(camera.position);
      autoDoor.update(delta);
    }
  }

  if (volumetricLight.isEnabled.value) {
    volumetricLight.update(camera, delta);
  }

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

function handleFloorClick(event: MouseEvent) {
  const point = getGroundPoint(event);
  if (!point) return;

  const p: Point3D = { x: point.x, y: 0.1, z: point.z };
  editorStore.addFloorPoint(p);

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

  editorStore.completeFloorPolygon();

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

function handleWallDoubleClick(event: MouseEvent) {
  const point = getGroundPoint(event);
  if (!point) return;

  const p: Point3D = { x: point.x, y: 0.1, z: point.z };

  if (!editorStore.currentWallStart) {
    editorStore.setWallStart(p);

    const geo = new THREE.SphereGeometry(0.6, 16, 16);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff9f43 });
    wallStartMarker = new THREE.Mesh(geo, mat);
    wallStartMarker.position.set(p.x, p.y, p.z);
    scene.add(wallStartMarker);
  } else {
    editorStore.completeWallSegment(p);

    const lastWall = editorStore.wallSegments[editorStore.wallSegments.length - 1];
    if (lastWall) {
      const geometry = createLineGeometry([lastWall.start, lastWall.end]);
      const material = new THREE.LineBasicMaterial({ color: 0xf59e0b });
      const line = new THREE.Line(geometry, material);
      line.name = `wall-segment-${lastWall.id}`;
      scene.add(line);
      lastWall.lineMesh = line;

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

function getCollisionObjects(): THREE.Object3D[] {
  const objects: THREE.Object3D[] = [];
  scene.traverse((child) => {
    if (child instanceof THREE.Mesh && child.name.startsWith("wall-model-")) {
      objects.push(child);
    }
  });
  return objects;
}

function generateModels() {
  console.log("开始生成模型，地板多边形数量:", editorStore.floorPolygons.length);

  editorStore.floorPolygons.forEach((polygon, index) => {
    console.log(`处理地板 ${index}:`, polygon.points);
    if (polygon.points.length < 3) {
      console.warn("地板顶点不足3个，跳过");
      return;
    }

    const shape = new THREE.Shape();
    shape.moveTo(polygon.points[0].x, -polygon.points[0].z);
    for (let i = 1; i < polygon.points.length; i++) {
      shape.lineTo(polygon.points[i].x, -polygon.points[i].z);
    }
    shape.closePath();

    const extrudeSettings = {
      depth: DEFAULT_MODEL_PARAMS.floorThickness,
      bevelEnabled: false,
    };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshPhongMaterial({
      color: DEFAULT_MODEL_PARAMS.floorColor,
      transparent: true,
      opacity: DEFAULT_MODEL_PARAMS.floorOpacity,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 0.02;
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    mesh.name = `floor-model-${polygon.id}`;
    scene.add(mesh);
    polygon.mesh = mesh;

    console.log("地板模型已添加到场景:", mesh.name);
  });

  editorStore.wallSegments.forEach((wall) => {
    const length = distanceXZ(wall.start, wall.end);
    if (length < 0.1) return;

    const geometry = new THREE.BoxGeometry(length, DEFAULT_MODEL_PARAMS.wallHeight, DEFAULT_MODEL_PARAMS.wallThickness);
    const material = new THREE.MeshPhongMaterial({ color: DEFAULT_MODEL_PARAMS.wallColor });
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
  });

  setupRoamEnvironment();

  editorStore.setGeneratedModel(true);
  editorStore.updateStatusMessage("3D模型已生成！可切换到漫游模式体验");
}

function setupRoamEnvironment() {
  const floorPolygons = editorStore.floorPolygons;
  const wallSegments = editorStore.wallSegments;

  console.log("setupRoamEnvironment - floorPolygons:", floorPolygons.length, "wallSegments:", wallSegments.length);

  if (floorPolygons.length === 0) {
    console.warn("No floor polygons, skipping roam environment setup");
    return;
  }

  let minX = Infinity,
    maxX = -Infinity;
  let minZ = Infinity,
    maxZ = -Infinity;

  floorPolygons.forEach((polygon) => {
    polygon.points.forEach((p) => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    });
  });

  const roomCenter = new THREE.Vector3((minX + maxX) / 2, DEFAULT_MODEL_PARAMS.wallHeight / 2, (minZ + maxZ) / 2);

  const roomSize = new THREE.Vector3(maxX - minX, DEFAULT_MODEL_PARAMS.wallHeight, maxZ - minZ);

  volumetricLight.createRoomLights(roomCenter, roomSize);

  if (wallSegments.length > 0) {
    wallSegments.forEach((wall, index) => {
      if (index === 0 || index === Math.floor(wallSegments.length / 2)) {
        const start = new THREE.Vector3(wall.start.x, 0, wall.start.z);
        const end = new THREE.Vector3(wall.end.x, 0, wall.end.z);
        autoDoor.createDoorFromWall(start, end, DEFAULT_MODEL_PARAMS.wallHeight, 0.5);
      }
    });
  } else {
    const doorPos1 = new THREE.Vector3(minX, 0, (minZ + maxZ) / 2);
    autoDoor.createDoor(doorPos1, Math.PI / 2, {
      width: 3,
      height: DEFAULT_MODEL_PARAMS.wallHeight * 0.8,
    });

    const doorPos2 = new THREE.Vector3((minX + maxX) / 2, 0, minZ);
    autoDoor.createDoor(doorPos2, 0, {
      width: 3,
      height: DEFAULT_MODEL_PARAMS.wallHeight * 0.8,
    });
  }

  const collisionObjects = getCollisionObjects();
  firstPerson.setCollisionObjects(collisionObjects);

  const spawnX = (minX + maxX) / 2;
  const spawnZ = minZ + 5;
  firstPerson.setPosition(spawnX, 1.7, spawnZ);
  firstPerson.setRotation(0, 0);

  volumetricLight.enable();
  autoDoor.enable();
}

function startRoamMode() {
  if (!editorStore.hasGeneratedModel) {
    editorStore.updateStatusMessage("请先生成3D模型");
    return;
  }

  controls.enabled = false;
  firstPerson.enable();
  volumetricLight.enable();
  autoDoor.enable();
  editorStore.setRoamActive(true);
  editorStore.updateStatusMessage("漫游模式已启动 - 点击场景开始");
}

function stopRoamMode() {
  firstPerson.disable();
  volumetricLight.disable();
  autoDoor.disable();
  controls.enabled = true;
  editorStore.setRoamActive(false);

  camera.position.set(50, 80, 100);
  camera.lookAt(0, 0, 0);
  controls.update();

  editorStore.updateStatusMessage("已退出漫游模式");
}

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

function clearScene() {
  stopRoamMode();

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

  volumetricLight.clearAll();
  autoDoor.clearAll();

  tempFloorMarkers = [];
  tempFloorLine = null;
  floorPreviewLine = null;
  wallStartMarker = null;
  wallPreviewLine = null;

  editorStore.clearAll();
}

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

watch(
  () => editorStore.mode,
  (newMode, oldMode) => {
    if (oldMode === "roam" && newMode !== "roam") {
      stopRoamMode();
    }
    if (newMode === "roam" && oldMode !== "roam") {
      startRoamMode();
    }
  },
);

watch(firstPerson.isLocked, (locked) => {
  editorStore.updateRoamState({ isLocked: locked });
});

defineExpose({
  generateModels,
  clearScene,
  uploadFloorPlan,
  startRoamMode,
  stopRoamMode,
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

.roam-hints {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
}

.roam-hint-main {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: rgba(26, 26, 46, 0.95);
  border: 1px solid var(--accent-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 15px;
  backdrop-filter: blur(8px);
  animation: pulse 2s ease-in-out infinite;
}

.roam-controls {
  display: flex;
  gap: 16px;
  padding: 12px 20px;
  background: rgba(26, 26, 46, 0.95);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  backdrop-filter: blur(8px);
}

.control-group {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 13px;
}

.control-group kbd {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-primary);
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

@keyframes pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4);
  }
  50% {
    box-shadow: 0 0 0 10px rgba(99, 102, 241, 0);
  }
}
</style>
