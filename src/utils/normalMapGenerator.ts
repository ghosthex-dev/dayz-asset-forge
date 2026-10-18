/**
 * Generates DayZ compatible Normal Maps (_nohq) and Specular/Detail Maps (_smdi)
 * from standard Diffuse / Color textures using GPU/Canvas Sobel filters.
 */

export class TextureGenerator {
  /**
   * Generate a Normal Map (_nohq) from an ImageData source
   * @param source RGBA ImageData
   * @param strength Normal map intensity (1 to 10)
   * @param invertY DayZ uses DirectX convention (inverted Y/Green channel)
   */
  public static generateNormalMap(
    source: ImageData,
    strength: number = 3.0,
    invertY: boolean = true
  ): ImageData {
    const width = source.width;
    const height = source.height;
    const srcData = source.data;
    const output = new ImageData(width, height);
    const outData = output.data;

    // Helper to get luminance at (x, y)
    const getLum = (x: number, y: number): number => {
      const clampedX = Math.max(0, Math.min(width - 1, x));
      const clampedY = Math.max(0, Math.min(height - 1, y));
      const idx = (clampedY * width + clampedX) * 4;
      // Perceptual luminance
      return (srcData[idx] * 0.299 + srcData[idx + 1] * 0.587 + srcData[idx + 2] * 0.114) / 255.0;
    };

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Sobel filter 3x3
        // tl  t  tr
        //  l  c   r
        // bl  b  br
        const tl = getLum(x - 1, y - 1);
        const t  = getLum(x,     y - 1);
        const tr = getLum(x + 1, y - 1);
        const l  = getLum(x - 1, y);
        const r  = getLum(x + 1, y);
        const bl = getLum(x - 1, y + 1);
        const b  = getLum(x,     y + 1);
        const br = getLum(x + 1, y + 1);

        // dx = (tr + 2*r + br) - (tl + 2*l + bl)
        // dy = (bl + 2*b + br) - (tl + 2*t + tr)
        const dx = (tr + 2.0 * r + br) - (tl + 2.0 * l + bl);
        let dy = (bl + 2.0 * b + br) - (tl + 2.0 * t + tr);

        if (invertY) {
          dy = -dy; // DayZ DirectX format
        }

        // Normal vector [nx, ny, nz]
        let nx = -dx * strength;
        let ny = -dy * strength;
        let nz = 1.0;

        // Normalize
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        nx /= len;
        ny /= len;
        nz /= len;

        const outIdx = (y * width + x) * 4;
        // Map [-1, 1] to [0, 255]
        outData[outIdx]     = Math.floor(((nx + 1.0) * 0.5) * 255); // Red (X)
        outData[outIdx + 1] = Math.floor(((ny + 1.0) * 0.5) * 255); // Green (Y)
        outData[outIdx + 2] = Math.floor(((nz + 1.0) * 0.5) * 255); // Blue (Z)
        outData[outIdx + 3] = 255; // Alpha
      }
    }

    return output;
  }

  /**
   * Generate DayZ Specular/Roughness map (_smdi)
   * Red: Diffuse roughness / Ambient occlusion
   * Green: Specular intensity
   * Blue: Glossiness / micro-roughness
   */
  public static generateSMDIMap(source: ImageData): ImageData {
    const width = source.width;
    const height = source.height;
    const srcData = source.data;
    const output = new ImageData(width, height);
    const outData = output.data;

    for (let i = 0; i < srcData.length; i += 4) {
      const r = srcData[i];
      const g = srcData[i + 1];
      const b = srcData[i + 2];
      const lum = (r * 0.299 + g * 0.587 + b * 0.114);

      // DayZ _smdi channel packing:
      // Red: Roughness (darker areas are smoother, brighter are rougher)
      outData[i] = Math.min(255, Math.floor(255 - lum * 0.6));
      // Green: Specular (brighter diffuse has moderate specular highlight)
      outData[i + 1] = Math.min(255, Math.floor(lum * 0.8 + 30));
      // Blue: Glossiness
      outData[i + 2] = Math.min(255, Math.floor(lum * 0.9));
      // Alpha: Fresnel reflection
      outData[i + 3] = 255;
    }

    return output;
  }

  /**
   * Apply color adjustments to ImageData (brightness, contrast, saturation, hue, tint)
   */
  public static applyAdjustments(
    source: ImageData,
    brightness: number, // -100 to 100
    contrast: number,   // -100 to 100
    saturation: number, // -100 to 100
    hue: number,        // -180 to 180
    tintColorHex: string,
    tintAlpha: number,  // 0 to 1
    invert: boolean
  ): ImageData {
    const width = source.width;
    const height = source.height;
    const srcData = source.data;
    const output = new ImageData(width, height);
    const outData = output.data;

    // Parse tint color
    const tintR = parseInt(tintColorHex.slice(1, 3), 16) || 0;
    const tintG = parseInt(tintColorHex.slice(3, 5), 16) || 0;
    const tintB = parseInt(tintColorHex.slice(5, 7), 16) || 0;

    // Contrast factor
    const cFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    const bOffset = (brightness / 100) * 128;
    const sFactor = (saturation + 100) / 100;
    const hueRad = (hue * Math.PI) / 180;

    for (let i = 0; i < srcData.length; i += 4) {
      let r = srcData[i];
      let g = srcData[i + 1];
      let b = srcData[i + 2];
      const a = srcData[i + 3];

      if (invert) {
        r = 255 - r;
        g = 255 - g;
        b = 255 - b;
      }

      // Brightness & Contrast
      r = Math.min(255, Math.max(0, cFactor * (r - 128) + 128 + bOffset));
      g = Math.min(255, Math.max(0, cFactor * (g - 128) + 128 + bOffset));
      b = Math.min(255, Math.max(0, cFactor * (b - 128) + 128 + bOffset));

      // Saturation
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = Math.min(255, Math.max(0, gray + (r - gray) * sFactor));
      g = Math.min(255, Math.max(0, gray + (g - gray) * sFactor));
      b = Math.min(255, Math.max(0, gray + (b - gray) * sFactor));

      // Hue rotation
      if (hue !== 0) {
        const u = Math.cos(hueRad);
        const w = Math.sin(hueRad);
        const newR = (.299 + .701*u + .168*w)*r + (.587 - .587*u + .330*w)*g + (.114 - .114*u - .497*w)*b;
        const newG = (.299 - .299*u - .328*w)*r + (.587 + .413*u + .035*w)*g + (.114 - .114*u + .288*w)*b;
        const newB = (.299 - .300*u + 1.25*w)*r + (.587 - .588*u - 1.05*w)*g + (.114 + .886*u - .203*w)*b;
        r = Math.min(255, Math.max(0, newR));
        g = Math.min(255, Math.max(0, newG));
        b = Math.min(255, Math.max(0, newB));
      }

      // Tint overlay
      if (tintAlpha > 0) {
        r = r * (1 - tintAlpha) + tintR * tintAlpha;
        g = g * (1 - tintAlpha) + tintG * tintAlpha;
        b = b * (1 - tintAlpha) + tintB * tintAlpha;
      }

      outData[i]     = Math.round(r);
      outData[i + 1] = Math.round(g);
      outData[i + 2] = Math.round(b);
      outData[i + 3] = a;
    }

    return output;
  }
}
