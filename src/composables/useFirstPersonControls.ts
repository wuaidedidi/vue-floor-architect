import { ref, onMounted, onUnmounted, type Ref } from "vue";
import * as THREE from "three";

export interface FirstPersonConfig {
  height: number;
  moveSpeed: number;
  lookSpeed: number;
  sprintMultiplier: number;
  collisionRadius: number;
  collisionObjects: THREE.Object3D[];
}

export interface FirstPersonState {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  velocity: THREE.Vector3;
  isMoving: boolean;
  isSprinting: boolean;
}

const DEFAULT_CONFIG: FirstPersonConfig = {
  height: 1.7,
  moveSpeed: 5,
  lookSpeed: 0.002,
  sprintMultiplier: 2,
  collisionRadius: 0.5,
  collisionObjects: [],
};

export function useFirstPersonControls(
  camera: Ref<THREE.PerspectiveCamera | null>,
  domElement: Ref<HTMLElement | null>,
  config: Partial<FirstPersonConfig> = {},
) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  const isEnabled = ref(false);
  const isLocked = ref(false);

  const state: FirstPersonState = {
    position: new THREE.Vector3(0, finalConfig.height, 0),
    rotation: new THREE.Euler(0, 0, 0, "YXZ"),
    velocity: new THREE.Vector3(),
    isMoving: false,
    isSprinting: false,
  };

  const keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
  };

  let yaw = 0;
  let pitch = 0;
  let moveForward = 0;
  let moveRight = 0;

  function enable() {
    isEnabled.value = true;
  }

  function disable() {
    isEnabled.value = false;
    if (isLocked.value) {
      unlock();
    }
  }

  function lock() {
    if (!domElement.value) return;

    domElement.value.requestPointerLock?.();
  }

  function unlock() {
    document.exitPointerLock?.();
    isLocked.value = false;
  }

  function setPosition(x: number, y: number, z: number) {
    state.position.set(x, y, z);
    if (camera.value) {
      camera.value.position.copy(state.position);
    }
  }

  function setRotation(yawAngle: number, pitchAngle: number) {
    yaw = yawAngle;
    pitch = pitchAngle;
    state.rotation.set(pitch, yaw, 0);
    if (camera.value) {
      camera.value.rotation.copy(state.rotation);
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (!isEnabled.value) return;

    switch (event.code) {
      case "KeyW":
      case "ArrowUp":
        keys.forward = true;
        break;
      case "KeyS":
      case "ArrowDown":
        keys.backward = true;
        break;
      case "KeyA":
      case "ArrowLeft":
        keys.left = true;
        break;
      case "KeyD":
      case "ArrowRight":
        keys.right = true;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        keys.sprint = true;
        break;
    }
  }

  function handleKeyUp(event: KeyboardEvent) {
    switch (event.code) {
      case "KeyW":
      case "ArrowUp":
        keys.forward = false;
        break;
      case "KeyS":
      case "ArrowDown":
        keys.backward = false;
        break;
      case "KeyA":
      case "ArrowLeft":
        keys.left = false;
        break;
      case "KeyD":
      case "ArrowRight":
        keys.right = false;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        keys.sprint = false;
        break;
    }
  }

  function handleMouseMove(event: MouseEvent) {
    if (!isEnabled.value || !isLocked.value || !camera.value) return;

    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;

    yaw -= movementX * finalConfig.lookSpeed;
    pitch -= movementY * finalConfig.lookSpeed;

    pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch));

    state.rotation.set(pitch, yaw, 0);
    camera.value.rotation.copy(state.rotation);
  }

  function handlePointerLockChange() {
    isLocked.value = document.pointerLockElement === domElement.value;
  }

  function handlePointerLockError() {
    console.error("Pointer lock error");
    isLocked.value = false;
  }

  function handleClick() {
    if (isEnabled.value && !isLocked.value) {
      lock();
    }
  }

  function checkCollision(newPosition: THREE.Vector3): boolean {
    if (finalConfig.collisionObjects.length === 0) return false;

    for (const obj of finalConfig.collisionObjects) {
      if (obj instanceof THREE.Mesh) {
        const box = new THREE.Box3().setFromObject(obj);
        const playerBox = new THREE.Box3(
          new THREE.Vector3(
            newPosition.x - finalConfig.collisionRadius,
            newPosition.y - finalConfig.height,
            newPosition.z - finalConfig.collisionRadius,
          ),
          new THREE.Vector3(
            newPosition.x + finalConfig.collisionRadius,
            newPosition.y + 0.2,
            newPosition.z + finalConfig.collisionRadius,
          ),
        );

        if (box.intersectsBox(playerBox)) {
          return true;
        }
      }
    }

    return false;
  }

  function update(delta: number) {
    if (!isEnabled.value || !camera.value || !isLocked.value) return;

    moveForward = 0;
    moveRight = 0;

    if (keys.forward) moveForward += 1;
    if (keys.backward) moveForward -= 1;
    if (keys.left) moveRight -= 1;
    if (keys.right) moveRight += 1;

    state.isMoving = moveForward !== 0 || moveRight !== 0;
    state.isSprinting = keys.sprint && state.isMoving;

    const speed = finalConfig.moveSpeed * (state.isSprinting ? finalConfig.sprintMultiplier : 1);
    const actualSpeed = speed * delta;

    const direction = new THREE.Vector3();
    const forward = new THREE.Vector3(0, 0, -1);
    const right = new THREE.Vector3(1, 0, 0);

    forward.applyEuler(new THREE.Euler(0, yaw, 0));
    right.applyEuler(new THREE.Euler(0, yaw, 0));

    direction.addScaledVector(forward, moveForward);
    direction.addScaledVector(right, moveRight);

    if (direction.length() > 0) {
      direction.normalize();
    }

    const newPosition = state.position.clone();
    newPosition.addScaledVector(direction, actualSpeed);
    newPosition.y = finalConfig.height;

    if (!checkCollision(newPosition)) {
      state.position.copy(newPosition);
    }

    camera.value.position.copy(state.position);
  }

  function getState(): FirstPersonState {
    return {
      position: state.position.clone(),
      rotation: state.rotation.clone(),
      velocity: state.velocity.clone(),
      isMoving: state.isMoving,
      isSprinting: state.isSprinting,
    };
  }

  function setCollisionObjects(objects: THREE.Object3D[]) {
    finalConfig.collisionObjects = objects;
  }

  onMounted(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    document.addEventListener("pointerlockerror", handlePointerLockError);

    if (domElement.value) {
      domElement.value.addEventListener("click", handleClick);
    }
  });

  onUnmounted(() => {
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("keyup", handleKeyUp);
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("pointerlockchange", handlePointerLockChange);
    document.removeEventListener("pointerlockerror", handlePointerLockError);

    if (domElement.value) {
      domElement.value.removeEventListener("click", handleClick);
    }

    if (isLocked.value) {
      unlock();
    }
  });

  return {
    isEnabled,
    isLocked,
    state,
    enable,
    disable,
    lock,
    unlock,
    setPosition,
    setRotation,
    update,
    getState,
    setCollisionObjects,
  };
}
