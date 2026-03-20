import * as THREE from "three";

/** 编辑器交互模式 */
export type EditorMode = "none" | "upload" | "draw-floor" | "draw-wall" | "generate";

/** 施工阶段 */
export type ConstructionPhase = "rough" | "plumbing" | "hard" | "soft";

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

/** 施工阶段材质参数 */
export interface ConstructionMaterialParams {
  color: number;
  roughness: number;
  metalness: number;
  noiseScale: number;
  noiseIntensity: number;
}

/** 各阶段材质参数 */
export const CONSTRUCTION_PHASES: Record<ConstructionPhase, ConstructionMaterialParams> = {
  rough: {
    color: 0x5d4037, // 深褐色水泥 - 更暗更明显
    roughness: 1.0, // 最粗糙
    metalness: 0.0,
    noiseScale: 4.0, // 更大颗粒噪点
    noiseIntensity: 0.6, // 更强烈的纹理变化
  },
  plumbing: {
    color: 0x757575, // 中灰色水泥
    roughness: 0.9,
    metalness: 0.0,
    noiseScale: 3.0,
    noiseIntensity: 0.4,
  },
  hard: {
    color: 0xe0e0e0, // 浅灰腻子
    roughness: 0.5, // 较光滑
    metalness: 0.0,
    noiseScale: 1.5, // 细腻纹理
    noiseIntensity: 0.1,
  },
  soft: {
    color: 0xffffff, // 纯白乳胶漆
    roughness: 0.15, // 非常光滑
    metalness: 0.1,
    noiseScale: 0.5, // 很细腻的纹理
    noiseIntensity: 0.02,
  },
};

/** 生成唯一ID */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
