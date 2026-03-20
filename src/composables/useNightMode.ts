import { ref, reactive } from "vue";
import * as THREE from "three";

// 夜景模式状态
interface NightModeState {
  isActive: boolean;
  ambientLightIntensity: number;
  directionalLightIntensity: number;
  backgroundDarkness: number;
}

// 发光物体配置
interface EmissiveObject {
  id: string;
  type: "tv" | "lamp" | "neon" | "screen" | "other";
  position: THREE.Vector3;
  size: { width: number; height: number; depth: number };
  color: number;
  intensity: number;
  mesh?: THREE.Mesh;
  light?: THREE.PointLight | THREE.SpotLight;
}

// 单例状态管理
const nightModeState = reactive<NightModeState>({
  isActive: false,
  ambientLightIntensity: 0.5,
  directionalLightIntensity: 1,
  backgroundDarkness: 0,
});

// 存储原始灯光状态
let originalAmbientIntensity = 0.5;
let originalDirectionalIntensity = 1;
let originalBackground: THREE.Color | null = null;

// 存储发光物体列表
const emissiveObjects = ref<EmissiveObject[]>([]);

// 存储场景引用
let sceneRef: THREE.Scene | null = null;
let cameraRef: THREE.PerspectiveCamera | null = null;
let controlsRef: any = null;

// 原始场景对象
let originalLights: { ambient: THREE.AmbientLight | null; directional: THREE.DirectionalLight | null } = {
  ambient: null,
  directional: null,
};

// 夜空星星
let starsMesh: THREE.Points | null = null;
let starsAnimationId: number | null = null;
const starOpacities: number[] = []; // 存储每个星星的不透明度

