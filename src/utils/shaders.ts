import * as THREE from "three";

// 施工阶段颜色定义 - 增强各阶段视觉差异
export const CONSTRUCTION_COLORS = {
  // 毛坯阶段 - 粗糙水泥（深褐色调，模拟原始水泥墙）
  rough: {
    color: new THREE.Color(0x5a4d44),
    roughness: 0.95,
    metalness: 0.05,
  },
  // 水电阶段 - 水泥开槽后（偏蓝灰色，模拟管线开槽后的效果）
  plumbing: {
    color: new THREE.Color(0x6b7380),
    roughness: 0.8,
    metalness: 0.1,
  },
  // 硬装阶段 - 腻子（米白色，模拟刮腻子效果）
  finishing: {
    color: new THREE.Color(0xe8e2d8),
    roughness: 0.4,
    metalness: 0.02,
  },
  // 软装阶段 - 乳胶漆（暖白色，模拟最终刷漆效果）
  decoration: {
    color: new THREE.Color(0xfaf8f5),
    roughness: 0.15,
    metalness: 0.01,
  },
};

// 阶段颜色数组
export const STAGE_COLORS = [
  CONSTRUCTION_COLORS.rough,
  CONSTRUCTION_COLORS.plumbing,
  CONSTRUCTION_COLORS.finishing,
  CONSTRUCTION_COLORS.decoration,
];

