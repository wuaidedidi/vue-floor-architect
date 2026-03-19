import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * 创建标准场景设置
 */
export function createScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);
  return scene;
}

/**
 * 创建透视相机
 */
export function createCamera(aspect: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 2000);
  camera.position.set(50, 80, 100);
  camera.lookAt(0, 0, 0);
  return camera;
}

/**
 * 创建WebGL渲染器
 */
export function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

/**
 * 创建轨道控制器
 */
export function createOrbitControls(
  camera: THREE.Camera, 
  domElement: HTMLElement
): OrbitControls {
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 10;
  controls.maxDistance = 500;
  controls.maxPolarAngle = Math.PI / 2 - 0.05; // 防止穿透地面
  return controls;
}

/**
 * 创建场景灯光
 */
export function createLights(): THREE.Group {
  const lightGroup = new THREE.Group();
  
  // 环境光
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  lightGroup.add(ambientLight);
  
  // 主方向光
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(50, 100, 50);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 500;
  directionalLight.shadow.camera.left = -100;
  directionalLight.shadow.camera.right = 100;
  directionalLight.shadow.camera.top = 100;
  directionalLight.shadow.camera.bottom = -100;
  lightGroup.add(directionalLight);
  
  // 辅助光
  const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
  fillLight.position.set(-50, 50, -50);
  lightGroup.add(fillLight);
  
  return lightGroup;
}

/**
 * 创建网格辅助线
 */
export function createGridHelper(size: number = 200, divisions: number = 50): THREE.GridHelper {
  const grid = new THREE.GridHelper(size, divisions, 0x444466, 0x333344);
  (grid.material as THREE.Material).opacity = 0.6;
  (grid.material as THREE.Material).transparent = true;
  return grid;
}

/**
 * 创建地面平面（用于射线检测）
 */
export function createGroundPlane(size: number = 1000): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(size, size);
  const material = new THREE.MeshBasicMaterial({
    visible: false,
    side: THREE.DoubleSide
  });
  const plane = new THREE.Mesh(geometry, material);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = 0;
  plane.name = 'ground-plane';
  return plane;
}

/**
 * 鼠标坐标转换为归一化设备坐标
 */
export function mouseToNDC(
  event: MouseEvent, 
  container: HTMLElement
): THREE.Vector2 {
  const rect = container.getBoundingClientRect();
  return new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );
}

/**
 * 通过射线获取地面交点
 */
export function getGroundIntersection(
  mouse: THREE.Vector2,
  camera: THREE.Camera,
  groundPlane: THREE.Mesh
): THREE.Vector3 | null {
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  
  const intersects = raycaster.intersectObject(groundPlane);
  
  if (intersects.length > 0) {
    return intersects[0].point;
  }
  
  return null;
}

/**
 * 创建绘制线条材质
 */
export function createLineMaterial(color: number = 0x00ffff): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({
    color,
    linewidth: 2,
    transparent: true,
    opacity: 0.8
  });
}

/**
 * 创建虚线材质
 */
export function createDashedLineMaterial(color: number = 0x00ffff): THREE.LineDashedMaterial {
  return new THREE.LineDashedMaterial({
    color,
    linewidth: 2,
    dashSize: 1,
    gapSize: 0.5
  });
}

/**
 * 释放Three.js对象资源
 */
export function disposeObject(obj: THREE.Object3D): void {
  if (obj instanceof THREE.Mesh) {
    obj.geometry?.dispose();
    if (Array.isArray(obj.material)) {
      obj.material.forEach(mat => mat.dispose());
    } else if (obj.material) {
      obj.material.dispose();
    }
  } else if (obj instanceof THREE.Line) {
    obj.geometry?.dispose();
    if (obj.material instanceof THREE.Material) {
      obj.material.dispose();
    }
  }
  
  // 递归处理子对象
  while (obj.children.length > 0) {
    disposeObject(obj.children[0]);
    obj.remove(obj.children[0]);
  }
}
