import * as THREE from 'three';

/** 编辑器交互模式 */
export type EditorMode = 'none' | 'upload' | 'draw-floor' | 'draw-wall' | 'generate' | 'roam';

/** 第一人称漫游配置 */
export interface FirstPersonRoamConfig {
  height: number;
  moveSpeed: number;
  lookSpeed: number;
  sprintMultiplier: number;
  collisionRadius: number;
}

/** 体积光配置 */
export interface VolumetricLightConfig {
  color: number;
  intensity: number;
  distance: number;
  angle: number;
  volumetricIntensity: number;
}

/** 自动门配置 */
export interface AutoDoorConfig {
  width: number;
  height: number;
  openAngle: number;
  openSpeed: number;
  triggerDistance: number;
}

/** 漫游模式状态 */
export interface RoamState {
  isActive: boolean;
  isLocked: boolean;
  position: { x: number; y: number; z: number } | null;
  isMoving: boolean;
}

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
  floorColor: 0x87CEEB, // 浅蓝色
  floorOpacity: 0.6,
  wallThickness: 4,
  wallHeight: 10,
  wallColor: 0xCCCCCC
};

/** 生成唯一ID */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
