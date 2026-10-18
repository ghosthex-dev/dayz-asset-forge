import * as THREE from 'three';

export class MeshModifiers {
  /**
   * Center the mesh so its geometric center is at (0, 0, 0)
   */
  public static autoCenter(mesh: THREE.Mesh): void {
    const geometry = mesh.geometry;
    geometry.computeBoundingBox();
    if (!geometry.boundingBox) return;

    const center = new THREE.Vector3();
    geometry.boundingBox.getCenter(center);
    geometry.translate(-center.x, -center.y, -center.z);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }

  /**
   * Ground the mesh so the bottom touches Y = 0
   */
  public static groundToFloor(mesh: THREE.Mesh): void {
    const geometry = mesh.geometry;
    geometry.computeBoundingBox();
    if (!geometry.boundingBox) return;

    const minY = geometry.boundingBox.min.y;
    geometry.translate(0, -minY, 0);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }

  /**
   * Swap coordinate axes between Y-up and Z-up (DayZ uses Y-up)
   */
  public static swapYZ(mesh: THREE.Mesh): void {
    const geometry = mesh.geometry;
    const pos = geometry.attributes.position;
    if (!pos) return;

    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const z = pos.getZ(i);
      pos.setY(i, z);
      pos.setZ(i, -y);
    }
    pos.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }

  /**
   * Scale mesh vertices by a factor
   */
  public static scaleGeometry(mesh: THREE.Mesh, factor: number): void {
    mesh.geometry.scale(factor, factor, factor);
    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeBoundingSphere();
  }

  /**
   * Flip/invert all normals on the mesh
   */
  public static flipNormals(mesh: THREE.Mesh): void {
    const geometry = mesh.geometry;
    const normals = geometry.attributes.normal;
    if (!normals) return;

    for (let i = 0; i < normals.count; i++) {
      normals.setXYZ(i, -normals.getX(i), -normals.getY(i), -normals.getZ(i));
    }
    normals.needsUpdate = true;

    // Also invert winding order if indexed
    if (geometry.index) {
      const indices = geometry.index.array;
      for (let i = 0; i < indices.length; i += 3) {
        const tmp = indices[i];
        indices[i] = indices[i + 1];
        indices[i + 1] = tmp;
      }
      geometry.index.needsUpdate = true;
    }
  }

  /**
   * Recalculate smooth normals
   */
  public static recalculateNormals(mesh: THREE.Mesh): void {
    mesh.geometry.computeVertexNormals();
  }

  /**
   * Generate a simplified low-poly mesh for DayZ LODs (LOD 1, LOD 2, or Geometry collision hull)
   * Uses vertex-clustering decimation algorithm.
   */
  public static decimate(geometry: THREE.BufferGeometry, targetRatio: number): THREE.BufferGeometry {
    // If geometry is non-indexed, convert to indexed
    let indexedGeo = geometry.index ? geometry : geometry.clone();
    const pos = indexedGeo.attributes.position;
    if (!pos) return geometry.clone();

    indexedGeo.computeBoundingBox();
    const bbox = indexedGeo.boundingBox!;
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);

    // Compute grid resolution based on target ratio
    const currentTriangles = (indexedGeo.index ? indexedGeo.index.count : pos.count) / 3;
    const targetTriangles = Math.max(12, Math.floor(currentTriangles * targetRatio));

    // Dynamic grid divisions
    const divisions = Math.max(8, Math.min(128, Math.round(Math.cbrt(targetTriangles * 2))));
    const cellSize = maxDim / divisions;

    const grid = new Map<string, { x: number; y: number; z: number; count: number; newIndex: number }>();
    const vertexMap = new Int32Array(pos.count);
    const newPositions: number[] = [];
    let uniqueCount = 0;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);

      const gx = Math.floor((x - bbox.min.x) / cellSize);
      const gy = Math.floor((y - bbox.min.y) / cellSize);
      const gz = Math.floor((z - bbox.min.z) / cellSize);
      const key = `${gx}_${gy}_${gz}`;

      let cell = grid.get(key);
      if (!cell) {
        cell = { x: 0, y: 0, z: 0, count: 0, newIndex: uniqueCount++ };
        grid.set(key, cell);
      }
      cell.x += x;
      cell.y += y;
      cell.z += z;
      cell.count++;
      vertexMap[i] = cell.newIndex;
    }

    // Build unique vertices
    const sortedCells = Array.from(grid.values()).sort((a, b) => a.newIndex - b.newIndex);
    for (const c of sortedCells) {
      newPositions.push(c.x / c.count, c.y / c.count, c.z / c.count);
    }

    // Build new triangles, discarding degenerate ones
    const newIndices: number[] = [];
    const origIndices = indexedGeo.index ? indexedGeo.index.array : null;
    const triCount = origIndices ? origIndices.length / 3 : pos.count / 3;

    for (let i = 0; i < triCount; i++) {
      const i0 = origIndices ? origIndices[i * 3] : i * 3;
      const i1 = origIndices ? origIndices[i * 3 + 1] : i * 3 + 1;
      const i2 = origIndices ? origIndices[i * 3 + 2] : i * 3 + 2;

      const v0 = vertexMap[i0];
      const v1 = vertexMap[i1];
      const v2 = vertexMap[i2];

      // Discard collapsed triangles where 2 or more vertices merged
      if (v0 !== v1 && v1 !== v2 && v0 !== v2) {
        newIndices.push(v0, v1, v2);
      }
    }

    const simplified = new THREE.BufferGeometry();
    simplified.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
    simplified.setIndex(newIndices);
    simplified.computeVertexNormals();
    simplified.computeBoundingBox();
    simplified.computeBoundingSphere();

    return simplified;
  }

  /**
   * Generate DayZ Box Collision Geometry (Geometry LOD)
   */
  public static createBoxCollisionLOD(mesh: THREE.Mesh): THREE.BufferGeometry {
    mesh.geometry.computeBoundingBox();
    const bbox = mesh.geometry.boundingBox!;
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const center = new THREE.Vector3();
    bbox.getCenter(center);

    const boxGeo = new THREE.BoxGeometry(size.x, size.y, size.z);
    boxGeo.translate(center.x, center.y, center.z);
    return boxGeo;
  }
}
