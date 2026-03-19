import { ref, onUnmounted, type Ref } from 'vue';
import * as THREE from 'three';

export interface Door {
  id: string;
  mesh: THREE.Mesh;
  hingePoint: THREE.Vector3;
  openAngle: number;
  currentAngle: number;
  targetAngle: number;
  isOpen: boolean;
  openDirection: 'left' | 'right';
  animationSpeed: number;
  triggerDistance: number;
}

export interface DoorOptions {
  openAngle?: number;
  animationSpeed?: number;
  triggerDistance?: number;
  openDirection?: 'left' | 'right';
}

export class DoorSystem {
  private doors: Map<string, Door> = new Map();
  private scene: THREE.Scene;
  private defaultOptions: Required<DoorOptions>;

  constructor(scene: THREE.Scene, options: DoorOptions = {}) {
    this.scene = scene;
    this.defaultOptions = {
      openAngle: options.openAngle || Math.PI / 2,
      animationSpeed: options.animationSpeed || 2.0,
      triggerDistance: options.triggerDistance || 2.5,
      openDirection: options.openDirection || 'right'
    };
  }

  createDoor(
    position: THREE.Vector3,
    size: { width: number; height: number; depth: number },
    rotation: number = 0,
    options: DoorOptions = {}
  ): Door | null {
    const doorOptions = { ...this.defaultOptions, ...options };

    const geometry = new THREE.BoxGeometry(size.width, size.height, size.depth);
    const material = new THREE.MeshPhongMaterial({
      color: 0x8B4513,
      side: THREE.DoubleSide
    });

    const doorMesh = new THREE.Mesh(geometry, material);
    doorMesh.position.copy(position);
    doorMesh.rotation.y = rotation;
    doorMesh.castShadow = true;
    doorMesh.receiveShadow = true;
    doorMesh.name = 'door';

    this.scene.add(doorMesh);

    const hingePoint = this.calculateHingePoint(position, size, rotation, doorOptions.openDirection);

    const door: Door = {
      id: `door-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      mesh: doorMesh,
      hingePoint,
      openAngle: doorOptions.openAngle,
      currentAngle: 0,
      targetAngle: 0,
      isOpen: false,
      openDirection: doorOptions.openDirection,
      animationSpeed: doorOptions.animationSpeed,
      triggerDistance: doorOptions.triggerDistance
    };

    this.doors.set(door.id, door);
    return door;
  }

  private calculateHingePoint(
    position: THREE.Vector3,
    size: { width: number; height: number; depth: number },
    rotation: number,
    direction: 'left' | 'right'
  ): THREE.Vector3 {
    const halfWidth = size.width / 2;
    const offset = direction === 'left' ? -halfWidth : halfWidth;

    const hingeX = position.x + Math.cos(rotation) * offset;
    const hingeZ = position.z + Math.sin(rotation) * offset;

    return new THREE.Vector3(hingeX, position.y, hingeZ);
  }

  addDoorMesh(
    mesh: THREE.Mesh,
    options: DoorOptions = {}
  ): Door | null {
    const doorOptions = { ...this.defaultOptions, ...options };

    const boundingBox = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3();
    boundingBox.getSize(size);

    const position = mesh.position.clone();
    const rotation = mesh.rotation.y;

    const hingePoint = this.calculateHingePoint(
      position,
      { width: size.x, height: size.y, depth: size.z },
      rotation,
      doorOptions.openDirection
    );

    const door: Door = {
      id: `door-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      mesh,
      hingePoint,
      openAngle: doorOptions.openAngle,
      currentAngle: 0,
      targetAngle: 0,
      isOpen: false,
      openDirection: doorOptions.openDirection,
      animationSpeed: doorOptions.animationSpeed,
      triggerDistance: doorOptions.triggerDistance
    };

    this.doors.set(door.id, door);
    return door;
  }

  removeDoor(doorId: string): boolean {
    const door = this.doors.get(doorId);
    if (door) {
      this.scene.remove(door.mesh);
      door.mesh.geometry.dispose();
      if (door.mesh.material instanceof THREE.Material) {
        door.mesh.material.dispose();
      }
      this.doors.delete(doorId);
      return true;
    }
    return false;
  }

