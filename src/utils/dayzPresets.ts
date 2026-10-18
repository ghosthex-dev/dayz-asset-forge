import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DayZMemoryPoint, DayZNamedSelection, DayZModConfig } from '../types';

export interface PresetAsset {
  name: string;
  category: DayZModConfig['category'];
  description: string;
  createGeometry: () => THREE.BufferGeometry;
  createDefaultTexture: () => ImageData;
  memoryPoints: DayZMemoryPoint[];
  namedSelections: DayZNamedSelection[];
  modConfig: DayZModConfig;
}

export class DayZPresets {
  public static getPresets(): PresetAsset[] {
    return [
      this.getTacticalKnifePreset(),
      this.getCanteenPreset(),
      this.getMilitaryCratePreset(),
      this.getRedDotOpticPreset(),
    ];
  }

  /**
   * Tactical Combat Knife Preset
   */
  private static getTacticalKnifePreset(): PresetAsset {
    return {
      name: 'Tactical Combat Knife',
      category: 'Tool/Melee',
      description: 'Standard military field knife with textured grip, steel blade, and brass guard.',
      createGeometry: () => {
        // 1. Blade: tapered steel knife blade
        const bladeGeo = new THREE.BoxGeometry(0.04, 0.26, 0.008);
        bladeGeo.translate(0, 0.21, 0);

        // 2. Crossguard
        const guardGeo = new THREE.BoxGeometry(0.09, 0.018, 0.025);
        guardGeo.translate(0, 0.08, 0);

        // 3. Ergonomic Handle Grip
        const handleGeo = new THREE.CylinderGeometry(0.022, 0.024, 0.16, 20);
        handleGeo.translate(0, -0.01, 0);

        // 4. Heavy Pommel Butt
        const pommelGeo = new THREE.CylinderGeometry(0.028, 0.022, 0.025, 20);
        pommelGeo.translate(0, -0.10, 0);

        // Merge all pieces into one solid geometry
        const merged = mergeGeometries([bladeGeo, guardGeo, handleGeo, pommelGeo], true);
        const finalGeo = merged || bladeGeo;
        finalGeo.computeVertexNormals();
        finalGeo.computeBoundingBox();
        finalGeo.computeBoundingSphere();
        return finalGeo;
      },
      createDefaultTexture: () => {
        return DayZPresets.generateProceduralTexture(512, 512, '#3f474f', '#6c7a89', 'TACTICAL KNIFE');
      },
      memoryPoints: [
        { id: '1', name: 'ce_ground', position: [0, -0.10, 0], color: '#eab308', description: 'Item drop & inventory ground origin' },
        { id: '2', name: 'action', position: [0, 0.34, 0], color: '#22c55e', description: 'Melee weapon slash/stab tip contact point' },
        { id: '3', name: 'handle_grip', position: [0, 0, 0], color: '#3b82f6', description: 'Player hand attachment position' },
      ],
      namedSelections: [
        { id: '1', name: 'camo', materialSlot: 'dz_knife_blade.rvmat', color: '#10b981' },
        { id: '2', name: 'zbytek', materialSlot: 'dz_knife_handle.rvmat', color: '#6366f1' },
      ],
      modConfig: {
        className: 'DZ_TacticalKnife',
        baseClass: 'CombatKnife',
        displayName: 'Tactical Field Knife',
        description: 'A rugged tactical knife suited for survival and close combat in Chernarus.',
        weight: 350,
        itemSize: [1, 2],
        category: 'Tool/Melee',
        modelPath: 'DZ\\weapons\\melee\\blade\\tactical_knife.p3d',
      },
    };
  }

