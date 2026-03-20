<template>
  <div class="weather-scene">
    <div ref="containerRef" class="scene-container"></div>
    <div class="weather-controls">
      <button
        v-for="weather in weatherTypes"
        :key="weather.type"
        @click="setWeather(weather.type)"
        :class="{ active: currentWeather === weather.type }">
        {{ weather.icon }} {{ weather.label }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const containerRef = ref<HTMLElement | null>(null);

const weatherTypes = [
  { type: "sunny", icon: "☀️", label: "晴天" },
  { type: "rainy", icon: "🌧️", label: "雨天" },
  { type: "night", icon: "🌙", label: "夜晚" },
];

const currentWeather = ref<string>("sunny");

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let animationId: number;
let sceneLight: THREE.PointLight[] = [];
let ambientLight: THREE.AmbientLight;
let directionalLight: THREE.DirectionalLight;
let rainDrops: THREE.LineSegments | null = null;
let lightFlickering = false;

const weatherConfigs = {
  sunny: {
    ambient: { color: 0xffffff, intensity: 1.2 },
    directional: { color: 0xffffff, intensity: 1.5 },
    background: 0x87ceeb,
    indoorLight: { color: 0xfff5e6, intensity: 0.3 },
  },
  rainy: {
    ambient: { color: 0x6b7b8c, intensity: 0.5 },
    directional: { color: 0x6b7b8c, intensity: 0.4 },
    background: 0x2c3e50,
    indoorLight: { color: 0xffa500, intensity: 1.2 },
  },
  night: {
    ambient: { color: 0x1a1a2e, intensity: 0.2 },
    directional: { color: 0x4a5568, intensity: 0.3 },
    background: 0x0f0f1a,
    indoorLight: { color: 0xffa500, intensity: 1.5 },
  },
};

function createRainDrops() {
  const rainCount = 8000;
  const rainGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(rainCount * 2 * 3);
  const velocities = new Float32Array(rainCount);
  const lengths = new Float32Array(rainCount);

  for (let i = 0; i < rainCount; i++) {
    const x = (Math.random() - 0.5) * 60;
    const y = Math.random() * 60;
    const z = (Math.random() - 0.5) * 60;
    const length = 0.1 + Math.random() * 0.3;

    positions[i * 6] = x;
    positions[i * 6 + 1] = y;
    positions[i * 6 + 2] = z;
    positions[i * 6 + 3] = x;
    positions[i * 6 + 4] = y - length;
    positions[i * 6 + 5] = z;

    velocities[i] = 0.5 + Math.random() * 0.8;
    lengths[i] = length;
  }

  rainGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  rainGeometry.setAttribute("velocity", new THREE.BufferAttribute(velocities, 1));
  rainGeometry.setAttribute("length", new THREE.BufferAttribute(lengths, 1));

  const rainMaterial = new THREE.LineBasicMaterial({
    color: 0xaaaaaa,
    transparent: true,
    opacity: 0.4,
  });

  rainDrops = new THREE.LineSegments(rainGeometry, rainMaterial);
  scene.add(rainDrops);
}

function animateRain() {
  if (!rainDrops) return;

  const positions = rainDrops.geometry.attributes.position.array as Float32Array;
  const velocities = rainDrops.geometry.attributes.velocity.array as Float32Array;
  const lengths = rainDrops.geometry.attributes.length.array as Float32Array;

  for (let i = 0; i < positions.length / 6; i++) {
    const velocity = velocities[i];
    const length = lengths[i];

    positions[i * 6 + 1] -= velocity;
    positions[i * 6 + 4] -= velocity;

    positions[i * 6] += Math.sin(Date.now() * 0.0005 + i * 0.1) * 0.02;
    positions[i * 6 + 3] += Math.sin(Date.now() * 0.0005 + i * 0.1) * 0.02;

    if (positions[i * 6 + 1] < -30) {
      const x = (Math.random() - 0.5) * 60;
      const y = 30 + Math.random() * 10;
      const z = (Math.random() - 0.5) * 60;

      positions[i * 6] = x;
      positions[i * 6 + 1] = y;
      positions[i * 6 + 2] = z;
      positions[i * 6 + 3] = x;
      positions[i * 6 + 4] = y - length;
      positions[i * 6 + 5] = z;
    }
  }
  rainDrops.geometry.attributes.position.needsUpdate = true;
}

function createIndoorLights() {
  const lightPositions = [
    { x: -3, y: 2, z: -3 },
    { x: 3, y: 2, z: -3 },
    { x: 0, y: 2, z: 2 },
  ];

  lightPositions.forEach((pos) => {
    const light = new THREE.PointLight(0xffa500, 0.3, 15);
    light.position.set(pos.x, pos.y, pos.z);
    scene.add(light);
    sceneLight.push(light);

    const lightSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffa500 }),
    );
    lightSphere.position.set(pos.x, pos.y, pos.z);
    scene.add(lightSphere);
  });
}

