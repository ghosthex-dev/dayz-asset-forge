import React, { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Navbar } from './components/Navbar';
import { Viewport3D } from './components/Viewport3D';
import { TextureEditor } from './components/TextureEditor';
import { Sidebar } from './components/Sidebar';
import { GameAssetBrowser, GameModelLoadData } from './components/GameAssetBrowser';
import {
  TransformData,
  DayZMemoryPoint,
  DayZNamedSelection,
  DayZModConfig,
  DayZRVMATConfig,
  DayZLODType,
} from './types';
import { DayZPresets, PresetAsset } from './utils/dayzPresets';
import { ModelLoader } from './utils/modelLoaders';
import { DayZExporter } from './utils/dayzExport';
import { PAAParser } from './utils/paaParser';
import { CheckCircle2, Sparkles } from 'lucide-react';

export const App: React.FC = () => {
  const [notification, setNotification] = useState<string | null>(null);
  // Active 3D Mesh
  const [mesh, setMesh] = useState<THREE.Mesh | null>(null);
  const [modelName, setModelName] = useState('Tactical Combat Knife');
  const [vertexCount, setVertexCount] = useState(0);
  const [triangleCount, setTriangleCount] = useState(0);

  // Active Textures & Canvases
  const [baseTexture, setBaseTexture] = useState<ImageData | null>(null);
  const [textureCanvas, setTextureCanvas] = useState<HTMLCanvasElement | null>(null);
  const [normalCanvas, setNormalCanvas] = useState<HTMLCanvasElement | null>(null);
  const [specularCanvas, setSpecularCanvas] = useState<HTMLCanvasElement | null>(null);

  // View & LOD state
  const [viewMode, setViewMode] = useState<'3d' | 'texture' | 'split'>('split');
  const [activeLOD, setActiveLOD] = useState<DayZLODType>('LOD 0');

  // Viewport Toggles
  const [wireframe, setWireframe] = useState(false);
  const [showNormals, setShowNormals] = useState(false);
  const [showMemoryPoints, setShowMemoryPoints] = useState(true);
  const [showGrid, setShowGrid] = useState(true);

  // Game Asset Browser Modal State
  const [isGameBrowserOpen, setIsGameBrowserOpen] = useState(false);

  // Transforms
  const [transform, setTransform] = useState<TransformData>({
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  });

  // DayZ Modding State
  const [memoryPoints, setMemoryPoints] = useState<DayZMemoryPoint[]>([]);
  const [namedSelections, setNamedSelections] = useState<DayZNamedSelection[]>([]);
  const [modConfig, setModConfig] = useState<DayZModConfig>({
    className: 'DZ_TacticalKnife',
    baseClass: 'CombatKnife',
    displayName: 'Tactical Field Knife',
    description: 'A rugged tactical knife suited for survival and close combat in Chernarus.',
    weight: 350,
    itemSize: [1, 2],
    category: 'Tool/Melee',
    modelPath: 'DZ\\weapons\\melee\\blade\\tactical_knife.p3d',
  });

  const [rvmatConfig, setRvmatConfig] = useState<DayZRVMATConfig>({
    ambient: [1, 1, 1, 1],
    diffuse: [1, 1, 1, 1],
    forcedDiffuse: [0, 0, 0, 0],
    emmisive: [0, 0, 0, 1],
    specular: [0.5, 0.5, 0.5, 1],
    specularPower: 30,
    stage1_nohq: 'dz\\gear\\my_item\\data\\item_nohq.paa',
    stage2_smdi: 'dz\\gear\\my_item\\data\\item_smdi.paa',
  });

  // Initialize with Knife Preset on initial load
  useEffect(() => {
    const knifePreset = DayZPresets.getPresets()[0];
    loadPreset(knifePreset);
  }, []);

  const loadPreset = (preset: PresetAsset) => {
    const geometry = preset.createGeometry();
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();

    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.6,
      metalness: 0.2,
      side: THREE.DoubleSide,
    });

    const newMesh = new THREE.Mesh(geometry, material);
    setMesh(newMesh);
    setModelName(preset.name);
    updateMeshStats(geometry);

    const tex = preset.createDefaultTexture();
    setBaseTexture(tex);

    setMemoryPoints(preset.memoryPoints);
    setNamedSelections(preset.namedSelections);
    setModConfig(preset.modConfig);
    setTransform({
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    });
  };

  const updateMeshStats = (geo: THREE.BufferGeometry) => {
    const pos = geo.attributes.position;
    const vCount = pos ? pos.count : 0;
    const tCount = geo.index ? geo.index.count / 3 : vCount / 3;
    setVertexCount(vCount);
    setTriangleCount(Math.round(tCount));
  };

  // Mesh modified by decimation, auto-center, ground floor, etc.
  const handleMeshModified = (newGeo: THREE.BufferGeometry) => {
    if (!mesh) return;
    mesh.geometry.dispose();
    mesh.geometry = newGeo;
    updateMeshStats(newGeo);
    setMesh(mesh.clone());
  };

  // Import Model File
  const handleImportModel = async (file: File) => {
    try {
      const result = await ModelLoader.loadModelFile(file);
      setMesh(result.mesh);
      setModelName(file.name.replace(/\.[^/.]+$/, ''));
      setVertexCount(result.vertexCount);
      setTriangleCount(result.triangleCount);
      setModConfig((prev) => ({
        ...prev,
        className: `DZ_${file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_')}`,
        displayName: file.name.replace(/\.[^/.]+$/, ''),
      }));
    } catch (err: any) {
      alert(`Error loading 3D model: ${err.message}`);
    }
  };

  // Import Texture File
  const handleImportTexture = async (file: File) => {
    try {
      const imgData = await ModelLoader.loadTextureFile(file);
      setBaseTexture(imgData);
    } catch (err: any) {
      alert(`Error loading texture: ${err.message}`);
    }
  };

  // Load extracted texture from DayZ Game Files
  const handleGameTextureLoaded = (imgData: ImageData, fileName: string) => {
    setBaseTexture(imgData);
    const baseName = fileName.split('\\').pop()?.replace(/\.[^/.]+$/, '') || 'Game Texture';
    setModelName(baseName);
  };

  // Load extracted model directly from DayZ Game Files (.p3d -> debinarized -> OBJ)
  const handleGameModelLoaded = async (data: GameModelLoadData) => {
    try {
      // 1. Parse Wavefront OBJ geometry generated from game P3D
      const loaded = ModelLoader.parseOBJText(data.obj);
      const newMesh = loaded.mesh;

      // Reset transforms
      setTransform({
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      });

      // 2. Load named selections from game model
      if (data.meta?.namedSelections && Array.isArray(data.meta.namedSelections)) {
        setNamedSelections(data.meta.namedSelections);
      }

      // 3. Load DayZ memory points from game model
      if (data.meta?.memoryPoints && Array.isArray(data.meta.memoryPoints)) {
        setMemoryPoints(data.meta.memoryPoints);
      }

      // 4. Update Mod Config with real game asset references
      const safeClassName = `DZ_${data.name.replace(/[^a-zA-Z0-9_]/g, '_')}`;
      setModConfig((prev) => ({
        ...prev,
        className: safeClassName,
        displayName: data.name,
        modelPath: `DZ\\${data.meta?.sourceFile || data.name + '.p3d'}`,
      }));

      setModelName(data.name);
      setVertexCount(loaded.vertexCount);
      setTriangleCount(loaded.triangleCount);

      // 5. Automatically fetch and apply companion DayZ texture if discovered
      if (data.primaryTextureUrl) {
        try {
          if (data.primaryTextureUrl.toLowerCase().includes('.png')) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            await new Promise<void>((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = (e) => reject(e);
              img.src = data.primaryTextureUrl!;
            });

            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            setBaseTexture(imgData);

            const threeTex = new THREE.CanvasTexture(canvas);
            threeTex.colorSpace = THREE.SRGBColorSpace;
            threeTex.flipY = false;
            (newMesh.material as THREE.MeshStandardMaterial).map = threeTex;
            (newMesh.material as THREE.MeshStandardMaterial).needsUpdate = true;
          } else {
            const texRes = await fetch(data.primaryTextureUrl);
            const texBuffer = await texRes.arrayBuffer();
            const decoded = PAAParser.decode(texBuffer);

            const canvas = document.createElement('canvas');
            canvas.width = decoded.width;
            canvas.height = decoded.height;
            const ctx = canvas.getContext('2d')!;
            const imgData = ctx.createImageData(decoded.width, decoded.height);
            imgData.data.set(decoded.data);
            ctx.putImageData(imgData, 0, 0);

            setBaseTexture(imgData);

            const threeTex = new THREE.CanvasTexture(canvas);
            threeTex.colorSpace = THREE.SRGBColorSpace;
            threeTex.flipY = false;
            (newMesh.material as THREE.MeshStandardMaterial).map = threeTex;
            (newMesh.material as THREE.MeshStandardMaterial).needsUpdate = true;
          }
        } catch (texErr) {
          console.warn('Could not auto-apply companion texture:', texErr);
        }
      }

      // Set active mesh in viewport
      setMesh(newMesh);

      const memCount = data.meta?.memoryPoints?.length || 0;
      const selCount = data.meta?.namedSelections?.length || 0;
      setNotification(`Loaded ${data.name} from DayZ files (${loaded.vertexCount.toLocaleString()} vertices, ${loaded.triangleCount.toLocaleString()} tris, ${selCount} selections, ${memCount} memory points)`);
      setTimeout(() => setNotification(null), 5000);
    } catch (err: any) {
      alert(`Failed to render game model: ${err.message}`);
    }
  };

  // Drag and drop general file
  const handleDropFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (['obj', 'stl', 'gltf', 'glb', 'p3d'].includes(ext || '')) {
      handleImportModel(file);
    } else if (['paa', 'png', 'jpg', 'jpeg', 'webp'].includes(ext || '')) {
      handleImportTexture(file);
    } else {
      alert(`File format .${ext} is not supported. Use OBJ, STL, GLTF, P3D, PAA, or PNG.`);
    }
  };

  // Quick Export Mod Bundle
  const handleExportBundle = () => {
    if (!mesh) return;

    // 1. Export OBJ model
    const objContent = DayZExporter.exportToOBJ(mesh, modConfig.className);
    DayZExporter.downloadFile(`${modConfig.className}.obj`, objContent);

    // 2. Export config.cpp
    const cppContent = DayZExporter.generateConfigCPP(modConfig, namedSelections, memoryPoints);
    DayZExporter.downloadFile(`config.cpp`, cppContent);

    // 3. Export model.cfg
    const modelCfgContent = DayZExporter.generateModelCFG(modConfig.className, namedSelections, memoryPoints);
    DayZExporter.downloadFile(`model.cfg`, modelCfgContent);

    // 4. Export RVMAT
    const rvmatContent = DayZExporter.generateRVMAT(rvmatConfig);
    DayZExporter.downloadFile(`${modConfig.className}.rvmat`, rvmatContent);

    // 5. Export PAA textures if available
    if (textureCanvas) {
      const ctx = textureCanvas.getContext('2d');
      if (ctx) {
        const data = ctx.getImageData(0, 0, textureCanvas.width, textureCanvas.height);
        DayZExporter.downloadTexture(data, `${modConfig.className}_co.paa`, true);
      }
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100">
      {/* Top Navbar */}
      <Navbar
        vertexCount={vertexCount}
        triangleCount={triangleCount}
        modelName={modelName}
        activeLOD={activeLOD}
        setActiveLOD={setActiveLOD}
        viewMode={viewMode}
        setViewMode={setViewMode}
        onExportBundle={handleExportBundle}
        onOpenGameFiles={() => setIsGameBrowserOpen(true)}
      />

      {/* Floating Notification Toast */}
      {notification && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 animate-in fade-in slide-in-from-top-2 duration-200 pointer-events-none">
          <div className="flex items-center space-x-2.5 px-4 py-2 bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 rounded-full shadow-2xl backdrop-blur-md text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{notification}</span>
          </div>
        </div>
      )}

      {/* Main Studio Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left / Center Workspaces depending on ViewMode */}
        <div className="flex flex-1 overflow-hidden">
          {/* 3D Viewport */}
          {(viewMode === '3d' || viewMode === 'split') && (
            <div className={`h-full ${viewMode === 'split' ? 'w-1/2 border-r border-zinc-800' : 'w-full'}`}>
              <Viewport3D
                mesh={mesh}
                textureCanvas={textureCanvas}
                normalCanvas={normalCanvas}
                specularCanvas={specularCanvas}
                memoryPoints={memoryPoints}
                wireframe={wireframe}
                setWireframe={setWireframe}
                showNormals={showNormals}
                setShowNormals={setShowNormals}
                showMemoryPoints={showMemoryPoints}
                setShowMemoryPoints={setShowMemoryPoints}
                showGrid={showGrid}
                setShowGrid={setShowGrid}
                transform={transform}
                onDropFile={handleDropFile}
              />
            </div>
          )}

          {/* 2D Texture Studio */}
          {(viewMode === 'texture' || viewMode === 'split') && (
            <div className={`h-full ${viewMode === 'split' ? 'w-1/2' : 'w-full'}`}>
              <TextureEditor
                baseTexture={baseTexture}
                mesh={mesh}
                onTextureUpdate={setTextureCanvas}
                onNormalUpdate={setNormalCanvas}
                onSpecularUpdate={setSpecularCanvas}
              />
            </div>
          )}
        </div>

        {/* Right Tool Sidebar */}
        <Sidebar
          mesh={mesh}
          transform={transform}
          setTransform={setTransform}
          memoryPoints={memoryPoints}
          setMemoryPoints={setMemoryPoints}
          namedSelections={namedSelections}
          setNamedSelections={setNamedSelections}
          modConfig={modConfig}
          setModConfig={setModConfig}
          rvmatConfig={rvmatConfig}
          setRvmatConfig={setRvmatConfig}
          onLoadPreset={loadPreset}
          onImportModelFile={handleImportModel}
          onImportTextureFile={handleImportTexture}
          onMeshModified={handleMeshModified}
          onOpenGameFiles={() => setIsGameBrowserOpen(true)}
        />
      </div>

      {/* DayZ Game Files Browser Modal */}
      <GameAssetBrowser
        isOpen={isGameBrowserOpen}
        onClose={() => setIsGameBrowserOpen(false)}
        onLoadTexture={handleGameTextureLoaded}
        onLoadModel={handleGameModelLoaded}
      />
    </div>
  );
};
