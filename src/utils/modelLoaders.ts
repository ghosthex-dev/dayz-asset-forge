import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PAAParser } from './paaParser';

export interface LoadedModelResult {
  mesh: THREE.Mesh;
  vertexCount: number;
  triangleCount: number;
  boundingBox: THREE.Box3;
}

export class ModelLoader {
  /**
   * Load a 3D model file from an ArrayBuffer / File
   */
  public static async loadModelFile(file: File): Promise<LoadedModelResult> {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const buffer = await file.arrayBuffer();

    let geometry: THREE.BufferGeometry | null = null;

    if (ext === 'obj') {
      const text = new TextDecoder().decode(buffer);
      const loader = new OBJLoader();
      const obj = loader.parse(text);

      // Extract first mesh geometry or merge
      let foundMesh: THREE.Mesh | null = null;
      obj.traverse((child) => {
        if (!foundMesh && (child as THREE.Mesh).isMesh) {
          foundMesh = child as THREE.Mesh;
        }
      });

      if (foundMesh) {
        geometry = (foundMesh as THREE.Mesh).geometry.clone();
      } else {
        throw new Error('No 3D mesh geometry found in OBJ file');
      }
    } else if (ext === 'stl') {
      const loader = new STLLoader();
      geometry = loader.parse(buffer);
    } else if (ext === 'gltf' || ext === 'glb') {
      const loader = new GLTFLoader();
      const gltf = await new Promise<any>((resolve, reject) => {
        loader.parse(buffer, '', resolve, reject);
      });

      let foundMesh: THREE.Mesh | null = null;
      gltf.scene.traverse((child: any) => {
        if (!foundMesh && child.isMesh) {
          foundMesh = child;
        }
      });

      if (foundMesh) {
        geometry = (foundMesh as THREE.Mesh).geometry.clone();
      } else {
        throw new Error('No 3D mesh geometry found in GLTF file');
      }
    } else if (ext === 'p3d') {
      // DayZ MLOD P3D basic parsing
      geometry = this.parseMLOD(buffer);
    } else {
      throw new Error(`Unsupported model format: .${ext}. Please use OBJ, STL, GLTF, or P3D.`);
    }

    if (!geometry) {
      throw new Error('Failed to parse 3D geometry.');
    }

    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    // Default DayZ PBR material
    const material = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      roughness: 0.5,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const pos = geometry.attributes.position;
    const vertexCount = pos ? pos.count : 0;
    const triangleCount = geometry.index ? geometry.index.count / 3 : vertexCount / 3;

    return {
      mesh,
      vertexCount,
      triangleCount: Math.round(triangleCount),
      boundingBox: geometry.boundingBox!,
    };
  }

  /**
   * Parse Wavefront OBJ text directly into a LoadedModelResult
   */
  public static parseOBJText(text: string): LoadedModelResult {
    const loader = new OBJLoader();
    const obj = loader.parse(text);

    let geometry: THREE.BufferGeometry | null = null;
    obj.traverse((child) => {
      if (!geometry && (child as THREE.Mesh).isMesh) {
        geometry = (child as THREE.Mesh).geometry.clone();
      }
    });

    if (!geometry) {
      throw new Error('No 3D mesh geometry found in OBJ data');
    }

    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.6,
      metalness: 0.2,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const pos = geometry.attributes.position;
    const vertexCount = pos ? pos.count : 0;
    const triangleCount = geometry.index ? geometry.index.count / 3 : vertexCount / 3;

    return {
      mesh,
      vertexCount,
      triangleCount: Math.round(triangleCount),
      boundingBox: geometry.boundingBox!,
    };
  }

  /**
   * Basic Bohemia MLOD (P3D) format parser
   * MLOD files store editable Bohemia Real Virtuality meshes
   */
  private static parseMLOD(buffer: ArrayBuffer): THREE.BufferGeometry {
    const view = new DataView(buffer);
    const tag = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));

    if (tag !== 'MLOD') {
      // If it's ODOL (binarized), it requires de-binarization
      throw new Error('This P3D is binarized (ODOL). Please export as editable MLOD in DayZ Object Builder or use OBJ.');
    }

    const version = view.getUint32(4, true);
    let offset = 8;

    const pointCount = view.getUint32(offset, true);
    offset += 4;

    const positions: number[] = [];
    for (let i = 0; i < pointCount; i++) {
      const x = view.getFloat32(offset, true);
      const y = view.getFloat32(offset + 4, true);
      const z = view.getFloat32(offset + 8, true);
      offset += 12;
      positions.push(x, y, z);
    }

    const faceCount = view.getUint32(offset, true);
    offset += 4;

    const indices: number[] = [];
    for (let i = 0; i < faceCount; i++) {
      // 4 points per face in MLOD (quads or tris with fourth vertex as duplicate or 0)
      const v0 = view.getUint32(offset, true);
      const v1 = view.getUint32(offset + 4, true);
      const v2 = view.getUint32(offset + 8, true);
      const v3 = view.getUint32(offset + 12, true);
      offset += 16;

      // Skip flags and texture string
      offset += 4; // flags
      let char = view.getUint8(offset++);
      while (char !== 0 && offset < buffer.byteLength) {
        char = view.getUint8(offset++);
      }
      // Material string
      char = view.getUint8(offset++);
      while (char !== 0 && offset < buffer.byteLength) {
        char = view.getUint8(offset++);
      }

      indices.push(v0, v1, v2);
      if (v3 !== v2 && v3 !== v0) {
        indices.push(v0, v2, v3);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    return geometry;
  }

  /**
   * Load texture image file (supports PNG, JPG, WebP, and DayZ PAA!)
   */
  public static async loadTextureFile(file: File): Promise<ImageData> {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const buffer = await file.arrayBuffer();

    if (ext === 'paa') {
      const result = PAAParser.decode(buffer);
      const canvas = document.createElement('canvas');
      canvas.width = result.width;
      canvas.height = result.height;
      const ctx = canvas.getContext('2d')!;
      const imgData = ctx.createImageData(result.width, result.height);
      imgData.data.set(result.data);
      return imgData;
    } else {
      // Standard browser image (PNG, JPG, WebP)
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0);
          const data = ctx.getImageData(0, 0, img.width, img.height);
          URL.revokeObjectURL(url);
          resolve(data);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Failed to load image file.'));
        };
        img.src = url;
      });
    }
  }
}