function flickerLights() {
  if (!lightFlickering) return;

  sceneLight.forEach((light) => {
    const config = weatherConfigs[currentWeather.value as keyof typeof weatherConfigs].indoorLight;
    const flicker = 0.8 + Math.random() * 0.4;
    light.intensity = config.intensity * flicker;
  });
}

let glassWaterDrops: THREE.Mesh | null = null;

function createWindowGlass() {
  const glassGeometry = new THREE.PlaneGeometry(12, 8);

  const glassMaterial = new THREE.MeshPhongMaterial({
    color: 0x88ccff,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
    shininess: 100,
    specular: new THREE.Color(0xffffff),
  });

  const glass = new THREE.Mesh(glassGeometry, glassMaterial);
  glass.position.set(0, 2, -5);
  scene.add(glass);

  const waterDropShader = {
    uniforms: {
      time: { value: 0 },
      opacity: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform float opacity;
      varying vec2 vUv;
      
      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
      }
      
      float noise(vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);
        float a = random(i);
        float b = random(i + vec2(1.0, 0.0));
        float c = random(i + vec2(0.0, 1.0));
        float d = random(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }
      
      float dropShape(vec2 pos, float size) {
        float dist = length(pos - vec2(0.0, size * 0.3));
        float mainDrop = smoothstep(size, 0.0, dist);
        float tail = smoothstep(size * 0.3, 0.0, length(pos - vec2(0.0, -size * 0.5))) * 0.3;
        return clamp(mainDrop + tail, 0.0, 1.0);
      }
      
      void main() {
        vec2 st = vUv * 12.0;
        float water = 0.0;
        
        for (int i = 0; i < 12; i++) {
          float fi = float(i);
          float speed = 0.3 + random(vec2(fi)) * 0.4;
          float yOffset = time * speed + fi * 0.8;
          
          vec2 gridPos = vec2(
            floor(st.x) + random(vec2(fi, floor(st.y + yOffset))),
            floor(st.y + yOffset)
          );
          
          vec2 localPos = fract(st + vec2(0.0, yOffset)) - 0.5;
          
          float dropRandom = random(gridPos);
          float size = 0.15 + dropRandom * 0.2;
          
          if (dropRandom > 0.3) {
            float drop = dropShape(localPos, size);
            water += drop * (0.4 + dropRandom * 0.3);
          }
        }
        
        float stream = 0.0;
        for (int i = 0; i < 15; i++) {
          float fi = float(i);
          float xPos = (fi + 0.5) / 15.0;
          xPos += noise(vec2(fi * 0.5, floor(time * 0.5))) * 0.1;
          
          float streamNoise = noise(vec2(st.x * 5.0, st.y * 8.0 + time * 2.0 + fi));
          float streamWidth = 0.005 + streamNoise * 0.015;
          
          float distToStream = abs(st.x / 12.0 - xPos);
          float streamLine = smoothstep(streamWidth, 0.0, distToStream);
          
          float verticalNoise = noise(vec2(fi * 2.0, st.y * 3.0 + time));
          streamLine *= verticalNoise * 0.5;
          
          stream += streamLine;
        }
        
        float film = noise(st * 3.0 + time * 0.5) * 0.15;
        film += noise(st * 6.0 + time * 0.8) * 0.08;
        
        water = clamp(water + stream * 0.4 + film, 0.0, 1.0);
        
        vec3 waterColor = vec3(0.9, 0.95, 1.0);
        vec3 highlight = vec3(1.0, 1.0, 1.0);
        
        float edgeHighlight = smoothstep(0.0, 0.3, water) - smoothstep(0.3, 0.35, water);
        vec3 finalColor = mix(waterColor, highlight, edgeHighlight * 0.5);
        
        float alpha = water * opacity;
        float fresnel = pow(1.0 - water, 2.0) * 0.3;
        
        gl_FragColor = vec4(finalColor, alpha * (0.5 + fresnel));
      }
    `,
  };

  const waterMaterial = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone(waterDropShader.uniforms),
    vertexShader: waterDropShader.vertexShader,
    fragmentShader: waterDropShader.fragmentShader,
    transparent: true,
    side: THREE.DoubleSide,
  });

  glassWaterDrops = new THREE.Mesh(glassGeometry, waterMaterial);
  glassWaterDrops.position.set(0, 2, -4.99);
  scene.add(glassWaterDrops);

  const windowFrame = new THREE.Mesh(
    new THREE.BoxGeometry(13, 9, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x4a3728 }),
  );
  windowFrame.position.set(0, 2, -5.1);
  scene.add(windowFrame);
}

function createRoom() {
  const floorGeometry = new THREE.PlaneGeometry(20, 20);
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x8b4513,
    side: THREE.DoubleSide,
  });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = Math.PI / 2;
  floor.position.y = -2;
  scene.add(floor);

  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0xf5f5dc,
  });

  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(20, 15), wallMaterial);
  backWall.position.set(0, 5.5, -10);
  scene.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(20, 15), wallMaterial);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-10, 5.5, 0);
  scene.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(20, 15), wallMaterial);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(10, 5.5, 0);
  scene.add(rightWall);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), wallMaterial);
  ceiling.rotation.x = -Math.PI / 2;
  ceiling.position.y = 8;
  scene.add(ceiling);
}

function initScene() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75,
    containerRef.value!.clientWidth / containerRef.value!.clientHeight,
    0.1,
    1000,
  );
  camera.position.set(0, 2, 8);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(containerRef.value!.clientWidth, containerRef.value!.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  containerRef.value!.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  ambientLight = new THREE.AmbientLight(0xffffff, 1);
  scene.add(ambientLight);

  directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(10, 20, 10);
  scene.add(directionalLight);

  createRoom();
  createWindowGlass();
  createIndoorLights();
  createRainDrops();
  if (rainDrops) {
    rainDrops.visible = false;
  }

  applyWeatherConfig("sunny");
}

function applyWeatherConfig(weather: string) {
  const config = weatherConfigs[weather as keyof typeof weatherConfigs];

  scene.background = new THREE.Color(config.background);

  ambientLight.color.setHex(config.ambient.color);
  ambientLight.intensity = config.ambient.intensity;

  directionalLight.color.setHex(config.directional.color);
  directionalLight.intensity = config.directional.intensity;

  sceneLight.forEach((light) => {
    light.color.setHex(config.indoorLight.color);
    light.intensity = config.indoorLight.intensity;
  });

  if (rainDrops) {
    rainDrops.visible = weather === "rainy";
  }

  if (glassWaterDrops && glassWaterDrops.material instanceof THREE.ShaderMaterial) {
    glassWaterDrops.material.uniforms.opacity.value = weather === "rainy" ? 1.0 : 0.0;
  }

  lightFlickering = weather === "rainy" || weather === "night";
}

function setWeather(weather: string) {
  currentWeather.value = weather;
  applyWeatherConfig(weather);
}

function animate() {
  animationId = requestAnimationFrame(animate);
  controls.update();

  if (currentWeather.value === "rainy") {
    animateRain();
    if (glassWaterDrops && glassWaterDrops.material instanceof THREE.ShaderMaterial) {
      glassWaterDrops.material.uniforms.time.value += 0.01;
    }
  }

  if (lightFlickering && Math.random() > 0.9) {
    flickerLights();
  }

  renderer.render(scene, camera);
}

function onResize() {
  if (!containerRef.value) return;
  camera.aspect = containerRef.value.clientWidth / containerRef.value.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(containerRef.value.clientWidth, containerRef.value.clientHeight);
}

onMounted(() => {
  initScene();
  animate();
  window.addEventListener("resize", onResize);
});

onUnmounted(() => {
  cancelAnimationFrame(animationId);
  window.removeEventListener("resize", onResize);
  renderer.dispose();
});
</script>

<style scoped>
.weather-scene {
  width: 100%;
  height: 100vh;
  position: relative;
  overflow: hidden;
}

.scene-container {
  width: 100%;
  height: 100%;
}

.weather-controls {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 10px;
  z-index: 100;
}

.weather-controls button {
  padding: 10px 20px;
  border: none;
  border-radius: 25px;
  background: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: all 0.3s ease;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.weather-controls button:hover {
  background: #4a90e2;
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(74, 144, 226, 0.3);
}

.weather-controls button.active {
  background: #4a90e2;
  color: white;
  box-shadow: 0 4px 15px rgba(74, 144, 226, 0.4);
}
</style>
