import { ref, computed } from "vue";
import * as THREE from "three";

export type WeatherType = "sunny" | "rainy" | "cloudy" | "night";

export interface WeatherConfig {
  type: WeatherType;
  ambientColor: number;
  ambientIntensity: number;
  directionalColor: number;
  directionalIntensity: number;
  fogColor: number;
  fogDensity: number;
  indoorLightColor: number;
  indoorLightIntensity: number;
  backgroundColor: number;
}

const weatherConfigs: Record<WeatherType, WeatherConfig> = {
  sunny: {
    type: "sunny",
    ambientColor: 0xffffff,
    ambientIntensity: 0.6,
    directionalColor: 0xfff5e6,
    directionalIntensity: 1.2,
    fogColor: 0x87ceeb,
    fogDensity: 0.002,
    indoorLightColor: 0xffaa66,
    indoorLightIntensity: 0,
    backgroundColor: 0x87ceeb,
  },
  rainy: {
    type: "rainy",
    ambientColor: 0x4a5568,
    ambientIntensity: 0.3,
    directionalColor: 0x718096,
    directionalIntensity: 0.4,
    fogColor: 0x2d3748,
    fogDensity: 0.015,
    indoorLightColor: 0xffaa66,
    indoorLightIntensity: 0.8,
    backgroundColor: 0x2d3748,
  },
  cloudy: {
    type: "cloudy",
    ambientColor: 0xc0c0c0,
    ambientIntensity: 0.5,
    directionalColor: 0xdcdcdc,
    directionalIntensity: 0.7,
    fogColor: 0x808080,
    fogDensity: 0.008,
    indoorLightColor: 0xffcc88,
    indoorLightIntensity: 0.3,
    backgroundColor: 0x808080,
  },
  night: {
    type: "night",
    ambientColor: 0x1a1a2e,
    ambientIntensity: 0.2,
    directionalColor: 0x4a5568,
    directionalIntensity: 0.2,
    fogColor: 0x0f0f1a,
    fogDensity: 0.02,
    indoorLightColor: 0xffaa66,
    indoorLightIntensity: 1.0,
    backgroundColor: 0x0f0f1a,
  },
};

