import { ref, type Ref } from "vue";
import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export interface EmissiveObject {
  mesh: THREE.Mesh;
  originalMaterial: THREE.Material | THREE.Material[];
  emissiveIntensity: number;
  type: "tv-screen" | "lamp" | "window-light" | "decorative";
}

export interface NightModeConfig {
  ambientLightIntensity: number;
  cameraCornerPosition: { x: number; y: number; z: number };
  cameraLookAt: { x: number; y: number; z: number };
  transitionDuration: number;
}

const DEFAULT_NIGHT_CONFIG: NightModeConfig = {
  ambientLightIntensity: 0.03,
  cameraCornerPosition: { x: -80, y: 60, z: -80 },
  cameraLookAt: { x: 0, y: 10, z: 0 },
  transitionDuration: 1500,
};

export function useNightMode(
  scene: Ref<THREE.Scene | null>,
  camera: Ref<THREE.PerspectiveCamera | null>,
  controls: Ref<OrbitControls | null>,
) {
  const isNightMode = ref(false);
  const emissiveObjects: EmissiveObject[] = [];

  let ambientLight: THREE.AmbientLight | null = null;
  let originalAmbientIntensity = 0.5;
  let animationFrameId: number | null = null;

  function setAmbientLight(light: THREE.AmbientLight) {
    ambientLight = light;
    originalAmbientIntensity = light.intensity;
  }

  function createEmissiveObjects() {
    if (!scene.value) return;

    clearEmissiveObjects();

    const roomCenter = new THREE.Vector3(0, 0, 0);
    const roomSize = 60;

    const tvScreen = createTVScreen(
      new THREE.Vector3(roomCenter.x + roomSize / 2 - 2, 15, roomCenter.z),
      new THREE.Euler(0, -Math.PI / 2, 0),
    );
    emissiveObjects.push(tvScreen);

    const tableLamp = createTableLamp(new THREE.Vector3(roomCenter.x - 20, 12, roomCenter.z + 15));
    emissiveObjects.push(tableLamp);

    const floorLamp = createFloorLamp(new THREE.Vector3(roomCenter.x + 15, 0, roomCenter.z - 20));
    emissiveObjects.push(floorLamp);

    const windowLight1 = createWindowLight(
      new THREE.Vector3(roomCenter.x, 18, roomCenter.z - roomSize / 2 + 2),
      new THREE.Euler(0, 0, 0),
    );
    emissiveObjects.push(windowLight1);

    const decorativeLight = createDecorativeLight(new THREE.Vector3(roomCenter.x - 15, 25, roomCenter.z - 10));
    emissiveObjects.push(decorativeLight);

    emissiveObjects.forEach((obj) => {
      scene.value!.add(obj.mesh);
    });
  }

  function createTVScreen(position: THREE.Vector3, rotation: THREE.Euler): EmissiveObject {
    const geometry = new THREE.BoxGeometry(16, 10, 0.5);

    const material = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: 0x1a5fff,
      emissiveIntensity: 0,
      metalness: 0.8,
      roughness: 0.2,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.rotation.copy(rotation);
    mesh.name = "tv-screen";
    mesh.castShadow = true;

    const frameGeometry = new THREE.BoxGeometry(17, 11, 0.3);
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      metalness: 0.9,
      roughness: 0.3,
    });
    const frame = new THREE.Mesh(frameGeometry, frameMaterial);
    frame.position.z = -0.3;
    mesh.add(frame);

    const standGeometry = new THREE.BoxGeometry(4, 1, 2);
    const stand = new THREE.Mesh(standGeometry, frameMaterial);
    stand.position.set(0, -6, 0.5);
    mesh.add(stand);

    return {
      mesh,
      originalMaterial: material,
      emissiveIntensity: 2.5,
      type: "tv-screen",
    };
  }

  function createTableLamp(position: THREE.Vector3): EmissiveObject {
    const group = new THREE.Group();

    const baseGeometry = new THREE.CylinderGeometry(1.5, 2, 1, 16);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      metalness: 0.3,
      roughness: 0.7,
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 0.5;
    group.add(base);

    const poleGeometry = new THREE.CylinderGeometry(0.3, 0.3, 6, 8);
    const pole = new THREE.Mesh(poleGeometry, baseMaterial);
    pole.position.y = 4;
    group.add(pole);

    const shadeGeometry = new THREE.CylinderGeometry(2.5, 3.5, 4, 16, 1, true);
    const shadeMaterial = new THREE.MeshStandardMaterial({
      color: 0xfff8dc,
      emissive: 0xffaa44,
      emissiveIntensity: 0,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const shade = new THREE.Mesh(shadeGeometry, shadeMaterial);
    shade.position.y = 8;
    group.add(shade);

    const bulbGeometry = new THREE.SphereGeometry(0.8, 16, 16);
    const bulbMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffee,
      emissive: 0xffcc66,
      emissiveIntensity: 0,
    });
    const bulb = new THREE.Mesh(bulbGeometry, bulbMaterial);
    bulb.position.y = 7;
    group.add(bulb);

    group.position.copy(position);
    group.name = "table-lamp";

    const containerMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1));
    containerMesh.name = "table-lamp-container";
    containerMesh.visible = false;
    group.add(containerMesh);

    const mesh = group as unknown as THREE.Mesh;

    return {
      mesh,
      originalMaterial: shadeMaterial,
      emissiveIntensity: 1.8,
      type: "lamp",
    };
  }

  function createFloorLamp(position: THREE.Vector3): EmissiveObject {
    const group = new THREE.Group();

    const baseGeometry = new THREE.CylinderGeometry(2, 2.5, 0.5, 16);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0x2c2c2c,
      metalness: 0.8,
      roughness: 0.2,
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    group.add(base);

    const poleGeometry = new THREE.CylinderGeometry(0.2, 0.2, 25, 8);
    const pole = new THREE.Mesh(poleGeometry, baseMaterial);
    pole.position.y = 12.5;
    group.add(pole);

    const shadeGeometry = new THREE.SphereGeometry(4, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const shadeMaterial = new THREE.MeshStandardMaterial({
      color: 0xf5f5dc,
      emissive: 0xffdd88,
      emissiveIntensity: 0,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const shade = new THREE.Mesh(shadeGeometry, shadeMaterial);
    shade.position.y = 25;
    shade.rotation.x = Math.PI;
    group.add(shade);

    const bulbGeometry = new THREE.SphereGeometry(1, 16, 16);
    const bulbMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffcc,
      emissiveIntensity: 0,
    });
    const bulb = new THREE.Mesh(bulbGeometry, bulbMaterial);
    bulb.position.y = 24;
    group.add(bulb);

    group.position.copy(position);
    group.name = "floor-lamp";

    const mesh = group as unknown as THREE.Mesh;

    return {
      mesh,
      originalMaterial: shadeMaterial,
      emissiveIntensity: 2.0,
      type: "lamp",
    };
  }

  function createWindowLight(position: THREE.Vector3, rotation: THREE.Euler): EmissiveObject {
    const group = new THREE.Group();

    const frameGeometry = new THREE.BoxGeometry(12, 10, 0.5);
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a4a4a,
      metalness: 0.6,
      roughness: 0.4,
    });
    const frame = new THREE.Mesh(frameGeometry, frameMaterial);
    group.add(frame);

    const glassGeometry = new THREE.PlaneGeometry(11, 9);
    const glassMaterial = new THREE.MeshStandardMaterial({
      color: 0x334455,
      emissive: 0x2244aa,
      emissiveIntensity: 0,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    });
    const glass = new THREE.Mesh(glassGeometry, glassMaterial);
    glass.position.z = 0.3;
    group.add(glass);

    const dividerV = new THREE.Mesh(new THREE.BoxGeometry(0.3, 9, 0.1), frameMaterial);
    dividerV.position.z = 0.35;
    group.add(dividerV);

    const dividerH = new THREE.Mesh(new THREE.BoxGeometry(11, 0.3, 0.1), frameMaterial);
    dividerH.position.z = 0.35;
    group.add(dividerH);

    group.position.copy(position);
    group.rotation.copy(rotation);
    group.name = "window-light";

    const mesh = group as unknown as THREE.Mesh;

    return {
      mesh,
      originalMaterial: glassMaterial,
      emissiveIntensity: 1.2,
      type: "window-light",
    };
  }

  function createDecorativeLight(position: THREE.Vector3): EmissiveObject {
    const group = new THREE.Group();

    const chainGeometry = new THREE.CylinderGeometry(0.1, 0.1, 3, 8);
    const chainMaterial = new THREE.MeshStandardMaterial({
      color: 0xb8860b,
      metalness: 0.9,
      roughness: 0.1,
    });
    const chain = new THREE.Mesh(chainGeometry, chainMaterial);
    chain.position.y = 1.5;
    group.add(chain);

    const shadeGeometry = new THREE.ConeGeometry(3, 4, 8, 1, true);
    const shadeMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b0000,
      emissive: 0xff4444,
      emissiveIntensity: 0,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const shade = new THREE.Mesh(shadeGeometry, shadeMaterial);
    shade.rotation.x = Math.PI;
    group.add(shade);

    const bulbGeometry = new THREE.SphereGeometry(0.6, 16, 16);
    const bulbMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffee,
      emissive: 0xffaa44,
      emissiveIntensity: 0,
    });
    const bulb = new THREE.Mesh(bulbGeometry, bulbMaterial);
    bulb.position.y = -1;
    group.add(bulb);

    group.position.copy(position);
    group.name = "decorative-light";

    const mesh = group as unknown as THREE.Mesh;

    return {
      mesh,
      originalMaterial: shadeMaterial,
      emissiveIntensity: 1.5,
      type: "decorative",
    };
  }

  function clearEmissiveObjects() {
    if (!scene.value) return;

    emissiveObjects.forEach((obj) => {
      scene.value!.remove(obj.mesh);
      disposeMesh(obj.mesh);
    });
    emissiveObjects.length = 0;
  }

  function disposeMesh(mesh: THREE.Object3D) {
    mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else if (child.material) {
          child.material.dispose();
        }
      }
    });
  }

  function activateEmissiveObjects(active: boolean) {
    emissiveObjects.forEach((obj) => {
      const targetIntensity = active ? obj.emissiveIntensity : 0;

      obj.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const mat = child.material as THREE.MeshStandardMaterial;
          if (mat.emissive) {
            animateEmissiveIntensity(mat, targetIntensity);
          }
        }
      });
    });
  }

  function animateEmissiveIntensity(material: THREE.MeshStandardMaterial, targetIntensity: number) {
    const startIntensity = material.emissiveIntensity;
    const startTime = performance.now();
    const duration = DEFAULT_NIGHT_CONFIG.transitionDuration;

    function update() {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeInOutCubic(progress);

      material.emissiveIntensity = startIntensity + (targetIntensity - startIntensity) * eased;

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  }

  function animateAmbientLight(targetIntensity: number) {
    if (!ambientLight) return;

    const startIntensity = ambientLight.intensity;
    const startTime = performance.now();
    const duration = DEFAULT_NIGHT_CONFIG.transitionDuration;

    function update() {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeInOutCubic(progress);

      if (ambientLight) {
        ambientLight.intensity = startIntensity + (targetIntensity - startIntensity) * eased;
      }

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  }

  function animateCameraToCorner() {
    if (!camera.value || !controls.value) return;

    const targetPosition = new THREE.Vector3(
      DEFAULT_NIGHT_CONFIG.cameraCornerPosition.x,
      DEFAULT_NIGHT_CONFIG.cameraCornerPosition.y,
      DEFAULT_NIGHT_CONFIG.cameraCornerPosition.z,
    );

    const targetLookAt = new THREE.Vector3(
      DEFAULT_NIGHT_CONFIG.cameraLookAt.x,
      DEFAULT_NIGHT_CONFIG.cameraLookAt.y,
      DEFAULT_NIGHT_CONFIG.cameraLookAt.z,
    );

    const startPosition = camera.value.position.clone();
    const startTarget = controls.value.target.clone();
    const startTime = performance.now();
    const duration = DEFAULT_NIGHT_CONFIG.transitionDuration;

    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
    }

    function update() {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeInOutCubic(progress);

      if (camera.value && controls.value) {
        camera.value.position.lerpVectors(startPosition, targetPosition, eased);
        controls.value.target.lerpVectors(startTarget, targetLookAt, eased);
        controls.value.update();
      }

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(update);
      } else {
        animationFrameId = null;
      }
    }

    animationFrameId = requestAnimationFrame(update);
  }

  function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function toggleNightMode(): boolean {
    isNightMode.value = !isNightMode.value;

    if (isNightMode.value) {
      createEmissiveObjects();
      activateEmissiveObjects(true);
      animateAmbientLight(DEFAULT_NIGHT_CONFIG.ambientLightIntensity);
      animateCameraToCorner();

      if (scene.value) {
        scene.value.background = new THREE.Color(0x050510);
      }
    } else {
      activateEmissiveObjects(false);
      animateAmbientLight(originalAmbientIntensity);

      if (scene.value) {
        scene.value.background = new THREE.Color(0x1a1a2e);
      }

      setTimeout(() => {
        clearEmissiveObjects();
      }, DEFAULT_NIGHT_CONFIG.transitionDuration);
    }

    return isNightMode.value;
  }

  function enableNightMode() {
    if (!isNightMode.value) {
      toggleNightMode();
    }
  }

  function disableNightMode() {
    if (isNightMode.value) {
      toggleNightMode();
    }
  }

  function cleanup() {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    clearEmissiveObjects();
  }

  return {
    isNightMode,
    emissiveObjects,
    setAmbientLight,
    toggleNightMode,
    enableNightMode,
    disableNightMode,
    createEmissiveObjects,
    clearEmissiveObjects,
    cleanup,
  };
}
