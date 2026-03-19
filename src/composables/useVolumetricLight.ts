import { ref, onUnmounted, type Ref } from "vue";
import * as THREE from "three";

export interface VolumetricLightConfig {
  color: number;
  intensity: number;
  distance: number;
  angle: number;
  penumbra: number;
  decay: number;
  volumetricIntensity: number;
  volumetricDecay: number;
  volumetricWeight: number;
  volumetricDensity: number;
}

export interface VolumetricLight {
  light: THREE.SpotLight;
  volumetricMesh: THREE.Mesh;
  helper?: THREE.SpotLightHelper;
  config: VolumetricLightConfig;
}

const DEFAULT_CONFIG: VolumetricLightConfig = {
  color: 0xffffee,
  intensity: 2,
  distance: 30,
  angle: Math.PI / 4,
  penumbra: 0.3,
  decay: 2,
  volumetricIntensity: 1.5,
  volumetricDecay: 1.0,
  volumetricWeight: 0.5,
  volumetricDensity: 0.8,
};

const volumetricVertexShader = `
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vUv = uv;
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const volumetricFragmentShader = `
uniform vec3 uLightColor;
uniform float uIntensity;
uniform float uDecay;
uniform float uWeight;
uniform float uDensity;
uniform float uTime;
uniform vec3 uLightPosition;
uniform vec3 uCameraPosition;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

