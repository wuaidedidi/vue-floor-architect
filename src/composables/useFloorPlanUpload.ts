import { ref, type Ref } from 'vue';
import * as THREE from 'three';
import { useEditorStore } from '../stores/editorStore';
import type { ThreeSceneContext } from './useThreeScene';
import type { FloorPlanImage } from '../types';

export function useFloorPlanUpload(contextRef: Ref<ThreeSceneContext | null>) {
  const store = useEditorStore();
  
  const isLoading = ref(false);
  const uploadedMesh = ref<THREE.Mesh | null>(null);

  /**
   * 处理文件上传
   */
  async function handleFileUpload(file: File): Promise<boolean> {
    if (!contextRef.value) return false;

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      store.updateStatusMessage('请上传图片文件 (JPG/PNG)');
      return false;
    }

    isLoading.value = true;
    store.updateStatusMessage('正在加载图片...');

    try {
      // 创建图片URL
      const imageUrl = URL.createObjectURL(file);
      
      // 加载图片获取尺寸
      const dimensions = await getImageDimensions(imageUrl);
      
      // 加载纹理并创建平面
      await loadFloorPlanTexture(imageUrl, dimensions.width, dimensions.height);
      
      // 更新store
      const floorPlan: FloorPlanImage = {
        url: imageUrl,
        width: dimensions.width,
        height: dimensions.height,
        mesh: uploadedMesh.value || undefined
      };
      
      store.setFloorPlan(floorPlan);
      store.updateStatusMessage('平面图已上传，可以开始绘制');
      
      return true;
    } catch (error) {
      console.error('图片加载失败:', error);
      store.updateStatusMessage('图片加载失败，请重试');
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 获取图片尺寸
   */
  function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  /**
   * 加载平面图纹理并创建平面网格
   */
  function loadFloorPlanTexture(url: string, originalWidth: number, originalHeight: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!contextRef.value) {
        reject(new Error('Scene not initialized'));
        return;
      }

      const { scene } = contextRef.value;

      // 清除之前的平面图
      if (uploadedMesh.value) {
        scene.remove(uploadedMesh.value);
        uploadedMesh.value.geometry.dispose();
        (uploadedMesh.value.material as THREE.Material).dispose();
        uploadedMesh.value = null;
      }

      const textureLoader = new THREE.TextureLoader();
      textureLoader.load(
        url,
        (texture) => {
          // 计算缩放后的尺寸（保持纵横比，最大尺寸为150）
          const maxSize = 150;
          const aspectRatio = originalWidth / originalHeight;
          let planeWidth: number;
          let planeHeight: number;

          if (aspectRatio > 1) {
            planeWidth = maxSize;
            planeHeight = maxSize / aspectRatio;
          } else {
            planeHeight = maxSize;
            planeWidth = maxSize * aspectRatio;
          }

          // 创建平面几何体
          const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
          
          // 创建材质
          const material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9
          });

          // 创建网格
          const mesh = new THREE.Mesh(geometry, material);
          mesh.rotation.x = -Math.PI / 2; // 平铺在XZ平面
          mesh.position.y = 0.01; // 稍微抬高，避免Z-fighting
          mesh.name = 'floor-plan-image';

          scene.add(mesh);
          uploadedMesh.value = mesh;

          resolve();
        },
        undefined,
        (error) => {
          console.error('纹理加载失败:', error);
          reject(error);
        }
      );
    });
  }

  /**
   * 移除平面图
   */
  function removeFloorPlan() {
    if (!contextRef.value || !uploadedMesh.value) return;

    const { scene } = contextRef.value;
    scene.remove(uploadedMesh.value);
    uploadedMesh.value.geometry.dispose();
    (uploadedMesh.value.material as THREE.Material).dispose();
    uploadedMesh.value = null;

    store.setFloorPlan(null as any);
    store.updateStatusMessage('平面图已移除');
  }

  return {
    isLoading,
    handleFileUpload,
    removeFloorPlan
  };
}
