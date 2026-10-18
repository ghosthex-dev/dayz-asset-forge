import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DayZMemoryPoint, TransformData } from '../types';
import { Sun, CloudRain, Sunset, Flashlight, Grid, Maximize, Eye, Compass, Focus } from 'lucide-react';

interface Viewport3DProps {
  mesh: THREE.Mesh | null;
  textureCanvas: HTMLCanvasElement | null;
  normalCanvas: HTMLCanvasElement | null;
  specularCanvas: HTMLCanvasElement | null;
  memoryPoints: DayZMemoryPoint[];
  wireframe: boolean;
  setWireframe: (val: boolean) => void;
  showNormals: boolean;
  setShowNormals: (val: boolean) => void;
  showMemoryPoints: boolean;
  setShowMemoryPoints: (val: boolean) => void;
  showGrid: boolean;
  setShowGrid: (val: boolean) => void;
  transform: TransformData;
  onDropFile: (file: File) => void;
}

export type LightingPreset = 'chernarus_noon' | 'overcast' | 'dusk' | 'night_flashlight';

export const Viewport3D: React.FC<Viewport3DProps> = ({
  mesh,
  textureCanvas,
  normalCanvas,
  specularCanvas,
  memoryPoints,
  wireframe,
  setWireframe,
  showNormals,
  setShowNormals,
  showMemoryPoints,
  setShowMemoryPoints,
  showGrid,
  setShowGrid,
  transform,
  onDropFile,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const lightsRef = useRef<{
    ambient: THREE.AmbientLight;
    dir: THREE.DirectionalLight;
    hemi: THREE.HemisphereLight;
    flashlight?: THREE.SpotLight;
  } | null>(null);

  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const memoryMarkersRef = useRef<THREE.Group>(new THREE.Group());

  const [lighting, setLighting] = useState<LightingPreset>('chernarus_noon');
  const [isDragging, setIsDragging] = useState(false);

  // Helper to frame the camera to fit any mesh
  const fitCamera = (targetMesh: THREE.Mesh, cam: THREE.PerspectiveCamera, ctrl: OrbitControls) => {
    targetMesh.geometry.computeBoundingBox();
    targetMesh.geometry.computeBoundingSphere();
    const bbox = targetMesh.geometry.boundingBox;
    const bsphere = targetMesh.geometry.boundingSphere;
    if (!bbox || !bsphere) return;

    const center = new THREE.Vector3();
    bbox.getCenter(center);
    const size = new THREE.Vector3();
    bbox.getSize(size);

    const maxDim = Math.max(size.x, size.y, size.z, 0.1);
    const dist = maxDim * 2.5;

    cam.position.set(center.x + dist * 0.7, center.y + dist * 0.5, center.z + dist * 0.9);
    ctrl.target.copy(center);
    cam.lookAt(center);
    ctrl.update();
  };

  // Initialize Three.js scene once
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x13151a);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.005, 1000);
    camera.position.set(0.4, 0.3, 0.5);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;
    controls.minDistance = 0.01;
    controls.maxDistance = 100;
    controlsRef.current = controls;

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    const dir = new THREE.DirectionalLight(0xfffaed, 2.5);
    dir.position.set(5, 10, 7);
    dir.castShadow = true;

    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x3d3d3d, 0.6);

    const flashlight = new THREE.SpotLight(0xffffff, 0, 25, Math.PI / 6, 0.3);
    const flashlightTarget = new THREE.Object3D();
    flashlightTarget.position.set(0, 0, -5);
    camera.add(flashlightTarget);
    camera.add(flashlight);
    flashlight.position.set(0, 0, 0);
    flashlight.target = flashlightTarget;

    scene.add(ambient, dir, hemi, camera);
    lightsRef.current = { ambient, dir, hemi, flashlight };

    // Grid Floor
    const gridHelper = new THREE.GridHelper(5, 50, 0x10b981, 0x27272a);
    gridHelper.position.y = -0.001;
    scene.add(gridHelper);
    gridHelperRef.current = gridHelper;

    // Memory points group
    scene.add(memoryMarkersRef.current);

    // If mesh already exists on mount, add it immediately!
    if (mesh) {
      mesh.name = 'ACTIVE_USER_MESH';
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      fitCamera(mesh, camera, controls);
    }

    // Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // ResizeObserver for reliable resizing inside flex containers
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0 && camera && renderer) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Manage Active Mesh in Scene whenever mesh changes
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    const oldMesh = scene.getObjectByName('ACTIVE_USER_MESH');
    if (oldMesh && oldMesh !== mesh) {
      scene.remove(oldMesh);
    }

    if (mesh) {
      mesh.name = 'ACTIVE_USER_MESH';
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (!scene.getObjectByName('ACTIVE_USER_MESH')) {
        scene.add(mesh);
      }

      if (cameraRef.current && controlsRef.current) {
        fitCamera(mesh, cameraRef.current, controlsRef.current);
      }
    }
  }, [mesh]);

  // Update Environment Lighting
  useEffect(() => {
    if (!lightsRef.current || !sceneRef.current) return;
    const { ambient, dir, hemi, flashlight } = lightsRef.current;

    switch (lighting) {
      case 'chernarus_noon':
        sceneRef.current.background = new THREE.Color(0x13151a);
        ambient.color.setHex(0xffffff);
        ambient.intensity = 0.9;
        dir.color.setHex(0xfff7e6);
        dir.intensity = 2.5;
        dir.position.set(5, 10, 7);
        hemi.intensity = 0.6;
        if (flashlight) flashlight.intensity = 0;
        break;

      case 'overcast':
        sceneRef.current.background = new THREE.Color(0x181a1f);
        ambient.color.setHex(0xb0c4de);
        ambient.intensity = 1.4;
        dir.color.setHex(0xcfd8dc);
        dir.intensity = 1.0;
        hemi.intensity = 0.9;
        if (flashlight) flashlight.intensity = 0;
        break;

      case 'dusk':
        sceneRef.current.background = new THREE.Color(0x181014);
        ambient.color.setHex(0xffaa77);
        ambient.intensity = 0.7;
        dir.color.setHex(0xff6f3c);
        dir.intensity = 3.0;
        dir.position.set(8, 2, 4);
        hemi.intensity = 0.4;
        if (flashlight) flashlight.intensity = 0;
        break;

      case 'night_flashlight':
        sceneRef.current.background = new THREE.Color(0x060709);
        ambient.intensity = 0.08;
        dir.intensity = 0.05;
        hemi.intensity = 0.05;
        if (flashlight) flashlight.intensity = 5.0;
        break;
    }
  }, [lighting]);

  // Update Grid
  useEffect(() => {
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = showGrid;
    }
  }, [showGrid]);

  // Update Mesh Transforms
  useEffect(() => {
    if (!mesh) return;
    mesh.position.set(...transform.position);
    mesh.rotation.set(
      (transform.rotation[0] * Math.PI) / 180,
      (transform.rotation[1] * Math.PI) / 180,
      (transform.rotation[2] * Math.PI) / 180
    );
    mesh.scale.set(...transform.scale);
  }, [mesh, transform]);

  // Update Material (Textures + Wireframe)
  useEffect(() => {
    if (!mesh) return;

    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (!mat) return;

    mat.wireframe = wireframe;

    // Diffuse map from 2D Canvas
    if (textureCanvas) {
      const tex = new THREE.CanvasTexture(textureCanvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.needsUpdate = true;
      mat.map = tex;
      mat.needsUpdate = true;
    }

    // Normal map
    if (normalCanvas) {
      const normTex = new THREE.CanvasTexture(normalCanvas);
      normTex.wrapS = THREE.RepeatWrapping;
      normTex.wrapT = THREE.RepeatWrapping;
      normTex.needsUpdate = true;
      mat.normalMap = normTex;
      mat.normalScale = new THREE.Vector2(1, 1);
      mat.needsUpdate = true;
    }

    // Roughness/Specular
    if (specularCanvas) {
      const specTex = new THREE.CanvasTexture(specularCanvas);
      specTex.wrapS = THREE.RepeatWrapping;
      specTex.wrapT = THREE.RepeatWrapping;
      specTex.needsUpdate = true;
      mat.roughnessMap = specTex;
      mat.needsUpdate = true;
    }
  }, [mesh, textureCanvas, normalCanvas, specularCanvas, wireframe]);

  // Update Memory Points Markers
  useEffect(() => {
    const group = memoryMarkersRef.current;
    group.clear();

    if (!showMemoryPoints || memoryPoints.length === 0) return;

    const isDense = memoryPoints.length > 10;
    const sphereGeo = new THREE.SphereGeometry(isDense ? 0.005 : 0.008, 16, 16);

    memoryPoints.forEach((pt, index) => {
      const color = pt.color || '#10b981';
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color) });
      const sphere = new THREE.Mesh(sphereGeo, mat);
      sphere.position.set(...pt.position);
      group.add(sphere);

      // On dense models (e.g. 40+ component points), only show labels for primary named points
      const isImportant =
        !isDense ||
        pt.name.includes('center') ||
        pt.name.includes('view') ||
        pt.name.includes('radius') ||
        pt.name.includes('barrel') ||
        pt.name.includes('action') ||
        pt.name.includes('muzzle') ||
        index < 6;

      if (isImportant) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 48;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.roundRect ? ctx.roundRect(0, 0, 256, 48, 8) : ctx.fillRect(0, 0, 256, 48);
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = 3;
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 20px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(pt.name, 128, 30);

          const labelTex = new THREE.CanvasTexture(canvas);
          const spriteMat = new THREE.SpriteMaterial({ map: labelTex, depthTest: false });
          const sprite = new THREE.Sprite(spriteMat);
          sprite.position.set(pt.position[0], pt.position[1] + 0.025, pt.position[2]);
          sprite.scale.set(0.06, 0.015, 1);

          group.add(sprite);
        }
      }
    });
  }, [memoryPoints, showMemoryPoints]);

  // Camera preset views
  const setCameraView = (view: 'front' | 'side' | 'top' | 'iso') => {
    if (!cameraRef.current || !controlsRef.current || !mesh) return;
    const center = new THREE.Vector3(0, 0, 0);
    mesh.geometry.computeBoundingBox();
    if (mesh.geometry.boundingBox) {
      mesh.geometry.boundingBox.getCenter(center);
    }

    const dist = 0.8;
    controlsRef.current.target.copy(center);

    switch (view) {
      case 'front':
        cameraRef.current.position.set(center.x, center.y, center.z + dist);
        break;
      case 'side':
        cameraRef.current.position.set(center.x + dist, center.y, center.z);
        break;
      case 'top':
        cameraRef.current.position.set(center.x, center.y + dist, center.z + 0.001);
        break;
      case 'iso':
        cameraRef.current.position.set(center.x + dist * 0.7, center.y + dist * 0.5, center.z + dist * 0.9);
        break;
    }
    controlsRef.current.update();
  };

  const handleCenterView = () => {
    if (mesh && cameraRef.current && controlsRef.current) {
      fitCamera(mesh, cameraRef.current, controlsRef.current);
    }
  };

  return (
    <div
      className={`relative w-full h-full flex flex-col bg-zinc-950 overflow-hidden ${
        isDragging ? 'ring-2 ring-emerald-500' : ''
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          onDropFile(e.dataTransfer.files[0]);
        }
      }}
    >
      {/* 3D WebGL Canvas */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Drag & drop overlay indicator */}
      {isDragging && (
        <div className="absolute inset-0 bg-emerald-950/60 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none z-50">
          <div className="p-4 rounded-xl bg-zinc-900 border border-emerald-500 shadow-2xl flex flex-col items-center">
            <Maximize className="w-10 h-10 text-emerald-400 animate-pulse mb-2" />
            <span className="text-zinc-100 font-bold text-sm">Drop 3D Model or Texture</span>
            <span className="text-xs text-zinc-400 mt-1">Accepts .obj, .stl, .gltf, .p3d, .paa, .png</span>
          </div>
        </div>
      )}

      {/* Top Floating Controls: Lighting & Camera Presets */}
      <div className="absolute top-3 left-3 flex items-center space-x-2 z-10">
        {/* Lighting Switcher */}
        <div className="flex items-center bg-zinc-900/90 backdrop-blur-md p-1 rounded-lg border border-zinc-800 shadow-lg">
          <button
            onClick={() => setLighting('chernarus_noon')}
            className={`p-1.5 rounded transition-colors ${
              lighting === 'chernarus_noon' ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Chernarus Sun (High Noon)"
          >
            <Sun className="w-4 h-4" />
          </button>
          <button
            onClick={() => setLighting('overcast')}
            className={`p-1.5 rounded transition-colors ${
              lighting === 'overcast' ? 'bg-blue-500/20 text-blue-400' : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Overcast / Rainy Weather"
          >
            <CloudRain className="w-4 h-4" />
          </button>
          <button
            onClick={() => setLighting('dusk')}
            className={`p-1.5 rounded transition-colors ${
              lighting === 'dusk' ? 'bg-orange-500/20 text-orange-400' : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Dusk / Golden Hour"
          >
            <Sunset className="w-4 h-4" />
          </button>
          <button
            onClick={() => setLighting('night_flashlight')}
            className={`p-1.5 rounded transition-colors ${
              lighting === 'night_flashlight' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Night with Flashlight"
          >
            <Flashlight className="w-4 h-4" />
          </button>
        </div>

        {/* Camera Views */}
        <div className="flex items-center bg-zinc-900/90 backdrop-blur-md p-1 rounded-lg border border-zinc-800 shadow-lg text-xs font-medium">
          <button
            onClick={handleCenterView}
            className="p-1.5 text-emerald-400 hover:text-emerald-300 rounded hover:bg-zinc-800"
            title="Focus / Frame Model"
          >
            <Focus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setCameraView('iso')}
            className="px-2 py-1 text-zinc-400 hover:text-zinc-100 rounded hover:bg-zinc-800"
          >
            Iso
          </button>
          <button
            onClick={() => setCameraView('front')}
            className="px-2 py-1 text-zinc-400 hover:text-zinc-100 rounded hover:bg-zinc-800"
          >
            Front
          </button>
          <button
            onClick={() => setCameraView('side')}
            className="px-2 py-1 text-zinc-400 hover:text-zinc-100 rounded hover:bg-zinc-800"
          >
            Side
          </button>
          <button
            onClick={() => setCameraView('top')}
            className="px-2 py-1 text-zinc-400 hover:text-zinc-100 rounded hover:bg-zinc-800"
          >
            Top
          </button>
        </div>
      </div>

      {/* Top Right Floating Controls: Toggles */}
      <div className="absolute top-3 right-3 flex items-center space-x-1.5 bg-zinc-900/90 backdrop-blur-md p-1 rounded-lg border border-zinc-800 shadow-lg z-10">
        <button
          onClick={() => setWireframe(!wireframe)}
          className={`p-1.5 rounded text-xs flex items-center space-x-1 transition-colors ${
            wireframe ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
          }`}
          title="Toggle Wireframe"
        >
          <Grid className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Wire</span>
        </button>
        <button
          onClick={() => setShowMemoryPoints(!showMemoryPoints)}
          className={`p-1.5 rounded text-xs flex items-center space-x-1 transition-colors ${
            showMemoryPoints ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
          }`}
          title="Toggle Memory Points (Pins)"
        >
          <Eye className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Memory</span>
        </button>
        <button
          onClick={() => setShowGrid(!showGrid)}
          className={`p-1.5 rounded text-xs flex items-center space-x-1 transition-colors ${
            showGrid ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
          }`}
          title="Toggle Floor Grid"
        >
          <Compass className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Floor</span>
        </button>
      </div>

      {/* Bottom Hint */}
      <div className="absolute bottom-3 left-3 text-[11px] text-zinc-500 bg-zinc-950/80 px-2.5 py-1 rounded-md border border-zinc-900 pointer-events-none">
        Left-click + drag to orbit • Right-click to pan • Scroll to zoom • Drag & drop models or textures directly
      </div>
    </div>
  );
};
