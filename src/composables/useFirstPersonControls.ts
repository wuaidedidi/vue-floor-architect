import { ref, onMounted, onUnmounted, type Ref } from "vue";
import * as THREE from "three";

export interface FirstPersonControls {
  isActive: Ref<boolean>;
  position: Ref<THREE.Vector3>;
  enable: () => void;
  disable: () => void;
  update: () => void;
  dispose: () => void;
}

export function useFirstPersonControls(
  camera: THREE.PerspectiveCamera,
  canvas: HTMLCanvasElement,
  scene: THREE.Scene,
): FirstPersonControls {
  const isActive = ref(false);
  const position = ref(new THREE.Vector3(0, 1.7, 0));

  // 移动状态
  const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    shift: false,
  };

  // 视角控制
  let euler = new THREE.Euler(0, 0, 0, "YXZ");
  const PI_2 = Math.PI / 2;

  // 移动参数
  const walkSpeed = 3.0;
  const runSpeed = 6.0;
  const height = 1.7;

  // 碰撞检测用的射线
  const raycaster = new THREE.Raycaster();
  const collisionDistance = 0.5;

  // 鼠标锁定状态
  let isPointerLocked = false;

  function onMouseMove(event: MouseEvent) {
    if (!isActive.value || !isPointerLocked) return;

    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;

    euler.setFromQuaternion(camera.quaternion);
    euler.y -= movementX * 0.002;
    euler.x -= movementY * 0.002;
    euler.x = Math.max(-PI_2, Math.min(PI_2, euler.x));

    camera.quaternion.setFromEuler(euler);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (!isActive.value) return;

    switch (event.code) {
      case "KeyW":
      case "ArrowUp":
        keys.w = true;
        break;
      case "KeyA":
      case "ArrowLeft":
        keys.a = true;
        break;
      case "KeyS":
      case "ArrowDown":
        keys.s = true;
        break;
      case "KeyD":
      case "ArrowRight":
        keys.d = true;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        keys.shift = true;
        break;
    }
  }

  function onKeyUp(event: KeyboardEvent) {
    switch (event.code) {
      case "KeyW":
      case "ArrowUp":
        keys.w = false;
        break;
      case "KeyA":
      case "ArrowLeft":
        keys.a = false;
        break;
      case "KeyS":
      case "ArrowDown":
        keys.s = false;
        break;
      case "KeyD":
      case "ArrowRight":
        keys.d = false;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        keys.shift = false;
        break;
    }
  }

  function onPointerLockChange() {
    isPointerLocked = document.pointerLockElement === canvas;
  }

  function checkCollision(direction: THREE.Vector3): boolean {
    raycaster.set(camera.position, direction);
    raycaster.camera = camera;

    // 过滤掉不需要检测碰撞的对象类型
    const objectsToCheck = scene.children.filter((obj) => {
      // 跳过精灵、灯光、辅助对象等
      if (obj instanceof THREE.Sprite) return false;
      if (obj instanceof THREE.Light) return false;
      if (obj instanceof THREE.GridHelper) return false;
      if (obj instanceof THREE.Line) return false;
      if (obj.name === "ground-plane") return false;
      if (obj.name === "volumetric-light-cone") return false;
      if (obj.name === "light-glow") return false;
      return true;
    });

    const intersects = raycaster.intersectObjects(objectsToCheck, true);

    for (const intersect of intersects) {
      if (intersect.distance < collisionDistance) {
        return true;
      }
    }
    return false;
  }

  function update() {
    if (!isActive.value) return;

    const speed = keys.shift ? runSpeed : walkSpeed;
    const delta = 0.016;

    const direction = new THREE.Vector3();
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    right.y = 0;
    right.normalize();

    if (keys.w) direction.add(forward);
    if (keys.s) direction.sub(forward);
    if (keys.d) direction.add(right);
    if (keys.a) direction.sub(right);

    if (direction.length() > 0) {
      direction.normalize();

      // 碰撞检测
      if (!checkCollision(direction)) {
        const moveDistance = speed * delta;
        camera.position.x += direction.x * moveDistance;
        camera.position.z += direction.z * moveDistance;
      }
    }

    // 保持高度
    camera.position.y = height;

    position.value.copy(camera.position);
  }

  function enable() {
    isActive.value = true;
    canvas.requestPointerLock();

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("pointerlockchange", onPointerLockChange);

    // 设置初始视角
    camera.position.copy(position.value);
    euler.setFromQuaternion(camera.quaternion);
  }

  function disable() {
    isActive.value = false;
    document.exitPointerLock();

    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("keyup", onKeyUp);
    document.removeEventListener("pointerlockchange", onPointerLockChange);
  }

  function dispose() {
    disable();
  }

  return {
    isActive,
    position,
    enable,
    disable,
    update,
    dispose,
  };
}
