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
import type { Point3D, FloorPlanImage, ConstructionPhase, WallMaterialConfig, FloorMaterialConfig } from "../types";
import { DEFAULT_MODEL_PARAMS, generateId, CONSTRUCTION_PHASES } from "../types";
import {
  createShapeFromPoints,
  distanceXZ,
  calculateAngleXZ,
  midpoint,
  createPointMarker,
  createLineGeometry,
} from "../utils/geometryUtils";

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

let tempFloorMarkers: THREE.Mesh[] = [];
let tempFloorLine: THREE.Line | null = null;
let floorPreviewLine: THREE.Line | null = null;
let wallStartMarker: THREE.Mesh | null = null;
let wallPreviewLine: THREE.Line | null = null;

let wallMeshes: THREE.Mesh[] = [];
let floorMeshes: THREE.Mesh[] = [];
let transitionAnimationId: number | null = null;
let currentTransitionProgress = 0;
let targetTransitionProgress = 0;
let wallTextures: Map<string, THREE.DataTexture> = new Map();
let floorTextures: Map<string, THREE.DataTexture> = new Map();
let paintTransitionY = 0;
let isPaintTransitioning = false;
let targetPaintY = 0;

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

// ================== 模型生成 ==================
function generateModels() {
  console.log("开始生成模型，地板多边形数量:", editorStore.floorPolygons.length);

  wallMeshes = [];
  floorMeshes = [];
  wallTextures.clear();
  floorTextures.clear();

  const initialPhase: ConstructionPhase = "rough";
  const initialWallConfig = CONSTRUCTION_PHASES[0].wallMaterial;
  const initialFloorConfig = CONSTRUCTION_PHASES[0].floorMaterial;

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

    const material = createFloorMaterial(initialFloorConfig, initialPhase);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 0.02;
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    mesh.name = `floor-model-${polygon.id}`;
    scene.add(mesh);
    polygon.mesh = mesh;
    floorMeshes.push(mesh);

    console.log("地板模型已添加到场景:", mesh.name);
  });

  editorStore.wallSegments.forEach((wall) => {
    const length = distanceXZ(wall.start, wall.end);
    if (length < 0.1) return;

    const geometry = new THREE.BoxGeometry(length, DEFAULT_MODEL_PARAMS.wallHeight, DEFAULT_MODEL_PARAMS.wallThickness);

    const material = createWallMaterial(initialWallConfig, initialPhase);

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

  currentTransitionProgress = 0;
  editorStore.setPhaseProgress(0);
  editorStore.setCurrentPhase("rough");
  editorStore.setGeneratedModel(true);
  editorStore.updateStatusMessage("3D模型已生成！使用鼠标旋转查看");
}

function createWallMaterial(config: WallMaterialConfig, phase: ConstructionPhase): THREE.MeshStandardMaterial {
  let texture: THREE.DataTexture | null = null;

  switch (phase) {
    case "rough":
      texture = createConcreteTexture(config.noiseIntensity);
      break;
    case "plumbing":
      texture = createConcreteTexture(config.noiseIntensity * 0.7);
      break;
    case "hardfinish":
      texture = createPuttyTexture(config.noiseIntensity);
      break;
    case "softfinish":
      texture = createPuttyTexture(config.noiseIntensity * 0.3);
      break;
  }

  const material = new THREE.MeshStandardMaterial({
    color: config.color,
    roughness: config.roughness,
    metalness: config.metalness,
    map: texture,
    side: THREE.DoubleSide,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.paintTransitionY = { value: DEFAULT_MODEL_PARAMS.wallHeight };
    shader.uniforms.wallHeight = { value: DEFAULT_MODEL_PARAMS.wallHeight };
    shader.uniforms.oldColor = { value: new THREE.Color(0x4a4a4a) };

    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `
      #include <common>
      varying float vWorldY;
      `,
    );

    shader.vertexShader = shader.vertexShader.replace(
      "#include <worldpos_vertex>",
      `
      #include <worldpos_vertex>
      vWorldY = (modelMatrix * vec4(transformed, 1.0)).y;
      `,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `
      #include <common>
      uniform float paintTransitionY;
      uniform float wallHeight;
      uniform vec3 oldColor;
      varying float vWorldY;
      `,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `
      #include <color_fragment>
      float brushLine = paintTransitionY;
      if (vWorldY > brushLine + 0.5) {
        diffuseColor.rgb = oldColor;
      } else if (vWorldY > brushLine - 0.5) {
        float t = (vWorldY - brushLine + 0.5) / 1.0;
        diffuseColor.rgb = mix(diffuseColor.rgb, oldColor, t);
      }
      `,
    );

    material.userData.shader = shader;
  };

  return material;
}

function createFloorMaterial(config: FloorMaterialConfig, phase: ConstructionPhase): THREE.MeshStandardMaterial {
  let texture: THREE.DataTexture | null = null;

  switch (phase) {
    case "rough":
      texture = createConcreteTexture(0.8);
      break;
    case "plumbing":
      texture = createConcreteTexture(0.6);
      break;
    case "hardfinish":
      texture = createWoodFloorTexture();
      break;
    case "softfinish":
      texture = createWoodFloorTexture();
      break;
  }

  const material = new THREE.MeshStandardMaterial({
    color: config.color,
    roughness: config.roughness,
    metalness: config.metalness,
    transparent: true,
    opacity: config.opacity,
    map: texture,
    side: THREE.DoubleSide,
  });

  return material;
}

function createNoiseTexture(size: number, intensity: number, roughness: number): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);

  for (let i = 0; i < size * size; i++) {
    const idx = i * 4;
    const noise = (Math.random() - 0.5) * intensity * 255;
    const baseValue = 128 + noise;

    data[idx] = Math.max(0, Math.min(255, baseValue));
    data[idx + 1] = Math.max(0, Math.min(255, baseValue));
    data[idx + 2] = Math.max(0, Math.min(255, baseValue));
    data[idx + 3] = 255;
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.needsUpdate = true;

  return texture;
}

