import * as THREE from 'three';
import type { ConstructionMaterialParams } from '../types';

// 噪点函数 - 用于生成水泥质感
const noiseFunctions = `
  // Simplex 2D noise
  vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
             -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
    + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
      dot(x12.zw,x12.zw)), 0.0);
    m = m*m ;
    m = m*m ;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
  
  // Fractional Brownian Motion for more detailed noise
  float fbm(vec2 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for(int i = 0; i < 4; i++) {
      if(i >= octaves) break;
      value += amplitude * snoise(p * frequency);
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return value;
  }
`;

// 顶点着色器
export const constructionVertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  
  void main() {
    vUv = uv;
    vPosition = position;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// 片段着色器
export const constructionFragmentShader = `
  uniform vec3 uColorFrom;
  uniform vec3 uColorTo;
  uniform float uRoughnessFrom;
  uniform float uRoughnessTo;
  uniform float uMetalnessFrom;
  uniform float uMetalnessTo;
  uniform float uNoiseScaleFrom;
  uniform float uNoiseScaleTo;
  uniform float uNoiseIntensityFrom;
  uniform float uNoiseIntensityTo;
  uniform float uGlobalProgress;     // 0-3 整体进度
  uniform float uTransitionY;        // 过渡线位置（0=顶部，1=底部）
  uniform float uTransitionWidth;    // 过渡带宽度
  uniform float uWallHeight;         // 墙体高度
  
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  
  ${noiseFunctions}
  
  void main() {
    // 计算当前片段在墙体上的相对高度（0在底部，1在顶部）
    float relativeHeight = (vPosition.y + uWallHeight * 0.5) / uWallHeight;
    relativeHeight = clamp(relativeHeight, 0.0, 1.0);
    
    // 从上到下的刷墙效果
    // uTransitionY: 0 = 顶部开始刷, 1 = 刷到底部
    // 当 uTransitionY = 0 时，全部显示 from 材质（未开始）
    // 当 uTransitionY = 1 时，全部显示 to 材质（刷完）
    
    // 创建明显的分界线效果
    float transitionFactor = smoothstep(
      uTransitionY - uTransitionWidth,
      uTransitionY + uTransitionWidth,
      1.0 - relativeHeight  // 翻转，让过渡从上到下
    );
    
    // 混合材质参数
    vec3 color = mix(uColorFrom, uColorTo, transitionFactor);
    float roughness = mix(uRoughnessFrom, uRoughnessTo, transitionFactor);
    float metalness = mix(uMetalnessFrom, uMetalnessTo, transitionFactor);
    float noiseScale = mix(uNoiseScaleFrom, uNoiseScaleTo, transitionFactor);
    float noiseIntensity = mix(uNoiseIntensityFrom, uNoiseIntensityTo, transitionFactor);
    
    // 生成噪点纹理
    vec2 noiseUV = vUv * noiseScale;
    float noise1 = fbm(noiseUV, 3);
    float noise2 = fbm(noiseUV * 2.0 + vec2(5.2, 1.3), 2);
    float combinedNoise = noise1 * 0.7 + noise2 * 0.3;
    
    // 应用噪点到颜色
    vec3 finalColor = color * (1.0 + combinedNoise * noiseIntensity);
    
    // 添加一些细微的污渍/斑驳效果（毛坯阶段更明显）
    float stainNoise = fbm(vUv * 5.0 + vec2(10.0, 10.0), 2);
    float stainIntensity = (1.0 - transitionFactor) * 0.2;
    finalColor *= (1.0 - stainNoise * stainIntensity);
    
    // 简单的光照计算
    vec3 lightDir = normalize(vec3(0.5, 1.0, 0.5));
    float diff = max(dot(vNormal, lightDir), 0.0);
    vec3 ambient = vec3(0.3);
    vec3 lighting = ambient + vec3(0.7) * diff;
    
    // 应用粗糙度到漫反射
    lighting *= (1.0 - roughness * 0.3);
    
    finalColor *= lighting;
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

// 创建施工阶段材质
export function createConstructionMaterial(
  wallHeight: number
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColorFrom: { value: new THREE.Color(0x5d4037) },
      uColorTo: { value: new THREE.Color(0x5d4037) },
      uRoughnessFrom: { value: 1.0 },
      uRoughnessTo: { value: 1.0 },
      uMetalnessFrom: { value: 0.0 },
      uMetalnessTo: { value: 0.0 },
      uNoiseScaleFrom: { value: 4.0 },
      uNoiseScaleTo: { value: 4.0 },
      uNoiseIntensityFrom: { value: 0.6 },
      uNoiseIntensityTo: { value: 0.6 },
      uGlobalProgress: { value: 0.0 },
      uTransitionY: { value: 0.0 },
      uTransitionWidth: { value: 0.1 },
      uWallHeight: { value: wallHeight }
    },
    vertexShader: constructionVertexShader,
    fragmentShader: constructionFragmentShader,
    side: THREE.DoubleSide
  });
}

// 根据全局进度(0-3)获取当前阶段和过渡参数
export function getPhaseFromProgress(globalProgress: number): {
  fromIndex: number;
  toIndex: number;
  phaseProgress: number;
  transitionY: number;
} {
  // globalProgress: 0-3
  // 0-1: rough -> plumbing
  // 1-2: plumbing -> hard
  // 2-3: hard -> soft
  
  const clampedProgress = Math.max(0, Math.min(3, globalProgress));
  const fromIndex = Math.floor(clampedProgress);
  const phaseProgress = clampedProgress - fromIndex; // 0-1 within current transition
  
  // transitionY: 0 = 未开始(全部from), 1 = 完成(全部to)
  // 这样当 phaseProgress = 0 时，transitionY = 0（全部显示 from 材质）
  // 当 phaseProgress = 1 时，transitionY = 1（全部显示 to 材质）
  const transitionY = phaseProgress;
  
  return {
    fromIndex: Math.min(fromIndex, 3),
    toIndex: Math.min(fromIndex + 1, 3),
    phaseProgress,
    transitionY
  };
}