  /**
   * Military Canteen Preset
   */
  private static getCanteenPreset(): PresetAsset {
    return {
      name: 'Military Canteen',
      category: 'Food/Drink',
      description: 'Olive drab army canteen with screw-on cap and belt pouch.',
      createGeometry: () => {
        const bodyGeo = new THREE.CylinderGeometry(0.08, 0.07, 0.22, 24);
        bodyGeo.scale(1, 1, 0.6); // Flatten like real canteen
        bodyGeo.translate(0, 0.11, 0);

        const neckGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.04, 16);
        neckGeo.translate(0, 0.24, 0);

        const capGeo = new THREE.CylinderGeometry(0.032, 0.03, 0.03, 16);
        capGeo.translate(0, 0.27, 0);

        const merged = mergeGeometries([bodyGeo, neckGeo, capGeo], true);
        const finalGeo = merged || bodyGeo;
        finalGeo.computeVertexNormals();
        finalGeo.computeBoundingBox();
        finalGeo.computeBoundingSphere();
        return finalGeo;
      },
      createDefaultTexture: () => {
        return DayZPresets.generateProceduralTexture(512, 512, '#384d34', '#556f4e', 'MILITARY CANTEEN');
      },
      memoryPoints: [
        { id: '1', name: 'ce_ground', position: [0, 0, 0], color: '#eab308', description: 'Drop origin' },
        { id: '2', name: 'proxy_belt', position: [0, 0.11, 0.06], color: '#3b82f6', description: 'Belt pouch attachment' },
      ],
      namedSelections: [
        { id: '1', name: 'camo', materialSlot: 'dz_canteen.rvmat', color: '#10b981' },
        { id: '2', name: 'camoGround', materialSlot: 'dz_canteen.rvmat', color: '#06b6d4' },
      ],
      modConfig: {
        className: 'DZ_OliveCanteen',
        baseClass: 'Canteen',
        displayName: 'Military Olive Canteen',
        description: 'A lightweight canteen for carrying potable water.',
        weight: 180,
        itemSize: [2, 2],
        category: 'Food/Drink',
        modelPath: 'DZ\\gear\\drinks\\canteen.p3d',
      },
    };
  }

  /**
   * Military Supply Crate Preset
   */
  private static getMilitaryCratePreset(): PresetAsset {
    return {
      name: 'Military Ammo Crate',
      category: 'BuildingProp',
      description: 'Reinforced wooden and steel ammunition crate with lock latches.',
      createGeometry: () => {
        const crateGeo = new THREE.BoxGeometry(0.8, 0.45, 0.5);
        crateGeo.translate(0, 0.225, 0);
        crateGeo.computeVertexNormals();
        crateGeo.computeBoundingBox();
        crateGeo.computeBoundingSphere();
        return crateGeo;
      },
      createDefaultTexture: () => {
        return DayZPresets.generateProceduralTexture(512, 512, '#4a3f2b', '#6b5d43', 'AMMO CRATE');
      },
      memoryPoints: [
        { id: '1', name: 'ce_ground', position: [0, 0, 0], color: '#eab308', description: 'Base origin on terrain' },
        { id: '2', name: 'action_open', position: [0, 0.45, 0.25], color: '#22c55e', description: 'Player interact latch prompt' },
      ],
      namedSelections: [
        { id: '1', name: 'camo', materialSlot: 'dz_crate_wood.rvmat', color: '#10b981' },
        { id: '2', name: 'lid', materialSlot: 'dz_crate_hinge.rvmat', color: '#f59e0b' },
      ],
      modConfig: {
        className: 'DZ_MilAmmoCrate',
        baseClass: 'Container_Base',
        displayName: 'Reinforced Ammunition Crate',
        description: 'Heavy duty military storage crate capable of storing high caliber munitions.',
        weight: 12000,
        itemSize: [5, 4],
        category: 'BuildingProp',
        modelPath: 'DZ\\structures\\military\\ammo_crate.p3d',
      },
    };
  }

  /**
   * Red Dot Optic Sight Preset
   */
  private static getRedDotOpticPreset(): PresetAsset {
    return {
      name: 'Compact Red Dot Sight',
      category: 'Weapon',
      description: 'Reflex red dot optic for Picatinny rail mounting.',
      createGeometry: () => {
        const baseGeo = new THREE.BoxGeometry(0.04, 0.03, 0.09);
        baseGeo.translate(0, 0.015, 0);

        const hoodGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.08, 20);
        hoodGeo.rotateX(Math.PI / 2);
        hoodGeo.translate(0, 0.045, 0);

        const merged = mergeGeometries([baseGeo, hoodGeo], true);
        const finalGeo = merged || baseGeo;
        finalGeo.computeVertexNormals();
        finalGeo.computeBoundingBox();
        finalGeo.computeBoundingSphere();
        return finalGeo;
      },
      createDefaultTexture: () => {
        return DayZPresets.generateProceduralTexture(512, 512, '#22252a', '#3b4048', 'RED DOT SIGHT');
      },
      memoryPoints: [
        { id: '1', name: 'ce_ground', position: [0, 0, 0], color: '#eab308', description: 'Drop origin' },
        { id: '2', name: 'eye', position: [0, 0.045, -0.15], color: '#ef4444', description: 'Player optic ADS view camera vector' },
        { id: '3', name: 'proxy_optic', position: [0, 0, 0], color: '#3b82f6', description: 'Rail mounting slot origin' },
      ],
      namedSelections: [
        { id: '1', name: 'camo', materialSlot: 'dz_optic_body.rvmat', color: '#10b981' },
        { id: '2', name: 'glass', materialSlot: 'dz_optic_glass.rvmat', color: '#06b6d4' },
      ],
      modConfig: {
        className: 'DZ_CompactRedDot',
        baseClass: 'ItemOptics',
        displayName: 'Compact Tactical Red Dot',
        description: 'Modern reflex optic offering rapid target acquisition in close-to-medium quarters.',
        weight: 220,
        itemSize: [1, 2],
        category: 'Weapon',
        modelPath: 'DZ\\weapons\\attachments\\optics\\red_dot.p3d',
      },
    };
  }

  /**
   * Generate an initial procedural texture with camouflage/metal grid pattern and label
   */
  private static generateProceduralTexture(
    width: number,
    height: number,
    color1: string,
    color2: string,
    label: string
  ): ImageData {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // Base background
    ctx.fillStyle = color1;
    ctx.fillRect(0, 0, width, height);

    // Subtle camo / military noise pattern
    ctx.fillStyle = color2;
    for (let i = 0; i < 40; i++) {
      const rx = Math.random() * width;
      const ry = Math.random() * height;
      const rw = 40 + Math.random() * 80;
      const rh = 40 + Math.random() * 80;
      ctx.beginPath();
      ctx.ellipse(rx, ry, rw, rh, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    // Grid panels
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, width - 40, height - 40);
    ctx.strokeRect(40, 40, width - 80, height - 80);

    // Label text
    ctx.font = 'bold 36px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.textAlign = 'center';
    ctx.fillText(`DAYZ // ${label}`, width / 2, height / 2 - 10);

    ctx.font = '18px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fillText('ASSET FORGE TEXTURE', width / 2, height / 2 + 25);

    return ctx.getImageData(0, 0, width, height);
  }
}