function createConcreteTexture(intensity: number): THREE.DataTexture {
  const size = 256;
  const data = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      let noise = 0;
      noise += (Math.random() - 0.5) * intensity * 100;
      noise += Math.sin(x * 0.1) * intensity * 20;
      noise += Math.cos(y * 0.15) * intensity * 15;

      const grain = (Math.random() - 0.5) * intensity * 50;

      const value = 128 + noise + grain;

      data[idx] = Math.max(0, Math.min(255, value));
      data[idx + 1] = Math.max(0, Math.min(255, value * 0.98));
      data[idx + 2] = Math.max(0, Math.min(255, value * 0.95));
      data[idx + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.needsUpdate = true;

  return texture;
}

function createPuttyTexture(intensity: number): THREE.DataTexture {
  const size = 256;
  const data = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      let noise = 0;
      noise += (Math.random() - 0.5) * intensity * 30;

      const wave = Math.sin(x * 0.05 + y * 0.03) * intensity * 10;

      const value = 200 + noise + wave;

      data[idx] = Math.max(0, Math.min(255, value));
      data[idx + 1] = Math.max(0, Math.min(255, value * 0.99));
      data[idx + 2] = Math.max(0, Math.min(255, value * 0.97));
      data[idx + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.needsUpdate = true;

  return texture;
}

function createWoodFloorTexture(): THREE.DataTexture {
  const size = 256;
  const data = new Uint8Array(size * size * 4);

  const baseColor = { r: 180, g: 140, b: 90 };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      const plankWidth = 64;
      const plankIndex = Math.floor(x / plankWidth);
      const gapEffect = x % plankWidth === 0 ? -30 : 0;

      const grain = Math.sin(y * 0.3 + plankIndex * 0.5) * 15;
      const variation = (Math.random() - 0.5) * 20;

      data[idx] = Math.max(0, Math.min(255, baseColor.r + grain + variation + gapEffect));
      data[idx + 1] = Math.max(0, Math.min(255, baseColor.g + grain * 0.8 + variation + gapEffect));
      data[idx + 2] = Math.max(0, Math.min(255, baseColor.b + grain * 0.5 + variation + gapEffect));
      data[idx + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.needsUpdate = true;

  return texture;
}

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;

  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;

  const rr = Math.round(ar + (br - ar) * t);
  const rg = Math.round(ag + (bg - ag) * t);
  const rb = Math.round(ab + (bb - ab) * t);

  return (rr << 16) | (rg << 8) | rb;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function interpolateWallMaterial(from: WallMaterialConfig, to: WallMaterialConfig, t: number): WallMaterialConfig {
  return {
    color: lerpColor(from.color, to.color, t),
    roughness: lerp(from.roughness, to.roughness, t),
    metalness: lerp(from.metalness, to.metalness, t),
    bumpScale: lerp(from.bumpScale, to.bumpScale, t),
    noiseIntensity: lerp(from.noiseIntensity, to.noiseIntensity, t),
  };
}

function interpolateFloorMaterial(from: FloorMaterialConfig, to: FloorMaterialConfig, t: number): FloorMaterialConfig {
  return {
    color: lerpColor(from.color, to.color, t),
    roughness: lerp(from.roughness, to.roughness, t),
    metalness: lerp(from.metalness, to.metalness, t),
    opacity: lerp(from.opacity, to.opacity, t),
  };
}

function getInterpolatedMaterials(progress: number): { wall: WallMaterialConfig; floor: FloorMaterialConfig } {
  const normalizedProgress = progress / 100;
  const totalPhases = CONSTRUCTION_PHASES.length - 1;
  const phasePosition = normalizedProgress * totalPhases;
  const fromIndex = Math.floor(phasePosition);
  const toIndex = Math.min(fromIndex + 1, totalPhases);
  const localT = phasePosition - fromIndex;

  const fromPhase = CONSTRUCTION_PHASES[fromIndex];
  const toPhase = CONSTRUCTION_PHASES[toIndex];

  return {
    wall: interpolateWallMaterial(fromPhase.wallMaterial, toPhase.wallMaterial, localT),
    floor: interpolateFloorMaterial(fromPhase.floorMaterial, toPhase.floorMaterial, localT),
  };
}

function updateMaterialsWithTransition(progress: number) {
  const materials = getInterpolatedMaterials(progress);

  const normalizedProgress = progress / 100;
  const totalPhases = CONSTRUCTION_PHASES.length - 1;
  const phasePosition = normalizedProgress * totalPhases;
  const fromIndex = Math.floor(phasePosition);
  const toIndex = Math.min(fromIndex + 1, totalPhases);
  const localT = phasePosition - fromIndex;

  const fromPhase = CONSTRUCTION_PHASES[fromIndex];
  const toPhase = CONSTRUCTION_PHASES[toIndex];

  wallMeshes.forEach((mesh) => {
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (mat) {
      mat.color.setHex(materials.wall.color);
      mat.roughness = materials.wall.roughness;
      mat.metalness = materials.wall.metalness;

      if (mat.userData.shader) {
        const shader = mat.userData.shader;
        shader.uniforms.paintTransitionY.value = paintTransitionY;
        shader.uniforms.oldColor.value.setHex(fromPhase.wallMaterial.color);
      }

      if (localT < 0.1 || localT > 0.9) {
        const phaseToUse = localT < 0.1 ? fromPhase.id : toPhase.id;
        if (!wallTextures.has(phaseToUse)) {
          wallTextures.set(phaseToUse, createConcreteTexture(materials.wall.noiseIntensity));
        }
        mat.map = wallTextures.get(phaseToUse) || null;
      }

      mat.needsUpdate = true;
    }
  });

  floorMeshes.forEach((mesh) => {
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (mat) {
      mat.color.setHex(materials.floor.color);
      mat.roughness = materials.floor.roughness;
      mat.metalness = materials.floor.metalness;
      mat.opacity = materials.floor.opacity;

      if (localT < 0.1 || localT > 0.9) {
        const phaseToUse = localT < 0.1 ? fromPhase.id : toPhase.id;
        if (!floorTextures.has(phaseToUse)) {
          if (phaseToUse === "rough" || phaseToUse === "plumbing") {
            floorTextures.set(phaseToUse, createConcreteTexture(0.8));
          } else {
            floorTextures.set(phaseToUse, createWoodFloorTexture());
          }
        }
        mat.map = floorTextures.get(phaseToUse) || null;
      }

      mat.needsUpdate = true;
    }
  });
}

function startTransitionAnimation(targetProgress: number) {
  targetTransitionProgress = targetProgress;

  if (transitionAnimationId !== null) {
    cancelAnimationFrame(transitionAnimationId);
  }

  editorStore.setTransitioning(true);
  isPaintTransitioning = true;
  paintTransitionY = DEFAULT_MODEL_PARAMS.wallHeight;
  targetPaintY = 0;

  function animateTransition() {
    const diff = targetTransitionProgress - currentTransitionProgress;

    if (Math.abs(diff) < 0.5 && Math.abs(paintTransitionY - targetPaintY) < 0.1) {
      currentTransitionProgress = targetTransitionProgress;
      paintTransitionY = targetPaintY;
      updateMaterialsWithTransition(currentTransitionProgress);
      editorStore.setTransitioning(false);
      transitionAnimationId = null;
      isPaintTransitioning = false;
      return;
    }

    currentTransitionProgress += diff * 0.04;

    if (isPaintTransitioning && paintTransitionY > targetPaintY) {
      paintTransitionY -= 0.15;
      if (paintTransitionY < targetPaintY) paintTransitionY = targetPaintY;
    }

    updateMaterialsWithTransition(currentTransitionProgress);

    transitionAnimationId = requestAnimationFrame(animateTransition);
  }

  animateTransition();
}

watch(
  () => editorStore.phaseProgress,
  (newProgress) => {
    if (editorStore.hasGeneratedModel) {
      startTransitionAnimation(newProgress);
    }
  },
);

watch(
  () => editorStore.currentPhase,
  (newPhase) => {
    if (editorStore.hasGeneratedModel) {
      const index = CONSTRUCTION_PHASES.findIndex((p) => p.id === newPhase);
      const progress = index * 25;
      startTransitionAnimation(progress);
    }
  },
);

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
  floorMeshes = [];

  if (transitionAnimationId !== null) {
    cancelAnimationFrame(transitionAnimationId);
    transitionAnimationId = null;
  }
  currentTransitionProgress = 0;
  targetTransitionProgress = 0;

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
