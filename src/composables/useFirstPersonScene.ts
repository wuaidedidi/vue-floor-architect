import { ref, onMounted, onUnmounted, type Ref } from 'vue';
import * as THREE from 'three';
import { useFirstPersonControls } from './useFirstPersonControls';
import { createRoomLighting } from './useVolumetricLight';
import { createAutoDoors, generateRoomDoors } from './useAutoDoor';

export interface FirstPersonScene {
  isActive: Ref<boolean>;
  enter: () => void;
  exit: () => void;
  toggle: () => void;
  dispose: () => void;
}

export function useFirstPersonScene(
  canvasRef: Ref<HTMLCanvasElement | null>,
  containerRef: Ref<HTMLDivElement | null>
): FirstPersonScene {
  const isActive = ref(false);
  
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let renderer: THREE.WebGLRenderer;
  let fpControls: ReturnType<typeof useFirstPersonControls>;
  let roomLighting: ReturnType<typeof createRoomLighting>;
  let autoDoors: ReturnType<typeof createAutoDoors>;
  let animationId: number | null = null;
  
  // 原始相机状态（用于退出时恢复）
  let originalCameraState: {
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
  } | null = null;
  
  function init() {
    if (!canvasRef.value || !containerRef.value) return;
    
    const canvas = canvasRef.value;
    const container = containerRef.value;
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    // 创建场景
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.Fog(0x1a1a2e, 5, 50);
    
    // 创建相机
    camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 1.7, 0);
    
    // 创建渲染器
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // 创建室内环境
    createRoom();
    
    // 创建体积光
    roomLighting = createRoomLighting(scene);
    
    // 创建自动门
    const doorConfigs = generateRoomDoors(20);
    autoDoors = createAutoDoors(scene, doorConfigs);
    
    // 创建第一人称控制器
    fpControls = useFirstPersonControls(camera, canvas, scene);
  }
  
  function createRoom() {
    const roomSize = 20;
    const wallHeight = 4;
    
    // 地板
    const floorGeometry = new THREE.PlaneGeometry(roomSize, roomSize);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a3a4a,
      roughness: 0.8,
      metalness: 0.1
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.name = 'floor';
    scene.add(floor);
    
    // 天花板
    const ceiling = new THREE.Mesh(
      floorGeometry,
      new THREE.MeshStandardMaterial({ color: 0x2a2a3a })
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = wallHeight;
    scene.add(ceiling);
    
    // 墙壁材质
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x5a5a6a,
      roughness: 0.9
    });
    
    // 四面墙
    const wallThickness = 0.3;
    const halfSize = roomSize / 2;
    
    // 前墙（有门洞）
    const frontWallLeft = new THREE.Mesh(
      new THREE.BoxGeometry(halfSize - 1, wallHeight, wallThickness),
      wallMaterial
    );
    frontWallLeft.position.set(-halfSize / 2 - 1, wallHeight / 2, -halfSize);
    frontWallLeft.castShadow = true;
    frontWallLeft.receiveShadow = true;
    scene.add(frontWallLeft);
    
    const frontWallRight = new THREE.Mesh(
      new THREE.BoxGeometry(halfSize - 1, wallHeight, wallThickness),
      wallMaterial
    );
    frontWallRight.position.set(halfSize / 2 + 1, wallHeight / 2, -halfSize);
    frontWallRight.castShadow = true;
    frontWallRight.receiveShadow = true;
    scene.add(frontWallRight);
    
    const frontWallTop = new THREE.Mesh(
      new THREE.BoxGeometry(2, wallHeight - 2.2, wallThickness),
      wallMaterial
    );
    frontWallTop.position.set(0, 2.2 + (wallHeight - 2.2) / 2, -halfSize);
    frontWallTop.castShadow = true;
    frontWallTop.receiveShadow = true;
    scene.add(frontWallTop);
    
    // 后墙（有门洞）
    const backWallLeft = new THREE.Mesh(
      new THREE.BoxGeometry(halfSize - 1, wallHeight, wallThickness),
      wallMaterial
    );
    backWallLeft.position.set(-halfSize / 2 - 1, wallHeight / 2, halfSize);
    backWallLeft.castShadow = true;
    backWallLeft.receiveShadow = true;
    scene.add(backWallLeft);
    
    const backWallRight = new THREE.Mesh(
      new THREE.BoxGeometry(halfSize - 1, wallHeight, wallThickness),
      wallMaterial
    );
    backWallRight.position.set(halfSize / 2 + 1, wallHeight / 2, halfSize);
    backWallRight.castShadow = true;
    backWallRight.receiveShadow = true;
    scene.add(backWallRight);
    
    const backWallTop = new THREE.Mesh(
      new THREE.BoxGeometry(2, wallHeight - 2.2, wallThickness),
      wallMaterial
    );
    backWallTop.position.set(0, 2.2 + (wallHeight - 2.2) / 2, halfSize);
    backWallTop.castShadow = true;
    backWallTop.receiveShadow = true;
    scene.add(backWallTop);
    
    // 左墙（有门洞）
    const leftWallFront = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, wallHeight, halfSize - 1),
      wallMaterial
    );
    leftWallFront.position.set(-halfSize, wallHeight / 2, -halfSize / 2 - 1);
    leftWallFront.castShadow = true;
    leftWallFront.receiveShadow = true;
    scene.add(leftWallFront);
    
    const leftWallBack = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, wallHeight, halfSize - 1),
      wallMaterial
    );
    leftWallBack.position.set(-halfSize, wallHeight / 2, halfSize / 2 + 1);
    leftWallBack.castShadow = true;
    leftWallBack.receiveShadow = true;
    scene.add(leftWallBack);
    
    const leftWallTop = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, wallHeight - 2.2, 2),
      wallMaterial
    );
    leftWallTop.position.set(-halfSize, 2.2 + (wallHeight - 2.2) / 2, 0);
    leftWallTop.castShadow = true;
    leftWallTop.receiveShadow = true;
    scene.add(leftWallTop);
    
    // 右墙（有门洞）
    const rightWallFront = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, wallHeight, halfSize - 1),
      wallMaterial
    );
    rightWallFront.position.set(halfSize, wallHeight / 2, -halfSize / 2 - 1);
    rightWallFront.castShadow = true;
    rightWallFront.receiveShadow = true;
    scene.add(rightWallFront);
    
    const rightWallBack = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, wallHeight, halfSize - 1),
      wallMaterial
    );
    rightWallBack.position.set(halfSize, wallHeight / 2, halfSize / 2 + 1);
    rightWallBack.castShadow = true;
    rightWallBack.receiveShadow = true;
    scene.add(rightWallBack);
    
    const rightWallTop = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, wallHeight - 2.2, 2),
      wallMaterial
    );
    rightWallTop.position.set(halfSize, 2.2 + (wallHeight - 2.2) / 2, 0);
    rightWallTop.castShadow = true;
    rightWallTop.receiveShadow = true;
    scene.add(rightWallTop);
    
    // 添加一些家具作为障碍物
    createFurniture(scene);
  }
  
  function createFurniture(scene: THREE.Scene) {
    // 中央桌子
    const tableGeometry = new THREE.BoxGeometry(3, 0.1, 2);
    const tableMaterial = new THREE.MeshStandardMaterial({ color: 0x6b4423 });
    const table = new THREE.Mesh(tableGeometry, tableMaterial);
    table.position.set(0, 0.75, 0);
    table.castShadow = true;
    table.receiveShadow = true;
    scene.add(table);
    
    // 桌腿
    const legGeometry = new THREE.BoxGeometry(0.1, 0.75, 0.1);
    const legPositions = [
      [-1.4, 0.375, -0.9],
      [1.4, 0.375, -0.9],
      [-1.4, 0.375, 0.9],
      [1.4, 0.375, 0.9]
    ];
    
    legPositions.forEach(pos => {
      const leg = new THREE.Mesh(legGeometry, tableMaterial);
      leg.position.set(...pos);
      leg.castShadow = true;
      scene.add(leg);
    });
    
    // 角落的柜子
    const cabinetGeometry = new THREE.BoxGeometry(2, 1.5, 0.8);
    const cabinetMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3728 });
    const cabinet = new THREE.Mesh(cabinetGeometry, cabinetMaterial);
    cabinet.position.set(-7, 0.75, -7);
    cabinet.castShadow = true;
    cabinet.receiveShadow = true;
    scene.add(cabinet);
    
    // 另一个柜子
    const cabinet2 = new THREE.Mesh(cabinetGeometry, cabinetMaterial);
    cabinet2.position.set(7, 0.75, 7);
    cabinet2.castShadow = true;
    cabinet2.receiveShadow = true;
    scene.add(cabinet2);
  }
  
  function animate() {
    if (!isActive.value) return;
    
    animationId = requestAnimationFrame(animate);
    
    // 更新控制器
    fpControls.update();
    
    // 更新体积光
    roomLighting.update(camera.position);
    
    // 更新自动门
    autoDoors.update(camera.position);
    
    // 渲染
    renderer.render(scene, camera);
  }
  
  function handleResize() {
    if (!containerRef.value || !camera || !renderer) return;
    
    const width = containerRef.value.clientWidth;
    const height = containerRef.value.clientHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
  
  function enter() {
    if (isActive.value) return;
    
    // 保存原始相机状态
    if (camera) {
      originalCameraState = {
        position: camera.position.clone(),
        quaternion: camera.quaternion.clone()
      };
    }
    
    isActive.value = true;
    fpControls.enable();
    animate();
    
    window.addEventListener('resize', handleResize);
  }
  
  function exit() {
    if (!isActive.value) return;
    
    isActive.value = false;
    fpControls.disable();
    
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    
    window.removeEventListener('resize', handleResize);
  }
  
  function toggle() {
    if (isActive.value) {
      exit();
    } else {
      enter();
    }
  }
  
  function dispose() {
    exit();
    
    if (fpControls) fpControls.dispose();
    if (roomLighting) roomLighting.dispose();
    if (autoDoors) autoDoors.dispose();
    if (renderer) renderer.dispose();
  }
  
  // 初始化
  init();
  
  return {
    isActive,
    enter,
    exit,
    toggle,
    dispose
  };
}
