import React, { useState } from 'react';
import * as THREE from 'three';
import {
  FolderOpen,
  Wrench,
  Tag,
  FileCode,
  Download,
  Upload,
  RefreshCw,
  Compass,
  Maximize2,
  Minimize2,
  Trash2,
  Plus,
  Copy,
  Check,
  Package,
  Layers,
  ChevronRight,
} from 'lucide-react';
import {
  TransformData,
  DayZMemoryPoint,
  DayZNamedSelection,
  DayZModConfig,
  DayZRVMATConfig,
  DayZLODType,
} from '../types';
import { DayZPresets, PresetAsset } from '../utils/dayzPresets';
import { MeshModifiers } from '../utils/meshModifiers';
import { DayZExporter } from '../utils/dayzExport';

interface SidebarProps {
  mesh: THREE.Mesh | null;
  transform: TransformData;
  setTransform: React.Dispatch<React.SetStateAction<TransformData>>;
  memoryPoints: DayZMemoryPoint[];
  setMemoryPoints: React.Dispatch<React.SetStateAction<DayZMemoryPoint[]>>;
  namedSelections: DayZNamedSelection[];
  setNamedSelections: React.Dispatch<React.SetStateAction<DayZNamedSelection[]>>;
  modConfig: DayZModConfig;
  setModConfig: React.Dispatch<React.SetStateAction<DayZModConfig>>;
  rvmatConfig: DayZRVMATConfig;
  setRvmatConfig: React.Dispatch<React.SetStateAction<DayZRVMATConfig>>;
  onLoadPreset: (preset: PresetAsset) => void;
  onImportModelFile: (file: File) => void;
  onImportTextureFile: (file: File) => void;
  onMeshModified: (newGeo: THREE.BufferGeometry) => void;
  onOpenGameFiles: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  mesh,
  transform,
  setTransform,
  memoryPoints,
  setMemoryPoints,
  namedSelections,
  setNamedSelections,
  modConfig,
  setModConfig,
  rvmatConfig,
  setRvmatConfig,
  onLoadPreset,
  onImportModelFile,
  onImportTextureFile,
  onMeshModified,
  onOpenGameFiles,
}) => {
  const [activeTab, setActiveTab] = useState<'files' | 'mesh' | 'dayz' | 'config'>('files');
  const [copied, setCopied] = useState(false);

  // New Memory Point Form State
  const [newPointName, setNewPointName] = useState('ce_ground');
  const [newSelectionName, setNewSelectionName] = useState('camo');

  const presets = DayZPresets.getPresets();

  // Mesh modifier triggers
  const handleAutoCenter = () => {
    if (!mesh) return;
    MeshModifiers.autoCenter(mesh);
    onMeshModified(mesh.geometry);
  };

  const handleGroundToFloor = () => {
    if (!mesh) return;
    MeshModifiers.groundToFloor(mesh);
    onMeshModified(mesh.geometry);
  };

  const handleSwapYZ = () => {
    if (!mesh) return;
    MeshModifiers.swapYZ(mesh);
    onMeshModified(mesh.geometry);
  };

  const handleFlipNormals = () => {
    if (!mesh) return;
    MeshModifiers.flipNormals(mesh);
    onMeshModified(mesh.geometry);
  };

  const handleRecalculateNormals = () => {
    if (!mesh) return;
    MeshModifiers.recalculateNormals(mesh);
    onMeshModified(mesh.geometry);
  };

  const handleDecimate = (ratio: number) => {
    if (!mesh) return;
    const simplified = MeshModifiers.decimate(mesh.geometry, ratio);
    onMeshModified(simplified);
  };

  const handleCreateCollisionBox = () => {
    if (!mesh) return;
    const box = MeshModifiers.createBoxCollisionLOD(mesh);
    onMeshModified(box);
  };

  // Add memory point
  const handleAddMemoryPoint = () => {
    if (!newPointName.trim()) return;
    const newPt: DayZMemoryPoint = {
      id: Date.now().toString(),
      name: newPointName.trim(),
      position: [0, 0, 0],
      color: '#eab308',
      description: 'Custom DayZ Memory Point',
    };
    setMemoryPoints([...memoryPoints, newPt]);
    setNewPointName('');
  };

  const handleRemoveMemoryPoint = (id: string) => {
    setMemoryPoints(memoryPoints.filter((p) => p.id !== id));
  };

  // Add named selection
  const handleAddSelection = () => {
    if (!newSelectionName.trim()) return;
    const newSel: DayZNamedSelection = {
      id: Date.now().toString(),
      name: newSelectionName.trim(),
      materialSlot: `${newSelectionName.trim()}.rvmat`,
      color: '#10b981',
    };
    setNamedSelections([...namedSelections, newSel]);
    setNewSelectionName('');
  };

  const handleRemoveSelection = (id: string) => {
    setNamedSelections(namedSelections.filter((s) => s.id !== id));
  };

  // Copy Config CPP
  const handleCopyConfig = () => {
    const code = DayZExporter.generateConfigCPP(modConfig, namedSelections, memoryPoints);
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-80 h-full bg-zinc-900 border-l border-zinc-800 flex flex-col select-none">
      {/* Sidebar Tabs */}
      <div className="flex bg-zinc-950 border-b border-zinc-800 text-xs font-medium">
        <button
          onClick={() => setActiveTab('files')}
          className={`flex-1 py-3 text-center transition-colors border-b-2 flex items-center justify-center space-x-1 ${
            activeTab === 'files'
              ? 'border-emerald-500 text-emerald-400 bg-zinc-900/50'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
          title="Import / Export & Presets"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>Assets</span>
        </button>
        <button
          onClick={() => setActiveTab('mesh')}
          className={`flex-1 py-3 text-center transition-colors border-b-2 flex items-center justify-center space-x-1 ${
            activeTab === 'mesh'
              ? 'border-emerald-500 text-emerald-400 bg-zinc-900/50'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
          title="Transform & Mesh Tools"
        >
          <Wrench className="w-3.5 h-3.5" />
          <span>Mesh</span>
        </button>
        <button
          onClick={() => setActiveTab('dayz')}
          className={`flex-1 py-3 text-center transition-colors border-b-2 flex items-center justify-center space-x-1 ${
            activeTab === 'dayz'
              ? 'border-emerald-500 text-emerald-400 bg-zinc-900/50'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
          title="Named Selections & Memory Points"
        >
          <Tag className="w-3.5 h-3.5" />
          <span>DayZ</span>
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`flex-1 py-3 text-center transition-colors border-b-2 flex items-center justify-center space-x-1 ${
            activeTab === 'config'
              ? 'border-emerald-500 text-emerald-400 bg-zinc-900/50'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
          title="PBO Config.cpp & RVMAT"
        >
          <FileCode className="w-3.5 h-3.5" />
          <span>Config</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs text-zinc-300">
        {/* =======================================================
            TAB 1: ASSETS & FILES & PRESETS
            ======================================================= */}
        {activeTab === 'files' && (
          <div className="space-y-5">
            {/* Direct Game Files Button */}
            <button
              onClick={onOpenGameFiles}
              className="w-full p-3 rounded-xl bg-gradient-to-r from-emerald-950/60 to-zinc-900 border border-emerald-500/40 hover:border-emerald-500 transition-all flex items-center justify-between text-left group shadow-lg shadow-emerald-950/20"
            >
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-xs text-zinc-100 group-hover:text-emerald-400 transition-colors">
                    Browse DayZ Game Files
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    Pull models & textures straight from PBOs
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* Import Section */}
            <div>
              <span className="text-zinc-400 uppercase font-semibold text-[10px] tracking-wider block mb-2">
                Import Local Files
              </span>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col items-center justify-center p-3 rounded-lg border border-dashed border-zinc-700 hover:border-emerald-500 hover:bg-zinc-800/50 cursor-pointer transition-all">
                  <Upload className="w-5 h-5 text-emerald-400 mb-1" />
                  <span className="font-medium text-zinc-200 text-center">Load 3D Model</span>
                  <span className="text-[10px] text-zinc-500">.obj, .stl, .p3d</span>
                  <input
                    type="file"
                    accept=".obj,.stl,.gltf,.glb,.p3d"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        onImportModelFile(e.target.files[0]);
                      }
                    }}
                  />
                </label>

                <label className="flex flex-col items-center justify-center p-3 rounded-lg border border-dashed border-zinc-700 hover:border-emerald-500 hover:bg-zinc-800/50 cursor-pointer transition-all">
                  <Upload className="w-5 h-5 text-blue-400 mb-1" />
                  <span className="font-medium text-zinc-200 text-center">Load Texture</span>
                  <span className="text-[10px] text-zinc-500">.paa, .png, .jpg</span>
                  <input
                    type="file"
                    accept=".paa,.png,.jpg,.jpeg,.webp"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        onImportTextureFile(e.target.files[0]);
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            {/* Presets */}
            <div>
              <span className="text-zinc-400 uppercase font-semibold text-[10px] tracking-wider block mb-2">
                DayZ Ready Templates
              </span>
              <div className="space-y-1.5">
                {presets.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => onLoadPreset(preset)}
                    className="w-full text-left p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800 hover:border-emerald-500/50 hover:bg-zinc-800/40 transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-200 group-hover:text-emerald-400">
                        {preset.name}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-zinc-800 text-zinc-400 font-mono">
                        {preset.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-1">
                      {preset.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Export Section */}
            <div>
              <span className="text-zinc-400 uppercase font-semibold text-[10px] tracking-wider block mb-2">
                Export Assets
              </span>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    if (!mesh) return;
                    const obj = DayZExporter.exportToOBJ(mesh, modConfig.className);
                    DayZExporter.downloadFile(`${modConfig.className}.obj`, obj);
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                >
                  <span className="font-medium">Export Model (.OBJ)</span>
                  <Download className="w-3.5 h-3.5 text-zinc-400" />
                </button>
                <button
                  onClick={() => {
                    const rvmat = DayZExporter.generateRVMAT(rvmatConfig);
                    DayZExporter.downloadFile(`${modConfig.className}.rvmat`, rvmat);
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                >
                  <span className="font-medium">Export Material (.RVMAT)</span>
                  <Download className="w-3.5 h-3.5 text-purple-400" />
                </button>
                <button
                  onClick={() => {
                    const cfg = DayZExporter.generateConfigCPP(modConfig, namedSelections, memoryPoints);
                    DayZExporter.downloadFile(`config.cpp`, cfg);
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                >
                  <span className="font-medium">Export Config (.CPP)</span>
                  <Download className="w-3.5 h-3.5 text-blue-400" />
                </button>
                <button
                  onClick={() => {
                    const modelCfg = DayZExporter.generateModelCFG(modConfig.className, namedSelections, memoryPoints);
                    DayZExporter.downloadFile(`model.cfg`, modelCfg);
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                >
                  <span className="font-medium">Export Model Config (.CFG)</span>
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =======================================================
            TAB 2: MESH STUDIO & TRANSFORMS
            ======================================================= */}
        {activeTab === 'mesh' && (
          <div className="space-y-5">
            {/* Quick Actions */}
            <div>
              <span className="text-zinc-400 uppercase font-semibold text-[10px] tracking-wider block mb-2">
                Origin & Alignment
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleAutoCenter}
                  className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg flex items-center justify-center space-x-1.5 transition-colors"
                  title="Center model bounds to (0,0,0)"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Auto Center</span>
                </button>
                <button
                  onClick={handleGroundToFloor}
                  className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg flex items-center justify-center space-x-1.5 transition-colors"
                  title="Place bottom of model at Y=0"
                >
                  <Compass className="w-3.5 h-3.5 text-blue-400" />
                  <span>Ground Floor</span>
                </button>
                <button
                  onClick={handleSwapYZ}
                  className="col-span-2 p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg flex items-center justify-center space-x-1.5 transition-colors"
                  title="Swap Y and Z axes (DayZ engine uses Y-up)"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
                  <span>Swap Y / Z Axes (DayZ Up)</span>
                </button>
              </div>
            </div>

            {/* Normals & Diagnostics */}
            <div>
              <span className="text-zinc-400 uppercase font-semibold text-[10px] tracking-wider block mb-2">
                Normals & Topology
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleFlipNormals}
                  className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg flex items-center justify-center space-x-1.5 transition-colors"
                  title="Fix inverted / transparent inside-out faces"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Flip Normals</span>
                </button>
                <button
                  onClick={handleRecalculateNormals}
                  className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg flex items-center justify-center space-x-1.5 transition-colors"
                  title="Recalculate smooth vertex normals"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Recalc Smooth</span>
                </button>
              </div>
            </div>

            {/* DayZ LOD Generator (Decimation) */}
            <div>
              <span className="text-zinc-400 uppercase font-semibold text-[10px] tracking-wider block mb-2">
                DayZ LOD Generation
              </span>
              <div className="space-y-1.5">
                <button
                  onClick={() => handleDecimate(0.5)}
                  className="w-full p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg flex items-center justify-between transition-colors"
                  title="Decimate to 50% for LOD 1"
                >
                  <span className="font-medium">Generate LOD 1 (50%)</span>
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                </button>
                <button
                  onClick={() => handleDecimate(0.25)}
                  className="w-full p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg flex items-center justify-between transition-colors"
                  title="Decimate to 25% for LOD 2"
                >
                  <span className="font-medium">Generate LOD 2 (25%)</span>
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                </button>
                <button
                  onClick={handleCreateCollisionBox}
                  className="w-full p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg flex items-center justify-between transition-colors"
                  title="Generate Box Collision for Geometry LOD"
                >
                  <span className="font-medium">Generate Geometry LOD Box</span>
                  <Package className="w-3.5 h-3.5 text-amber-400" />
                </button>
              </div>
            </div>

            {/* Numeric Transforms */}
            <div>
              <span className="text-zinc-400 uppercase font-semibold text-[10px] tracking-wider block mb-2">
                Transforms
              </span>
              <div className="space-y-3 bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                {/* Scale */}
                <div>
                  <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                    <span>Uniform Scale</span>
                    <span className="font-mono">{transform.scale[0].toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="5.0"
                    step="0.05"
                    value={transform.scale[0]}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setTransform({ ...transform, scale: [val, val, val] });
                    }}
                    className="w-full"
                  />
                </div>

                {/* Rotation Y */}
                <div>
                  <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                    <span>Rotation Y (Yaw)</span>
                    <span className="font-mono">{transform.rotation[1]}°</span>
                  </div>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    value={transform.rotation[1]}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setTransform({
                        ...transform,
                        rotation: [transform.rotation[0], val, transform.rotation[2]],
                      });
                    }}
                    className="w-full"
                  />
                </div>

                <button
                  onClick={() =>
                    setTransform({
                      position: [0, 0, 0],
                      rotation: [0, 0, 0],
                      scale: [1, 1, 1],
                    })
                  }
                  className="w-full py-1 text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 rounded"
                >
                  Reset Transforms
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =======================================================
            TAB 3: DAYZ SELECTIONS & MEMORY POINTS
            ======================================================= */}
        {activeTab === 'dayz' && (
          <div className="space-y-5">
            {/* Named Selections */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-zinc-400 uppercase font-semibold text-[10px] tracking-wider">
                  Named Selections ({namedSelections.length})
                </span>
              </div>
              <div className="space-y-1.5 mb-2">
                {namedSelections.map((sel) => (
                  <div
                    key={sel.id}
                    className="flex items-center justify-between p-2 bg-zinc-950/80 rounded border border-zinc-800"
                  >
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: sel.color || '#10b981' }}
                      />
                      <span className="font-mono font-medium text-zinc-200">{sel.name}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] text-zinc-500 font-mono">{sel.materialSlot}</span>
                      <button
                        onClick={() => handleRemoveSelection(sel.id)}
                        className="text-zinc-500 hover:text-red-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add selection */}
              <div className="flex items-center space-x-1.5">
                <input
                  type="text"
                  placeholder="Selection name (e.g. camo, zbytek)"
                  value={newSelectionName}
                  onChange={(e) => setNewSelectionName(e.target.value)}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={handleAddSelection}
                  className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded"
                  title="Add Selection"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Memory Points */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-zinc-400 uppercase font-semibold text-[10px] tracking-wider">
                  Memory Points ({memoryPoints.length})
                </span>
              </div>
              <div className="space-y-1.5 mb-2">
                {memoryPoints.map((pt) => (
                  <div
                    key={pt.id}
                    className="p-2 bg-zinc-950/80 rounded border border-zinc-800 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: pt.color || '#eab308' }}
                        />
                        <span className="font-mono font-semibold text-zinc-200">{pt.name}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveMemoryPoint(pt.id)}
                        className="text-zinc-500 hover:text-red-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    {pt.description && (
                      <p className="text-[10px] text-zinc-500">{pt.description}</p>
                    )}
                    <div className="text-[10px] text-zinc-400 font-mono">
                      pos: [{pt.position.map((v) => v.toFixed(2)).join(', ')}]
                    </div>
                  </div>
                ))}
              </div>

              {/* Add memory point */}
              <div className="flex items-center space-x-1.5">
                <input
                  type="text"
                  placeholder="Point name (e.g. ce_ground, eye)"
                  value={newPointName}
                  onChange={(e) => setNewPointName(e.target.value)}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={handleAddMemoryPoint}
                  className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded"
                  title="Add Memory Point"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =======================================================
            TAB 4: CONFIG.CPP & RVMAT GENERATOR
            ======================================================= */}
        {activeTab === 'config' && (
          <div className="space-y-4">
            <div>
              <span className="text-zinc-400 uppercase font-semibold text-[10px] tracking-wider block mb-2">
                DayZ Item Properties
              </span>
              <div className="space-y-2 bg-zinc-950 p-2.5 rounded-lg border border-zinc-800">
                <div>
                  <label className="text-[10px] text-zinc-400 block mb-0.5">Class Name</label>
                  <input
                    type="text"
                    value={modConfig.className}
                    onChange={(e) => setModConfig({ ...modConfig, className: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs font-mono text-zinc-200"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 block mb-0.5">Display Name</label>
                  <input
                    type="text"
                    value={modConfig.displayName}
                    onChange={(e) => setModConfig({ ...modConfig, displayName: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-0.5">Weight (g)</label>
                    <input
                      type="number"
                      value={modConfig.weight}
                      onChange={(e) => setModConfig({ ...modConfig, weight: Number(e.target.value) })}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs font-mono text-zinc-200"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-0.5">Inventory Size</label>
                    <div className="flex items-center space-x-1">
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={modConfig.itemSize[0]}
                        onChange={(e) =>
                          setModConfig({
                            ...modConfig,
                            itemSize: [Number(e.target.value), modConfig.itemSize[1]],
                          })
                        }
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-xs font-mono text-center text-zinc-200"
                      />
                      <span className="text-zinc-500">x</span>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={modConfig.itemSize[1]}
                        onChange={(e) =>
                          setModConfig({
                            ...modConfig,
                            itemSize: [modConfig.itemSize[0], Number(e.target.value)],
                          })
                        }
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-xs font-mono text-center text-zinc-200"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Generated Config.cpp Preview */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-zinc-400 uppercase font-semibold text-[10px] tracking-wider">
                  config.cpp Preview
                </span>
                <button
                  onClick={handleCopyConfig}
                  className="flex items-center space-x-1 text-[11px] text-emerald-400 hover:text-emerald-300"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-[10px] font-mono text-zinc-400 max-h-48 overflow-y-auto whitespace-pre">
                {DayZExporter.generateConfigCPP(modConfig, namedSelections, memoryPoints)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