void main() {
  float dist = length(vWorldPosition - uLightPosition);
  
  float decay = exp(-dist * uDecay * 0.05);
  
  float coneFalloff = 1.0 - (vUv.y * vUv.y);
  coneFalloff = pow(coneFalloff, 1.5);
  
  float noise = random(vUv + uTime * 0.1) * 0.1;
  
  float edgeSoftness = smoothstep(0.0, 0.4, 1.0 - length(vUv - 0.5) * 2.0);
  
  float intensity = uIntensity * decay * coneFalloff * uDensity;
  intensity *= (1.0 + noise);
  intensity *= edgeSoftness;
  
  vec3 viewDir = normalize(uCameraPosition - vWorldPosition);
  float viewAngle = abs(dot(vNormal, viewDir));
  float viewFalloff = mix(0.2, 1.0, viewAngle);
  
  intensity *= viewFalloff;
  
  vec3 finalColor = uLightColor * intensity * uWeight;
  
  float alpha = intensity * 0.8;
  alpha = clamp(alpha, 0.0, 0.9);
  
  gl_FragColor = vec4(finalColor, alpha);
}
`;

export function useVolumetricLight(scene: Ref<THREE.Scene | null>) {
  const volumetricLights = ref<VolumetricLight[]>([]);
  const isEnabled = ref(false);
  let animationTime = 0;

  function createVolumetricLight(
    position: THREE.Vector3,
    target: THREE.Vector3,
    config: Partial<VolumetricLightConfig> = {},
  ): VolumetricLight | null {
    if (!scene.value) {
      console.warn("VolumetricLight: Scene not ready");
      return null;
    }

    console.log("Creating volumetric light at:", position, "target:", target);

    const finalConfig = { ...DEFAULT_CONFIG, ...config };

    const light = new THREE.SpotLight(
      finalConfig.color,
      finalConfig.intensity,
      finalConfig.distance,
      finalConfig.angle,
      finalConfig.penumbra,
      finalConfig.decay,
    );
    light.position.copy(position);
    light.target.position.copy(target);
    light.castShadow = true;
    light.shadow.mapSize.width = 1024;
    light.shadow.mapSize.height = 1024;
    light.shadow.camera.near = 0.1;
    light.shadow.camera.far = finalConfig.distance;

    const coneLength = finalConfig.distance;
    const coneRadius = Math.tan(finalConfig.angle) * coneLength;

    const geometry = new THREE.ConeGeometry(coneRadius, coneLength, 32, 1, true);
    geometry.rotateX(Math.PI);
    geometry.translate(0, -coneLength / 2, 0);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uLightColor: { value: new THREE.Color(finalConfig.color) },
        uIntensity: { value: finalConfig.volumetricIntensity },
        uDecay: { value: finalConfig.volumetricDecay },
        uWeight: { value: finalConfig.volumetricWeight },
        uDensity: { value: finalConfig.volumetricDensity },
        uTime: { value: 0 },
        uLightPosition: { value: position.clone() },
        uCameraPosition: { value: new THREE.Vector3() },
      },
      vertexShader: volumetricVertexShader,
      fragmentShader: volumetricFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const volumetricMesh = new THREE.Mesh(geometry, material);
    volumetricMesh.position.copy(position);
    volumetricMesh.lookAt(target);

    scene.value.add(light);
    scene.value.add(light.target);
    scene.value.add(volumetricMesh);

    console.log(
      "Volumetric light added to scene. Light:",
      light.position,
      "Target:",
      light.target.position,
      "Mesh:",
      volumetricMesh.position,
    );

    const volumetricLight: VolumetricLight = {
      light,
      volumetricMesh,
      config: finalConfig,
    };

    volumetricLights.value.push(volumetricLight);
    return volumetricLight;
  }

  function removeVolumetricLight(volumetricLight: VolumetricLight) {
    if (!scene.value) return;

    scene.value.remove(volumetricLight.light);
    scene.value.remove(volumetricLight.light.target);
    scene.value.remove(volumetricLight.volumetricMesh);

    volumetricLight.volumetricMesh.geometry.dispose();
    (volumetricLight.volumetricMesh.material as THREE.ShaderMaterial).dispose();

    const index = volumetricLights.value.indexOf(volumetricLight);
    if (index > -1) {
      volumetricLights.value.splice(index, 1);
    }
  }

  function update(camera: THREE.Camera, delta: number) {
    if (!isEnabled.value) return;

    animationTime += delta;

    const cameraPosition = camera.position.clone();

    volumetricLights.value.forEach((vl) => {
      const material = vl.volumetricMesh.material as THREE.ShaderMaterial;
      material.uniforms.uTime.value = animationTime;
      material.uniforms.uCameraPosition.value.copy(cameraPosition);

      const lightToCamera = cameraPosition.clone().sub(vl.light.position);
      const distance = lightToCamera.length();

      const dynamicIntensity = vl.config.volumetricIntensity * (1 + Math.sin(animationTime * 2) * 0.1);
      material.uniforms.uIntensity.value = dynamicIntensity;

      const distanceFactor = Math.max(0.5, 1 - distance / (vl.config.distance * 2));
      material.uniforms.uWeight.value = vl.config.volumetricWeight * distanceFactor;
    });
  }

  function enable() {
    console.log("VolumetricLight enable called, lights count:", volumetricLights.value.length);
    isEnabled.value = true;
    volumetricLights.value.forEach((vl) => {
      vl.light.visible = true;
      vl.volumetricMesh.visible = true;
      console.log("Enabled light:", vl.light.position, "mesh visible:", vl.volumetricMesh.visible);
    });
  }

  function disable() {
    isEnabled.value = false;
    volumetricLights.value.forEach((vl) => {
      vl.light.visible = false;
      vl.volumetricMesh.visible = false;
    });
  }

  function clearAll() {
    volumetricLights.value.forEach((vl) => removeVolumetricLight(vl));
    volumetricLights.value = [];
  }

  function createRoomLights(roomCenter: THREE.Vector3, roomSize: THREE.Vector3) {
    const lightPositions = [
      new THREE.Vector3(
        roomCenter.x - roomSize.x * 0.3,
        roomCenter.y + roomSize.y * 0.45,
        roomCenter.z - roomSize.z * 0.3,
      ),
      new THREE.Vector3(
        roomCenter.x + roomSize.x * 0.3,
        roomCenter.y + roomSize.y * 0.45,
        roomCenter.z + roomSize.z * 0.3,
      ),
      new THREE.Vector3(roomCenter.x, roomCenter.y + roomSize.y * 0.45, roomCenter.z),
    ];

    lightPositions.forEach((pos) => {
      const target = pos.clone();
      target.y = roomCenter.y - roomSize.y * 0.5;
      createVolumetricLight(pos, target, {
        intensity: 2,
        distance: 30,
        angle: Math.PI / 4,
        volumetricIntensity: 2.0,
        volumetricDensity: 1.0,
        volumetricWeight: 0.8,
      });
    });

    enable();
  }

  onUnmounted(() => {
    clearAll();
  });

  return {
    volumetricLights,
    isEnabled,
    createVolumetricLight,
    removeVolumetricLight,
    update,
    enable,
    disable,
    clearAll,
    createRoomLights,
  };
}
