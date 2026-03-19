import * as THREE from "three";

/** 编辑器交互模式 */
export type EditorMode = "none" | "upload" | "draw-floor" | "draw-wall" | "generate";

/** 2D点坐标 */
export interface Point2D {
  x: number;
  z: number;
}

/** 3D点坐标 */
export interface Point3D {
  x: number;
  y: number;
  z: number;
}

/** 墙体线段 */
export interface WallSegment {
  id: string;
  start: Point3D;
  end: Point3D;
  mesh?: THREE.Mesh;
  lineMesh?: THREE.Line;
}

/** 地板多边形数据 */
export interface FloorPolygon {
  id: string;
  points: Point3D[];
  closed: boolean;
  mesh?: THREE.Mesh;
  lineMesh?: THREE.Line;
}

/** 上传的平面图 */
export interface FloorPlanImage {
  url: string;
  width: number;
  height: number;
  mesh?: THREE.Mesh;
}

/** 编辑器状态 */
export interface EditorState {
  mode: EditorMode;
  floorPlan: FloorPlanImage | null;
  floorPolygons: FloorPolygon[];
  wallSegments: WallSegment[];
  currentFloorPoints: Point3D[];
  currentWallStart: Point3D | null;
  isDrawing: boolean;
  hasGeneratedModel: boolean;
}

/** 模型生成参数 */
export interface ModelGenerationParams {
  floorThickness: number;
  floorColor: number;
  floorOpacity: number;
  wallThickness: number;
  wallHeight: number;
  wallColor: number;
}

/** 默认模型生成参数 */
export const DEFAULT_MODEL_PARAMS: ModelGenerationParams = {
  floorThickness: 5,
  floorColor: 0x87ceeb, // 浅蓝色
  floorOpacity: 0.6,
  wallThickness: 4,
  wallHeight: 10,
  wallColor: 0xcccccc,
};

/** 家具类型 */
export type FurnitureType = "sofa" | "cabinet" | "table" | "chair" | "bed";

/** 材质类型 */
export type MaterialType = "leather" | "wood" | "fabric" | "metal";

/** 材质预设配置 */
export interface MaterialPreset {
  name: string;
  type: MaterialType;
  color: number;
  roughness: number;
  metalness: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  normalScale?: number;
}

/** 家具对象 */
export interface Furniture {
  id: string;
  type: FurnitureType;
  name: string;
  position: Point3D;
  rotation: Point3D;
  scale: Point3D;
  mesh?: THREE.Mesh | THREE.Group;
  currentMaterial?: MaterialType;
}

/** 深棕皮质 */
export const LEATHER_DARK_BROWN: MaterialPreset = {
  name: "深棕皮质",
  type: "leather",
  color: 0x4a3728,
  roughness: 0.6,
  metalness: 0.1,
  clearcoat: 0.3,
  clearcoatRoughness: 0.4,
};

/** 米白皮质 */
export const LEATHER_CREAM: MaterialPreset = {
  name: "米白皮质",
  type: "leather",
  color: 0xe8dcc8,
  roughness: 0.5,
  metalness: 0.05,
  clearcoat: 0.2,
  clearcoatRoughness: 0.5,
};

/** 黑色皮质 */
export const LEATHER_BLACK: MaterialPreset = {
  name: "黑色皮质",
  type: "leather",
  color: 0x1a1a1a,
  roughness: 0.4,
  metalness: 0.15,
  clearcoat: 0.4,
  clearcoatRoughness: 0.3,
};

/** 酒红皮质 */
export const LEATHER_WINE: MaterialPreset = {
  name: "酒红皮质",
  type: "leather",
  color: 0x722f37,
  roughness: 0.55,
  metalness: 0.08,
  clearcoat: 0.25,
  clearcoatRoughness: 0.45,
};

/** 胡桃木纹 */
export const WOOD_WALNUT: MaterialPreset = {
  name: "胡桃木纹",
  type: "wood",
  color: 0x5d4e37,
  roughness: 0.7,
  metalness: 0.0,
  normalScale: 1.0,
};

/** 橡木原色 */
export const WOOD_OAK: MaterialPreset = {
  name: "橡木原色",
  type: "wood",
  color: 0x8b7355,
  roughness: 0.6,
  metalness: 0.0,
  normalScale: 0.8,
};

/** 樱桃木色 */
export const WOOD_CHERRY: MaterialPreset = {
  name: "樱桃木色",
  type: "wood",
  color: 0x8b4513,
  roughness: 0.65,
  metalness: 0.0,
  normalScale: 0.9,
};

/** 白橡木色 */
export const WOOD_WHITE_OAK: MaterialPreset = {
  name: "白橡木色",
  type: "wood",
  color: 0xd4c5b0,
  roughness: 0.55,
  metalness: 0.0,
  normalScale: 0.7,
};

/** 灰色布艺 */
export const FABRIC_GRAY: MaterialPreset = {
  name: "灰色布艺",
  type: "fabric",
  color: 0x808080,
  roughness: 0.9,
  metalness: 0.0,
};

/** 蓝色布艺 */
export const FABRIC_BLUE: MaterialPreset = {
  name: "蓝色布艺",
  type: "fabric",
  color: 0x4a6fa5,
  roughness: 0.85,
  metalness: 0.0,
};

/** 米色布艺 */
export const FABRIC_BEIGE: MaterialPreset = {
  name: "米色布艺",
  type: "fabric",
  color: 0xd4c5a5,
  roughness: 0.9,
  metalness: 0.0,
};

/** 不锈钢 */
export const METAL_STAINLESS: MaterialPreset = {
  name: "不锈钢",
  type: "metal",
  color: 0xc0c0c0,
  roughness: 0.2,
  metalness: 0.9,
};

/** 哑光金属 */
export const METAL_MATTE: MaterialPreset = {
  name: "哑光金属",
  type: "metal",
  color: 0x808080,
  roughness: 0.4,
  metalness: 0.7,
};

/** 金色金属 */
export const METAL_GOLD: MaterialPreset = {
  name: "金色金属",
  type: "metal",
  color: 0xd4af37,
  roughness: 0.25,
  metalness: 0.85,
};

/** 皮革材质预设数组 */
export const LEATHER_PRESETS: MaterialPreset[] = [LEATHER_DARK_BROWN, LEATHER_CREAM, LEATHER_BLACK, LEATHER_WINE];

/** 木纹材质预设数组 */
export const WOOD_PRESETS: MaterialPreset[] = [WOOD_WALNUT, WOOD_OAK, WOOD_CHERRY, WOOD_WHITE_OAK];

/** 布艺材质预设数组 */
export const FABRIC_PRESETS: MaterialPreset[] = [FABRIC_GRAY, FABRIC_BLUE, FABRIC_BEIGE];

/** 金属材质预设数组 */
export const METAL_PRESETS: MaterialPreset[] = [METAL_STAINLESS, METAL_MATTE, METAL_GOLD];

/** 材质预设库 */
export const MATERIAL_PRESETS: Record<MaterialType, MaterialPreset[]> = {
  leather: LEATHER_PRESETS,
  wood: WOOD_PRESETS,
  fabric: FABRIC_PRESETS,
  metal: METAL_PRESETS,
};

/** 生成唯一ID */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