export function useWeatherEffects() {
  const currentWeather = ref<WeatherType>("sunny");
  const isTransitioning = ref(false);

  // 雨滴系统
  let rainSystem: THREE.Points | null = null;
  let rainGeometry: THREE.BufferGeometry | null = null;
  let rainMaterial: THREE.PointsMaterial | null = null;
  let rainPositions: Float32Array | null = null;
  let rainVelocities: Float32Array | null = null;

  // 玻璃雨滴纹理
  let glassRainTexture: THREE.CanvasTexture | null = null;
  let glassRainCanvas: HTMLCanvasElement | null = null;
  let glassRainContext: CanvasRenderingContext2D | null = null;
  let glassRainDrops: Array<{ x: number; y: number; length: number; speed: number; opacity: number }> = [];

  // 室内灯光
  let indoorLights: THREE.PointLight[] = [];
  let indoorLightFlickerTime = 0;

  // 场景引用
  let sceneRef: THREE.Scene | null = null;
  let ambientLightRef: THREE.AmbientLight | null = null;
  let directionalLightRef: THREE.DirectionalLight | null = null;
  let rendererRef: THREE.WebGLRenderer | null = null;

  const currentConfig = computed(() => weatherConfigs[currentWeather.value]);

  function initWeatherSystem(
    scene: THREE.Scene,
    ambientLight: THREE.AmbientLight,
    directionalLight: THREE.DirectionalLight,
    renderer: THREE.WebGLRenderer,
  ) {
    sceneRef = scene;
    ambientLightRef = ambientLight;
    directionalLightRef = directionalLight;
    rendererRef = renderer;

    // 初始化雨滴系统
    initRainSystem(scene);

    // 初始化玻璃雨滴纹理
    initGlassRainTexture();

    // 初始化室内灯光
    initIndoorLights(scene);

    // 应用初始天气
    applyWeatherConfig(currentConfig.value);
  }

  function initRainSystem(scene: THREE.Scene) {
    const rainCount = 8000;
    rainGeometry = new THREE.BufferGeometry();
    rainPositions = new Float32Array(rainCount * 3);
    rainVelocities = new Float32Array(rainCount);

    for (let i = 0; i < rainCount; i++) {
      rainPositions[i * 3] = (Math.random() - 0.5) * 400;
      rainPositions[i * 3 + 1] = Math.random() * 200;
      rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 400;
      rainVelocities[i] = 0.5 + Math.random() * 0.5;
    }

    rainGeometry.setAttribute("position", new THREE.BufferAttribute(rainPositions, 3));

    rainMaterial = new THREE.PointsMaterial({
      color: 0xaaaaaa,
      size: 0.5,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });

    rainSystem = new THREE.Points(rainGeometry, rainMaterial);
    rainSystem.visible = false;
    scene.add(rainSystem);
  }

  function initGlassRainTexture() {
    glassRainCanvas = document.createElement("canvas");
    glassRainCanvas.width = 512;
    glassRainCanvas.height = 512;
    glassRainContext = glassRainCanvas.getContext("2d");

    if (glassRainContext) {
      // 初始化雨滴 - 增加数量让效果更明显
      for (let i = 0; i < 80; i++) {
        glassRainDrops.push({
          x: Math.random() * glassRainCanvas.width,
          y: Math.random() * glassRainCanvas.height,
          length: 15 + Math.random() * 40,
          speed: 0.8 + Math.random() * 2,
          opacity: 0.4 + Math.random() * 0.5,
        });
      }
    }

    glassRainTexture = new THREE.CanvasTexture(glassRainCanvas);
    glassRainTexture.wrapS = THREE.RepeatWrapping;
    glassRainTexture.wrapT = THREE.RepeatWrapping;
  }

  function initIndoorLights(scene: THREE.Scene) {
    // 创建多个室内点光源，模拟房间灯光
    const lightPositions = [
      { x: -30, y: 25, z: -30 },
      { x: 30, y: 25, z: -30 },
      { x: -30, y: 25, z: 30 },
      { x: 30, y: 25, z: 30 },
      { x: 0, y: 30, z: 0 },
    ];

    lightPositions.forEach((pos) => {
      const light = new THREE.PointLight(0xffaa66, 0, 60);
      light.position.set(pos.x, pos.y, pos.z);
      light.castShadow = true;
      light.shadow.mapSize.width = 512;
      light.shadow.mapSize.height = 512;
      scene.add(light);
      indoorLights.push(light);
    });
  }

  function updateGlassRainTexture() {
    if (!glassRainContext || !glassRainCanvas) return;

    const canvas = glassRainCanvas;
    const ctx = glassRainContext;

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制雨滴
    glassRainDrops.forEach((drop) => {
      // 更新雨滴位置
      drop.y += drop.speed;

      // 如果雨滴超出底部，重置到顶部
      if (drop.y > canvas.height) {
        drop.y = -drop.length;
        drop.x = Math.random() * canvas.width;
      }

      // 绘制雨滴
      const gradient = ctx.createLinearGradient(drop.x, drop.y, drop.x, drop.y + drop.length);
      gradient.addColorStop(0, `rgba(200, 220, 255, 0)`);
      gradient.addColorStop(0.5, `rgba(200, 220, 255, ${drop.opacity})`);
      gradient.addColorStop(1, `rgba(200, 220, 255, 0)`);

      ctx.beginPath();
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2;
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x, drop.y + drop.length);
      ctx.stroke();

      // 绘制水滴头部
      ctx.beginPath();
      ctx.fillStyle = `rgba(220, 230, 255, ${drop.opacity * 0.8})`;
      ctx.arc(drop.x, drop.y + drop.length, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // 更新纹理
    if (glassRainTexture) {
      glassRainTexture.needsUpdate = true;
    }
  }

  function updateRainAnimation() {
    if (!rainSystem || !rainPositions || !rainVelocities || !rainGeometry) return;

    const positions = rainGeometry.attributes.position.array as Float32Array;

    for (let i = 0; i < rainVelocities.length; i++) {
      // 更新Y位置
      positions[i * 3 + 1] -= rainVelocities[i] * 2;

      // 如果雨滴落到地面以下，重置到顶部
      if (positions[i * 3 + 1] < 0) {
        positions[i * 3 + 1] = 200;
        positions[i * 3] = (Math.random() - 0.5) * 400;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 400;
      }
    }

    rainGeometry.attributes.position.needsUpdate = true;
  }

  function updateIndoorLightFlicker(deltaTime: number) {
    indoorLightFlickerTime += deltaTime;

    const config = currentConfig.value;
    const baseIntensity = config.indoorLightIntensity;

    indoorLights.forEach((light, index) => {
      // 为每个灯光创建不同的闪烁模式
      const flickerOffset = index * 1.5;
      const flickerSpeed = 2 + index * 0.5;

      // 使用正弦波创建轻微的闪烁效果
      const flicker = Math.sin(indoorLightFlickerTime * flickerSpeed + flickerOffset) * 0.05;

      // 偶尔添加随机闪烁
      const randomFlicker = Math.random() > 0.98 ? (Math.random() - 0.5) * 0.1 : 0;

      light.intensity = Math.max(0, baseIntensity + flicker + randomFlicker);
      light.color.setHex(config.indoorLightColor);
    });
  }

  function applyWeatherConfig(config: WeatherConfig) {
    if (!sceneRef || !ambientLightRef || !directionalLightRef || !rendererRef) return;

    // 使用Tween或渐变效果
    const duration = 1000; // 1秒过渡
    const startTime = Date.now();

    // 保存起始值
    const startAmbientColor = ambientLightRef.color.clone();
    const startAmbientIntensity = ambientLightRef.intensity;
    const startDirectionalColor = directionalLightRef.color.clone();
    const startDirectionalIntensity = directionalLightRef.intensity;
    const startFogColor = sceneRef.fog
      ? (sceneRef.fog as THREE.FogExp2).color.clone()
      : new THREE.Color(config.fogColor);
    const startFogDensity = sceneRef.fog ? (sceneRef.fog as THREE.FogExp2).density : 0;
    const startBackgroundColor = rendererRef.getClearColor(new THREE.Color());

    const targetAmbientColor = new THREE.Color(config.ambientColor);
    const targetDirectionalColor = new THREE.Color(config.directionalColor);
    const targetFogColor = new THREE.Color(config.fogColor);
    const targetBackgroundColor = new THREE.Color(config.backgroundColor);

    function animateTransition() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // 使用easeInOutCubic缓动
      const easeProgress = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      // 插值颜色
      ambientLightRef!.color.lerpColors(startAmbientColor, targetAmbientColor, easeProgress);
      ambientLightRef!.intensity =
        startAmbientIntensity + (config.ambientIntensity - startAmbientIntensity) * easeProgress;

      directionalLightRef!.color.lerpColors(startDirectionalColor, targetDirectionalColor, easeProgress);
      directionalLightRef!.intensity =
        startDirectionalIntensity + (config.directionalIntensity - startDirectionalIntensity) * easeProgress;

      // 更新雾
      if (!sceneRef!.fog) {
        sceneRef!.fog = new THREE.FogExp2(config.fogColor, config.fogDensity);
      }
      const fog = sceneRef!.fog as THREE.FogExp2;
      fog.color.lerpColors(startFogColor, targetFogColor, easeProgress);
      fog.density = startFogDensity + (config.fogDensity - startFogDensity) * easeProgress;

      // 更新背景色
      const currentBg = startBackgroundColor.clone().lerp(targetBackgroundColor, easeProgress);
      rendererRef!.setClearColor(currentBg);
      sceneRef!.background = currentBg;

      if (progress < 1) {
        requestAnimationFrame(animateTransition);
      } else {
        isTransitioning.value = false;
      }
    }

    isTransitioning.value = true;
    animateTransition();

    // 控制雨滴系统
    if (rainSystem && rainMaterial) {
      if (config.type === "rainy") {
        rainSystem.visible = true;
        rainMaterial.opacity = 0.6;
      } else {
        rainSystem.visible = false;
        rainMaterial.opacity = 0;
      }
    }
  }

  function setWeather(weather: WeatherType) {
    if (currentWeather.value === weather || isTransitioning.value) return;

    currentWeather.value = weather;
    applyWeatherConfig(weatherConfigs[weather]);
  }

  function update(deltaTime: number) {
    // 更新雨滴动画
    if (currentWeather.value === "rainy") {
      updateRainAnimation();
      updateGlassRainTexture();
    }

    // 更新室内灯光闪烁
    if (currentWeather.value === "rainy" || currentWeather.value === "night") {
      updateIndoorLightFlicker(deltaTime);
    } else {
      // 晴天时关闭室内灯光
      indoorLights.forEach((light) => {
        light.intensity = 0;
      });
    }
  }

  function getGlassRainTexture(): THREE.CanvasTexture | null {
    return glassRainTexture;
  }

  function dispose() {
    if (rainGeometry) rainGeometry.dispose();
    if (rainMaterial) rainMaterial.dispose();
    if (glassRainTexture) glassRainTexture.dispose();
    indoorLights.forEach((light) => light.dispose());
    rainSystem = null;
    glassRainTexture = null;
    indoorLights = [];
  }

  return {
    currentWeather,
    currentConfig,
    isTransitioning,
    initWeatherSystem,
    setWeather,
    update,
    getGlassRainTexture,
    dispose,
  };
}
