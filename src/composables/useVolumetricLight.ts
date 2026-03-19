import * as THREE from 'three';

export interface VolumetricLight {
  light: THREE.SpotLight;
  cone: THREE.Mesh;
  update: (cameraPosition: THREE.Vector3) => void;
  dispose: () => void;
}

export function createVolumetricLight(
  scene: THREE.Scene,
  position: THREE.Vector3 = new THREE.Vector3(0, 8, 0),
  target: THREE.Vector3 = new THREE.Vector3(0, 0, 0)
): VolumetricLight {
  // 创建聚光灯
  const spotLight = new THREE.SpotLight(0xffaa55, 100);
  spotLight.position.copy(position);
  spotLight.target.position.copy(target);
  spotLight.angle = Math.PI / 4;
  spotLight.penumbra = 0.3;
  spotLight.decay = 1.5;
  spotLight.distance = 30;
  spotLight.castShadow = true;
  spotLight.shadow.mapSize.width = 1024;
  spotLight.shadow.mapSize.height = 1024;
  spotLight.shadow.bias = -0.0001;
  
  scene.add(spotLight);
  scene.add(spotLight.target);
  
  // 创建体积光锥体
  const coneHeight = 12;
  const coneRadius = Math.tan(spotLight.angle) * coneHeight;
  
  const coneGeometry = new THREE.ConeGeometry(coneRadius, coneHeight, 32, 1, true);
  coneGeometry.translate(0, -coneHeight / 2, 0);
  
  // 创建体积光材质
  const coneMaterial = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(0xffaa55) },
      uIntensity: { value: 0.3 },
      uCameraPosition: { value: new THREE.Vector3() },
      uLightPosition: { value: position },
      uTime: { value: 0 }
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      varying float vHeight;
      
      void main() {
        vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        vNormal = normalize(normalMatrix * normal);
        vHeight = 1.0 - (position.y + 6.0) / 12.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uIntensity;
      uniform vec3 uCameraPosition;
      uniform vec3 uLightPosition;
      uniform float uTime;
      
      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      varying float vHeight;
      
      void main() {
        // 计算视角方向
        vec3 viewDirection = normalize(uCameraPosition - vWorldPosition);
        
        // 计算到光源的距离
        float distToLight = distance(vWorldPosition, uLightPosition);
        float lightAttenuation = 1.0 - smoothstep(0.0, 15.0, distToLight);
        
        // 视角相关效果 - 看向光源时更亮
        vec3 lightDir = normalize(uLightPosition - vWorldPosition);
        float viewAngle = dot(viewDirection, lightDir);
        float viewFactor = smoothstep(0.0, 1.0, viewAngle);
        
        // 高度衰减
        float heightAttenuation = pow(vHeight, 0.5);
        
        // 边缘柔和
        float fresnel = 1.0 - abs(dot(viewDirection, vNormal));
        fresnel = pow(fresnel, 0.5);
        
        // 动态闪烁效果
        float flicker = 1.0 + sin(uTime * 2.0) * 0.05 + sin(uTime * 5.0) * 0.02;
        
        // 综合计算
        float alpha = uIntensity * lightAttenuation * heightAttenuation * fresnel * flicker;
        alpha *= (0.5 + 0.5 * viewFactor);
        
        gl_FragColor = vec4(uColor, alpha);
      }
    `
  });
  
  const cone = new THREE.Mesh(coneGeometry, coneMaterial);
  cone.position.copy(position);
  cone.lookAt(target);
  cone.rotateX(-Math.PI / 2);
  cone.name = 'volumetric-light-cone';
  
  scene.add(cone);
  
  // 添加光晕精灵
  const glowTexture = createGlowTexture();
  const glowMaterial = new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0xffaa55,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending
  });
  
  const glow = new THREE.Sprite(glowMaterial);
  glow.scale.set(3, 3, 1);
  glow.position.copy(position);
  glow.name = 'light-glow';
  scene.add(glow);
  
  let time = 0;
  
  function update(cameraPosition: THREE.Vector3) {
    time += 0.016;
    
    // 更新shader uniforms
    (cone.material as THREE.ShaderMaterial).uniforms.uCameraPosition.value.copy(cameraPosition);
    (cone.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
    
    // 动态调整光晕
    const distToCamera = cameraPosition.distanceTo(position);
    const glowOpacity = Math.max(0.1, 0.5 - distToCamera / 40);
    glowMaterial.opacity = glowOpacity;
    
    // 看向光源时的额外效果
    const lightDir = new THREE.Vector3().subVectors(position, cameraPosition).normalize();
    const viewDir = new THREE.Vector3(0, 0, -1).applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, -1),
        cameraPosition.clone().sub(position).normalize()
      )
    );
  }
  
  function dispose() {
    scene.remove(spotLight);
    scene.remove(spotLight.target);
    scene.remove(cone);
    scene.remove(glow);
    
    coneGeometry.dispose();
    coneMaterial.dispose();
    glowMaterial.dispose();
    glowTexture.dispose();
  }
  
  return {
    light: spotLight,
    cone,
    update,
    dispose
  };
}

// 创建光晕纹理
function createGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255, 200, 150, 1)');
  gradient.addColorStop(0.3, 'rgba(255, 170, 85, 0.5)');
  gradient.addColorStop(0.7, 'rgba(255, 150, 50, 0.2)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

// 创建多个体积光
export function createRoomLighting(scene: THREE.Scene): { lights: VolumetricLight[]; update: (cameraPosition: THREE.Vector3) => void; dispose: () => void } {
  const lightPositions = [
    new THREE.Vector3(-5, 8, -5),
    new THREE.Vector3(5, 8, -5),
    new THREE.Vector3(-5, 8, 5),
    new THREE.Vector3(5, 8, 5)
  ];
  
  const lights: VolumetricLight[] = [];
  
  lightPositions.forEach(pos => {
    const light = createVolumetricLight(scene, pos, new THREE.Vector3(pos.x, 0, pos.z));
    lights.push(light);
  });
  
  function update(cameraPosition: THREE.Vector3) {
    lights.forEach(light => light.update(cameraPosition));
  }
  
  function dispose() {
    lights.forEach(light => light.dispose());
  }
  
  return {
    lights,
    update,
    dispose
  };
}