  update(playerPosition: THREE.Vector3, delta: number) {
    this.doors.forEach((door) => {
      const distance = playerPosition.distanceTo(door.mesh.position);
      const shouldOpen = distance < door.triggerDistance;

      if (shouldOpen && !door.isOpen) {
        door.targetAngle = door.openDirection === 'right' ? -door.openAngle : door.openAngle;
        door.isOpen = true;
      } else if (!shouldOpen && door.isOpen) {
        door.targetAngle = 0;
        door.isOpen = false;
      }

      if (Math.abs(door.currentAngle - door.targetAngle) > 0.001) {
        const angleDiff = door.targetAngle - door.currentAngle;
        const angleStep = door.animationSpeed * delta;

        if (Math.abs(angleDiff) < angleStep) {
          this.rotateDoor(door, door.targetAngle - door.currentAngle);
          door.currentAngle = door.targetAngle;
        } else {
          const rotationAmount = Math.sign(angleDiff) * angleStep;
          this.rotateDoor(door, rotationAmount);
          door.currentAngle += rotationAmount;
        }
      }
    });
  }

  private rotateDoor(door: Door, angle: number) {
    const mesh = door.mesh;
    const hinge = door.hingePoint;

    const relativePos = new THREE.Vector3();
    relativePos.subVectors(mesh.position, hinge);

    const rotationMatrix = new THREE.Matrix4();
    rotationMatrix.makeRotationY(angle);
    relativePos.applyMatrix4(rotationMatrix);

    mesh.position.addVectors(hinge, relativePos);
    mesh.rotation.y += angle;
  }

  openDoor(doorId: string): boolean {
    const door = this.doors.get(doorId);
    if (door && !door.isOpen) {
      door.targetAngle = door.openDirection === 'right' ? -door.openAngle : door.openAngle;
      door.isOpen = true;
      return true;
    }
    return false;
  }

  closeDoor(doorId: string): boolean {
    const door = this.doors.get(doorId);
    if (door && door.isOpen) {
      door.targetAngle = 0;
      door.isOpen = false;
      return true;
    }
    return false;
  }

  toggleDoor(doorId: string): boolean {
    const door = this.doors.get(doorId);
    if (door) {
      if (door.isOpen) {
        return this.closeDoor(doorId);
      } else {
        return this.openDoor(doorId);
      }
    }
    return false;
  }

  getDoors(): Door[] {
    return Array.from(this.doors.values());
  }

  getDoorById(doorId: string): Door | undefined {
    return this.doors.get(doorId);
  }

  dispose() {
    this.doors.forEach((door) => {
      this.scene.remove(door.mesh);
      door.mesh.geometry.dispose();
      if (door.mesh.material instanceof THREE.Material) {
        door.mesh.material.dispose();
      }
    });
    this.doors.clear();
  }
}

export function useDoorSystem(scene: Ref<THREE.Scene | null>, options: DoorOptions = {}) {
  const doorSystem = ref<DoorSystem | null>(null);
  const doors = ref<Door[]>([]);

  function init() {
    if (!scene.value) return;
    doorSystem.value = new DoorSystem(scene.value, options);
  }

  function createDoor(
    position: THREE.Vector3,
    size: { width: number; height: number; depth: number },
    rotation?: number,
    doorOptions?: DoorOptions
  ): Door | null {
    if (!doorSystem.value) return null;
    const door = doorSystem.value.createDoor(position, size, rotation, doorOptions);
    if (door) {
      doors.value = doorSystem.value.getDoors();
    }
    return door;
  }

  function addDoorMesh(mesh: THREE.Mesh, doorOptions?: DoorOptions): Door | null {
    if (!doorSystem.value) return null;
    const door = doorSystem.value.addDoorMesh(mesh, doorOptions);
    if (door) {
      doors.value = doorSystem.value.getDoors();
    }
    return door;
  }

  function removeDoor(doorId: string): boolean {
    if (!doorSystem.value) return false;
    const result = doorSystem.value.removeDoor(doorId);
    if (result) {
      doors.value = doorSystem.value.getDoors();
    }
    return result;
  }

  function update(playerPosition: THREE.Vector3, delta: number) {
    if (doorSystem.value) {
      doorSystem.value.update(playerPosition, delta);
    }
  }

  function openDoor(doorId: string): boolean {
    return doorSystem.value?.openDoor(doorId) || false;
  }

  function closeDoor(doorId: string): boolean {
    return doorSystem.value?.closeDoor(doorId) || false;
  }

  function toggleDoor(doorId: string): boolean {
    return doorSystem.value?.toggleDoor(doorId) || false;
  }

  function dispose() {
    if (doorSystem.value) {
      doorSystem.value.dispose();
      doorSystem.value = null;
      doors.value = [];
    }
  }

  onUnmounted(() => {
    dispose();
  });

  return {
    doorSystem,
    doors,
    init,
    createDoor,
    addDoorMesh,
    removeDoor,
    update,
    openDoor,
    closeDoor,
    toggleDoor,
    dispose
  };
}
