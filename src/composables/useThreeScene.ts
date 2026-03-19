import { ref, onMounted, onUnmounted, type Ref, type ShallowRef, shallowRef } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  createScene,
  createCamera,
  createRenderer,
  createOrbitControls,
  createLights,
  createGridHelper,
  createGroundPlane,
  disposeObject
} from '../utils/threeHelpers';

export interface ThreeSceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  groundPlane: THREE.Mesh;
}

// 使用模块级别的变量存储 Three.js 对象，完全避免 Vue 响应式系统
let _scene: THREE.Scene | null = null;
let _camera: THREE.PerspectiveCamera | null = null;
let _renderer: THREE.WebGLRenderer | null = null;
let _controls: OrbitControls | null = null;
let _groundPlane: THREE.Mesh | null = null;
let _animationId: number | null = null;

export function useThreeScene(containerRef: Ref<HTMLCanvasElement | null>) {
  const isInitialized = ref(false);

  // 提供一个获取上下文的方法（非响应式）
  function getContext(): ThreeSceneContext | null {
    if (!_scene || !_camera || !_renderer || !_controls || !_groundPlane) {
      return null;
    }
    return {
      scene: _scene,
      camera: _camera,
      renderer: _renderer,
      controls: _controls,
      groundPlane: _groundPlane
    };
  }

  // 使用 shallowRef 仅作为触发器，不存储实际 Three.js 对象
  const contextTrigger = shallowRef(0);
  
  // 返回一个计算属性式的 getter
  const context = {
    get value(): ThreeSceneContext | null {
      // 通过读取 contextTrigger 来保持响应式追踪
      contextTrigger.value;
      return getContext();
    }
  };

  function init() {
    if (!containerRef.value || isInitialized.value) return;

    const canvas = containerRef.value;
    const container = canvas.parentElement || document.body;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 创建场景
    _scene = createScene();

    // 创建相机
    _camera = createCamera(width / height);

    // 创建渲染器
    _renderer = createRenderer(canvas);
    _renderer.setSize(width, height);

    // 创建控制器
    _controls = createOrbitControls(_camera, canvas);

    // 添加灯光
    const lights = createLights();
    _scene.add(lights);

    // 添加网格
    const grid = createGridHelper(200, 40);
    _scene.add(grid);

    // 创建地面平面（用于射线检测）
    _groundPlane = createGroundPlane();
    _scene.add(_groundPlane);

    isInitialized.value = true;
    contextTrigger.value++; // 触发响应式更新

    // 开始动画循环
    animate();
  }

  function animate() {
    if (!_scene || !_camera || !_renderer || !_controls) return;

    _animationId = requestAnimationFrame(animate);
    
    _controls.update();
    _renderer.render(_scene, _camera);
  }

  function handleResize() {
    if (!_camera || !_renderer || !containerRef.value) return;

    const container = containerRef.value.parentElement || document.body;
    const width = container.clientWidth;
    const height = container.clientHeight;

    _camera.aspect = width / height;
    _camera.updateProjectionMatrix();
    _renderer.setSize(width, height);
  }

  function addToScene(object: THREE.Object3D) {
    if (_scene) {
      _scene.add(object);
    }
  }

  function removeFromScene(object: THREE.Object3D) {
    if (_scene) {
      _scene.remove(object);
      disposeObject(object);
    }
  }

  function clearScene(keepGrid: boolean = true) {
    if (!_scene) return;

    const toRemove: THREE.Object3D[] = [];

    _scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.name !== 'ground-plane') {
        toRemove.push(child);
      } else if (child instanceof THREE.Line) {
        toRemove.push(child);
      }
    });

    toRemove.forEach((obj) => {
      _scene!.remove(obj);
      disposeObject(obj);
    });
  }

  function cleanup() {
    if (_animationId !== null) {
      cancelAnimationFrame(_animationId);
      _animationId = null;
    }

    if (_controls) {
      _controls.dispose();
    }

    if (_scene) {
      while (_scene.children.length > 0) {
        const child = _scene.children[0];
        _scene.remove(child);
        disposeObject(child);
      }
    }

    if (_renderer) {
      _renderer.dispose();
    }

    _scene = null;
    _camera = null;
    _renderer = null;
    _controls = null;
    _groundPlane = null;

    isInitialized.value = false;
  }

  onMounted(() => {
    init();
    window.addEventListener('resize', handleResize);
  });

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
    cleanup();
  });

  return {
    isInitialized,
    context,
    getContext,
    addToScene,
    removeFromScene,
    clearScene
  };
}
