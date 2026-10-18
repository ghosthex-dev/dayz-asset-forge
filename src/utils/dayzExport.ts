import * as THREE from 'three';
import { DayZRVMATConfig, DayZModConfig, DayZMemoryPoint, DayZNamedSelection } from '../types';
import { PAAParser } from './paaParser';

export class DayZExporter {
  /**
   * Generate Bohemia RVMAT content
   */
  public static generateRVMAT(
    config: DayZRVMATConfig,
    baseTexturePath: string = 'dz\\gear\\my_item\\data'
  ): string {
    return `////////////////////////////////////////////////////////////////////
// DayZ Asset Forge - RVMAT Material Definition
// Generated for Bohemia Interactive Real Virtuality & Enfusion Engine
////////////////////////////////////////////////////////////////////

ambient[] = {${config.ambient.join(', ')}};
diffuse[] = {${config.diffuse.join(', ')}};
forcedDiffuse[] = {${config.forcedDiffuse.join(', ')}};
emmisive[] = {${config.emmisive.join(', ')}};
specular[] = {${config.specular.join(', ')}};
specularPower = ${config.specularPower};
PixelShaderID = "Super";
VertexShaderID = "Super";

class Stage1
{
\ttexture = "${baseTexturePath}\\item_nohq.paa";
\tuvSource = "tex";
\tclass uvTransform
\t{
\t\taside[] = {1,0,0};
\t\tup[] = {0,1,0};
\t\tdir[] = {0,0,0};
\t\tpos[] = {0,0,0};
\t};
};

class Stage2
{
\ttexture = "${baseTexturePath}\\item_smdi.paa";
\tuvSource = "tex";
\tclass uvTransform
\t{
\t\taside[] = {1,0,0};
\t\tup[] = {0,1,0};
\t\tdir[] = {0,0,0};
\t\tpos[] = {0,0,0};
\t};
};
`;
  }

  /**
   * Generate DayZ config.cpp for PBO addon packaging
   */
  public static generateConfigCPP(
    mod: DayZModConfig,
    namedSelections: DayZNamedSelection[],
    memoryPoints: DayZMemoryPoint[]
  ): string {
    const parentCfg = mod.category === 'Weapon' ? 'CfgWeapons' : 'CfgVehicles';
    const selectionNames = namedSelections.map((s) => `"${s.name}"`).join(', ');

    return `////////////////////////////////////////////////////////////////////
// DayZ Asset Forge - PBO config.cpp
// Class: ${mod.className}
////////////////////////////////////////////////////////////////////

class CfgPatches
{
\tclass ${mod.className}_Mod
\t{
\t\tunits[] = {"${mod.className}"};
\t\tweapons[] = {};
\t\trequiredVersion = 0.1;
\t\trequiredAddons[] = {"DZ_Data", "DZ_Gear_Drinks", "DZ_Weapons_Melee"};
\t};
};

class ${parentCfg}
{
\tclass ${mod.baseClass};
\tclass ${mod.className}: ${mod.baseClass}
\t{
\t\tscope = 2;
\t\tdisplayName = "${mod.displayName}";
\t\tdescriptionShort = "${mod.description}";
\t\tmodel = "${mod.modelPath}";
\t\tweight = ${mod.weight};
\t\titemSize[] = {${mod.itemSize[0]}, ${mod.itemSize[1]}};
\t\trotationFlags = 17;
\t\thiddenSelections[] = {${selectionNames || '"camo", "zbytek"'}};
\t\thiddenSelectionsTextures[] = {
\t\t\t"my_mod\\data\\item_co.paa"
\t\t};
\t\thiddenSelectionsMaterials[] = {
\t\t\t"my_mod\\data\\item.rvmat"
\t\t};

\t\tclass DamageSystem
\t\t{
\t\t\tclass GlobalHealth
\t\t\t{
\t\t\t\tclass Health
\t\t\t\t{
\t\t\t\t\thitpoints = 100;
\t\t\t\t\thealthLevels[] = {
\t\t\t\t\t\t{1.0, {"my_mod\\data\\item.rvmat"}},
\t\t\t\t\t\t{0.7, {"my_mod\\data\\item.rvmat"}},
\t\t\t\t\t\t{0.5, {"my_mod\\data\\item_damage.rvmat"}},
\t\t\t\t\t\t{0.3, {"my_mod\\data\\item_damage.rvmat"}},
\t\t\t\t\t\t{0.0, {"my_mod\\data\\item_destruct.rvmat"}}
\t\t\t\t\t};
\t\t\t\t};
\t\t\t};
\t\t};
\t};
};
`;
  }

