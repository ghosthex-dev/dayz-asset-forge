import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  Paintbrush,
  Eraser,
  Pipette,
  Layers,
  Sparkles,
  Download,
  RotateCcw,
  Sliders,
  Eye,
  SlidersHorizontal,
  FileCode,
} from 'lucide-react';
import { TextureAdjustments } from '../types';
import { TextureGenerator } from '../utils/normalMapGenerator';
import { DayZExporter } from '../utils/dayzExport';

interface TextureEditorProps {
  baseTexture: ImageData | null;
  mesh: THREE.Mesh | null;
  onTextureUpdate: (canvas: HTMLCanvasElement) => void;
  onNormalUpdate: (canvas: HTMLCanvasElement) => void;
  onSpecularUpdate: (canvas: HTMLCanvasElement) => void;
}

export type ActiveMapType = 'diffuse' | 'normal' | 'specular';

export const TextureEditor: React.FC<TextureEditorProps> = ({
  baseTexture,
  mesh,
  onTextureUpdate,
  onNormalUpdate,
  onSpecularUpdate,
}) => {
  // Canvases
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const uvCanvasRef = useRef<HTMLCanvasElement>(null);

  // Active Map
  const [activeMap, setActiveMap] = useState<ActiveMapType>('diffuse');

  // Drawing Tools State
  const [tool, setTool] = useState<'brush' | 'eraser' | 'picker'>('brush');
  const [brushColor, setBrushColor] = useState('#22c55e');
  const [brushSize, setBrushSize] = useState(16);
  const [brushOpacity, setBrushOpacity] = useState(1.0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showUVOverlay, setShowUVOverlay] = useState(true);

  // Texture Adjustments State
  const [adjustments, setAdjustments] = useState<TextureAdjustments>({
    brightness: 0,
    contrast: 0,
    saturation: 0,
    hue: 0,
    tintColor: '#22c55e',
    tintAlpha: 0,
    invert: false,
  });

  // Stored Image Data for maps
  const diffuseDataRef = useRef<ImageData | null>(null);
  const normalDataRef = useRef<ImageData | null>(null);
  const specularDataRef = useRef<ImageData | null>(null);

  // Sync initial baseTexture into diffuseDataRef
  useEffect(() => {
    if (baseTexture) {
      diffuseDataRef.current = new ImageData(
        new Uint8ClampedArray(baseTexture.data),
        baseTexture.width,
        baseTexture.height
      );
      renderActiveTexture();
    }
  }, [baseTexture]);

  // Render UV Wireframe onto overlay canvas
  useEffect(() => {
    if (!uvCanvasRef.current || !mesh) return;
    const canvas = uvCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!showUVOverlay) return;

    const uvs = mesh.geometry.attributes.uv;
    if (!uvs) return;

    ctx.strokeStyle = 'rgba(16, 185, 129, 0.45)'; // emerald wire
    ctx.lineWidth = 1;

    const width = canvas.width;
    const height = canvas.height;

    const index = mesh.geometry.index;
    const triCount = index ? index.count / 3 : uvs.count / 3;

    for (let i = 0; i < triCount; i++) {
      const i0 = index ? index.getX(i * 3) : i * 3;
      const i1 = index ? index.getX(i * 3 + 1) : i * 3 + 1;
      const i2 = index ? index.getX(i * 3 + 2) : i * 3 + 2;

      // UV space: (0,0) is bottom-left in Three.js, top-left in canvas
      const u0 = uvs.getX(i0) * width;
      const v0 = (1.0 - uvs.getY(i0)) * height;
      const u1 = uvs.getX(i1) * width;
      const v1 = (1.0 - uvs.getY(i1)) * height;
      const u2 = uvs.getX(i2) * width;
      const v2 = (1.0 - uvs.getY(i2)) * height;

      ctx.beginPath();
      ctx.moveTo(u0, v0);
      ctx.lineTo(u1, v1);
      ctx.lineTo(u2, v2);
      ctx.closePath();
      ctx.stroke();
    }
  }, [mesh, showUVOverlay]);

  // Render the currently active map (diffuse, normal, or specular)
  const renderActiveTexture = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let targetData: ImageData | null = null;
    if (activeMap === 'diffuse') targetData = diffuseDataRef.current;
    else if (activeMap === 'normal') targetData = normalDataRef.current;
    else if (activeMap === 'specular') targetData = specularDataRef.current;

    if (!targetData) return;

    if (canvas.width !== targetData.width || canvas.height !== targetData.height) {
      canvas.width = targetData.width;
      canvas.height = targetData.height;
      if (uvCanvasRef.current) {
        uvCanvasRef.current.width = targetData.width;
        uvCanvasRef.current.height = targetData.height;
      }
    }

    // Apply adjustments only on diffuse
    if (activeMap === 'diffuse' && (
      adjustments.brightness !== 0 ||
      adjustments.contrast !== 0 ||
      adjustments.saturation !== 0 ||
      adjustments.hue !== 0 ||
      adjustments.tintAlpha > 0 ||
      adjustments.invert
    )) {
      const adjusted = TextureGenerator.applyAdjustments(
        targetData,
        adjustments.brightness,
        adjustments.contrast,
        adjustments.saturation,
        adjustments.hue,
        adjustments.tintColor,
        adjustments.tintAlpha,
        adjustments.invert
      );
      ctx.putImageData(adjusted, 0, 0);
    } else {
      ctx.putImageData(targetData, 0, 0);
    }

    // Notify 3D viewport of change
    if (activeMap === 'diffuse') onTextureUpdate(canvas);
    else if (activeMap === 'normal') onNormalUpdate(canvas);
    else if (activeMap === 'specular') onSpecularUpdate(canvas);
  }, [activeMap, adjustments, onTextureUpdate, onNormalUpdate, onSpecularUpdate]);

  useEffect(() => {
    renderActiveTexture();
  }, [renderActiveTexture]);

  // Drawing event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    drawPixel(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDrawing) {
      drawPixel(e);
    }
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
    // Persist drawn canvas pixels back to active map data
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const currentData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);

    if (activeMap === 'diffuse') diffuseDataRef.current = currentData;
    else if (activeMap === 'normal') normalDataRef.current = currentData;
    else if (activeMap === 'specular') specularDataRef.current = currentData;

    renderActiveTexture();
  };

  const drawPixel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (tool === 'picker') {
      const pixel = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
      const hex = `#${((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1)}`;
      setBrushColor(hex);
      setTool('brush');
      return;
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = `rgba(0, 0, 0, ${brushOpacity})`;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = brushColor;
      ctx.globalAlpha = brushOpacity;
    }

    ctx.fill();
    ctx.restore();

    // Live update 3D mesh
    if (activeMap === 'diffuse') onTextureUpdate(canvas);
    else if (activeMap === 'normal') onNormalUpdate(canvas);
    else if (activeMap === 'specular') onSpecularUpdate(canvas);
  };

  // Generate DayZ _nohq normal map from diffuse
  const handleGenerateNormal = () => {
    if (!diffuseDataRef.current) return;
    const normalData = TextureGenerator.generateNormalMap(diffuseDataRef.current, 3.5, true);
    normalDataRef.current = normalData;

    // Create temp canvas to update normal
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = normalData.width;
    tempCanvas.height = normalData.height;
    const ctx = tempCanvas.getContext('2d')!;
    ctx.putImageData(normalData, 0, 0);
    onNormalUpdate(tempCanvas);

    setActiveMap('normal');
  };

  // Generate DayZ _smdi specular map from diffuse
  const handleGenerateSMDI = () => {
    if (!diffuseDataRef.current) return;
    const smdiData = TextureGenerator.generateSMDIMap(diffuseDataRef.current);
    specularDataRef.current = smdiData;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = smdiData.width;
    tempCanvas.height = smdiData.height;
    const ctx = tempCanvas.getContext('2d')!;
    ctx.putImageData(smdiData, 0, 0);
    onSpecularUpdate(tempCanvas);

    setActiveMap('specular');
  };

  // Export current texture
  const handleDownload = (asPAA: boolean) => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const currentData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    const suffix = activeMap === 'diffuse' ? '_co' : activeMap === 'normal' ? '_nohq' : '_smdi';
    DayZExporter.downloadTexture(currentData, `item${suffix}`, asPAA);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 border-r border-zinc-800">
      {/* Top Bar: Map Switcher & Tools */}
      <div className="h-12 bg-zinc-900 border-b border-zinc-800 px-3 flex items-center justify-between select-none">
        {/* Map Type Switcher */}
        <div className="flex items-center space-x-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-xs font-medium">
          <button
            onClick={() => setActiveMap('diffuse')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeMap === 'diffuse'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Diffuse (_co)
          </button>
          <button
            onClick={() => setActiveMap('normal')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeMap === 'normal'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Normal (_nohq)
          </button>
          <button
            onClick={() => setActiveMap('specular')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeMap === 'specular'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Specular (_smdi)
          </button>
        </div>

        {/* Quick Generators */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={handleGenerateNormal}
            className="flex items-center space-x-1 px-2.5 py-1 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 rounded text-xs font-medium transition-all"
            title="Generate DayZ _nohq Normal Map via Sobel"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Gen Normal</span>
          </button>
          <button
            onClick={handleGenerateSMDI}
            className="flex items-center space-x-1 px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded text-xs font-medium transition-all"
            title="Generate DayZ _smdi Specular Map"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Gen Specular</span>
          </button>
        </div>
      </div>

      {/* Main Texture Canvas Workspace */}
      <div className="relative flex-1 bg-zinc-950 flex items-center justify-center p-4 overflow-auto">
        <div className="relative shadow-2xl rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900 checkerboard-bg">
          <canvas
            ref={canvasRef}
            width={512}
            height={512}
            className="block max-w-[480px] max-h-[480px] object-contain cursor-crosshair"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
          {/* UV Overlay Wireframe Canvas */}
          <canvas
            ref={uvCanvasRef}
            width={512}
            height={512}
            className="absolute inset-0 pointer-events-none max-w-[480px] max-h-[480px]"
          />
        </div>

        {/* Floating UV overlay toggle */}
        <div className="absolute top-4 right-4 flex items-center space-x-2">
          <button
            onClick={() => setShowUVOverlay(!showUVOverlay)}
            className={`px-2.5 py-1 text-xs rounded-lg flex items-center space-x-1.5 border transition-all ${
              showUVOverlay
                ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40'
                : 'bg-zinc-900/80 text-zinc-400 border-zinc-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>UV Wireframe</span>
          </button>
        </div>
      </div>

      {/* Bottom Tool Palette & Sliders */}
      <div className="bg-zinc-900 border-t border-zinc-800 p-3 space-y-3 select-none">
        {/* Brush Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setTool('brush')}
              className={`p-1.5 rounded-lg border transition-all ${
                tool === 'brush'
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200'
              }`}
              title="Paint Brush"
            >
              <Paintbrush className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTool('eraser')}
              className={`p-1.5 rounded-lg border transition-all ${
                tool === 'eraser'
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200'
              }`}
              title="Eraser"
            >
              <Eraser className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTool('picker')}
              className={`p-1.5 rounded-lg border transition-all ${
                tool === 'picker'
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200'
              }`}
              title="Eyedropper Color Picker"
            >
              <Pipette className="w-4 h-4" />
            </button>

            {/* Color Input */}
            <input
              type="color"
              value={brushColor}
              onChange={(e) => setBrushColor(e.target.value)}
              className="w-7 h-7 rounded-lg border border-zinc-700 bg-transparent cursor-pointer p-0.5"
              title="Brush Color"
            />
          </div>

          {/* Size & Opacity */}
          <div className="flex items-center space-x-4 text-xs text-zinc-400">
            <div className="flex items-center space-x-1.5">
              <span>Size:</span>
              <input
                type="range"
                min="1"
                max="64"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-20"
              />
              <span className="font-mono text-zinc-200 w-5">{brushSize}</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span>Opacity:</span>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={brushOpacity}
                onChange={(e) => setBrushOpacity(Number(e.target.value))}
                className="w-20"
              />
              <span className="font-mono text-zinc-200 w-7">
                {Math.round(brushOpacity * 100)}%
              </span>
            </div>
          </div>

          {/* Download Buttons */}
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => handleDownload(true)}
              className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs font-medium border border-zinc-700 flex items-center space-x-1"
              title="Download as Bohemia Interactive PAA Texture"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>.PAA</span>
            </button>
            <button
              onClick={() => handleDownload(false)}
              className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs font-medium border border-zinc-700 flex items-center space-x-1"
              title="Download as standard PNG"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span>.PNG</span>
            </button>
          </div>
        </div>

        {/* Adjustments (Only visible for Diffuse) */}
        {activeMap === 'diffuse' && (
          <div className="pt-2 border-t border-zinc-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <div className="flex justify-between text-zinc-400 mb-0.5">
                <span>Brightness</span>
                <span className="font-mono">{adjustments.brightness}</span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                value={adjustments.brightness}
                onChange={(e) =>
                  setAdjustments({ ...adjustments, brightness: Number(e.target.value) })
                }
                className="w-full"
              />
            </div>
            <div>
              <div className="flex justify-between text-zinc-400 mb-0.5">
                <span>Contrast</span>
                <span className="font-mono">{adjustments.contrast}</span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                value={adjustments.contrast}
                onChange={(e) =>
                  setAdjustments({ ...adjustments, contrast: Number(e.target.value) })
                }
                className="w-full"
              />
            </div>
            <div>
              <div className="flex justify-between text-zinc-400 mb-0.5">
                <span>Saturation</span>
                <span className="font-mono">{adjustments.saturation}</span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                value={adjustments.saturation}
                onChange={(e) =>
                  setAdjustments({ ...adjustments, saturation: Number(e.target.value) })
                }
                className="w-full"
              />
            </div>
            <div>
              <div className="flex justify-between text-zinc-400 mb-0.5">
                <span>Hue Shift</span>
                <span className="font-mono">{adjustments.hue}°</span>
              </div>
              <input
                type="range"
                min="-180"
                max="180"
                value={adjustments.hue}
                onChange={(e) =>
                  setAdjustments({ ...adjustments, hue: Number(e.target.value) })
                }
                className="w-full"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
