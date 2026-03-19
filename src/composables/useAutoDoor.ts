import { ref, onUnmounted, type Ref } from "vue";
import * as THREE from "three";

export interface DoorConfig {
  width: number;
  height: number;
  thickness: number;
  openAngle: number;
  openSpeed: number;
  closeDelay: number;
  triggerDistance: number;
  pivotOffset: number;
}

export interface Door {
  id: string;
  mesh: THREE.Mesh;
  pivot: THREE.Object3D;
  config: DoorConfig;
  isOpen: boolean;
  isAnimating: boolean;
  currentAngle: number;
  targetAngle: number;
  closeTimer: number | null;
  position: THREE.Vector3;
}

const DEFAULT_DOOR_CONFIG: DoorConfig = {
  width: 3,
  height: 8,
  thickness: 0.3,
  openAngle: Math.PI / 2 - 0.1,
  openSpeed: 2,
  closeDelay: 3,
  triggerDistance: 4,
  pivotOffset: 0,
};

export function useAutoDoor(scene: Ref<THREE.Scene | null>) {
  const doors = ref<Door[]>([]);
  const isEnabled = ref(false);
  let doorIdCounter = 0;

  function createDoor(position: THREE.Vector3, rotation: number = 0, config: Partial<DoorConfig> = {}): Door | null {
    if (!scene.value) {
      console.warn("AutoDoor: Scene not ready");
      return null;
    }

    console.log("Creating door at:", position, "rotation:", rotation);

    const finalConfig = { ...DEFAULT_DOOR_CONFIG, ...config };
    const id = `door-${++doorIdCounter}`;

    const pivot = new THREE.Object3D();
    pivot.position.copy(position);
    pivot.rotation.y = rotation;
    scene.value.add(pivot);

    console.log("Door pivot added to scene at:", position, "rotation:", rotation);

    const geometry = new THREE.BoxGeometry(finalConfig.width, finalConfig.height, finalConfig.thickness);

    const material = new THREE.MeshPhongMaterial({
      color: 0xcd853f,
      transparent: false,
      opacity: 1.0,
      emissive: 0x331100,
      emissiveIntensity: 0.2,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(finalConfig.width / 2 - finalConfig.pivotOffset, finalConfig.height / 2, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = id;
    pivot.add(mesh);

    const door: Door = {
      id,
      mesh,
      pivot,
      config: finalConfig,
      isOpen: false,
      isAnimating: false,
      currentAngle: 0,
      targetAngle: 0,
      closeTimer: null,
      position: position.clone(),
    };

    doors.value.push(door);
    return door;
  }

  function createDoorFromWall(
    wallStart: THREE.Vector3,
    wallEnd: THREE.Vector3,
    wallHeight: number,
    doorPosition: number = 0.5,
    config: Partial<DoorConfig> = {},
  ): Door | null {
    const direction = wallEnd.clone().sub(wallStart);
    const length = direction.length();
    direction.normalize();

    const midPoint = wallStart.clone().add(wallEnd).multiplyScalar(0.5);
    const doorPos = wallStart.clone().add(direction.clone().multiplyScalar(length * doorPosition));
    doorPos.y = 0;

    const angle = Math.atan2(direction.x, direction.z);

    const finalConfig = {
      ...DEFAULT_DOOR_CONFIG,
      height: wallHeight * 0.8,
      ...config,
    };

    return createDoor(doorPos, angle, finalConfig);
  }

  function removeDoor(door: Door) {
    if (!scene.value) return;

    if (door.closeTimer !== null) {
      clearTimeout(door.closeTimer);
    }

    door.pivot.remove(door.mesh);
    scene.value.remove(door.pivot);

    door.mesh.geometry.dispose();
    (door.mesh.material as THREE.Material).dispose();

    const index = doors.value.indexOf(door);
    if (index > -1) {
      doors.value.splice(index, 1);
    }
  }

  function checkProximity(playerPosition: THREE.Vector3) {
    doors.value.forEach((door) => {
      const doorWorldPos = new THREE.Vector3();
      door.pivot.getWorldPosition(doorWorldPos);

      const distance = playerPosition.distanceTo(doorWorldPos);

      if (distance < door.config.triggerDistance) {
        if (!door.isOpen && !door.isAnimating) {
          openDoor(door);
        } else if (door.isOpen && door.closeTimer !== null) {
          clearTimeout(door.closeTimer);
          door.closeTimer = null;
        }
      } else {
        if (door.isOpen && !door.isAnimating && door.closeTimer === null) {
          door.closeTimer = window.setTimeout(() => {
            closeDoor(door);
            door.closeTimer = null;
          }, door.config.closeDelay * 1000);
        }
      }
    });
  }

  function openDoor(door: Door) {
    if (door.isAnimating || door.isOpen) return;

    door.isAnimating = true;
    door.targetAngle = door.config.openAngle;
    door.isOpen = true;
  }

  function closeDoor(door: Door) {
    if (door.isAnimating || !door.isOpen) return;

    door.isAnimating = true;
    door.targetAngle = 0;
    door.isOpen = false;
  }

  function update(delta: number) {
    if (!isEnabled.value) return;

    doors.value.forEach((door) => {
      if (!door.isAnimating) return;

      const diff = door.targetAngle - door.currentAngle;
      const step = door.config.openSpeed * delta;

      if (Math.abs(diff) < step) {
        door.currentAngle = door.targetAngle;
        door.isAnimating = false;
      } else {
        door.currentAngle += Math.sign(diff) * step;
      }

      door.pivot.rotation.y = door.currentAngle;
    });
  }

  function enable() {
    console.log("AutoDoor enable called, doors count:", doors.value.length);
    isEnabled.value = true;
    doors.value.forEach((door) => {
      console.log("Door:", door.id, "position:", door.position);
    });
  }

  function disable() {
    isEnabled.value = false;
  }

  function clearAll() {
    doors.value.forEach((door) => removeDoor(door));
    doors.value = [];
  }

  function getDoors(): Door[] {
    return doors.value;
  }

  onUnmounted(() => {
    clearAll();
  });

  return {
    doors,
    isEnabled,
    createDoor,
    createDoorFromWall,
    removeDoor,
    checkProximity,
    openDoor,
    closeDoor,
    update,
    enable,
    disable,
    clearAll,
    getDoors,
  };
}
