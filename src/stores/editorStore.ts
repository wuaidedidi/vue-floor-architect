import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type {
  EditorMode,
  EditorState,
  FloorPlanImage,
  FloorPolygon,
  WallSegment,
  Point3D,
  Furniture,
  FurnitureType,
} from "../types";
import { generateId } from "../types";

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
  const furnitures = ref<Furniture[]>([]);
  const selectedFurnitureId = ref<string | null>(null);
  const currentFurnitureType = ref<FurnitureType>("sofa");

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
      case "furniture":
        return "家具模式";
      default:
        return "选择操作";
    }
  });

  const selectedFurniture = computed(() => {
    return furnitures.value.find((f) => f.id === selectedFurnitureId.value) || null;
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
      case "furniture":
        statusMessage.value = "点击添加家具，点击已有家具选中换装";
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
    furnitures.value = [];
    selectedFurnitureId.value = null;
    statusMessage.value = "已清空所有内容";
  }

  function updateStatusMessage(message: string) {
    statusMessage.value = message;
  }

  function addFurniture(furniture: Furniture) {
    furnitures.value.push(furniture);
    statusMessage.value = `${furniture.name}已添加`;
  }

  function removeFurniture(id: string) {
    const index = furnitures.value.findIndex((f) => f.id === id);
    if (index !== -1) {
      furnitures.value.splice(index, 1);
      if (selectedFurnitureId.value === id) {
        selectedFurnitureId.value = null;
      }
    }
  }

  function setSelectedFurniture(id: string | null) {
    selectedFurnitureId.value = id;
  }

  function updateFurnitureMaterial(id: string, materialType: string) {
    const furniture = furnitures.value.find((f) => f.id === id);
    if (furniture) {
      furniture.materialType = materialType as any;
    }
  }

  function setCurrentFurnitureType(type: FurnitureType) {
    currentFurnitureType.value = type;
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
    furnitures,
    selectedFurnitureId,
    currentFurnitureType,
    // Computed
    canGenerate,
    modeLabel,
    selectedFurniture,
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
    addFurniture,
    removeFurniture,
    setSelectedFurniture,
    updateFurnitureMaterial,
    setCurrentFurnitureType,
  };
});
