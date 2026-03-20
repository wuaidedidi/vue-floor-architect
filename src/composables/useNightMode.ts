import { ref, type Ref } from "vue";
import * as THREE from "three";

export interface NightModeState {
  isActive: boolean;
  originalAmbientIntensity: number;
  originalDirectionalIntensity: number;
  originalBackground: THREE.Color;
  originalCameraPosition?: THREE.Vector3;
  originalTarget?: THREE.Vector3;
}

export function useNightMode(
  scene: Ref<THREE.Scene | null>,
  camera: Ref<THREE.PerspectiveCamera | null>,
  controls: Ref<THREE.OrbitControls | null>,
  renderer: Ref<THREE.WebGLRenderer | null>,
) {
  const isNightMode = ref(false);
  const state: NightModeState = {
    isActive: false,
    originalAmbientIntensity: 0.5,
    originalDirectionalIntensity: 1,
    originalBackground: new THREE.Color(0x1a1a2e),
  };

  // 发光材质列表
  const emissiveMaterials: THREE.Material[] = [];

  // 存储所有场景材质以便恢复
  const allSceneMaterials: { material: THREE.Material; originalEmissive: number; originalEmissiveIntensity: number }[] =
    [];

  /**
   * 收集场景中的发光材质
   */
  function collectEmissiveMaterials() {
    emissiveMaterials.length = 0;
    allSceneMaterials.length = 0;
    if (!scene.value) return;

    scene.value.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((mat) => {
          if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhongMaterial) {
            // 保存原始状态
            allSceneMaterials.push({
              material: mat,
              originalEmissive: mat.emissive.getHex(),
              originalEmissiveIntensity: mat.emissiveIntensity,
            });

            // 检查材质是否有发光属性或应该被激活
            if (mat.emissive && mat.emissive.getHex() !== 0) {
              emissiveMaterials.push(mat);
            }
          }
        });
      }
    });
  }

  /**
   * 激活夜景模式
   */
  function activateNightMode() {
    if (!scene.value || !camera.value || !controls.value) return;

    // 保存原始状态
    state.isActive = true;
    isNightMode.value = true;

    // 1. 将环境光调到最低（几乎全黑）
    scene.value.traverse((child) => {
      if (child instanceof THREE.AmbientLight) {
        state.originalAmbientIntensity = child.intensity;
        child.intensity = 0.02; // 几乎全黑
      }
      if (child instanceof THREE.DirectionalLight) {
        state.originalDirectionalIntensity = child.intensity;
        child.intensity = 0.05; // 主光源也调暗
      }
    });

    // 2. 改变背景为深色
    state.originalBackground = (scene.value.background as THREE.Color) || new THREE.Color(0x1a1a2e);
    scene.value.background = new THREE.Color(0x050508); // 接近黑色的深蓝

    // 3. 收集并激活发光材质
    collectEmissiveMaterials();
    emissiveMaterials.forEach((mat) => {
      if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhongMaterial) {
        // 增强发光效果 - 大幅提高亮度
        mat.emissiveIntensity = 5.0;
        // 如果没有发光颜色，设置一个默认的暖色发光
        if (mat.emissive.getHex() === 0) {
          mat.emissive.setHex(0xffaa44);
        }
      }
    });

    // 4. 如果没有发光材质，创建一些示例发光物体（电视屏幕、灯罩等）
    createEmissiveObjects();

    // 5. 视角自动退到房间角落，给全景概览
    moveCameraToOverview();

    // 6. 调整渲染器以适应夜景
    if (renderer.value) {
      renderer.value.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.value.toneMappingExposure = 1.5;
    }
  }

  /**
   * 创建示例发光物体（如果没有的话）
   */
  function createEmissiveObjects() {
    if (!scene.value) return;

    // 检查是否已存在夜景物体组
    const existingGroup = scene.value.getObjectByName("night-mode-objects");
    if (existingGroup) return;

    const nightGroup = new THREE.Group();
    nightGroup.name = "night-mode-objects";

    // 1. 电视屏幕发光效果 - 增强版
    const tvGeometry = new THREE.PlaneGeometry(10, 6);
    const tvMaterial = new THREE.MeshBasicMaterial({
      color: 0x66aaff,
      side: THREE.DoubleSide,
    });
    const tvScreen = new THREE.Mesh(tvGeometry, tvMaterial);
    tvScreen.position.set(-20, 15, -30);
    tvScreen.rotation.y = Math.PI / 6;
    tvScreen.name = "tv-screen";
    nightGroup.add(tvScreen);

    // 电视光源 - 增强亮度
    const tvLight = new THREE.PointLight(0x66aaff, 5, 50);
    tvLight.position.set(-20, 15, -28);
    tvLight.name = "tv-light";
    nightGroup.add(tvLight);

    // 电视外框发光效果
    const tvFrameGeometry = new THREE.BoxGeometry(11, 7, 0.5);
    const tvFrameMaterial = new THREE.MeshBasicMaterial({
      color: 0x222222,
    });
    const tvFrame = new THREE.Mesh(tvFrameGeometry, tvFrameMaterial);
    tvFrame.position.set(-20, 15, -30.3);
    tvFrame.rotation.y = Math.PI / 6;
    tvFrame.name = "tv-frame";
    nightGroup.add(tvFrame);

    // 2. 台灯发光效果 - 增强版
    const lampShadeGeometry = new THREE.ConeGeometry(4, 5, 32, 1, true);
    const lampShadeMaterial = new THREE.MeshBasicMaterial({
      color: 0xffcc66,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const lampShade = new THREE.Mesh(lampShadeGeometry, lampShadeMaterial);
    lampShade.position.set(25, 18, 20);
    lampShade.name = "lamp-shade";
    nightGroup.add(lampShade);

    // 台灯底座
    const lampBaseGeometry = new THREE.CylinderGeometry(3, 3.5, 1, 32);
    const lampBaseMaterial = new THREE.MeshBasicMaterial({ color: 0x444444 });
    const lampBase = new THREE.Mesh(lampBaseGeometry, lampBaseMaterial);
    lampBase.position.set(25, 10, 20);
    lampBase.name = "lamp-base";
    nightGroup.add(lampBase);

    // 台灯灯杆
    const lampPoleGeometry = new THREE.CylinderGeometry(0.3, 0.3, 8, 16);
    const lampPoleMaterial = new THREE.MeshBasicMaterial({ color: 0x666666 });
    const lampPole = new THREE.Mesh(lampPoleGeometry, lampPoleMaterial);
    lampPole.position.set(25, 14, 20);
    lampPole.name = "lamp-pole";
    nightGroup.add(lampPole);

    // 台灯光源 - 增强亮度
    const lampLight = new THREE.PointLight(0xffcc66, 4, 40);
    lampLight.position.set(25, 15, 20);
    lampLight.name = "lamp-light";
    nightGroup.add(lampLight);

    // 3. 窗户月光效果 - 增强
    const moonLight = new THREE.DirectionalLight(0xaaccff, 0.5);
    moonLight.position.set(-50, 80, -50);
    moonLight.name = "moon-light";
    nightGroup.add(moonLight);

    // 4. 地板边缘灯带 - 增强版
    const stripGeometry = new THREE.BoxGeometry(60, 0.3, 0.8);
    const stripMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.8,
    });
    const floorStrip = new THREE.Mesh(stripGeometry, stripMaterial);
    floorStrip.position.set(0, 0.5, -40);
    floorStrip.name = "floor-strip";
    nightGroup.add(floorStrip);

    // 灯带光源
    const stripLight = new THREE.PointLight(0x00ffff, 3, 30);
    stripLight.position.set(0, 2, -40);
    stripLight.name = "strip-light";
    nightGroup.add(stripLight);

    // 5. 天花板吊灯
    const ceilingLampGeometry = new THREE.SphereGeometry(3, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const ceilingLampMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffee,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const ceilingLamp = new THREE.Mesh(ceilingLampGeometry, ceilingLampMaterial);
    ceilingLamp.position.set(0, 30, 0);
    ceilingLamp.name = "ceiling-lamp";
    nightGroup.add(ceilingLamp);

    // 吊灯光源
    const ceilingLight = new THREE.PointLight(0xffffee, 6, 60);
    ceilingLight.position.set(0, 28, 0);
    ceilingLight.name = "ceiling-light";
    nightGroup.add(ceilingLight);

    // 6. 墙角氛围灯
    const cornerLightColors = [0xff3366, 0x33ff66, 0x3366ff];
    const cornerPositions = [
      { x: 40, y: 5, z: 40 },
      { x: -40, y: 5, z: 40 },
      { x: 40, y: 5, z: -40 },
    ];

    cornerPositions.forEach((pos, index) => {
      // 氛围灯球
      const sphereGeometry = new THREE.SphereGeometry(1.5, 32, 32);
      const sphereMaterial = new THREE.MeshBasicMaterial({
        color: cornerLightColors[index],
        transparent: true,
        opacity: 0.8,
      });
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
      sphere.position.set(pos.x, pos.y, pos.z);
      sphere.name = `corner-light-${index}`;
      nightGroup.add(sphere);

      // 氛围光源
      const pointLight = new THREE.PointLight(cornerLightColors[index], 4, 35);
      pointLight.position.set(pos.x, pos.y + 2, pos.z);
      pointLight.name = `corner-light-source-${index}`;
      nightGroup.add(pointLight);
    });

    scene.value.add(nightGroup);
  }

  /**
   * 移动相机到全景概览位置
   */
  function moveCameraToOverview() {
    if (!camera.value || !controls.value) return;

    // 保存当前相机位置（用于恢复）
    state.originalCameraPosition = camera.value.position.clone();
    state.originalTarget = controls.value.target.clone();

    // 计算房间中心（假设房间在0,0,0附近）
    const roomCenter = new THREE.Vector3(0, 0, 0);

    // 将相机移动到角落高处，俯瞰整个房间
    const cornerPosition = new THREE.Vector3(80, 60, 80);

    // 使用动画平滑过渡
    animateCamera(cornerPosition, roomCenter);
  }

  /**
   * 相机动画
   */
  function animateCamera(targetPosition: THREE.Vector3, targetLookAt: THREE.Vector3) {
    if (!camera.value || !controls.value) return;

    const startPosition = camera.value.position.clone();
    const startTarget = controls.value.target.clone();
    const duration = 1500; // 1.5秒
    const startTime = Date.now();

    function updateCamera() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // 使用缓动函数
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      if (camera.value && controls.value) {
        camera.value.position.lerpVectors(startPosition, targetPosition, easeProgress);
        controls.value.target.lerpVectors(startTarget, targetLookAt, easeProgress);
        controls.value.update();
      }

      if (progress < 1) {
        requestAnimationFrame(updateCamera);
      }
    }

    updateCamera();
  }

  /**
   * 恢复日间模式
   */
  function deactivateNightMode() {
    if (!scene.value || !camera.value || !controls.value) return;

    state.isActive = false;
    isNightMode.value = false;

    // 1. 恢复灯光
    scene.value.traverse((child) => {
      if (child instanceof THREE.AmbientLight) {
        child.intensity = state.originalAmbientIntensity;
      }
      if (child instanceof THREE.DirectionalLight && child.name !== "moon-light") {
        child.intensity = state.originalDirectionalIntensity;
      }
    });

    // 2. 恢复背景
    scene.value.background = state.originalBackground;

    // 3. 恢复所有材质的发光属性
    allSceneMaterials.forEach((item) => {
      const mat = item.material;
      if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhongMaterial) {
        mat.emissive.setHex(item.originalEmissive);
        mat.emissiveIntensity = item.originalEmissiveIntensity;
      }
    });

    // 4. 移除夜景物体
    const nightGroup = scene.value.getObjectByName("night-mode-objects");
    if (nightGroup) {
      scene.value.remove(nightGroup);
      // 清理资源
      nightGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }

    // 5. 恢复相机位置
    if (state.originalCameraPosition && state.originalTarget) {
      animateCamera(state.originalCameraPosition, state.originalTarget);
    }

    // 6. 恢复渲染器设置
    if (renderer.value) {
      renderer.value.toneMapping = THREE.NoToneMapping;
      renderer.value.toneMappingExposure = 1.0;
    }
  }

  /**
   * 切换夜景模式
   */
  function toggleNightMode() {
    if (isNightMode.value) {
      deactivateNightMode();
    } else {
      activateNightMode();
    }
  }

  return {
    isNightMode,
    activateNightMode,
    deactivateNightMode,
    toggleNightMode,
  };
}
