import { ref, onUnmounted, toRaw, type Ref } from "vue";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { CopyShader } from "three/examples/jsm/shaders/CopyShader.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";

const VolumetricLightShader = {
  uniforms: {
    tDiffuse: { value: null },
    lightPosition: { value: new THREE.Vector2(0.5, 0.5) },
    exposure: { value: 0.3 },
    decay: { value: 0.96 },
    density: { value: 0.8 },
    weight: { value: 0.6 },
    samples: { value: 60 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 lightPosition;
    uniform float exposure;
    uniform float decay;
    uniform float density;
    uniform float weight;
    uniform int samples;
    varying vec2 vUv;

    void main() {
      vec2 texCoord = vUv;
      vec2 deltaTextCoord = vec2(texCoord - lightPosition);
      vec2 textCoo = texCoord;
      deltaTextCoord *= 1.0 / float(samples) * density;
      vec4 color = texture2D(tDiffuse, texCoord);
      float illuminationDecay = 1.0;

      for(int i = 0; i < 100; i++) {
        if(i >= samples) break;
        textCoo -= deltaTextCoord;
        vec4 sample = texture2D(tDiffuse, textCoo);
        sample *= illuminationDecay * weight;
        color += sample;
        illuminationDecay *= decay;
      }

      gl_FragColor = color * exposure;
    }
  `,
};

const BlendShader = {
  uniforms: {
    tDiffuse1: { value: null },
    tDiffuse2: { value: null },
    mixRatio: { value: 0.5 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse1;
    uniform sampler2D tDiffuse2;
    uniform float mixRatio;
    varying vec2 vUv;

    void main() {
      vec4 color1 = texture2D(tDiffuse1, vUv);
      vec4 color2 = texture2D(tDiffuse2, vUv);
      gl_FragColor = mix(color1, color2, mixRatio);
    }
  `,
};

export interface VolumetricLightOptions {
  intensity?: number;
  decay?: number;
  density?: number;
  weight?: number;
  samples?: number;
}

export class VolumetricLightEffect {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private lightComposer: EffectComposer;
  private lightScene: THREE.Scene;
  private lightCamera: THREE.OrthographicCamera;
  private lightMesh: THREE.Mesh | null = null;
  private options: Required<VolumetricLightOptions>;
  private volumetricPass: ShaderPass;
  private blendPass: ShaderPass;
  private fxaaPass: ShaderPass;
  private renderTarget: THREE.WebGLRenderTarget;

  constructor(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    renderer: THREE.WebGLRenderer,
    options: VolumetricLightOptions = {},
  ) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;

    this.options = {
      intensity: options.intensity || 0.4,
      decay: options.decay || 0.95,
      density: options.density || 0.7,
      weight: options.weight || 0.5,
      samples: options.samples || 50,
    };

    const size = renderer.getSize(new THREE.Vector2());
    const pixelRatio = renderer.getPixelRatio();

    this.renderTarget = new THREE.WebGLRenderTarget(size.x * pixelRatio, size.y * pixelRatio);

    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(toRaw(scene), toRaw(camera)));

    this.lightScene = new THREE.Scene();
    this.lightCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.lightComposer = new EffectComposer(renderer);
    this.lightComposer.addPass(new RenderPass(this.lightScene, this.lightCamera));

    this.volumetricPass = new ShaderPass(VolumetricLightShader);
    this.volumetricPass.uniforms.exposure.value = this.options.intensity;
    this.volumetricPass.uniforms.decay.value = this.options.decay;
    this.volumetricPass.uniforms.density.value = this.options.density;
    this.volumetricPass.uniforms.weight.value = this.options.weight;
    this.volumetricPass.uniforms.samples.value = this.options.samples;
    this.lightComposer.addPass(this.volumetricPass);

    this.blendPass = new ShaderPass(BlendShader);
    this.blendPass.uniforms.tDiffuse2.value = this.lightComposer.renderTarget2.texture;
    this.blendPass.uniforms.mixRatio.value = 0.6;
    this.composer.addPass(this.blendPass);

    this.fxaaPass = new ShaderPass(FXAAShader);
    this.fxaaPass.uniforms.resolution.value.set(1 / (size.x * pixelRatio), 1 / (size.y * pixelRatio));
    this.composer.addPass(this.fxaaPass);

    const copyPass = new ShaderPass(CopyShader);
    copyPass.renderToScreen = true;
    this.composer.addPass(copyPass);
  }

  addLight(position: THREE.Vector3, color: THREE.Color = new THREE.Color(0xffffff), intensity: number = 1.0) {
    const geometry = new THREE.SphereGeometry(0.5, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: intensity,
    });
    this.lightMesh = new THREE.Mesh(geometry, material);
    this.lightMesh.position.copy(position);
    this.lightMesh.userData.baseOpacity = intensity;
    this.lightScene.add(this.lightMesh);

    const pointLight = new THREE.PointLight(color, intensity * 2, 50);
    pointLight.position.copy(position);
    toRaw(this.scene).add(pointLight);
  }

  update(cameraPosition: THREE.Vector3, cameraDirection: THREE.Vector3) {
    if (!this.lightMesh) return;

    const lightPos = this.lightMesh.position.clone();
    const screenPos = lightPos.clone().project(this.camera);

    const ndcX = (screenPos.x + 1) / 2;
    const ndcY = (screenPos.y + 1) / 2;

    this.volumetricPass.uniforms.lightPosition.value.set(ndcX, ndcY);

    const distance = cameraPosition.distanceTo(lightPos);
    const viewDirection = cameraDirection.clone().normalize();
    const lightDirection = lightPos.clone().sub(cameraPosition).normalize();
    const dotProduct = viewDirection.dot(lightDirection);

    const viewFactor = Math.max(0, dotProduct);
    const distanceFactor = Math.max(0, 1 - distance / 30);
    const dynamicIntensity = this.options.intensity * viewFactor * distanceFactor;

    this.volumetricPass.uniforms.exposure.value = THREE.MathUtils.lerp(
      this.volumetricPass.uniforms.exposure.value,
      dynamicIntensity,
      0.05,
    );

    if (this.lightMesh.material instanceof THREE.MeshBasicMaterial) {
      const baseOpacity = this.lightMesh.userData.baseOpacity || 1.0;
      this.lightMesh.material.opacity = THREE.MathUtils.lerp(
        this.lightMesh.material.opacity,
        baseOpacity * viewFactor * distanceFactor,
        0.05,
      );
    }
  }

  render() {
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.render(toRaw(this.scene), toRaw(this.camera));

    this.lightComposer.render();

    this.blendPass.uniforms.tDiffuse1.value = this.renderTarget.texture;
    this.composer.render();

    this.renderer.setRenderTarget(null);
  }

  setSize(width: number, height: number) {
    const pixelRatio = this.renderer.getPixelRatio();
    this.composer.setSize(width, height);
    this.lightComposer.setSize(width, height);
    this.fxaaPass.uniforms.resolution.value.set(1 / (width * pixelRatio), 1 / (height * pixelRatio));
    this.renderTarget.setSize(width * pixelRatio, height * pixelRatio);
  }

  setIntensity(value: number) {
    this.options.intensity = value;
  }

  dispose() {
    this.composer.dispose();
    this.lightComposer.dispose();
    this.renderTarget.dispose();
    if (this.lightMesh) {
      this.lightMesh.geometry.dispose();
      if (this.lightMesh.material instanceof THREE.Material) {
        this.lightMesh.material.dispose();
      }
    }
  }
}

