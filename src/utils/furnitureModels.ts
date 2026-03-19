import * as THREE from 'three';
import type { FurnitureObject, FurnitureType } from '../types';
import { generateId } from '../types';
import { createMaterialFromPreset } from '../composables/useFurnitureDressing';
import { MATERIAL_PRESETS } from '../types';

/**
 * 创建沙发模型
 */
export function createSofa(
  position: THREE.Vector3 = new THREE.Vector3(0, 0, 0),
  width: number = 20,
  depth: number = 10,
  height: number = 8
): FurnitureObject {
  const group = new THREE.Group();

  // 沙发底座材质
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0x8b4513,
    roughness: 0.7,
    metalness: 0.1
  });

  // 沙发坐垫材质（默认皮革）
  const cushionMaterial = createMaterialFromPreset(MATERIAL_PRESETS.leather[0]);

  // 底座
  const baseGeo = new THREE.BoxGeometry(width, height * 0.4, depth);
  const base = new THREE.Mesh(baseGeo, baseMaterial);
  base.position.y = height * 0.2;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // 坐垫
  const cushionGeo = new THREE.BoxGeometry(width * 0.95, height * 0.35, depth * 0.9);
  const cushion = new THREE.Mesh(cushionGeo, cushionMaterial);
  cushion.position.y = height * 0.55;
  cushion.castShadow = true;
  cushion.receiveShadow = true;
  group.add(cushion);

  // 靠背
  const backrestGeo = new THREE.BoxGeometry(width, height * 0.5, depth * 0.25);
  const backrest = new THREE.Mesh(backrestGeo, cushionMaterial);
  backrest.position.set(0, height * 0.7, -depth * 0.35);
  backrest.castShadow = true;
  backrest.receiveShadow = true;
  group.add(backrest);

  // 扶手
  const armrestGeo = new THREE.BoxGeometry(width * 0.12, height * 0.45, depth);
  const leftArmrest = new THREE.Mesh(armrestGeo, cushionMaterial);
  leftArmrest.position.set(-width * 0.44, height * 0.4, 0);
  leftArmrest.castShadow = true;
  leftArmrest.receiveShadow = true;
  group.add(leftArmrest);

  const rightArmrest = new THREE.Mesh(armrestGeo, cushionMaterial);
  rightArmrest.position.set(width * 0.44, height * 0.4, 0);
  rightArmrest.castShadow = true;
  rightArmrest.receiveShadow = true;
  group.add(rightArmrest);

  // 设置组位置
  group.position.copy(position);

  // 为了简单，将组作为mesh处理（实际应用中可能需要更复杂的处理）
  const furniture: FurnitureObject = {
    id: generateId(),
    type: 'sofa',
    name: '沙发',
    mesh: group as unknown as THREE.Mesh,
    originalMaterial: cushionMaterial,
    currentMaterial: cushionMaterial
  };

  return furniture;
}

/**
 * 创建柜子模型
 */
export function createCabinet(
  position: THREE.Vector3 = new THREE.Vector3(0, 0, 0),
  width: number = 15,
  depth: number = 8,
  height: number = 20
): FurnitureObject {
  const group = new THREE.Group();

  // 柜体材质（默认木纹）
  const cabinetMaterial = createMaterialFromPreset(MATERIAL_PRESETS.wood[0]);

  // 金属把手材质
  const handleMaterial = new THREE.MeshStandardMaterial({
    color: 0xaaaaaa,
    roughness: 0.3,
    metalness: 0.9
  });

  // 柜体
  const cabinetGeo = new THREE.BoxGeometry(width, height, depth);
  const cabinet = new THREE.Mesh(cabinetGeo, cabinetMaterial);
  cabinet.position.y = height / 2;
  cabinet.castShadow = true;
  cabinet.receiveShadow = true;
  group.add(cabinet);

  // 台面
  const topGeo = new THREE.BoxGeometry(width * 1.05, 1, depth * 1.05);
  const top = new THREE.Mesh(topGeo, cabinetMaterial);
  top.position.y = height + 0.5;
  top.castShadow = true;
  top.receiveShadow = true;
  group.add(top);

  // 柜门分隔线（使用稍微深一点的颜色）
  const lineMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.5
  });

  // 垂直分隔线
  const vLineGeo = new THREE.BoxGeometry(0.2, height * 0.9, 0.1);
  const vLine = new THREE.Mesh(vLineGeo, lineMaterial);
  vLine.position.set(0, height / 2, depth / 2 + 0.06);
  group.add(vLine);

  // 水平分隔线
  const hLineGeo = new THREE.BoxGeometry(width * 0.9, 0.2, 0.1);
  const hLine = new THREE.Mesh(hLineGeo, lineMaterial);
  hLine.position.set(0, height / 2, depth / 2 + 0.06);
  group.add(hLine);

  // 把手
  const handleGeo = new THREE.BoxGeometry(2, 0.5, 0.5);
  const handle1 = new THREE.Mesh(handleGeo, handleMaterial);
  handle1.position.set(-width * 0.2, height * 0.35, depth / 2 + 0.3);
  handle1.castShadow = true;
  group.add(handle1);

  const handle2 = new THREE.Mesh(handleGeo, handleMaterial);
  handle2.position.set(width * 0.2, height * 0.35, depth / 2 + 0.3);
  handle2.castShadow = true;
  group.add(handle2);

  const handle3 = new THREE.Mesh(handleGeo, handleMaterial);
  handle3.position.set(-width * 0.2, height * 0.65, depth / 2 + 0.3);
  handle3.castShadow = true;
  group.add(handle3);

  const handle4 = new THREE.Mesh(handleGeo, handleMaterial);
  handle4.position.set(width * 0.2, height * 0.65, depth / 2 + 0.3);
  handle4.castShadow = true;
  group.add(handle4);

  // 设置组位置
  group.position.copy(position);

  const furniture: FurnitureObject = {
    id: generateId(),
    type: 'cabinet',
    name: '柜子',
    mesh: group as unknown as THREE.Mesh,
    originalMaterial: cabinetMaterial,
    currentMaterial: cabinetMaterial
  };

  return furniture;
}

