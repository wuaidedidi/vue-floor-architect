import { type Ref } from "vue";
import * as THREE from "three";
import { useEditorStore } from "../stores/editorStore";
import type { Furniture, FurnitureType, MaterialType, Point3D } from "../types";
import { MATERIAL_PRESETS, FURNITURE_DEFAULTS, generateId } from "../types";

export function useFurnitureStyle(sceneRef: Ref<THREE.Scene | null>) {
  const store = useEditorStore();

  const animationMixers: Map<string, { startTime: number; mesh: THREE.Object3D; originalScale: THREE.Vector3 }> =
    new Map();
  let animationFrameId: number | null = null;

  function createFurniture(type: FurnitureType, position: Point3D): Furniture | null {
    if (!sceneRef.value) return null;

    const defaults = FURNITURE_DEFAULTS[type];
    const furniture: Furniture = {
      id: generateId(),
      type,
      name: defaults.name,
      position,
      rotation: 0,
      scale: { x: 1, y: 1, z: 1 },
      materialType: "wood",
    };

    const group = new THREE.Group();
    group.userData.furnitureId = furniture.id;

    const envMap = sceneRef.value.environment;

    switch (type) {
      case "sofa":
        createSofaMesh(group, defaults, envMap);
        break;
      case "cabinet":
        createCabinetMesh(group, defaults, envMap);
        break;
      case "table":
        createTableMesh(group, defaults, envMap);
        break;
      case "chair":
        createChairMesh(group, defaults, envMap);
        break;
      case "bed":
        createBedMesh(group, defaults, envMap);
        break;
    }

    group.position.set(position.x, position.y, position.z);
    sceneRef.value.add(group);
    furniture.mesh = group;

    return furniture;
  }

  function createSofaMesh(
    group: THREE.Group,
    defaults: { width: number; height: number; depth: number },
    envMap: THREE.Texture | null,
  ) {
    const material = new THREE.MeshStandardMaterial({
      color: MATERIAL_PRESETS.wood.color,
      roughness: MATERIAL_PRESETS.wood.roughness,
      metalness: MATERIAL_PRESETS.wood.metalness,
      envMap: envMap,
      envMapIntensity: MATERIAL_PRESETS.wood.envMapIntensity,
    });

    const seatGeo = new THREE.BoxGeometry(defaults.width, defaults.height * 0.4, defaults.depth);
    const seat = new THREE.Mesh(seatGeo, material);
    seat.position.y = defaults.height * 0.2;
    seat.castShadow = true;
    seat.receiveShadow = true;
    seat.userData.isFurniturePart = true;
    group.add(seat);

    const backGeo = new THREE.BoxGeometry(defaults.width, defaults.height * 0.6, defaults.depth * 0.3);
    const back = new THREE.Mesh(backGeo, material);
    back.position.set(0, defaults.height * 0.5, -defaults.depth * 0.35);
    back.castShadow = true;
    back.receiveShadow = true;
    back.userData.isFurniturePart = true;
    group.add(back);

    const armGeo = new THREE.BoxGeometry(defaults.width * 0.1, defaults.height * 0.5, defaults.depth);
    const leftArm = new THREE.Mesh(armGeo, material);
    leftArm.position.set(-defaults.width * 0.45, defaults.height * 0.35, 0);
    leftArm.castShadow = true;
    leftArm.receiveShadow = true;
    leftArm.userData.isFurniturePart = true;
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, material);
    rightArm.position.set(defaults.width * 0.45, defaults.height * 0.35, 0);
    rightArm.castShadow = true;
    rightArm.receiveShadow = true;
    rightArm.userData.isFurniturePart = true;
    group.add(rightArm);
  }

  function createCabinetMesh(
    group: THREE.Group,
    defaults: { width: number; height: number; depth: number },
    envMap: THREE.Texture | null,
  ) {
    const material = new THREE.MeshStandardMaterial({
      color: MATERIAL_PRESETS.wood.color,
      roughness: MATERIAL_PRESETS.wood.roughness,
      metalness: MATERIAL_PRESETS.wood.metalness,
      envMap: envMap,
      envMapIntensity: MATERIAL_PRESETS.wood.envMapIntensity,
    });

    const bodyGeo = new THREE.BoxGeometry(defaults.width, defaults.height, defaults.depth);
    const body = new THREE.Mesh(bodyGeo, material);
    body.position.y = defaults.height / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    body.userData.isFurniturePart = true;
    group.add(body);

    const doorMaterial = new THREE.MeshStandardMaterial({
      color: 0x654321,
      roughness: 0.5,
      metalness: 0.1,
      envMap: envMap,
      envMapIntensity: 1.0,
    });

    const doorGeo = new THREE.BoxGeometry(defaults.width * 0.45, defaults.height * 0.9, 0.3);
    const leftDoor = new THREE.Mesh(doorGeo, doorMaterial);
    leftDoor.position.set(-defaults.width * 0.25, defaults.height / 2, defaults.depth / 2 + 0.25);
    leftDoor.castShadow = true;
    leftDoor.userData.isFurniturePart = true;
    group.add(leftDoor);

    const rightDoor = new THREE.Mesh(doorGeo, doorMaterial);
    rightDoor.position.set(defaults.width * 0.25, defaults.height / 2, defaults.depth / 2 + 0.25);
    rightDoor.castShadow = true;
    rightDoor.userData.isFurniturePart = true;
    group.add(rightDoor);

    const handleMaterial = new THREE.MeshStandardMaterial({
      color: 0xc0c0c0,
      roughness: 0.15,
      metalness: 1.0,
      envMap: envMap,
      envMapIntensity: 2.5,
    });
    const handleGeo = new THREE.CylinderGeometry(0.15, 0.15, 1, 8);

    const leftHandle = new THREE.Mesh(handleGeo, handleMaterial);
    leftHandle.rotation.x = Math.PI / 2;
    leftHandle.position.set(-defaults.width * 0.1, defaults.height / 2, defaults.depth / 2 + 0.5);
    leftHandle.userData.isFurniturePart = true;
    group.add(leftHandle);

    const rightHandle = new THREE.Mesh(handleGeo, handleMaterial);
    rightHandle.rotation.x = Math.PI / 2;
    rightHandle.position.set(defaults.width * 0.1, defaults.height / 2, defaults.depth / 2 + 0.5);
    rightHandle.userData.isFurniturePart = true;
    group.add(rightHandle);
  }

  function createTableMesh(
    group: THREE.Group,
    defaults: { width: number; height: number; depth: number },
    envMap: THREE.Texture | null,
  ) {
    const topMaterial = new THREE.MeshStandardMaterial({
      color: MATERIAL_PRESETS.wood.color,
      roughness: MATERIAL_PRESETS.wood.roughness,
      metalness: MATERIAL_PRESETS.wood.metalness,
      envMap: envMap,
      envMapIntensity: MATERIAL_PRESETS.wood.envMapIntensity,
    });

    const topGeo = new THREE.BoxGeometry(defaults.width, 0.5, defaults.depth);
    const top = new THREE.Mesh(topGeo, topMaterial);
    top.position.y = defaults.height;
    top.castShadow = true;
    top.receiveShadow = true;
    top.userData.isFurniturePart = true;
    group.add(top);

    const legMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a3728,
      roughness: 0.6,
      metalness: 0.0,
      envMap: envMap,
      envMapIntensity: 0.8,
    });

    const legGeo = new THREE.CylinderGeometry(0.3, 0.3, defaults.height, 8);
    const legPositions = [
      [-defaults.width / 2 + 0.5, defaults.height / 2, -defaults.depth / 2 + 0.5],
      [defaults.width / 2 - 0.5, defaults.height / 2, -defaults.depth / 2 + 0.5],
      [-defaults.width / 2 + 0.5, defaults.height / 2, defaults.depth / 2 - 0.5],
      [defaults.width / 2 - 0.5, defaults.height / 2, defaults.depth / 2 - 0.5],
    ];

    legPositions.forEach((pos) => {
      const leg = new THREE.Mesh(legGeo, legMaterial);
      leg.position.set(pos[0], pos[1], pos[2]);
      leg.castShadow = true;
      leg.userData.isFurniturePart = true;
      group.add(leg);
    });
  }

  function createChairMesh(
    group: THREE.Group,
    defaults: { width: number; height: number; depth: number },
    envMap: THREE.Texture | null,
  ) {
    const material = new THREE.MeshStandardMaterial({
      color: MATERIAL_PRESETS.wood.color,
      roughness: MATERIAL_PRESETS.wood.roughness,
      metalness: MATERIAL_PRESETS.wood.metalness,
      envMap: envMap,
      envMapIntensity: MATERIAL_PRESETS.wood.envMapIntensity,
    });

    const seatGeo = new THREE.BoxGeometry(defaults.width, 0.3, defaults.depth);
    const seat = new THREE.Mesh(seatGeo, material);
    seat.position.y = defaults.height * 0.5;
    seat.castShadow = true;
    seat.receiveShadow = true;
    seat.userData.isFurniturePart = true;
    group.add(seat);

    const backGeo = new THREE.BoxGeometry(defaults.width, defaults.height * 0.5, 0.2);
    const back = new THREE.Mesh(backGeo, material);
    back.position.set(0, defaults.height * 0.75, -defaults.depth / 2 + 0.1);
    back.castShadow = true;
    back.receiveShadow = true;
    back.userData.isFurniturePart = true;
    group.add(back);

    const legGeo = new THREE.CylinderGeometry(0.15, 0.15, defaults.height * 0.5, 8);
    const legPositions = [
      [-defaults.width / 2 + 0.2, defaults.height * 0.25, -defaults.depth / 2 + 0.2],
      [defaults.width / 2 - 0.2, defaults.height * 0.25, -defaults.depth / 2 + 0.2],
      [-defaults.width / 2 + 0.2, defaults.height * 0.25, defaults.depth / 2 - 0.2],
      [defaults.width / 2 - 0.2, defaults.height * 0.25, defaults.depth / 2 - 0.2],
    ];

    legPositions.forEach((pos) => {
      const leg = new THREE.Mesh(legGeo, material);
      leg.position.set(pos[0], pos[1], pos[2]);
      leg.castShadow = true;
      leg.userData.isFurniturePart = true;
      group.add(leg);
    });
  }

  function createBedMesh(
    group: THREE.Group,
    defaults: { width: number; height: number; depth: number },
    envMap: THREE.Texture | null,
  ) {
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: MATERIAL_PRESETS.wood.color,
      roughness: MATERIAL_PRESETS.wood.roughness,
      metalness: MATERIAL_PRESETS.wood.metalness,
      envMap: envMap,
      envMapIntensity: MATERIAL_PRESETS.wood.envMapIntensity,
    });

    const frameGeo = new THREE.BoxGeometry(defaults.width, defaults.height * 0.3, defaults.depth);
    const frame = new THREE.Mesh(frameGeo, frameMaterial);
    frame.position.y = defaults.height * 0.15;
    frame.castShadow = true;
    frame.receiveShadow = true;
    frame.userData.isFurniturePart = true;
    group.add(frame);

    const mattressMaterial = new THREE.MeshStandardMaterial({
      color: 0xf5f5dc,
      roughness: 0.95,
      metalness: 0.0,
      envMap: envMap,
      envMapIntensity: 0.4,
    });
    const mattressGeo = new THREE.BoxGeometry(defaults.width * 0.95, defaults.height * 0.25, defaults.depth * 0.95);
    const mattress = new THREE.Mesh(mattressGeo, mattressMaterial);
    mattress.position.y = defaults.height * 0.42;
    mattress.castShadow = true;
    mattress.receiveShadow = true;
    mattress.userData.isFurniturePart = true;
    group.add(mattress);

    const headboardGeo = new THREE.BoxGeometry(defaults.width, defaults.height * 1.5, 0.5);
    const headboard = new THREE.Mesh(headboardGeo, frameMaterial);
    headboard.position.set(0, defaults.height * 0.9, -defaults.depth / 2 + 0.25);
    headboard.castShadow = true;
    headboard.receiveShadow = true;
    headboard.userData.isFurniturePart = true;
    group.add(headboard);
  }

  function createSpotlight(furniture: Furniture): THREE.SpotLight | null {
    if (!sceneRef.value || !furniture.mesh) return null;

    const defaults = FURNITURE_DEFAULTS[furniture.type];

    const spotlight = new THREE.SpotLight(0xffffff, 200);
    spotlight.position.set(furniture.position.x, furniture.position.y + defaults.height + 20, furniture.position.z);
    spotlight.target.position.set(
      furniture.position.x,
      furniture.position.y + defaults.height / 2,
      furniture.position.z,
    );

    spotlight.angle = Math.PI / 5;
    spotlight.penumbra = 0.5;
    spotlight.decay = 1.0;
    spotlight.distance = 50;
    spotlight.castShadow = true;
    spotlight.shadow.mapSize.width = 1024;
    spotlight.shadow.mapSize.height = 1024;
    spotlight.shadow.camera.near = 1;
    spotlight.shadow.camera.far = 50;

    sceneRef.value.add(spotlight);
    sceneRef.value.add(spotlight.target);

    const helperLight = new THREE.PointLight(0xffffcc, 30, 25);
    helperLight.position.set(furniture.position.x, furniture.position.y + defaults.height + 8, furniture.position.z);
    helperLight.name = `helper-light-${furniture.id}`;
    sceneRef.value.add(helperLight);

    return spotlight;
  }

  function removeSpotlight(furniture: Furniture) {
    if (!sceneRef.value || !furniture.spotlight) return;

    sceneRef.value.remove(furniture.spotlight);
    sceneRef.value.remove(furniture.spotlight.target);
    furniture.spotlight.dispose();
    furniture.spotlight = undefined;

    const helperLight = sceneRef.value.getObjectByName(`helper-light-${furniture.id}`);
    if (helperLight) {
      sceneRef.value.remove(helperLight);
      (helperLight as THREE.PointLight).dispose();
    }
  }

  function playSelectAnimation(furniture: Furniture) {
    if (!furniture.mesh) return;

    const mesh = furniture.mesh;
    const originalScale = mesh.scale.clone();

    animationMixers.set(furniture.id, {
      startTime: performance.now(),
      mesh,
      originalScale,
    });

    if (!animationFrameId) {
      animateSelection();
    }
  }

  function animateSelection() {
    const now = performance.now();
    const toRemove: string[] = [];

    animationMixers.forEach((data, id) => {
      const elapsed = now - data.startTime;
      const duration = 400;

      if (elapsed >= duration) {
        data.mesh.scale.copy(data.originalScale);
        toRemove.push(id);
        return;
      }

      const progress = elapsed / duration;
      let scaleMultiplier = 1;

      if (progress < 0.3) {
        const t = progress / 0.3;
        scaleMultiplier = 1 + 0.15 * Math.sin(t * Math.PI);
      } else if (progress < 0.6) {
        const t = (progress - 0.3) / 0.3;
        scaleMultiplier = 1.15 - 0.2 * t;
      } else {
        const t = (progress - 0.6) / 0.4;
        scaleMultiplier = 0.95 + 0.05 * t;
      }

      data.mesh.scale.set(
        data.originalScale.x * scaleMultiplier,
        data.originalScale.y * scaleMultiplier,
        data.originalScale.z * scaleMultiplier,
      );
    });

    toRemove.forEach((id) => animationMixers.delete(id));

    if (animationMixers.size > 0) {
      animationFrameId = requestAnimationFrame(animateSelection);
    } else {
      animationFrameId = null;
    }
  }

  function changeMaterial(furniture: Furniture, materialType: MaterialType) {
    if (!furniture.mesh || !sceneRef.value) return;

    const preset = MATERIAL_PRESETS[materialType];
    furniture.materialType = materialType;

    const envMap = sceneRef.value.environment;

    furniture.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData.isFurniturePart) {
        const newMaterial = new THREE.MeshStandardMaterial({
          color: preset.color,
          roughness: preset.roughness,
          metalness: preset.metalness,
          envMap: envMap,
          envMapIntensity: preset.envMapIntensity || 1.0,
        });

        child.material.dispose();
        child.material = newMaterial;
      }
    });
  }

  function selectFurniture(furniture: Furniture) {
    if (store.selectedFurnitureId && store.selectedFurnitureId !== furniture.id) {
      const prevFurniture = store.furnitures.find((f) => f.id === store.selectedFurnitureId);
      if (prevFurniture) {
        removeSpotlight(prevFurniture);
      }
    }

    store.setSelectedFurniture(furniture.id);

    if (!furniture.spotlight) {
      const spotlight = createSpotlight(furniture);
      if (spotlight) {
        furniture.spotlight = spotlight;
      }
    }

    playSelectAnimation(furniture);
  }

  function deselectFurniture() {
    if (store.selectedFurnitureId) {
      const furniture = store.furnitures.find((f) => f.id === store.selectedFurnitureId);
      if (furniture) {
        removeSpotlight(furniture);
      }
    }
    store.setSelectedFurniture(null);
  }

  function deleteFurniture(furniture: Furniture) {
    if (!sceneRef.value || !furniture.mesh) return;

    removeSpotlight(furniture);

    furniture.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });

    sceneRef.value.remove(furniture.mesh);
    furniture.mesh = undefined;
  }

  function cleanup() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    animationMixers.clear();
  }

  return {
    createFurniture,
    createSpotlight,
    removeSpotlight,
    playSelectAnimation,
    changeMaterial,
    selectFurniture,
    deselectFurniture,
    deleteFurniture,
    cleanup,
  };
}
