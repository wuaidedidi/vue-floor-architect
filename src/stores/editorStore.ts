import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { EditorMode, EditorState, FloorPlanImage, FloorPolygon, WallSegment, Point3D } from "../types";
import { generateId } from "../types";

// 施工阶段枚举
export type ConstructionStage = "rough" | "plumbing" | "finishing" | "decoration";

export interface MaterialTransitionState {
  progress: number;
  fromStage: number;
  toStage: number;
}

export const useEditorStore = defineStore("editor", () => {
  // State
  const mode = ref<EditorMode>("none");
  const floorPlan = ref<FloorPlanImage | null>(null);
  const floorPolygons = ref<FloorPolygon[]>([]);
  const wallSegments = ref<WallSegment[]>([]);
  const currentFloorPoints = ref<Point3D[]>([]);
  const currentWallStart = ref<Point3D | null>(null);
  const isDrawing = ref(false);
  const hasGeneratedModel = ref(false);
  const statusMessage = ref("请选择操作模式");

  // 施工阶段状态
  const constructionStage = ref<number>(0); // 0: 毛坯, 1: 水电, 2: 硬装, 3: 软装
  const materialTransition = ref<MaterialTransitionState>({
    progress: 1,
    fromStage: 0,
    toStage: 0,
  });

  // Computed
  const canGenerate = computed(() => {
    return floorPolygons.value.length > 0 || wallSegments.value.length > 0;
  });

  const modeLabel = computed(() => {
    switch (mode.value) {
      case "upload":
        return "上传平面图";
      case "draw-floor":
        return "绘制地面";
      case "draw-wall":
        return "绘制墙体";
      case "generate":
        return "生成模型";
      default:
        return "选择操作";
    }
  });

  // Actions
  function setMode(newMode: EditorMode) {
    // Reset current drawing state when switching modes
    if (mode.value !== newMode) {
      cancelCurrentDrawing();
    }
    mode.value = newMode;

    switch (newMode) {
      case "upload":
        statusMessage.value = "点击选择或拖拽图片上传平面图";
        break;
      case "draw-floor":
        statusMessage.value = "点击画布标记地板顶点，双击完成绘制";
        break;
      case "draw-wall":
        statusMessage.value = "双击设置墙体起点";
        break;
      case "generate":
        statusMessage.value = "点击生成按钮创建3D模型";
        break;
      default:
        statusMessage.value = "请选择操作模式";
    }
  }

  function setFloorPlan(image: FloorPlanImage) {
    floorPlan.value = image;
    statusMessage.value = "平面图已上传";
  }

  function addFloorPoint(point: Point3D) {
    currentFloorPoints.value.push(point);
    isDrawing.value = true;
  }

  function completeFloorPolygon() {
    if (currentFloorPoints.value.length >= 3) {
      const polygon: FloorPolygon = {
        id: generateId(),
        points: [...currentFloorPoints.value],
        closed: true,
      };
      floorPolygons.value.push(polygon);
      statusMessage.value = `地板区域已创建 (${polygon.points.length}个顶点)`;
    }
    currentFloorPoints.value = [];
    isDrawing.value = false;
  }

  function cancelCurrentDrawing() {
    currentFloorPoints.value = [];
    currentWallStart.value = null;
    isDrawing.value = false;
  }

  function setWallStart(point: Point3D) {
    currentWallStart.value = point;
    isDrawing.value = true;
    statusMessage.value = "双击设置墙体终点";
  }

  function completeWallSegment(endPoint: Point3D) {
    if (currentWallStart.value) {
      const segment: WallSegment = {
        id: generateId(),
        start: { ...currentWallStart.value },
        end: { ...endPoint },
      };
      wallSegments.value.push(segment);
      statusMessage.value = "墙体线段已创建";
    }
    currentWallStart.value = null;
    isDrawing.value = false;
  }

  function setGeneratedModel(generated: boolean) {
    hasGeneratedModel.value = generated;
    if (generated) {
      statusMessage.value = "3D模型已生成！可旋转查看";
    }
  }

  function clearAll() {
    floorPlan.value = null;
    floorPolygons.value = [];
    wallSegments.value = [];
    currentFloorPoints.value = [];
    currentWallStart.value = null;
    isDrawing.value = false;
    hasGeneratedModel.value = false;
    statusMessage.value = "已清空所有内容";
  }

  function updateStatusMessage(message: string) {
    statusMessage.value = message;
  }

  // 施工阶段相关 actions
  function setConstructionStage(stage: number) {
    constructionStage.value = Math.max(0, Math.min(3, stage));
    const stageNames = ["毛坯阶段", "水电阶段", "硬装阶段", "软装阶段"];
    statusMessage.value = `已切换至${stageNames[constructionStage.value]}`;
  }

  function setMaterialTransitionProgress(progress: number, fromStage: number, toStage: number) {
    materialTransition.value = {
      progress: Math.max(0, Math.min(1, progress)),
      fromStage,
      toStage,
    };
  }

  return {
    // State
    mode,
    floorPlan,
    floorPolygons,
    wallSegments,
    currentFloorPoints,
    currentWallStart,
    isDrawing,
    hasGeneratedModel,
    statusMessage,
    constructionStage,
    materialTransition,
    // Computed
    canGenerate,
    modeLabel,
    // Actions
    setMode,
    setFloorPlan,
    addFloorPoint,
    completeFloorPolygon,
    cancelCurrentDrawing,
    setWallStart,
    completeWallSegment,
    setGeneratedModel,
    clearAll,
    updateStatusMessage,
    setConstructionStage,
    setMaterialTransitionProgress,
  };
});
