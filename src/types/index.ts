import * as THREE from "three";

/** 编辑器交互模式 */
export type EditorMode = "none" | "upload" | "draw-floor" | "draw-wall" | "generate";

/** 施工阶段 */
export type ConstructionPhase = "rough" | "plumbing" | "hardfinish" | "softfinish";

/** 施工阶段配置 */
export interface ConstructionPhaseConfig {
  id: ConstructionPhase;
  label: string;
  description: string;
  wallMaterial: WallMaterialConfig;
  floorMaterial: FloorMaterialConfig;
}

/** 墙体材质配置 */
export interface WallMaterialConfig {
  color: number;
  roughness: number;
  metalness: number;
  bumpScale: number;
  noiseIntensity: number;
}

/** 地板材质配置 */
export interface FloorMaterialConfig {
  color: number;
  roughness: number;
  metalness: number;
  opacity: number;
}

/** 施工阶段配置列表 */
export const CONSTRUCTION_PHASES: ConstructionPhaseConfig[] = [
  {
    id: "rough",
    label: "毛坯",
    description: "原始混凝土结构",
    wallMaterial: {
      color: 0x4a4a4a,
      roughness: 1.0,
      metalness: 0.0,
      bumpScale: 1.0,
      noiseIntensity: 0.8,
    },
    floorMaterial: {
      color: 0x3a3a3a,
      roughness: 1.0,
      metalness: 0.0,
      opacity: 1.0,
    },
  },
  {
    id: "plumbing",
    label: "水电",
    description: "水电改造阶段",
    wallMaterial: {
      color: 0x6a6a6a,
      roughness: 0.9,
      metalness: 0.1,
      bumpScale: 0.7,
      noiseIntensity: 0.5,
    },
    floorMaterial: {
      color: 0x5a5a5a,
      roughness: 0.95,
      metalness: 0.05,
      opacity: 1.0,
    },
  },
  {
    id: "hardfinish",
    label: "硬装",
    description: "刮腻子刷漆阶段",
    wallMaterial: {
      color: 0xf0ebe0,
      roughness: 0.7,
      metalness: 0.0,
      bumpScale: 0.3,
      noiseIntensity: 0.15,
    },
    floorMaterial: {
      color: 0xb8956c,
      roughness: 0.6,
      metalness: 0.1,
      opacity: 1.0,
    },
  },
  {
    id: "softfinish",
    label: "软装",
    description: "家具布置完成",
    wallMaterial: {
      color: 0xfaf8f5,
      roughness: 0.35,
      metalness: 0.0,
      bumpScale: 0.05,
      noiseIntensity: 0.02,
    },
    floorMaterial: {
      color: 0xc9a66b,
      roughness: 0.4,
      metalness: 0.2,
      opacity: 1.0,
    },
  },
];

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
  floorColor: 0x87ceeb,
  floorOpacity: 0.6,
  wallThickness: 4,
  wallHeight: 10,
  wallColor: 0xcccccc,
};

/** 生成唯一ID */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
