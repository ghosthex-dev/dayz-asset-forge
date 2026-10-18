import React from 'react';
import { Box, Layers, Image as ImageIcon, Download, Sparkles, Eye, Columns, Gamepad2 } from 'lucide-react';
import { DayZLODType } from '../types';

interface NavbarProps {
  vertexCount: number;
  triangleCount: number;
  modelName: string;
  activeLOD: DayZLODType;
  setActiveLOD: (lod: DayZLODType) => void;
  viewMode: '3d' | 'texture' | 'split';
  setViewMode: (mode: '3d' | 'texture' | 'split') => void;
  onExportBundle: () => void;
  onOpenGameFiles: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  vertexCount,
  triangleCount,
  modelName,
  activeLOD,
  setActiveLOD,
  viewMode,
  setViewMode,
  onExportBundle,
  onOpenGameFiles,
}) => {
  const lods: DayZLODType[] = ['LOD 0', 'LOD 1', 'LOD 2', 'ShadowVolume', 'Geometry', 'Memory'];

  return (
    <header className="h-14 bg-zinc-900 border-b border-zinc-800 px-4 flex items-center justify-between z-30 select-none">
      {/* Brand & Title */}
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black shadow-lg shadow-emerald-950/40">
          DZ
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-sm tracking-wide text-zinc-100">DayZ Asset Forge</span>
            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
              v1.0
            </span>
          </div>
          <div className="text-[11px] text-zinc-400 flex items-center space-x-2">
            <span>Model: <span className="text-zinc-200 font-medium">{modelName}</span></span>
            <span>•</span>
            <span className="font-mono">{vertexCount.toLocaleString()} verts</span>
            <span>•</span>
            <span className="font-mono">{triangleCount.toLocaleString()} tris</span>
          </div>
        </div>
      </div>

      {/* DayZ LOD Selector */}
      <div className="hidden md:flex items-center space-x-1 bg-zinc-950/70 p-1 rounded-lg border border-zinc-800">
        <span className="text-[11px] font-semibold px-2 text-zinc-400 uppercase tracking-wider">LOD:</span>
        {lods.map((lod) => (
          <button
            key={lod}
            onClick={() => setActiveLOD(lod)}
            className={`px-2.5 py-1 text-xs rounded font-medium transition-all ${
              activeLOD === lod
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-900'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
          >
            {lod}
          </button>
        ))}
      </div>

      {/* View Mode & Actions */}
      <div className="flex items-center space-x-2">
        {/* View mode toggle */}
        <div className="flex items-center bg-zinc-950 p-1 rounded-lg border border-zinc-800">
          <button
            onClick={() => setViewMode('3d')}
            className={`px-2.5 py-1 text-xs rounded flex items-center space-x-1.5 transition-all ${
              viewMode === '3d'
                ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="3D Viewport Only"
          >
            <Box className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">3D View</span>
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={`px-2.5 py-1 text-xs rounded flex items-center space-x-1.5 transition-all ${
              viewMode === 'split'
                ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Split 3D & 2D Texture Studio"
          >
            <Columns className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Split</span>
          </button>
          <button
            onClick={() => setViewMode('texture')}
            className={`px-2.5 py-1 text-xs rounded flex items-center space-x-1.5 transition-all ${
              viewMode === 'texture'
                ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Texture Studio Only"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Texture 2D</span>
          </button>
        </div>

        {/* Open Game Files Explorer */}
        <button
          onClick={onOpenGameFiles}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-800 text-emerald-300 font-medium text-xs rounded-lg border border-emerald-500/30 transition-all shadow-sm"
        >
          <Gamepad2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Game Files</span>
        </button>

        {/* Quick Export Bundle */}
        <button
          onClick={onExportBundle}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-medium text-xs rounded-lg transition-all shadow-md shadow-emerald-950/60"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Mod Bundle</span>
        </button>
      </div>
    </header>
  );
};
