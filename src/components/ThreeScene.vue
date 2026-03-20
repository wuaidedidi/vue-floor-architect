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
import type { Point3D, FloorPlanImage, WeatherType } from "../types";
import { DEFAULT_MODEL_PARAMS, generateId, WEATHER_PRESETS } from "../types";
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

// Three.js 对象 - 使用普通变量，完全避免 Vue 响应式
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let groundPlane: THREE.Mesh;
let animationId: number | null = null;

// 天气效果相关对象
let ambientLight: THREE.AmbientLight;
let directionalLight: THREE.DirectionalLight;
let rainDrops: THREE.Points | null = null;
let snowFlakes: THREE.Points | null = null;
let windowGlass: THREE.Mesh | null = null;
let rainDropMaterial: THREE.ShaderMaterial | null = null;
let indoorLights: THREE.PointLight[] = [];
let indoorLightHelpers: THREE.Mesh[] = [];
let weatherTransitionProgress = 1;
let targetWeatherConfig = WEATHER_PRESETS.sunny;

// 临时绘制对象
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

  // 添加灯光 - 使用可引用的变量
  ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(50, 100, 50);
  directionalLight.castShadow = true;
  scene.add(directionalLight);

  // 创建室内灯光
  createIndoorLights();

  // 创建示例窗户
  createWindowGlass();

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

  // 更新天气效果
  updateWeatherEffects();

  renderer.render(scene, camera);
}

// ================== 天气效果系统 ==================
function createIndoorLights() {
  const lightPositions = [
    { x: -30, y: 15, z: -30 },
    { x: 30, y: 15, z: -30 },
    { x: 0, y: 20, z: 0 },
  ];

  lightPositions.forEach((pos, index) => {
    const light = new THREE.PointLight(0xffa500, 0, 50);
    light.position.set(pos.x, pos.y, pos.z);
    light.castShadow = true;
    scene.add(light);
    indoorLights.push(light);

    const helperGeo = new THREE.SphereGeometry(1, 16, 16);
    const helperMat = new THREE.MeshBasicMaterial({
      color: 0xffa500,
      transparent: true,
      opacity: 0,
    });
    const helper = new THREE.Mesh(helperGeo, helperMat);
    helper.position.copy(light.position);
    scene.add(helper);
    indoorLightHelpers.push(helper);
  });
}

function createWindowGlass() {
  const glassGeo = new THREE.PlaneGeometry(40, 25);

  rainDropMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uRainIntensity: { value: 0 },
      uDropColor: { value: new THREE.Color(0x88ccff) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uRainIntensity;
      uniform vec3 uDropColor;
      varying vec2 vUv;
      
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      
      float drop(vec2 uv, float speed, float offset) {
        float t = uTime * speed + offset;
        float y = fract(t + uv.y);
        float x = uv.x + sin(t * 2.0) * 0.02;
        
        float trail = smoothstep(0.0, 0.15, y) * smoothstep(1.0, 0.3, y);
        float dropShape = smoothstep(0.02, 0.0, abs(x - 0.5)) * trail;
        
        return dropShape * 0.8;
      }
      
      void main() {
        vec3 baseColor = vec3(0.15, 0.18, 0.22);
        vec3 dropLayer = vec3(0.0);
        
        for(float i = 0.0; i < 5.0; i++) {
          float offset = hash(vec2(i, i * 2.0)) * 10.0;
          float speed = 0.3 + hash(vec2(i * 3.0, i)) * 0.4;
          vec2 dropUv = vUv + vec2(hash(vec2(i, i * 5.0)) * 0.3, 0.0);
          dropLayer += uDropColor * drop(dropUv, speed, offset) * uRainIntensity;
        }
        
        float fog = (vUv.y * 0.3 + 0.1) * uRainIntensity;
        vec3 fogColor = vec3(0.2, 0.25, 0.3);
        
        vec3 finalColor = mix(baseColor, dropLayer + baseColor, uRainIntensity);
        finalColor = mix(finalColor, fogColor, fog * 0.5);
        
        gl_FragColor = vec4(finalColor, 0.7 + uRainIntensity * 0.2);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
  });

  windowGlass = new THREE.Mesh(glassGeo, rainDropMaterial);
  windowGlass.position.set(0, 15, -50);
  windowGlass.name = "window-glass";
  scene.add(windowGlass);

  const frameGeo = new THREE.BoxGeometry(42, 27, 1);
  const frameMat = new THREE.MeshPhongMaterial({ color: 0x4a3728 });
  const frame = new THREE.Mesh(frameGeo, frameMat);
  frame.position.set(0, 15, -50.5);
  scene.add(frame);
}

