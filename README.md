# DayZ Asset Forge

An all-in-one 3D asset studio, PBO explorer, and texture workbench designed specifically for **DayZ** and Bohemia Interactive Real Virtuality / Enfusion modding. Available as a standalone Windows desktop app (Electron) or local web workstation (Vite + React).

For Easy Setup use these links. Otherwise proceed to the "Getting Started" section below
Installer: https://github.com/ghosthex-dev/dayz-asset-forge/releases/tag/installer
Portable Version: https://github.com/ghosthex-dev/dayz-asset-forge/releases/tag/Portable
---

## 🚀 Features

### 1. Direct Game Asset & PBO Browser
* **Automatic DayZ Detection:** Automatically detects DayZ Steam installations across standard libraries, secondary drives, registry entries, and custom directories.
* **Direct PBO Extraction & Parsing:** Browse game `.pbo` archives in real-time without needing third-party unpackers.
* **Instant ODOL Debinarization:** Converts binarized DayZ models (`ODOLv6` / `ODOLv7`) directly into editable MLOD and 3D geometry with complete vertex, normal, UV, texture, and named selection mapping.
* **Native PAA Image Conversion:** High-speed decoding of Bohemia `.paa` files (DXT1, DXT5, ARGB) into standard web-compatible textures for immediate viewport rendering and editing.

### 2. 3D Model Studio & Viewport
* **Supported Formats:** `.obj`, `.stl`, `.gltf`, `.glb`, and editable `.p3d` (Bohemia MLOD).
* **Interactive 3D Viewport:** Three.js orbit controls, camera reset, wireframe mode, grid toggling, and real-time lighting.
* **Drag & Drop:** Drop any 3D model or texture directly into the 3D viewport.
* **Instant Export:** Export cleaned, centered `.obj` models ready for DayZ Object Builder or Workbench.

### 3. Real-Time In-App Texture Studio
* **Interactive 2D Canvas:** Draw, paint, erase, sample colors with brush opacity and size controls.
* **UV Wireframe Overlay:** Superimposes the 3D model's UV layout directly over the 2D texture so you see seams and polygons while painting.
* **Filter Adjustments:** Live sliders for Brightness, Contrast, Saturation, Hue Shift, and Tint Color.
* **One-Click DayZ Normal Generator (`_nohq`):** Automatically calculates height-to-normal maps with Sobel filters and DirectX inverted Y green channel.
* **One-Click DayZ Specular Generator (`_smdi`):** Packs Ambient Occlusion/Roughness (R), Specular highlight (G), and Glossiness (B).

### 4. Mesh Tools & Diagnostics
* **Auto-Center:** Centers model bounding box to `(0, 0, 0)`.
* **Ground to Floor:** Automatically adjusts lowest vertex to `Y = 0` so items rest naturally on terrain or in player inventory.
* **Swap Y/Z Axes:** One-click toggle between CAD/Blender Z-up and DayZ Y-up coordinates.
* **Flip / Invert Normals:** Instantly fixes inside-out or transparent faces.
* **Recalculate Smooth Normals:** Generates smooth vertex normals for clean lighting.
* **DayZ LOD Generation:** Automatic decimation down to 50% (LOD 1), 25% (LOD 2), and generates simplified Geometry LOD collision boxes.

### 5. DayZ Named Selections & Memory Points
* **Named Selections:** Manage vertex groups like `camo`, `zbytek`, and `glass` with corresponding material slot references.
* **Memory Points:** Visual 3D sphere markers with billboard pins for DayZ contact points:
  * `ce_ground` (Drop origin)
  * `usti hlavne` (Muzzle flash)
  * `eye` (Optic ADS camera vector)
  * `action` (Melee hit point)
  * `proxy_optic`, `proxy_suppressor`, etc.

### 6. DayZ Mod Config & Package Generator
* Generates ready-to-compile **`config.cpp`** (with `CfgPatches` and `CfgVehicles`/`CfgWeapons` classes, health levels, and damage materials).
* Generates Bohemia **`.rvmat`** (pixel & vertex shader stages with `Stage1` nohq and `Stage2` smdi).
* Generates Bohemia **`model.cfg`** (skeletons and sections).
* **One-Click Export Bundle:** Downloads model + textures + configs packed and ready for `AddonBuilder`.

---

## 🛠️ Getting Started

### Prerequisites
* Windows 10/11 64-bit
* [Node.js](https://nodejs.org/) v18+ and `npm`
* Microsoft Visual C++ 2015-2022 Redistributable (x64)

### Development Mode (Web / Local Server)
```bash
# Clone the repository
git clone https://github.com/Starfury1985/dayz-asset-forge.git
cd dayz-asset-forge

# Install dependencies
npm install

# Start development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser, or double-click `run.bat`.

### Building Desktop Installer (.exe)
To compile the standalone Windows executable and installer:
```bash
# Compile UI and package Electron installer into release/
npm run dist
```
This produces:
* An NSIS installer: `release/DayZ Asset Forge Setup 1.0.0.exe`
* A portable single-file executable: `release/DayZ Asset Forge 1.0.0.exe`

---

## 🔒 Copyright & Legal Disclaimer

* **DayZ** is a registered trademark of **Bohemia Interactive a.s.**
* **DayZ Asset Forge** is an independent, open-source community modding tool and is not affiliated with, endorsed by, or sponsored by Bohemia Interactive.
* **No Copyrighted Game Assets:** This repository contains **NO official DayZ game files, proprietary 3D models (`.p3d`), game textures (`.paa`), sound archives, or game data (`.pbo`)**. All game assets are read directly from the user's legally purchased and locally installed copy of DayZ via Steam.
* Included third-party debinarization tools are open source (MIT licensed). See [tools/odol-convert/README.md](tools/odol-convert/README.md) for original ODOL-convert attribution.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
