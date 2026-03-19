import * as THREE from 'three';

export interface DoorConfig {
  position: THREE.Vector3;
  rotation: number;
  width: number;
  height: number;
  openAngle: number;
  triggerDistance: number;
  openSpeed: number;
}

export interface AutoDoor {
  group: THREE.Group;
  doorMesh: THREE.Mesh;
  frameMesh: THREE.Mesh;
  isOpen: boolean;
  update: (playerPosition: THREE.Vector3) => void;
  dispose: () => void;
}

export function createAutoDoor(
  scene: THREE.Scene,
  config: DoorConfig
): AutoDoor {
  const {
    position,
    rotation,
    width = 1.2,
    height = 2.2,
    openAngle = Math.PI / 2,
    triggerDistance = 2.5,
    openSpeed = 2.0
  } = config;
  
  const group = new THREE.Group();
  group.position.copy(position);
  group.rotation.y = rotation;
  
  // 创建门框
  const frameThickness = 0.1;
  const frameDepth = 0.15;
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a4a4a,
    roughness: 0.8
  });
  
  // 门框几何体
  const frameGroup = new THREE.Group();
  
  // 左框
  const leftFrame = new THREE.Mesh(
    new THREE.BoxGeometry(frameThickness, height, frameDepth),
    frameMaterial
  );
  leftFrame.position.set(-width / 2 - frameThickness / 2, height / 2, 0);
  frameGroup.add(leftFrame);
  
  // 右框
  const rightFrame = new THREE.Mesh(
    new THREE.BoxGeometry(frameThickness, height, frameDepth),
    frameMaterial
  );
  rightFrame.position.set(width / 2 + frameThickness / 2, height / 2, 0);
  frameGroup.add(rightFrame);
  
  // 上框
  const topFrame = new THREE.Mesh(
    new THREE.BoxGeometry(width + frameThickness * 2, frameThickness, frameDepth),
    frameMaterial
  );
  topFrame.position.set(0, height + frameThickness / 2, 0);
  frameGroup.add(topFrame);
  
  group.add(frameGroup);
  
  // 创建门扇组（用于旋转）
  const doorGroup = new THREE.Group();
  doorGroup.position.set(-width / 2, 0, 0); // 以左边缘为旋转轴
  
  // 门板
  const doorGeometry = new THREE.BoxGeometry(width, height, 0.08);
  const doorMaterial = new THREE.MeshStandardMaterial({
    color: 0x8b5a2b,
    roughness: 0.6,
    metalness: 0.1
  });
  
  const doorMesh = new THREE.Mesh(doorGeometry, doorMaterial);
  doorMesh.position.set(width / 2, height / 2, 0);
  doorMesh.castShadow = true;
  doorMesh.receiveShadow = true;
  doorGroup.add(doorMesh);
  
  // 门把手
  const handleGeometry = new THREE.SphereGeometry(0.06, 16, 16);
  const handleMaterial = new THREE.MeshStandardMaterial({
    color: 0xc0c0c0,
    metalness: 0.9,
    roughness: 0.2
  });
  
  const handle = new THREE.Mesh(handleGeometry, handleMaterial);
  handle.position.set(width - 0.15, height / 2, 0.08);
  doorGroup.add(handle);
  
  // 门把手底座
  const handleBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.05, 16),
    handleMaterial
  );
  handleBase.rotation.x = Math.PI / 2;
  handleBase.position.set(width - 0.15, height / 2, 0.05);
  doorGroup.add(handleBase);
  
  // 门板纹理细节
  const panelGeometry = new THREE.BoxGeometry(width * 0.8, height * 0.6, 0.02);
  const panelMaterial = new THREE.MeshStandardMaterial({
    color: 0x7a4a1b,
    roughness: 0.7
  });
  const panel = new THREE.Mesh(panelGeometry, panelMaterial);
  panel.position.set(width / 2, height / 2, 0.05);
  doorGroup.add(panel);
  
  group.add(doorGroup);
  scene.add(group);
  
  // 状态
  let isOpen = false;
  let currentAngle = 0;
  let targetAngle = 0;
  
  function update(playerPosition: THREE.Vector3) {
    // 计算玩家到门的距离
    const doorWorldPos = new THREE.Vector3();
    group.getWorldPosition(doorWorldPos);
    
    const distance = playerPosition.distanceTo(doorWorldPos);
    
    // 判断是否应该开门
    const shouldOpen = distance < triggerDistance;
    
    if (shouldOpen !== isOpen) {
      isOpen = shouldOpen;
      targetAngle = isOpen ? openAngle : 0;
    }
    
    // 平滑插值到目标角度
    const delta = 0.016;
    const diff = targetAngle - currentAngle;
    
    if (Math.abs(diff) > 0.001) {
      const step = Math.sign(diff) * openSpeed * delta;
      if (Math.abs(step) > Math.abs(diff)) {
        currentAngle = targetAngle;
      } else {
        currentAngle += step;
      }
      doorGroup.rotation.y = currentAngle;
    }
  }
  
  function dispose() {
    scene.remove(group);
    
    doorGeometry.dispose();
    doorMaterial.dispose();
    frameMaterial.dispose();
    handleGeometry.dispose();
    handleMaterial.dispose();
    panelGeometry.dispose();
    panelMaterial.dispose();
  }
  
  return {
    group,
    doorMesh,
    frameMesh: leftFrame,
    isOpen,
    update,
    dispose
  };
}

// 管理多个自动门
export function createAutoDoors(
  scene: THREE.Scene,
  configs: DoorConfig[]
): { doors: AutoDoor[]; update: (playerPosition: THREE.Vector3) => void; dispose: () => void } {
  const doors = configs.map(config => createAutoDoor(scene, config));
  
  function update(playerPosition: THREE.Vector3) {
    doors.forEach(door => door.update(playerPosition));
  }
  
  function dispose() {
    doors.forEach(door => door.dispose());
  }
  
  return {
    doors,
    update,
    dispose
  };
}

// 预设门配置生成器
export function generateRoomDoors(roomSize: number = 20): DoorConfig[] {
  const halfSize = roomSize / 2;
  const doorWidth = 1.2;
  
  return [
    // 前门
    {
      position: new THREE.Vector3(0, 0, -halfSize),
      rotation: 0,
      width: doorWidth,
      height: 2.2,
      openAngle: Math.PI / 2,
      triggerDistance: 2.5,
      openSpeed: 2.0
    },
    // 后门
    {
      position: new THREE.Vector3(0, 0, halfSize),
      rotation: Math.PI,
      width: doorWidth,
      height: 2.2,
      openAngle: Math.PI / 2,
      triggerDistance: 2.5,
      openSpeed: 2.0
    },
    // 左门
    {
      position: new THREE.Vector3(-halfSize, 0, 0),
      rotation: -Math.PI / 2,
      width: doorWidth,
      height: 2.2,
      openAngle: Math.PI / 2,
      triggerDistance: 2.5,
      openSpeed: 2.0
    },
    // 右门
    {
      position: new THREE.Vector3(halfSize, 0, 0),
      rotation: Math.PI / 2,
      width: doorWidth,
      height: 2.2,
      openAngle: Math.PI / 2,
      triggerDistance: 2.5,
      openSpeed: 2.0
    }
  ];
}
