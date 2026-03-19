import { ref, onMounted, onUnmounted, type Ref } from "vue";
import * as THREE from "three";

export interface FirstPersonControlsOptions {
  movementSpeed?: number;
  lookSpeed?: number;
  height?: number;
  gravity?: number;
  jumpForce?: number;
}

export class FirstPersonControls {
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  private options: Required<FirstPersonControlsOptions>;

  private isLocked = false;
  private velocity = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private moveForward = false;
  private moveBackward = false;
  private moveLeft = false;
  private moveRight = false;
  private canJump = false;
  private isOnGround = true;

  private euler = new THREE.Euler(0, 0, 0, "YXZ");
  private PI_2 = Math.PI / 2;

  private onKeyDownBound: (event: KeyboardEvent) => void;
  private onKeyUpBound: (event: KeyboardEvent) => void;
  private onMouseMoveBound: (event: MouseEvent) => void;
  private onClickBound: () => void;
  private onPointerlockchangeBound: () => void;
  private onPointerlockerrorBound: () => void;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement, options: FirstPersonControlsOptions = {}) {
    this.camera = camera;
    this.domElement = domElement;

    this.options = {
      movementSpeed: options.movementSpeed || 10.0,
      lookSpeed: options.lookSpeed || 0.002,
      height: options.height || 1.8,
      gravity: options.gravity || 30.0,
      jumpForce: options.jumpForce || 10.0,
    };

    this.onKeyDownBound = this.onKeyDown.bind(this);
    this.onKeyUpBound = this.onKeyUp.bind(this);
    this.onMouseMoveBound = this.onMouseMove.bind(this);
    this.onClickBound = this.onClick.bind(this);
    this.onPointerlockchangeBound = this.onPointerlockchange.bind(this);
    this.onPointerlockerrorBound = this.onPointerlockerror.bind(this);

    this.connect();
  }

  connect(): void {
    document.addEventListener("keydown", this.onKeyDownBound);
    document.addEventListener("keyup", this.onKeyUpBound);
    document.addEventListener("mousemove", this.onMouseMoveBound);
    document.addEventListener("click", this.onClickBound);
    document.addEventListener("pointerlockchange", this.onPointerlockchangeBound);
    document.addEventListener("pointerlockerror", this.onPointerlockerrorBound);
  }

  disconnect(): void {
    document.removeEventListener("keydown", this.onKeyDownBound);
    document.removeEventListener("keyup", this.onKeyUpBound);
    document.removeEventListener("mousemove", this.onMouseMoveBound);
    document.removeEventListener("click", this.onClickBound);
    document.removeEventListener("pointerlockchange", this.onPointerlockchangeBound);
    document.removeEventListener("pointerlockerror", this.onPointerlockerrorBound);
    this.unlockPointer();
  }

  dispose(): void {
    this.disconnect();
  }

  lockPointer(): void {
    this.domElement.requestPointerLock();
  }

  unlockPointer(): void {
    document.exitPointerLock();
  }

  getIsLocked(): boolean {
    return this.isLocked;
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (!this.isLocked) return;

    switch (event.code) {
      case "ArrowUp":
      case "KeyW":
        this.moveForward = true;
        break;
      case "ArrowDown":
      case "KeyS":
        this.moveBackward = true;
        break;
      case "ArrowLeft":
      case "KeyA":
        this.moveLeft = true;
        break;
      case "ArrowRight":
      case "KeyD":
        this.moveRight = true;
        break;
      case "Space":
        if (this.canJump && this.isOnGround) {
          this.velocity.y = this.options.jumpForce;
          this.canJump = false;
          this.isOnGround = false;
        }
        break;
    }
  }

  private onKeyUp(event: KeyboardEvent): void {
    switch (event.code) {
      case "ArrowUp":
      case "KeyW":
        this.moveForward = false;
        break;
      case "ArrowDown":
      case "KeyS":
        this.moveBackward = false;
        break;
      case "ArrowLeft":
      case "KeyA":
        this.moveLeft = false;
        break;
      case "ArrowRight":
      case "KeyD":
        this.moveRight = false;
        break;
    }
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.isLocked) return;

    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;

    this.euler.setFromQuaternion(this.camera.quaternion);
    this.euler.y -= movementX * this.options.lookSpeed;
    this.euler.x -= movementY * this.options.lookSpeed;
    this.euler.x = Math.max(-this.PI_2, Math.min(this.PI_2, this.euler.x));
    this.camera.quaternion.setFromEuler(this.euler);
  }

  private onClick(): void {
    if (!this.isLocked) {
      this.lockPointer();
    }
  }

  private onPointerlockchange(): void {
    this.isLocked = document.pointerLockElement === this.domElement;
  }

  private onPointerlockerror(): void {
    console.error("Pointer lock error");
  }

  update(delta: number, colliders?: THREE.Mesh[]): void {
    if (!this.isLocked) return;

    this.velocity.x -= this.velocity.x * 10.0 * delta;
    this.velocity.z -= this.velocity.z * 10.0 * delta;
    this.velocity.y -= this.options.gravity * delta;

    this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
    this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
    this.direction.normalize();

    if (this.moveForward || this.moveBackward) {
      this.velocity.z += this.direction.z * this.options.movementSpeed * delta * 50;
    }
    if (this.moveLeft || this.moveRight) {
      this.velocity.x += this.direction.x * this.options.movementSpeed * delta * 50;
    }

    const moveVector = new THREE.Vector3(this.velocity.x * delta, 0, this.velocity.z * delta);
    moveVector.applyEuler(new THREE.Euler(0, this.euler.y, 0));

    const newPosition = this.camera.position.clone();
    newPosition.x += moveVector.x;
    newPosition.z += moveVector.z;

    if (colliders && colliders.length > 0) {
      const collision = this.checkCollision(newPosition, colliders);
      if (!collision) {
        this.camera.position.x = newPosition.x;
        this.camera.position.z = newPosition.z;
      }
    } else {
      this.camera.position.x = newPosition.x;
      this.camera.position.z = newPosition.z;
    }

    this.camera.position.y += this.velocity.y * delta;

    if (this.camera.position.y < this.options.height) {
      this.velocity.y = 0;
      this.camera.position.y = this.options.height;
      this.canJump = true;
      this.isOnGround = true;
    }
  }

  private checkCollision(position: THREE.Vector3, colliders: THREE.Mesh[]): boolean {
    const playerRadius = 0.5;
    const playerHeight = this.options.height;

    for (const collider of colliders) {
      const box = new THREE.Box3().setFromObject(collider);
      const playerBox = new THREE.Box3(
        new THREE.Vector3(position.x - playerRadius, 0, position.z - playerRadius),
        new THREE.Vector3(position.x + playerRadius, playerHeight, position.z + playerRadius),
      );

      if (box.intersectsBox(playerBox)) {
        return true;
      }
    }
    return false;
  }

  getPosition(): THREE.Vector3 {
    return this.camera.position.clone();
  }

  getDirection(): THREE.Vector3 {
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    return direction;
  }
}

