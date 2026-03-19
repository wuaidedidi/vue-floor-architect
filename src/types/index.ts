import * as THREE from "three";

/** 编辑器交互模式 */
export type EditorMode = "none" | "upload" | "draw-floor" | "draw-wall" | "generate" | "select";

/** 材质类型 */
export type MaterialType = "leather" | "wood" | "fabric" | "metal";

/** 家具类型 */
export type FurnitureType = "sofa" | "cabinet" | "table" | "chair";

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

/** 材质预设 */
export interface MaterialPreset {
  name: string;
  type: MaterialType;
  color: number;
  roughness: number;
  metalness: number;
  normalScale?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
}

/** 家具对象 */
export interface FurnitureObject {
  id: string;
  type: FurnitureType;
  name: string;
  mesh: THREE.Mesh | THREE.Group;
  originalMaterial: THREE.Material;
  currentMaterial: THREE.Material;
  spotlight?: THREE.SpotLight;
  spotlightHelper?: THREE.SpotLightHelper;
}

/** 生成唯一ID */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/** 材质预设配置 */
export const MATERIAL_PRESETS: Record<MaterialType, MaterialPreset[]> = {
  leather: [
    {
      name: "黑色真皮",
      type: "leather",
      color: 0x1a1a1a,
      roughness: 0.25,
      metalness: 0.15,
      clearcoat: 0.6,
      clearcoatRoughness: 0.15,
    },
    {
      name: "棕色皮革",
      type: "leather",
      color: 0x5c3d2e,
      roughness: 0.3,
      metalness: 0.1,
      clearcoat: 0.5,
      clearcoatRoughness: 0.2,
    },
    {
      name: "酒红色皮面",
      type: "leather",
      color: 0x722f37,
      roughness: 0.28,
      metalness: 0.12,
      clearcoat: 0.55,
      clearcoatRoughness: 0.18,
    },
  ],
  wood: [
    { name: "浅胡桃木", type: "wood", color: 0xc4a35a, roughness: 0.55, metalness: 0.05 },
    { name: "深橡木", type: "wood", color: 0x5d4037, roughness: 0.5, metalness: 0.08 },
    { name: "红木", type: "wood", color: 0x8b0000, roughness: 0.45, metalness: 0.1 },
    { name: "枫木", type: "wood", color: 0xe8d4a5, roughness: 0.6, metalness: 0.04 },
  ],
  fabric: [
    { name: "亚麻灰", type: "fabric", color: 0x808080, roughness: 0.85, metalness: 0 },
    { name: "米白色", type: "fabric", color: 0xf5f5dc, roughness: 0.8, metalness: 0 },
    { name: "深蓝色", type: "fabric", color: 0x1e3a5f, roughness: 0.82, metalness: 0 },
  ],
  metal: [
    { name: "拉丝钢", type: "metal", color: 0xaaaaaa, roughness: 0.15, metalness: 0.95 },
    { name: "黄铜", type: "metal", color: 0xb8860b, roughness: 0.12, metalness: 0.9 },
    { name: "黑铁", type: "metal", color: 0x333333, roughness: 0.35, metalness: 0.8 },
  ],
};