  /**
   * Generate Bohemia model.cfg with skeleton definitions & memory points
   */
  public static generateModelCFG(
    modelName: string,
    namedSelections: DayZNamedSelection[],
    memoryPoints: DayZMemoryPoint[]
  ): string {
    const bones = namedSelections.map((s) => `\t\t\t"${s.name}", ""`).join(',\n');

    return `////////////////////////////////////////////////////////////////////
// DayZ Asset Forge - model.cfg
////////////////////////////////////////////////////////////////////

class CfgSkeletons
{
\tclass ${modelName}_Skeleton
\t{
\t\tisDiscrete = 1;
\t\tskeletonInherit = "";
\t\tskeletonBones[] =
\t\t{
${bones || '\t\t\t"camo", ""'}
\t\t};
\t};
};

class CfgModels
{
\tclass Default;
\tclass ${modelName}: Default
\t{
\t\tskeletonName = "${modelName}_Skeleton";
\t\tsectionsInherit = "";
\t\tsections[] =
\t\t{
${namedSelections.map((s) => `\t\t\t"${s.name}"`).join(',\n') || '\t\t\t"camo"'}
\t\t};
\t\tclass Animations
\t\t{
\t\t};
\t};
};
`;
  }

  /**
   * Export Three.js Mesh to Wavefront OBJ format
   */
  public static exportToOBJ(mesh: THREE.Mesh, modelName: string = 'dayz_asset'): string {
    const geometry = mesh.geometry;
    let output = `# DayZ Asset Forge - Wavefront OBJ Exporter\n`;
    output += `# Model: ${modelName}\n`;
    output += `o ${modelName}\n\n`;

    const pos = geometry.attributes.position;
    const normals = geometry.attributes.normal;
    const uvs = geometry.attributes.uv;

    if (!pos) return output;

    // Vertices (v x y z)
    for (let i = 0; i < pos.count; i++) {
      output += `v ${pos.getX(i).toFixed(6)} ${pos.getY(i).toFixed(6)} ${pos.getZ(i).toFixed(6)}\n`;
    }

    // Texture Coordinates (vt u v)
    if (uvs) {
      for (let i = 0; i < uvs.count; i++) {
        output += `vt ${uvs.getX(i).toFixed(6)} ${uvs.getY(i).toFixed(6)}\n`;
      }
    }

    // Vertex Normals (vn x y z)
    if (normals) {
      for (let i = 0; i < normals.count; i++) {
        output += `vn ${normals.getX(i).toFixed(6)} ${normals.getY(i).toFixed(6)} ${normals.getZ(i).toFixed(6)}\n`;
      }
    }

    // Faces (f v/vt/vn)
    output += `\ns 1\n`;
    if (geometry.index) {
      const idx = geometry.index.array;
      for (let i = 0; i < idx.length; i += 3) {
        const v1 = idx[i] + 1;
        const v2 = idx[i + 1] + 1;
        const v3 = idx[i + 2] + 1;
        if (uvs && normals) {
          output += `f ${v1}/${v1}/${v1} ${v2}/${v2}/${v2} ${v3}/${v3}/${v3}\n`;
        } else if (normals) {
          output += `f ${v1}//${v1} ${v2}//${v2} ${v3}//${v3}\n`;
        } else {
          output += `f ${v1} ${v2} ${v3}\n`;
        }
      }
    } else {
      for (let i = 0; i < pos.count; i += 3) {
        const v1 = i + 1;
        const v2 = i + 2;
        const v3 = i + 3;
        if (uvs && normals) {
          output += `f ${v1}/${v1}/${v1} ${v2}/${v2}/${v2} ${v3}/${v3}/${v3}\n`;
        } else {
          output += `f ${v1} ${v2} ${v3}\n`;
        }
      }
    }

    return output;
  }

  /**
   * Helper to download a string as a text file
   */
  public static downloadFile(filename: string, content: string | Blob): void {
    const blob = content instanceof Blob ? content : new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Helper to download ImageData as PAA or PNG
   */
  public static downloadTexture(imageData: ImageData, filename: string, asPAA: boolean = false): void {
    if (asPAA) {
      const paaBuffer = PAAParser.encodeToPAA(imageData);
      const blob = new Blob([paaBuffer], { type: 'application/octet-stream' });
      this.downloadFile(filename.replace(/\.[^/.]+$/, '') + '.paa', blob);
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d')!;
      ctx.putImageData(imageData, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          this.downloadFile(filename.replace(/\.[^/.]+$/, '') + '.png', blob);
        }
      });
    }
  }
}
