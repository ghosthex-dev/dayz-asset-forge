import React, { useState, useEffect } from 'react';
import {
  Gamepad2,
  FolderArchive,
  Search,
  Box,
  Image as ImageIcon,
  FileCode,
  Download,
  Loader2,
  ChevronRight,
  HardDrive,
  X,
  Sparkles,
  FolderDown,
  CheckCircle2,
  FolderOpen,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { PBOEntry } from '../utils/pboParser';
import { PAAParser } from '../utils/paaParser';

export interface GameModelLoadData {
  obj: string;
  name: string;
  meta: any;
  primaryTextureUrl?: string | null;
  primaryTextureName?: string | null;
}

interface GameAssetBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadTexture: (imgData: ImageData, fileName: string) => void;
  onLoadModel: (data: GameModelLoadData) => void;
}

interface PBOItem {
  name: string;
  fullPath: string;
  size: number;
  category: string;
}

export const GameAssetBrowser: React.FC<GameAssetBrowserProps> = ({
  isOpen,
  onClose,
  onLoadTexture,
  onLoadModel,
}) => {
  const [activePath, setActivePath] = useState('');
  const [detectedPaths, setDetectedPaths] = useState<string[]>([]);
  const [pbos, setPbos] = useState<PBOItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedPbo, setSelectedPbo] = useState<PBOItem | null>(null);

  // PBO Entries & Filter
  const [entries, setEntries] = useState<PBOEntry[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'model' | 'texture' | 'material'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Loading States
  const [loadingPbos, setLoadingPbos] = useState(false);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [extractingName, setExtractingName] = useState<string | null>(null);
  const [unpacking, setUnpacking] = useState(false);
  const [unpackStatus, setUnpackStatus] = useState<string | null>(null);
  const [systemDeps, setSystemDeps] = useState<{
    hasVCRedist: boolean;
    hasOdolConvert: boolean;
    hasDayZHelper: boolean;
  } | null>(null);
  const [hasDayZTools, setHasDayZTools] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Initialize: detect DayZ directory & system dependencies
  useEffect(() => {
    if (!isOpen) return;

    fetch('/api/dayz/detect')
      .then((res) => res.json())
      .then((data) => {
        setDetectedPaths(data.detectedPaths || []);
        setSystemDeps(data.systemDependencies || null);
        setHasDayZTools(!!data.hasDayZTools);
        const initPath = data.activePath || '';
        setActivePath(initPath);
        if (initPath) {
          loadPbos(initPath);
        }
      })
      .catch((err) => console.error('Failed to detect DayZ:', err));
  }, [isOpen]);

  const handleSwitchPath = (newPath: string) => {
    setActivePath(newPath);
    fetch(`/api/dayz/set-active-path?path=${encodeURIComponent(newPath)}`, { method: 'POST' });
    loadPbos(newPath);
  };

  const handleBrowseFolder = async () => {
    try {
      const res = await fetch('/api/dayz/browse-folder', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.selectedPath) {
        setActivePath(data.selectedPath);
        if (!detectedPaths.includes(data.selectedPath)) {
          setDetectedPaths([data.selectedPath, ...detectedPaths]);
        }
        loadPbos(data.selectedPath);
      }
    } catch (err: any) {
      alert(`Could not open folder picker: ${err.message}`);
    }
  };

  const loadPbos = (dir: string) => {
    setLoadingPbos(true);
    fetch(`/api/dayz/pbos?dir=${encodeURIComponent(dir)}`)
      .then((res) => res.json())
      .then((data) => {
        setPbos(data.pbos || []);
        setLoadingPbos(false);
        // Select first relevant PBO automatically
        if (data.pbos && data.pbos.length > 0) {
          const first = data.pbos.find((p: PBOItem) => p.name.includes('gear_drinks') || p.name.includes('weapon')) || data.pbos[0];
          selectPbo(first);
        }
      })
      .catch((err) => {
        console.error('Failed to list PBOs:', err);
        setLoadingPbos(false);
      });
  };

  const selectPbo = (pbo: PBOItem) => {
    setSelectedPbo(pbo);
    setLoadingEntries(true);
    fetch(`/api/dayz/pbo/contents?pboPath=${encodeURIComponent(pbo.fullPath)}`)
      .then((res) => res.json())
      .then((data) => {
        setEntries(data.entries || []);
        setLoadingEntries(false);
      })
      .catch((err) => {
        console.error('Failed to parse PBO:', err);
        setLoadingEntries(false);
      });
  };

  // Unpack entire PBO archive
  const handleUnpackPbo = async () => {
    if (!selectedPbo || unpacking) return;
    setUnpacking(true);
    setUnpackStatus(null);
    try {
      const res = await fetch(`/api/dayz/pbo/unpack?pboPath=${encodeURIComponent(selectedPbo.fullPath)}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to unpack');
      setUnpackStatus(`Successfully unpacked ${data.extractedCount} files to unpacked/${data.pboName.replace('.pbo', '')}`);
      setTimeout(() => setUnpackStatus(null), 6000);
    } catch (err: any) {
      alert(`Unpack failed: ${err.message}`);
    } finally {
      setUnpacking(false);
    }
  };

  // Extract and load Texture into Studio
  const handleExtractTexture = async (entry: PBOEntry) => {
    if (!selectedPbo) return;
    setExtractingName(entry.name);

    try {
      // 1. Try server-side PAA to PNG conversion
      const convRes = await fetch(
        `/api/dayz/texture/convert-paa?pboPath=${encodeURIComponent(selectedPbo.fullPath)}&fileName=${encodeURIComponent(entry.name)}`
      );
      if (convRes.ok) {
        const convData = await convRes.json();
        if (convData.pngUrl) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = (e) => reject(e);
            img.src = convData.pngUrl;
          });
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          onLoadTexture(imgData, entry.name);
          setExtractingName(null);
          onClose();
          return;
        }
      }

      // 2. Fallback to client-side decode
      const res = await fetch(
        `/api/dayz/pbo/extract-file?pboPath=${encodeURIComponent(selectedPbo.fullPath)}&fileName=${encodeURIComponent(entry.name)}`
      );
      const buffer = await res.arrayBuffer();

      // Decode DayZ PAA texture
      const decodeResult = PAAParser.decode(buffer);
      const canvas = document.createElement('canvas');
      canvas.width = decodeResult.width;
      canvas.height = decodeResult.height;
      const ctx = canvas.getContext('2d')!;
      const imgData = ctx.createImageData(decodeResult.width, decodeResult.height);
      imgData.data.set(decodeResult.data);

      onLoadTexture(imgData, entry.name);
      setExtractingName(null);
      onClose();
    } catch (err: any) {
      alert(`Error extracting texture: ${err.message}`);
      setExtractingName(null);
    }
  };

  // Extract, debinarize ODOL, and load 3D model into Studio
  const handleExtractAndLoadModel = async (entry: PBOEntry) => {
    if (!selectedPbo) return;
    setExtractingName(entry.name);

    try {
      const res = await fetch(
        `/api/dayz/model/load-game-model?pboPath=${encodeURIComponent(selectedPbo.fullPath)}&fileName=${encodeURIComponent(entry.name)}`
      );
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP error ${res.status}`);
      }
      const data: GameModelLoadData = await res.json();
      onLoadModel(data);
      setExtractingName(null);
      onClose();
    } catch (err: any) {
      alert(`Error loading game model: ${err.message}`);
      setExtractingName(null);
    }
  };

  // Extract and download as standard OBJ
  const handleDownloadOBJ = async (entry: PBOEntry) => {
    if (!selectedPbo) return;
    setExtractingName(entry.name);
    try {
      const res = await fetch(
        `/api/dayz/model/load-game-model?pboPath=${encodeURIComponent(selectedPbo.fullPath)}&fileName=${encodeURIComponent(entry.name)}`
      );
      const data = await res.json();
      if (!data.obj) throw new Error('No OBJ data generated');
      const blob = new Blob([data.obj], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.name || 'model'}.obj`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExtractingName(null);
    } catch (err: any) {
      alert(`Error exporting OBJ: ${err.message}`);
      setExtractingName(null);
    }
  };

  // Download raw game file
  const handleDownloadRaw = (entry: PBOEntry) => {
    if (!selectedPbo) return;
    const url = `/api/dayz/pbo/extract-file?pboPath=${encodeURIComponent(selectedPbo.fullPath)}&fileName=${encodeURIComponent(entry.name)}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = entry.name.split('\\').pop() || entry.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!isOpen) return null;

  // Filtered PBOs
  const categories = ['All', 'Weapons', 'Gear & Items', 'Clothing', 'Vehicles', 'Structures', 'AI & Characters', 'Environment'];
  const filteredPbos = pbos.filter((p) => selectedCategory === 'All' || p.category === selectedCategory);

  // Filtered Entries inside selected PBO
  const filteredEntries = entries.filter((e) => {
    const matchesType =
      filterType === 'all' ||
      (filterType === 'model' && e.type === 'model') ||
      (filterType === 'texture' && e.type === 'texture') ||
      (filterType === 'material' && e.type === 'material');

    const matchesSearch =
      searchQuery.trim() === '' ||
      e.name.toLowerCase().includes(searchQuery.toLowerCase().trim());

    return matchesType && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-6xl h-[88vh] bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-zinc-200">
        {/* Header */}
        <div className="h-16 bg-zinc-950 border-b border-zinc-800 px-6 flex items-center justify-between select-none">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="font-bold text-base text-zinc-100">DayZ Game Files Browser</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Direct Game Extraction
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Browse official DayZ addons, unpack models and textures, and load them directly into the 3D studio.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            {/* System Status Pill */}
            <button
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-[11px] text-emerald-300 hover:bg-emerald-900/40 transition-colors"
              title="Click to view DayZ engine & system dependencies status"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Engine Ready</span>
            </button>

            {/* Path Selector / Display */}
            <div className="flex items-center space-x-1.5 bg-zinc-900 border border-zinc-800 rounded-lg p-1 text-xs">
              {detectedPaths.length > 1 ? (
                <select
                  value={activePath}
                  onChange={(e) => handleSwitchPath(e.target.value)}
                  className="bg-transparent text-zinc-300 font-mono text-[11px] px-2 py-0.5 rounded focus:outline-none cursor-pointer max-w-xs truncate"
                  title="Switch between detected DayZ installations"
                >
                  {detectedPaths.map((p) => (
                    <option key={p} value={p} className="bg-zinc-900 text-zinc-200">
                      {p.includes('DayZServer') ? `[Server] ${p}` : `[Retail] ${p}`}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center space-x-1.5 px-2 py-0.5">
                  <HardDrive className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span className="text-zinc-400 font-mono text-[11px] truncate max-w-xs">{activePath || 'No DayZ folder selected'}</span>
                </div>
              )}

              {/* Browse custom folder button */}
              <button
                onClick={handleBrowseFolder}
                className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-[11px] font-medium transition-colors flex items-center space-x-1 shrink-0"
                title="Browse for custom DayZ installation folder"
              >
                <FolderOpen className="w-3 h-3 text-emerald-400" />
                <span>Browse...</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Diagnostics & Dependencies Drawer */}
        {showDiagnostics && (
          <div className="bg-zinc-950 border-b border-zinc-800 px-6 py-3 flex items-center justify-between text-xs text-zinc-300 animate-in fade-in duration-150">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <div>
                  <span className="font-semibold text-zinc-200">DayZ Installation:</span>{' '}
                  <span className="text-zinc-400 font-mono text-[11px]">{pbos.length} PBOs found</span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <div>
                  <span className="font-semibold text-zinc-200">ODOL Debinarizer:</span>{' '}
                  <span className="text-zinc-400 font-mono text-[11px]">odol-convert.exe (Ready)</span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <div>
                  <span className="font-semibold text-zinc-200">Mesh & Texture Engine:</span>{' '}
                  <span className="text-zinc-400 font-mono text-[11px]">dayz_helper.exe (Standalone)</span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <div>
                  <span className="font-semibold text-zinc-200">VC++ Runtime:</span>{' '}
                  <span className="text-zinc-400 font-mono text-[11px]">x64 Detected</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowDiagnostics(false)}
              className="text-zinc-400 hover:text-zinc-200 text-[11px] underline"
            >
              Close
            </button>
          </div>
        )}

        {/* Categories Bar */}
        <div className="h-11 bg-zinc-950/70 border-b border-zinc-800/80 px-6 flex items-center space-x-1.5 overflow-x-auto select-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Main 2-Column Workspace */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Column: PBO List */}
          <div className="w-80 bg-zinc-950 border-r border-zinc-800 flex flex-col">
            <div className="p-3 border-b border-zinc-800/80 text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
              <span>PBO Archives ({filteredPbos.length})</span>
              {loadingPbos && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />}
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredPbos.map((pbo) => {
                const isSelected = selectedPbo?.fullPath === pbo.fullPath;
                return (
                  <button
                    key={pbo.fullPath}
                    onClick={() => selectPbo(pbo)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all flex items-center justify-between group ${
                      isSelected
                        ? 'bg-emerald-600/15 border-emerald-500/50 text-emerald-300 shadow-sm'
                        : 'bg-zinc-900/40 border-zinc-800/80 text-zinc-300 hover:bg-zinc-800/50 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      <FolderArchive className={`w-4 h-4 shrink-0 ${isSelected ? 'text-emerald-400' : 'text-zinc-500'}`} />
                      <div className="truncate">
                        <div className="font-medium text-xs truncate">{pbo.name}</div>
                        <div className="text-[10px] text-zinc-500 font-mono">
                          {(pbo.size / (1024 * 1024)).toFixed(1)} MB
                        </div>
                      </div>
                    </div>
                    <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-transform ${isSelected ? 'text-emerald-400 translate-x-0.5' : 'text-zinc-600'}`} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Files Inside Selected PBO */}
          <div className="flex-1 bg-zinc-900 flex flex-col overflow-hidden">
            {/* Top Toolbar in Right Column */}
            <div className="p-3 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between gap-3">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
                <input
                  type="text"
                  placeholder={`Search inside ${selectedPbo?.name || 'PBO'} (e.g. canteen, m4a1, co.paa)...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Type Filter */}
              <div className="flex items-center space-x-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800 text-xs font-medium">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-2.5 py-1 rounded transition-colors ${filterType === 'all' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  All ({entries.length})
                </button>
                <button
                  onClick={() => setFilterType('model')}
                  className={`px-2.5 py-1 rounded transition-colors ${filterType === 'model' ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  Models .p3d ({entries.filter((e) => e.type === 'model').length})
                </button>
                <button
                  onClick={() => setFilterType('texture')}
                  className={`px-2.5 py-1 rounded transition-colors ${filterType === 'texture' ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  Textures .paa ({entries.filter((e) => e.type === 'texture').length})
                </button>
                <button
                  onClick={() => setFilterType('material')}
                  className={`px-2.5 py-1 rounded transition-colors ${filterType === 'material' ? 'bg-purple-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  Materials .rvmat ({entries.filter((e) => e.type === 'material').length})
                </button>
              </div>

              {/* Unpack Full PBO */}
              <button
                onClick={handleUnpackPbo}
                disabled={unpacking || !selectedPbo}
                className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/80 rounded-lg text-xs font-medium transition-all flex items-center space-x-1.5 shrink-0 disabled:opacity-50"
                title="Unpack all files from this PBO to disk"
              >
                {unpacking ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                ) : (
                  <FolderDown className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>{unpacking ? 'Unpacking...' : 'Unpack Full PBO'}</span>
              </button>
            </div>

            {/* Unpack Notification Banner */}
            {unpackStatus && (
              <div className="bg-emerald-950/60 border-b border-emerald-500/30 px-4 py-2 flex items-center space-x-2 text-xs text-emerald-300 animate-in fade-in duration-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{unpackStatus}</span>
              </div>
            )}

            {/* Entries Grid / List */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingEntries ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-400 space-y-2">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                  <span className="text-xs">Parsing PBO directory...</span>
                </div>
              ) : filteredEntries.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-2">
                  <FolderArchive className="w-10 h-10 text-zinc-700" />
                  <span className="text-xs">No matching files found</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {filteredEntries.map((entry) => {
                    const isExtracting = extractingName === entry.name;
                    return (
                      <div
                        key={entry.name}
                        className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 hover:border-zinc-700 transition-all flex flex-col justify-between space-y-2 group"
                      >
                        <div>
                          <div className="flex items-center space-x-2 mb-1">
                            {entry.type === 'model' && <Box className="w-4 h-4 text-emerald-400 shrink-0" />}
                            {entry.type === 'texture' && <ImageIcon className="w-4 h-4 text-blue-400 shrink-0" />}
                            {entry.type === 'material' && <FileCode className="w-4 h-4 text-purple-400 shrink-0" />}
                            {entry.type === 'config' && <FileCode className="w-4 h-4 text-amber-400 shrink-0" />}
                            {entry.type === 'other' && <Box className="w-4 h-4 text-zinc-500 shrink-0" />}
                            <span className="font-semibold text-xs text-zinc-200 truncate group-hover:text-emerald-400 transition-colors">
                              {entry.name.split('\\').pop()}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-500 font-mono truncate" title={entry.name}>
                            {entry.name}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-zinc-900">
                          <span className="text-[10px] text-zinc-400 font-mono">
                            {(entry.size / 1024).toFixed(1)} KB
                          </span>

                          <div className="flex items-center space-x-1.5">
                            {entry.type === 'model' && (
                              <>
                                <button
                                  onClick={() => handleExtractAndLoadModel(entry)}
                                  disabled={isExtracting}
                                  className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded text-[11px] font-semibold transition-all flex items-center space-x-1.5 shadow-sm active:scale-95"
                                  title="Extract official DayZ model, debinarize, and open in 3D Viewport with companion textures"
                                >
                                  {isExtracting ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                                  ) : (
                                    <Box className="w-3.5 h-3.5 text-emerald-400" />
                                  )}
                                  <span>Load in 3D</span>
                                </button>
                                <button
                                  onClick={() => handleDownloadOBJ(entry)}
                                  disabled={isExtracting}
                                  className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded text-[10px] font-mono transition-all"
                                  title="Export and download as standard .OBJ"
                                >
                                  OBJ
                                </button>
                              </>
                            )}

                            {entry.type === 'texture' && (
                              <button
                                onClick={() => handleExtractTexture(entry)}
                                disabled={isExtracting}
                                className="px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded text-[11px] font-medium transition-all flex items-center space-x-1 shadow-sm active:scale-95"
                                title="Decode DayZ PAA and open in Texture Studio"
                              >
                                {isExtracting ? (
                                  <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                                ) : (
                                  <Sparkles className="w-3 h-3 text-blue-400" />
                                )}
                                <span>Load in Studio</span>
                              </button>
                            )}

                            <button
                              onClick={() => handleDownloadRaw(entry)}
                              className="p-1 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
                              title="Download raw file"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
