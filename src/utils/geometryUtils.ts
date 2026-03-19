import * as THREE from 'three';
import type { Point3D } from '../types';

/**
 * 计算两点之间的距离
 */
export function distance3D(p1: Point3D, p2: Point3D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dz = p2.z - p1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * 计算两点在XZ平面上的距离
 */
export function distanceXZ(p1: Point3D, p2: Point3D): number {
  const dx = p2.x - p1.x;
  const dz = p2.z - p1.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * 计算两点的中点
 */
export function midpoint(p1: Point3D, p2: Point3D): Point3D {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
    z: (p1.z + p2.z) / 2
  };
}

/**
 * 计算线段在XZ平面上的旋转角度
 */
export function calculateAngleXZ(start: Point3D, end: Point3D): number {
  return Math.atan2(end.z - start.z, end.x - start.x);
}

/**
 * 从点数组创建THREE.Shape（用于地板挤出）
 */
export function createShapeFromPoints(points: Point3D[]): THREE.Shape {
  const shape = new THREE.Shape();
  
  if (points.length < 3) {
    console.warn('需要至少3个点来创建形状');
    return shape;
  }

  // 使用 x 和 z 坐标创建2D形状
  shape.moveTo(points[0].x, points[0].z);
  
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i].x, points[i].z);
  }
  
  shape.closePath();
  return shape;
}

/**
 * 创建闭合线条几何体（用于绘制预览）
 */
export function createLineGeometry(points: Point3D[], closed: boolean = false): THREE.BufferGeometry {
  const vertices: number[] = [];
  
  for (const point of points) {
    vertices.push(point.x, point.y, point.z);
  }
  
  // 如果需要闭合，添加第一个点
  if (closed && points.length > 0) {
    vertices.push(points[0].x, points[0].y, points[0].z);
  }
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  
  return geometry;
}

/**
 * 创建点标记几何体
 */
export function createPointMarker(position: Point3D, size: number = 0.5): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(size, 16, 16);
  const material = new THREE.MeshBasicMaterial({ 
    color: 0xff6b6b,
    transparent: true,
    opacity: 0.8
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position.x, position.y + 0.1, position.z);
  return mesh;
}

/**
 * 判断点是否在多边形内（射线法）
 */
export function isPointInPolygon(point: Point3D, polygon: Point3D[]): boolean {
  let inside = false;
  const x = point.x;
  const z = point.z;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, zi = polygon[i].z;
    const xj = polygon[j].x, zj = polygon[j].z;
    
    if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}

/**
 * 计算多边形面积（梯形法则）
 */
export function calculatePolygonArea(points: Point3D[]): number {
  if (points.length < 3) return 0;
  
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].z;
    area -= points[j].x * points[i].z;
  }
  
  return Math.abs(area) / 2;
}

/**
 * 计算多边形中心点
 */
export function calculatePolygonCenter(points: Point3D[]): Point3D {
  if (points.length === 0) {
    return { x: 0, y: 0, z: 0 };
  }
  
  let sumX = 0, sumY = 0, sumZ = 0;
  for (const point of points) {
    sumX += point.x;
    sumY += point.y;
    sumZ += point.z;
  }
  
  return {
    x: sumX / points.length,
    y: sumY / points.length,
    z: sumZ / points.length
  };
}