function createRainEffect() {
  if (rainDrops) return;

  const dropCount = 5000;
  const positions = new Float32Array(dropCount * 3);
  const velocities = new Float32Array(dropCount);

  for (let i = 0; i < dropCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 200;
    positions[i * 3 + 1] = Math.random() * 100;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
    velocities[i] = 0.5 + Math.random() * 0.5;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("velocity", new THREE.BufferAttribute(velocities, 1));

  const material = new THREE.PointsMaterial({
    color: 0x88aacc,
    size: 0.3,
    transparent: true,
    opacity: 0.6,
  });

  rainDrops = new THREE.Points(geometry, material);
  rainDrops.name = "rain-effect";
  scene.add(rainDrops);
}

function createSnowEffect() {
  if (snowFlakes) return;

  const flakeCount = 3000;
  const positions = new Float32Array(flakeCount * 3);
  const sizes = new Float32Array(flakeCount);

  for (let i = 0; i < flakeCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 200;
    positions[i * 3 + 1] = Math.random() * 100;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
    sizes[i] = 0.5 + Math.random() * 1.5;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 1,
    transparent: true,
    opacity: 0.8,
    sizeAttenuation: true,
  });

  snowFlakes = new THREE.Points(geometry, material);
  snowFlakes.name = "snow-effect";
  scene.add(snowFlakes);
}

function removeRainEffect() {
  if (rainDrops) {
    scene.remove(rainDrops);
    rainDrops.geometry.dispose();
    (rainDrops.material as THREE.Material).dispose();
    rainDrops = null;
  }
}

function removeSnowEffect() {
  if (snowFlakes) {
    scene.remove(snowFlakes);
    snowFlakes.geometry.dispose();
    (snowFlakes.material as THREE.Material).dispose();
    snowFlakes = null;
  }
}

function updateWeatherEffects() {
  const time = performance.now() * 0.001;

  // 更新雨滴动画
  if (rainDrops && rainDrops.visible) {
    const positions = rainDrops.geometry.attributes.position.array as Float32Array;
    const velocities = rainDrops.geometry.attributes.velocity.array as Float32Array;

    for (let i = 0; i < positions.length / 3; i++) {
      positions[i * 3 + 1] -= velocities[i] * 2;

      if (positions[i * 3 + 1] < 0) {
        positions[i * 3 + 1] = 100;
        positions[i * 3] = (Math.random() - 0.5) * 200;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
      }
    }
    rainDrops.geometry.attributes.position.needsUpdate = true;
  }

  // 更新雪花动画
  if (snowFlakes && snowFlakes.visible) {
    const positions = snowFlakes.geometry.attributes.position.array as Float32Array;

    for (let i = 0; i < positions.length / 3; i++) {
      positions[i * 3 + 1] -= 0.2;
      positions[i * 3] += Math.sin(time + i) * 0.05;
      positions[i * 3 + 2] += Math.cos(time + i * 0.5) * 0.05;

      if (positions[i * 3 + 1] < 0) {
        positions[i * 3 + 1] = 100;
        positions[i * 3] = (Math.random() - 0.5) * 200;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
      }
    }
    snowFlakes.geometry.attributes.position.needsUpdate = true;
  }

  // 更新窗户水滴效果
  if (rainDropMaterial) {
    rainDropMaterial.uniforms.uTime.value = time;
  }

  // 更新室内灯光闪烁效果
  const currentWeather = editorStore.currentWeather;
  if (currentWeather === "rainy" || currentWeather === "snowy") {
    indoorLights.forEach((light, index) => {
      const baseIntensity = 2.0;
      const flicker1 = Math.sin(time * 2.5 + index * 1.7) * 0.25;
      const flicker2 = Math.sin(time * 5.3 + index * 2.3) * 0.15;
      const flicker3 = Math.sin(time * 11.7 + index * 3.1) * 0.08;
      const randomFlicker = (Math.random() - 0.5) * 0.1;
      light.intensity = baseIntensity + flicker1 + flicker2 + flicker3 + randomFlicker;

      const warmth = 0.5 + Math.sin(time * 1.5 + index) * 0.3;
      const baseColor = new THREE.Color(0xffa500);
      const warmColor = new THREE.Color(0xffcc66);
      light.color.copy(baseColor.lerp(warmColor, warmth));
    });

    indoorLightHelpers.forEach((helper, index) => {
      const flicker1 = Math.sin(time * 2.5 + index * 1.7) * 0.25;
      const flicker2 = Math.sin(time * 5.3 + index * 2.3) * 0.15;
      const flicker3 = Math.sin(time * 11.7 + index * 3.1) * 0.08;
      const mat = helper.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.5 + flicker1 * 0.4 + flicker2 * 0.2 + flicker3 * 0.1;

      const warmth = 0.5 + Math.sin(time * 1.5 + index) * 0.3;
      const baseColor = new THREE.Color(0xffa500);
      const warmColor = new THREE.Color(0xffcc66);
      mat.color.copy(baseColor.lerp(warmColor, warmth));
    });
  }

  // 平滑过渡天气效果
  if (weatherTransitionProgress < 1) {
    weatherTransitionProgress += 0.02;
    weatherTransitionProgress = Math.min(weatherTransitionProgress, 1);
    applyWeatherTransition();
  }
}