/**
 * 创建桌子模型
 */
export function createTable(
  position: THREE.Vector3 = new THREE.Vector3(0, 0, 0),
  width: number = 16,
  depth: number = 10,
  height: number = 10
): FurnitureObject {
  const group = new THREE.Group();

  // 桌面材质
  const topMaterial = createMaterialFromPreset(MATERIAL_PRESETS.wood[1]);

  // 桌腿材质
  const legMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.4,
    metalness: 0.6
  });

  // 桌面
  const topGeo = new THREE.BoxGeometry(width, 1.5, depth);
  const top = new THREE.Mesh(topGeo, topMaterial);
  top.position.y = height;
  top.castShadow = true;
  top.receiveShadow = true;
  group.add(top);

  // 桌腿
  const legGeo = new THREE.BoxGeometry(1.2, height - 0.75, 1.2);
  const legPositions = [
    { x: -width / 2 + 1.5, z: -depth / 2 + 1.5 },
    { x: width / 2 - 1.5, z: -depth / 2 + 1.5 },
    { x: -width / 2 + 1.5, z: depth / 2 - 1.5 },
    { x: width / 2 - 1.5, z: depth / 2 - 1.5 }
  ];

  legPositions.forEach(pos => {
    const leg = new THREE.Mesh(legGeo, legMaterial);
    leg.position.set(pos.x, (height - 0.75) / 2, pos.z);
    leg.castShadow = true;
    leg.receiveShadow = true;
    group.add(leg);
  });

  // 设置组位置
  group.position.copy(position);

  const furniture: FurnitureObject = {
    id: generateId(),
    type: 'table',
    name: '桌子',
    mesh: group as unknown as THREE.Mesh,
    originalMaterial: topMaterial,
    currentMaterial: topMaterial
  };

  return furniture;
}

/**
 * 创建椅子模型
 */
export function createChair(
  position: THREE.Vector3 = new THREE.Vector3(0, 0, 0),
  width: number = 6,
  depth: number = 6,
  height: number = 10
): FurnitureObject {
  const group = new THREE.Group();

  // 椅子材质
  const seatMaterial = createMaterialFromPreset(MATERIAL_PRESETS.leather[1]);

  // 椅腿材质
  const legMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.3,
    metalness: 0.8
  });

  // 座面
  const seatGeo = new THREE.BoxGeometry(width, 0.8, depth);
  const seat = new THREE.Mesh(seatGeo, seatMaterial);
  seat.position.y = height * 0.45;
  seat.castShadow = true;
  seat.receiveShadow = true;
  group.add(seat);

  // 靠背
  const backrestGeo = new THREE.BoxGeometry(width, height * 0.5, 0.8);
  const backrest = new THREE.Mesh(backrestGeo, seatMaterial);
  backrest.position.set(0, height * 0.7, -depth / 2 + 0.4);
  backrest.castShadow = true;
  backrest.receiveShadow = true;
  group.add(backrest);

  // 椅腿
  const legGeo = new THREE.BoxGeometry(0.6, height * 0.45, 0.6);
  const legPositions = [
    { x: -width / 2 + 0.8, z: -depth / 2 + 0.8 },
    { x: width / 2 - 0.8, z: -depth / 2 + 0.8 },
    { x: -width / 2 + 0.8, z: depth / 2 - 0.8 },
    { x: width / 2 - 0.8, z: depth / 2 - 0.8 }
  ];

  legPositions.forEach(pos => {
    const leg = new THREE.Mesh(legGeo, legMaterial);
    leg.position.set(pos.x, height * 0.225, pos.z);
    leg.castShadow = true;
    leg.receiveShadow = true;
    group.add(leg);
  });

  // 设置组位置
  group.position.copy(position);

  const furniture: FurnitureObject = {
    id: generateId(),
    type: 'chair',
    name: '椅子',
    mesh: group as unknown as THREE.Mesh,
    originalMaterial: seatMaterial,
    currentMaterial: seatMaterial
  };

  return furniture;
}

/**
 * 根据类型创建家具
 */
export function createFurnitureByType(
  type: FurnitureType,
  position: THREE.Vector3 = new THREE.Vector3(0, 0, 0)
): FurnitureObject | null {
  switch (type) {
    case 'sofa':
      return createSofa(position);
    case 'cabinet':
      return createCabinet(position);
    case 'table':
      return createTable(position);
    case 'chair':
      return createChair(position);
    default:
      console.warn('Unknown furniture type:', type);
      return null;
  }
}