export function useFirstPersonControls(
  camera: Ref<THREE.PerspectiveCamera | null>,
  domElement: Ref<HTMLElement | null>,
  options: FirstPersonControlsOptions = {},
) {
  const controls = ref<FirstPersonControls | null>(null);
  const isLocked = ref(false);
  const isActive = ref(false);

  function init() {
    if (!camera.value || !domElement.value) return;
    controls.value = new FirstPersonControls(camera.value, domElement.value, options);
    isActive.value = true;
  }

  function update(delta: number, colliders?: THREE.Mesh[]) {
    if (controls.value && isActive.value) {
      controls.value.update(delta, colliders);
      isLocked.value = controls.value.getIsLocked();
    }
  }

  function activate() {
    isActive.value = true;
    if (controls.value) {
      controls.value.connect();
    }
  }

  function deactivate() {
    isActive.value = false;
    if (controls.value) {
      controls.value.disconnect();
    }
  }

  function dispose() {
    if (controls.value) {
      controls.value.dispose();
      controls.value = null;
    }
    isActive.value = false;
    isLocked.value = false;
  }

  function lockPointer() {
    if (controls.value) {
      controls.value.lockPointer();
    }
  }

  function unlockPointer() {
    if (controls.value) {
      controls.value.unlockPointer();
    }
  }

  return {
    controls,
    isLocked,
    isActive,
    init,
    update,
    activate,
    deactivate,
    dispose,
    lockPointer,
    unlockPointer,
  };
}