function applyWeatherTransition() {
  const config = targetWeatherConfig;
  const t = weatherTransitionProgress;

  // 平滑过渡环境光
  const currentAmbientColor = ambientLight.color.clone();
  const targetAmbientColor = new THREE.Color(config.ambientColor);
  ambientLight.color.copy(currentAmbientColor.lerp(targetAmbientColor, t * 0.1));
  ambientLight.intensity = THREE.MathUtils.lerp(ambientLight.intensity, config.ambientIntensity, t * 0.1);

  // 平滑过渡方向光
  const currentDirColor = directionalLight.color.clone();
  const targetDirColor = new THREE.Color(config.directionalColor);
  directionalLight.color.copy(currentDirColor.lerp(targetDirColor, t * 0.1));
  directionalLight.intensity = THREE.MathUtils.lerp(directionalLight.intensity, config.directionalIntensity, t * 0.1);

  // 平滑过渡背景色
  const currentBgColor = scene.background as THREE.Color;
  const targetBgColor = new THREE.Color(config.backgroundColor);
  if (currentBgColor) {
    currentBgColor.lerp(targetBgColor, t * 0.1);
  }

  // 更新雾效果
  if (config.fogColor && config.fogDensity) {
    if (!scene.fog) {
      scene.fog = new THREE.FogExp2(config.fogColor, config.fogDensity);
    } else {
      const fog = scene.fog as THREE.FogExp2;
      fog.color.lerp(new THREE.Color(config.fogColor), t * 0.1);
      fog.density = THREE.MathUtils.lerp(fog.density, config.fogDensity, t * 0.1);
    }
  } else {
    scene.fog = null;
  }
}

function setWeather(weather: WeatherType) {
  const config = WEATHER_PRESETS[weather];
  targetWeatherConfig = config;
  weatherTransitionProgress = 0;

  // 控制雨效果
  if (weather === "rainy") {
    if (!rainDrops) createRainEffect();
    rainDrops!.visible = true;
    if (rainDropMaterial) {
      rainDropMaterial.uniforms.uRainIntensity.value = 1;
    }
  } else {
    if (rainDrops) rainDrops.visible = false;
    if (rainDropMaterial) {
      rainDropMaterial.uniforms.uRainIntensity.value = 0;
    }
  }

  // 控制雪效果
  if (weather === "snowy") {
    if (!snowFlakes) createSnowEffect();
    snowFlakes!.visible = true;
  } else {
    if (snowFlakes) snowFlakes.visible = false;
  }

  // 控制室内灯光
  const showIndoorLights = weather === "rainy" || weather === "snowy" || weather === "cloudy";
  indoorLights.forEach((light) => {
    light.intensity = showIndoorLights ? 1.5 : 0;
  });
  indoorLightHelpers.forEach((helper) => {
    const mat = helper.material as THREE.MeshBasicMaterial;
    mat.opacity = showIndoorLights ? 0.3 : 0;
  });
}

// 监听天气变化
watch(
  () => editorStore.currentWeather,
  (newWeather) => {
    setWeather(newWeather);
  },
);

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

  // 生成墙体模型
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

  editorStore.setGeneratedModel(true);
  editorStore.updateStatusMessage("3D模型已生成！使用鼠标旋转查看");
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