export function useNightMode() {
  // 初始化夜景模式
  function initNightMode(scene: THREE.Scene, camera: THREE.PerspectiveCamera, controls: any) {
    sceneRef = scene;
    cameraRef = camera;
    controlsRef = controls;

    // 保存原始背景和灯光
    if (!originalBackground) {
      originalBackground =
        scene.background instanceof THREE.Color ? scene.background.clone() : new THREE.Color(0x1a1a2e);
    }

    // 查找场景中的灯光
    scene.traverse((obj) => {
      if (obj instanceof THREE.AmbientLight && !originalLights.ambient) {
        originalLights.ambient = obj;
        originalAmbientIntensity = obj.intensity;
      }
      if (obj instanceof THREE.DirectionalLight && !originalLights.directional) {
        originalLights.directional = obj;
        originalDirectionalIntensity = obj.intensity;
      }
    });

    // 创建默认发光物体（示例：电视、台灯等）
    createDefaultEmissiveObjects();
  }

  // 创建默认发光物体示例
  function createDefaultEmissiveObjects() {
    // 示例电视屏幕 - 增强发光效果
    const tvObject: EmissiveObject = {
      id: "tv-main",
      type: "tv",
      position: new THREE.Vector3(20, 15, -20),
      size: { width: 24, height: 14, depth: 0.5 },
      color: 0x66aaff,
      intensity: 4,
    };

    // 示例台灯1 - 增强发光效果
    const lamp1: EmissiveObject = {
      id: "lamp-1",
      type: "lamp",
      position: new THREE.Vector3(-25, 12, 20),
      size: { width: 5, height: 5, depth: 5 },
      color: 0xffcc66,
      intensity: 3.5,
    };

    // 示例台灯2 - 增强发光效果
    const lamp2: EmissiveObject = {
      id: "lamp-2",
      type: "lamp",
      position: new THREE.Vector3(25, 12, 20),
      size: { width: 5, height: 5, depth: 5 },
      color: 0xffcc66,
      intensity: 3.5,
    };

    // 示例霓虹灯 - 增强发光效果
    const neon: EmissiveObject = {
      id: "neon-sign",
      type: "neon",
      position: new THREE.Vector3(0, 28, -25),
      size: { width: 20, height: 3, depth: 0.5 },
      color: 0xff6699,
      intensity: 4.5,
    };

    // 添加天花板嵌入式筒灯
    const ceilingLight1: EmissiveObject = {
      id: "ceiling-1",
      type: "lamp",
      position: new THREE.Vector3(-15, 35, 0),
      size: { width: 4, height: 1, depth: 4 },
      color: 0xffffee,
      intensity: 3,
    };

    const ceilingLight2: EmissiveObject = {
      id: "ceiling-2",
      type: "lamp",
      position: new THREE.Vector3(15, 35, 0),
      size: { width: 4, height: 1, depth: 4 },
      color: 0xffffee,
      intensity: 3,
    };

    emissiveObjects.value = [tvObject, lamp1, lamp2, neon, ceilingLight1, ceilingLight2];
  }

  // 激活夜景模式
  function activateNightMode() {
    if (!sceneRef || nightModeState.isActive) return;

    nightModeState.isActive = true;

    // 1. 调暗环境光和方向光 - 增强对比度
    if (originalLights.ambient) {
      originalLights.ambient.intensity = 0.008; // 更暗的环境
    }
    if (originalLights.directional) {
      originalLights.directional.intensity = 0.02;
    }

    // 2. 改变背景颜色为更深的夜色
    sceneRef.background = new THREE.Color(0x020208);

    // 3. 添加夜空星星
    createStars();

    // 4. 激活所有发光物体
    emissiveObjects.value.forEach((obj) => createEmissiveMesh(obj));

    // 5. 移动相机到房间角落，显示全景
    moveCameraToCorner();

    // 6. 隐藏网格辅助线
    sceneRef.traverse((obj) => {
      if (obj instanceof THREE.GridHelper) {
        obj.visible = false;
      }
    });
  }

  // 取消夜景模式
  function deactivateNightMode() {
    if (!sceneRef || !nightModeState.isActive) return;

    nightModeState.isActive = false;

    // 恢复灯光
    if (originalLights.ambient) {
      originalLights.ambient.intensity = originalAmbientIntensity;
    }
    if (originalLights.directional) {
      originalLights.directional.intensity = originalDirectionalIntensity;
    }

    // 恢复背景
    if (originalBackground) {
      sceneRef.background = originalBackground.clone();
    }

    // 移除发光物体
    emissiveObjects.value.forEach((obj) => {
      if (obj.mesh) {
        sceneRef!.remove(obj.mesh);
        obj.mesh.geometry?.dispose();
        (obj.mesh.material as THREE.Material)?.dispose();
        obj.mesh = undefined;
      }
      if (obj.light) {
        sceneRef!.remove(obj.light);
        obj.light = undefined;
      }
      // 清理光晕效果
      const objWithGlow = obj as any;
      if (objWithGlow.glowMesh) {
        sceneRef!.remove(objWithGlow.glowMesh);
        objWithGlow.glowMesh.geometry?.dispose();
        (objWithGlow.glowMesh.material as THREE.Material)?.dispose();
        objWithGlow.glowMesh = undefined;
      }
    });

    // 移除星星
    if (starsMesh) {
      sceneRef.remove(starsMesh);
      starsMesh.geometry?.dispose();
      (starsMesh.material as THREE.Material)?.dispose();
      starsMesh = null;
    }

    // 停止星星动画
    if (starsAnimationId) {
      cancelAnimationFrame(starsAnimationId);
      starsAnimationId = null;
    }

    // 显示网格辅助线
    sceneRef.traverse((obj) => {
      if (obj instanceof THREE.GridHelper) {
        obj.visible = true;
      }
    });
  }

  // 切换夜景模式
  function toggleNightMode() {
    if (nightModeState.isActive) {
      deactivateNightMode();
    } else {
      activateNightMode();
    }
  }

  // 创建发光物体网格
  function createEmissiveMesh(obj: EmissiveObject) {
    if (!sceneRef) return;

    // 创建增强的发光材质 - 使用 MeshStandardMaterial 获得更好的发光效果
    const emissiveMaterial = new THREE.MeshStandardMaterial({
      color: obj.color,
      emissive: obj.color,
      emissiveIntensity: 3, // 增强发光强度
      transparent: true,
      opacity: 1,
      metalness: 0.1,
      roughness: 0.2,
    });

    // 创建几何体
    let geometry: THREE.BufferGeometry;
    if (obj.type === "tv" || obj.type === "screen") {
      geometry = new THREE.PlaneGeometry(obj.size.width, obj.size.height);
    } else if (obj.type === "lamp") {
      geometry = new THREE.SphereGeometry(obj.size.width / 2, 24, 24);
    } else if (obj.type === "neon") {
      geometry = new THREE.BoxGeometry(obj.size.width, obj.size.height, obj.size.depth);
    } else {
      geometry = new THREE.BoxGeometry(obj.size.width, obj.size.height, obj.size.depth);
    }

    const mesh = new THREE.Mesh(geometry, emissiveMaterial);
    mesh.position.copy(obj.position);

    // 如果是平面，面向相机
    if (obj.type === "tv" || obj.type === "screen") {
      mesh.rotation.y = Math.PI;
    }

    sceneRef.add(mesh);
    obj.mesh = mesh;

    // 添加点光源 - 增加光照范围和强度
    const pointLight = new THREE.PointLight(obj.color, obj.intensity, 150, 2);
    pointLight.position.copy(obj.position);
    pointLight.castShadow = true;
    pointLight.shadow.mapSize.width = 1024;
    pointLight.shadow.mapSize.height = 1024;
    sceneRef.add(pointLight);
    obj.light = pointLight;

    // 为霓虹灯和电视添加额外的光晕效果
    if (obj.type === "neon" || obj.type === "tv") {
      const glowGeometry = new THREE.SphereGeometry(Math.max(obj.size.width, obj.size.height) / 1.5, 32, 32);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: obj.color,
        transparent: true,
        opacity: 0.15,
      });
      const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
      glowMesh.position.copy(obj.position);
      sceneRef.add(glowMesh);

      // 存储光晕mesh以便后续清理
      (obj as any).glowMesh = glowMesh;
    }
  }

  // 创建夜空星星
  function createStars() {
    if (!sceneRef || starsMesh) return;

    const starsGeometry = new THREE.BufferGeometry();
    const starPositions: number[] = [];
    const starColors: number[] = [];
    starOpacities.length = 0;

    for (let i = 0; i < 2500; i++) {
      // 增加星星数量到2500
      const radius = 300 + Math.random() * 200;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.cos(phi) + 50;
      const z = radius * Math.sin(phi) * Math.sin(theta);

      starPositions.push(x, y, z);

      const colorChoice = Math.random();
      if (colorChoice < 0.7) {
        starColors.push(1, 1, 1);
      } else if (colorChoice < 0.85) {
        starColors.push(0.8, 0.9, 1);
      } else {
        starColors.push(1, 0.9, 0.8);
      }

      starOpacities.push(0.5 + Math.random() * 0.5);
    }

    starsGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
    starsGeometry.setAttribute("color", new THREE.Float32BufferAttribute(starColors, 3));

    const starsMaterial = new THREE.PointsMaterial({
      size: 1.2 + Math.random() * 1.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      sizeAttenuation: true,
    });

    starsMesh = new THREE.Points(starsGeometry, starsMaterial);
    sceneRef.add(starsMesh);

    animateStars();
  }

  // 星星闪烁动画
  function animateStars() {
    if (!starsMesh || !nightModeState.isActive) {
      starsAnimationId = null;
      return;
    }

    const material = starsMesh.material as THREE.PointsMaterial;
    const time = Date.now() * 0.001;

    const globalOpacity = 0.85 + Math.sin(time * 0.5) * 0.1;
    material.opacity = globalOpacity;

    starsAnimationId = requestAnimationFrame(animateStars);
  }

  // 移动相机到房间角落，显示全景
  function moveCameraToCorner() {
    if (!cameraRef || !controlsRef) return;

    // 计算房间边界（基于地板多边形或墙体）
    // 这里使用默认值，实际项目中应该从store获取
    const roomBounds = {
      minX: -40,
      maxX: 40,
      minZ: -40,
      maxZ: 40,
    };

    // 相机位置 - 房间角落
    const targetX = roomBounds.maxX + 30;
    const targetY = 50; // 稍微高一点的视角
    const targetZ = roomBounds.maxZ + 30;

    // 平滑移动相机
    animateCameraPosition(
      new THREE.Vector3(targetX, targetY, targetZ),
      new THREE.Vector3(0, 10, 0), // 看向房间中心
    );
  }

  // 相机位移动画
  function animateCameraPosition(targetPos: THREE.Vector3, targetLookAt: THREE.Vector3) {
    if (!cameraRef || !controlsRef) return;

    const startPos = cameraRef.position.clone();
    const duration = 1500; // 1.5秒动画
    const startTime = Date.now();

    function updateCamera() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // 使用缓动函数
      const easeProgress = easeInOutCubic(progress);

      // 插值位置
      cameraRef!.position.lerpVectors(startPos, targetPos, easeProgress);

      // 更新控制器目标
      controlsRef.target.lerp(targetLookAt, easeProgress);
      controlsRef.update();

      if (progress < 1) {
        requestAnimationFrame(updateCamera);
      }
    }

    updateCamera();
  }

  // 缓动函数
  function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // 添加自定义发光物体
  function addEmissiveObject(obj: Omit<EmissiveObject, "mesh" | "light">) {
    const newObj: EmissiveObject = {
      ...obj,
      mesh: undefined,
      light: undefined,
    };
    emissiveObjects.value.push(newObj);

    // 如果夜景模式已激活，立即创建物体
    if (nightModeState.isActive && sceneRef) {
      createEmissiveMesh(newObj);
    }
  }

  // 移除发光物体
  function removeEmissiveObject(id: string) {
    const index = emissiveObjects.value.findIndex((obj) => obj.id === id);
    if (index !== -1) {
      const obj = emissiveObjects.value[index];
      if (obj.mesh && sceneRef) {
        sceneRef.remove(obj.mesh);
        obj.mesh.geometry?.dispose();
        (obj.mesh.material as THREE.Material)?.dispose();
      }
      if (obj.light && sceneRef) {
        sceneRef.remove(obj.light);
      }
      emissiveObjects.value.splice(index, 1);
    }
  }

  return {
    isNightModeActive: nightModeState.isActive,
    initNightMode,
    activateNightMode,
    deactivateNightMode,
    toggleNightMode,
    addEmissiveObject,
    removeEmissiveObject,
    emissiveObjects,
  };
}
