import * as THREE from "three";

/** 编辑器交互模式 */
export type EditorMode = "none" | "upload" | "draw-floor" | "draw-wall" | "generate";

/** 天气类型 */
export type WeatherType = "sunny" | "rainy" | "cloudy" | "snowy";

/** 天气配置 */
export interface WeatherConfig {
  type: WeatherType;
  label: string;
  icon: string;
  ambientColor: number;
  ambientIntensity: number;
  directionalColor: number;
  directionalIntensity: number;
  backgroundColor: number;
  fogColor?: number;
  fogDensity?: number;
}

/** 天气预设配置 */
export const WEATHER_PRESETS: Record<WeatherType, WeatherConfig> = {
  sunny: {
    type: "sunny",
    label: "晴天",
    icon: "☀️",
    ambientColor: 0xffffff,
    ambientIntensity: 0.6,
    directionalColor: 0xfff5e6,
    directionalIntensity: 1.2,
    backgroundColor: 0x87ceeb,
  },
  rainy: {
    type: "rainy",
    label: "雨天",
    icon: "🌧️",
    ambientColor: 0x4a5568,
    ambientIntensity: 0.3,
    directionalColor: 0x6b7280,
    directionalIntensity: 0.4,
    backgroundColor: 0x1a1a2e,
    fogColor: 0x2d3748,
    fogDensity: 0.008,
  },
  cloudy: {
    type: "cloudy",
    label: "阴天",
    icon: "☁️",
    ambientColor: 0x9ca3af,
    ambientIntensity: 0.45,
    directionalColor: 0xd1d5db,
    directionalIntensity: 0.6,
    backgroundColor: 0x4a5568,
  },
  snowy: {
    type: "snowy",
    label: "雪天",
    icon: "❄️",
    ambientColor: 0xe2e8f0,
    ambientIntensity: 0.5,
    directionalColor: 0xf0f9ff,
    directionalIntensity: 0.7,
    backgroundColor: 0xcbd5e1,
    fogColor: 0xe2e8f0,
    fogDensity: 0.005,
  },
};

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