export function useVolumetricLight(
  scene: Ref<THREE.Scene | null>,
  camera: Ref<THREE.PerspectiveCamera | null>,
  renderer: Ref<THREE.WebGLRenderer | null>,
  options: VolumetricLightOptions = {},
) {
  const effect = ref<VolumetricLightEffect | null>(null);
  const isActive = ref(false);
  const currentCamera = ref<THREE.PerspectiveCamera | null>(null);

  function init() {
    if (!scene.value || !camera.value || !renderer.value) return;
    currentCamera.value = camera.value;
    effect.value = new VolumetricLightEffect(toRaw(scene.value), toRaw(camera.value), toRaw(renderer.value), options);
    isActive.value = true;
  }

  function setCamera(newCamera: THREE.PerspectiveCamera) {
    currentCamera.value = newCamera;
    if (effect.value) {
      (effect.value as any).camera = toRaw(newCamera);
    }
  }

  function addLight(position: THREE.Vector3, color?: THREE.Color, intensity?: number) {
    if (effect.value) {
      effect.value.addLight(position, color, intensity);
    }
  }

  function update(cameraPosition: THREE.Vector3, cameraDirection: THREE.Vector3) {
    if (effect.value && isActive.value) {
      effect.value.update(cameraPosition, cameraDirection);
    }
  }

  function render() {
    if (effect.value && isActive.value) {
      effect.value.render();
    }
  }

  function setSize(width: number, height: number) {
    if (effect.value) {
      effect.value.setSize(width, height);
    }
  }

  function activate() {
    isActive.value = true;
  }

  function deactivate() {
    isActive.value = false;
  }

  function dispose() {
    if (effect.value) {
      effect.value.dispose();
      effect.value = null;
    }
    isActive.value = false;
  }

  onUnmounted(() => {
    dispose();
  });

  return {
    effect,
    isActive,
    currentCamera,
    init,
    addLight,
    update,
    render,
    setSize,
    setCamera,
    activate,
    deactivate,
    dispose,
  };
}