// 自定义着色器 - 实现从上到下的材质过渡效果
export const createTransitionShaderMaterial = (
  wallHeight: number,
  stageIndex: number = 0,
  transitionProgress: number = 1,
): THREE.ShaderMaterial => {
  const currentStage = STAGE_COLORS[stageIndex];
  const nextStage = STAGE_COLORS[Math.min(stageIndex + 1, STAGE_COLORS.length - 1)];

  return new THREE.ShaderMaterial({
    uniforms: {
      uWallHeight: { value: wallHeight },
      uTransitionProgress: { value: transitionProgress },
      uCurrentColor: { value: currentStage.color },
      uNextColor: { value: nextStage.color },
      uCurrentRoughness: { value: currentStage.roughness },
      uNextRoughness: { value: nextStage.roughness },
      uBrushEdgeWidth: { value: 0.25 }, // 增加刷痕边缘宽度
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec3 vPosition;
      varying vec2 vUv;
      varying vec3 vNormal;
      
      void main() {
        vPosition = position;
        vUv = uv;
        vNormal = normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uWallHeight;
      uniform float uTransitionProgress;
      uniform vec3 uCurrentColor;
      uniform vec3 uNextColor;
      uniform float uCurrentRoughness;
      uniform float uNextRoughness;
      uniform float uBrushEdgeWidth;
      uniform float uTime;
      
      varying vec3 vPosition;
      varying vec2 vUv;
      varying vec3 vNormal;
      
      // 噪声函数 - 用于模拟刷痕纹理
      float noise(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }
      
      // 更复杂的噪声用于更自然的纹理
      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 4; i++) {
          value += amplitude * noise(p);
          p *= 2.0;
          amplitude *= 0.5;
        }
        return value;
      }
      
      void main() {
        // 将 Y 坐标归一化到 [0, 1] 范围（从底部到顶部）
        float normalizedY = (vPosition.y + uWallHeight * 0.5) / uWallHeight;
        
        // 过渡边界位置 - 从顶部开始往下刷
        float transitionY = 1.0 - uTransitionProgress;
        
        // 计算颜色混合因子
        float colorMix = 0.0;
        
        if (normalizedY < transitionY) {
          // 过渡边界以下 - 当前阶段颜色
          colorMix = 0.0;
        } else if (normalizedY < transitionY + uBrushEdgeWidth) {
          // 刷痕边缘区域 - 使用噪声创建更明显的刷痕效果
          float edgeProgress = (normalizedY - transitionY) / uBrushEdgeWidth;
          
          // 多层噪声创造更自然的刷痕
          float noise1 = noise(vec2(vUv.x * 40.0, normalizedY * 80.0 + uTime * 0.05));
          float noise2 = noise(vec2(vUv.x * 100.0, normalizedY * 150.0));
          float combinedNoise = (noise1 + noise2) * 0.5;
          
          // 更强烈的刷痕效果
          float brushEffect = smoothstep(0.0, 1.0, edgeProgress + (combinedNoise - 0.5) * 0.7);
          colorMix = brushEffect;
        } else {
          // 过渡边界以上 - 下一阶段颜色
          colorMix = 1.0;
        }
        
        // 添加材质纹理差异 - 根据粗糙度添加纹理细节
        vec3 currentTexColor = uCurrentColor;
        vec3 nextTexColor = uNextColor;
        
        float roughnessTex = fbm(vUv * 180.0);
        currentTexColor += (roughnessTex - 0.5) * uCurrentRoughness * 0.25;
        nextTexColor += (roughnessTex - 0.5) * uNextRoughness * 0.12;
        
        // 混合颜色
        vec3 finalColor = mix(currentTexColor, nextTexColor, colorMix);
        
        // 添加更明显的墙面纹理
        float textureNoise = fbm(vUv * 250.0);
        finalColor += (textureNoise - 0.5) * 0.08;
        
        // 刷痕边缘高光效果
        if (colorMix > 0.02 && colorMix < 0.98) {
          float edgeDist = abs(normalizedY - transitionY - uBrushEdgeWidth * 0.5);
          if (edgeDist < 0.03) {
            finalColor += 0.2 * (1.0 - edgeDist / 0.03);
          }
        }
        
        // 改进的光照计算
        vec3 lightDir = normalize(vec3(0.3, 0.8, 0.5));
        float diffuse = max(dot(vNormal, lightDir), 0.0);
        float ambient = 0.35;
        
        // 应用光照
        finalColor = finalColor * (ambient + diffuse * 0.7);
        
        // 根据阶段添加颜色色调变化
        float stageContrast = mix(uCurrentRoughness, uNextRoughness, colorMix);
        finalColor *= (1.0 - stageContrast * 0.2);
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
  });
};

// 更新着色器材质的过渡状态
export const updateTransitionShader = (
  material: THREE.ShaderMaterial,
  stageIndex: number,
  transitionProgress: number,
  fromStage?: number,
  toStage?: number,
) => {
  if (!material.uniforms) return;

  const actualFromStage = fromStage !== undefined ? fromStage : stageIndex;
  const actualToStage = toStage !== undefined ? toStage : Math.min(stageIndex + 1, STAGE_COLORS.length - 1);

  const fromColor = STAGE_COLORS[actualFromStage].color;
  const toColor = STAGE_COLORS[actualToStage].color;
  const fromRoughness = STAGE_COLORS[actualFromStage].roughness;
  const toRoughness = STAGE_COLORS[actualToStage].roughness;

  // 如果是跨阶段过渡，调整进度计算
  let adjustedProgress = transitionProgress;
  if (actualToStage > actualFromStage + 1) {
    const stageDiff = actualToStage - actualFromStage;
    adjustedProgress = (transitionProgress * stageDiff) % 1;
  }

  material.uniforms.uCurrentColor.value = fromColor;
  material.uniforms.uNextColor.value = toColor;
  material.uniforms.uCurrentRoughness.value = fromRoughness;
  material.uniforms.uNextRoughness.value = toRoughness;
  material.uniforms.uTransitionProgress.value = adjustedProgress;
  material.uniforms.uTime.value = performance.now() * 0.001;
};

// 创建普通材质（非着色器）
export const createStageMaterial = (stageIndex: number): THREE.MeshStandardMaterial => {
  const stage = STAGE_COLORS[stageIndex];
  return new THREE.MeshStandardMaterial({
    color: stage.color,
    roughness: stage.roughness,
    metalness: stage.metalness,
  });
};
