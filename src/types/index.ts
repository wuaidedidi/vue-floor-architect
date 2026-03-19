import * as THREE from "three";

/** 编辑器交互模式 */
export type EditorMode = "none" | "upload" | "draw-floor" | "draw-wall" | "generate" | "furniture";

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

/** 家具类型 */
export type FurnitureType = "sofa" | "cabinet" | "table" | "chair" | "bed";

/** 材质类型 */
export type MaterialType = "leather" | "wood" | "fabric" | "metal" | "glass";

/** 材质预设配置 */
export interface MaterialPreset {
  type: MaterialType;
  name: string;
  color: number;
  roughness: number;
  metalness: number;
  normalScale?: number;
  envMapIntensity?: number;
}

/** 家具数据 */
export interface Furniture {
  id: string;
  type: FurnitureType;
  name: string;
  position: Point3D;
  rotation: number;
  scale: Point3D;
  materialType: MaterialType;
  mesh?: THREE.Group;
  spotlight?: THREE.SpotLight;
  spotlightHelper?: THREE.SpotLightHelper;
}

/** 材质预设库 */
export const MATERIAL_PRESETS: Record<MaterialType, MaterialPreset> = {
  leather: {
    type: "leather",
    name: "皮质",
    color: 0x8b4513,
    roughness: 0.35,
    metalness: 0.05,
    normalScale: 0.6,
    envMapIntensity: 1.2,
  },
  wood: {
    type: "wood",
    name: "木纹",
    color: 0xdeb887,
    roughness: 0.55,
    metalness: 0.0,
    normalScale: 0.4,
    envMapIntensity: 0.8,
  },
  fabric: {
    type: "fabric",
    name: "布艺",
    color: 0x5a7a51,
    roughness: 0.95,
    metalness: 0.0,
    normalScale: 1.0,
    envMapIntensity: 0.4,
  },
  metal: {
    type: "metal",
    name: "金属",
    color: 0xd4d4d4,
    roughness: 0.15,
    metalness: 1.0,
    normalScale: 0.05,
    envMapIntensity: 2.5,
  },
  glass: {
    type: "glass",
    name: "玻璃",
    color: 0xe8f4f8,
    roughness: 0.02,
    metalness: 0.0,
    normalScale: 0.0,
    envMapIntensity: 3.0,
  },
};

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
  furnitures: Furniture[];
  selectedFurnitureId: string | null;
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
  floorColor: 0x87ceeb,
  floorOpacity: 0.6,
  wallThickness: 4,
  wallHeight: 10,
  wallColor: 0xcccccc,
};

/** 家具默认尺寸 */
export const FURNITURE_DEFAULTS: Record<FurnitureType, { width: number; height: number; depth: number; name: string }> =
  {
    sofa: { width: 20, height: 8, depth: 8, name: "沙发" },
    cabinet: { width: 15, height: 12, depth: 5, name: "柜子" },
    table: { width: 12, height: 4, depth: 8, name: "桌子" },
    chair: { width: 5, height: 5, depth: 5, name: "椅子" },
    bed: { width: 20, height: 3, depth: 15, name: "床" },
  };

/** 生成唯一ID */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
