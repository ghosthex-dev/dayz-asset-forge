export interface TransformData {
  position: [number, number, number];
  rotation: [number, number, number]; // in degrees
  scale: [number, number, number];
}

export interface DayZMemoryPoint {
  id: string;
  name: string;
  position: [number, number, number];
  color?: string;
  description?: string;
}

export interface DayZNamedSelection {
  id: string;
  name: string;
  materialSlot: string;
  color?: string;
}

export type DayZLODType = 'LOD 0' | 'LOD 1' | 'LOD 2' | 'ShadowVolume' | 'Geometry' | 'Memory';

export interface TextureAdjustments {
  brightness: number; // -100 to 100
  contrast: number;   // -100 to 100
  saturation: number; // -100 to 100
  hue: number;        // -180 to 180
  tintColor: string;  // hex
  tintAlpha: number;  // 0 to 1
  invert: boolean;
}

export interface DayZRVMATConfig {
  ambient: [number, number, number, number];
  diffuse: [number, number, number, number];
  forcedDiffuse: [number, number, number, number];
  emmisive: [number, number, number, number];
  specular: [number, number, number, number];
  specularPower: number;
  stage1_nohq: string;
  stage2_smdi: string;
}

export interface DayZModConfig {
  className: string;
  baseClass: string;
  displayName: string;
  description: string;
  weight: number; // grams
  itemSize: [number, number]; // [width, height] in inventory grid
  category: 'Weapon' | 'Clothing' | 'Food/Drink' | 'Tool/Melee' | 'VehiclePart' | 'BuildingProp';
  modelPath: string;
}
