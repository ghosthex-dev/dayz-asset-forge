/**
 * Bohemia Interactive PAA Texture Parser & Decoder for DayZ
 * Supports DXT1 (BC1), DXT5 (BC3), ARGB8888, ARGB4444, ARGB1555 formats
 * Supports TagGG headers, Mipmap Offsets (OFFS/SFFO), and LZSS compressed mipmaps
 */
export interface PAADecodeResult {
  width: number;
  height: number;
  data: Uint8ClampedArray; // RGBA pixels
  formatName: string;
}

export class PAAParser {
  /**
   * Check if a buffer appears to be a Bohemia PAA file
   */
  public static isPAA(buffer: ArrayBuffer): boolean {
    if (buffer.byteLength < 4) return false;
    const view = new DataView(buffer);
    const magic = view.getUint16(0, true);
    return (
      magic === 0xff01 || // DXT1
      magic === 0xff02 || // DXT2/3
      magic === 0xff03 || // DXT4/5
      magic === 0x4444 || // ARGB 4444
      magic === 0x1555 || // ARGB 1555
      magic === 0x8888 || // ARGB 8888
      magic === 0x8080    // Indexed
    );
  }

  /**
   * Decode PAA into ImageData RGBA buffer
   */
  public static decode(buffer: ArrayBuffer): PAADecodeResult {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    const magic = view.getUint16(0, true);

    let offset = 2;
    let mipmap0Offset = -1;

    // Read TagGG headers (TagGG sections contain average color, max color, and OFFS table)
    while (offset + 8 <= buffer.byteLength) {
      const tag = String.fromCharCode(
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3]
      );

      if (tag === 'GGAT' || tag === 'TAGG') {
        const tagName = String.fromCharCode(
          bytes[offset + 4],
          bytes[offset + 5],
          bytes[offset + 6],
          bytes[offset + 7]
        );
        const tagLen = view.getUint32(offset + 8, true);

        // OFFS / SFFO is the mipmap offsets table
        if (tagName === 'SFFO' || tagName === 'OFFS') {
          if (offset + 12 + 4 <= buffer.byteLength) {
            mipmap0Offset = view.getUint32(offset + 12, true);
          }
        }
        offset += 12 + tagLen;
      } else {
        break;
      }
    }

    if (mipmap0Offset === -1 || mipmap0Offset >= buffer.byteLength) {
      mipmap0Offset = offset;
    }

    if (mipmap0Offset + 6 > buffer.byteLength) {
      return this.fallbackParse();
    }

    // Read Mipmap 0 header
    const rawW = view.getUint16(mipmap0Offset, true);
    const rawH = view.getUint16(mipmap0Offset + 2, true);
    // Highest bit 0x8000 is a flag in Bohemia PAA
    const width = rawW & 0x7fff;
    const height = rawH & 0x7fff;

    const dataSize =
      bytes[mipmap0Offset + 4] |
      (bytes[mipmap0Offset + 5] << 8) |
      (bytes[mipmap0Offset + 6] << 16);
    const dataOffset = mipmap0Offset + 7;

    if (width === 0 || height === 0 || width > 8192 || height > 8192) {
      return this.fallbackParse();
    }

    const output = new Uint8ClampedArray(width * height * 4);
    let formatName = 'Unknown';

    if (magic === 0xff01) {
      formatName = 'DXT1 (BC1)';
      const expectedSize = Math.ceil(width / 4) * Math.ceil(height / 4) * 8;
      let dxtData: Uint8Array;
      if (dataSize < expectedSize) {
        dxtData = this.decompressMipmap(bytes.subarray(dataOffset, dataOffset + dataSize), expectedSize);
      } else {
        dxtData = bytes.subarray(dataOffset, dataOffset + expectedSize);
      }
      this.decodeDXT1(dxtData, width, height, output);
    } else if (magic === 0xff02 || magic === 0xff03) {
      formatName = magic === 0xff02 ? 'DXT3' : 'DXT5 (BC3)';
      const expectedSize = Math.ceil(width / 4) * Math.ceil(height / 4) * 16;
      let dxtData: Uint8Array;
      if (dataSize < expectedSize) {
        dxtData = this.decompressMipmap(bytes.subarray(dataOffset, dataOffset + dataSize), expectedSize);
      } else {
        dxtData = bytes.subarray(dataOffset, dataOffset + expectedSize);
      }
      this.decodeDXT5(dxtData, width, height, output);
    } else if (magic === 0x8888) {
      formatName = 'ARGB8888';
      this.decodeARGB8888(buffer, dataOffset, width, height, output);
    } else if (magic === 0x4444) {
      formatName = 'ARGB4444';
      this.decodeARGB4444(buffer, dataOffset, width, height, output);
    } else if (magic === 0x1555) {
      formatName = 'ARGB1555';
      this.decodeARGB1555(buffer, dataOffset, width, height, output);
    } else {
      formatName = 'Generic/Indexed';
      this.decodeGeneric(buffer, dataOffset, width, height, output);
    }

    return {
      width,
      height,
      data: output,
      formatName,
    };
  }

  /**
   * Decompress Mipmap using pure JS LZSS
   */
  private static decompressMipmap(src: Uint8Array, expectedSize: number): Uint8Array {
    return this.decompressLZSS(src, expectedSize);
  }

  /**
   * Bohemia Interactive Ring-Buffer LZSS Decompressor (used in PAA & P3D)
   */
  private static decompressLZSS(src: Uint8Array, expectedSize: number): Uint8Array {
    const dst = new Uint8Array(expectedSize);
    const ring = new Uint8Array(4096);
    for (let i = 0; i < 4078; i++) ring[i] = 0x20; // initialized to ' ' space

    let r = 4078;
    let flags = 0;
    let srcPos = 0;
    let dstPos = 0;
    let remaining = expectedSize;

    while (remaining > 0 && srcPos < src.length) {
      flags >>= 1;
      if ((flags & 0x100) === 0) {
        flags = src[srcPos++] | 0xff00;
      }

      if ((flags & 1) !== 0) {
        if (srcPos >= src.length) break;
        const c = src[srcPos++];
        dst[dstPos++] = c;
        remaining--;
        ring[r] = c;
        r = (r + 1) & 0xfff;
      } else {
        if (srcPos + 1 >= src.length) break;
        let pos = src[srcPos++];
        let len = src[srcPos++];
        pos |= (len & 0xf0) << 4;
        len = (len & 0x0f) + 2;

        let j = r - pos;
        const end = len + j;
        for (; j <= end && remaining > 0; j++) {
          const c = ring[j & 0xfff];
          dst[dstPos++] = c;
          remaining--;
          ring[r] = c;
          r = (r + 1) & 0xfff;
        }
      }
    }

    return dst;
  }

  private static fallbackParse(): PAADecodeResult {
    const width = 512;
    const height = 512;
    const output = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < output.length; i += 4) {
      output[i] = 75;
      output[i + 1] = 85;
      output[i + 2] = 95;
      output[i + 3] = 255;
    }
    return { width, height, data: output, formatName: 'Fallback Texture' };
  }

  /**
   * Decode DXT1 block compressed data
   */
  private static decodeDXT1(
    bytes: Uint8Array,
    width: number,
    height: number,
    output: Uint8ClampedArray
  ) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const blockCountX = Math.ceil(width / 4);
    const blockCountY = Math.ceil(height / 4);

    let ptr = 0;
    const colors: [number, number, number][] = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];

    for (let by = 0; by < blockCountY; by++) {
      for (let bx = 0; bx < blockCountX; bx++) {
        if (ptr + 8 > bytes.length) return;

        const c0 = view.getUint16(ptr, true);
        const c1 = view.getUint16(ptr + 2, true);
        ptr += 4;

        colors[0] = this.unpack565(c0);
        colors[1] = this.unpack565(c1);

        if (c0 > c1) {
          colors[2] = [
            Math.round((2 * colors[0][0] + colors[1][0]) / 3),
            Math.round((2 * colors[0][1] + colors[1][1]) / 3),
            Math.round((2 * colors[0][2] + colors[1][2]) / 3),
          ];
          colors[3] = [
            Math.round((colors[0][0] + 2 * colors[1][0]) / 3),
            Math.round((colors[0][1] + 2 * colors[1][1]) / 3),
            Math.round((colors[0][2] + 2 * colors[1][2]) / 3),
          ];
        } else {
          colors[2] = [
            Math.round((colors[0][0] + colors[1][0]) / 2),
            Math.round((colors[0][1] + colors[1][1]) / 2),
            Math.round((colors[0][2] + colors[1][2]) / 2),
          ];
          colors[3] = [0, 0, 0];
        }

        const indices = view.getUint32(ptr, true);
        ptr += 4;

        for (let py = 0; py < 4; py++) {
          for (let px = 0; px < 4; px++) {
            const x = bx * 4 + px;
            const y = by * 4 + py;

            if (x < width && y < height) {
              const code = (indices >> ((py * 4 + px) * 2)) & 3;
              const col = colors[code];
              const outIdx = (y * width + x) * 4;

              output[outIdx] = col[0];
              output[outIdx + 1] = col[1];
              output[outIdx + 2] = col[2];
              output[outIdx + 3] = c0 <= c1 && code === 3 ? 0 : 255;
            }
          }
        }
      }
    }
  }

  /**
   * Decode DXT5 block compressed data
   */
  private static decodeDXT5(
    bytes: Uint8Array,
    width: number,
    height: number,
    output: Uint8ClampedArray
  ) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const blockCountX = Math.ceil(width / 4);
    const blockCountY = Math.ceil(height / 4);

    let ptr = 0;
    const alphas = new Uint8Array(8);
    const colors: [number, number, number][] = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];

    for (let by = 0; by < blockCountY; by++) {
      for (let bx = 0; bx < blockCountX; bx++) {
        if (ptr + 16 > bytes.length) return;

        const a0 = bytes[ptr];
        const a1 = bytes[ptr + 1];
        alphas[0] = a0;
        alphas[1] = a1;

        if (a0 > a1) {
          for (let i = 1; i <= 6; i++) {
            alphas[i + 1] = Math.round(((7 - i) * a0 + i * a1) / 7);
          }
        } else {
          for (let i = 1; i <= 4; i++) {
            alphas[i + 1] = Math.round(((5 - i) * a0 + i * a1) / 5);
          }
          alphas[6] = 0;
          alphas[7] = 255;
        }

        let alphaBits = BigInt(0);
        for (let i = 0; i < 6; i++) {
          alphaBits |= BigInt(bytes[ptr + 2 + i]) << BigInt(i * 8);
        }
        ptr += 8;

        const c0 = view.getUint16(ptr, true);
        const c1 = view.getUint16(ptr + 2, true);
        ptr += 4;

        colors[0] = this.unpack565(c0);
        colors[1] = this.unpack565(c1);
        colors[2] = [
          Math.round((2 * colors[0][0] + colors[1][0]) / 3),
          Math.round((2 * colors[0][1] + colors[1][1]) / 3),
          Math.round((2 * colors[0][2] + colors[1][2]) / 3),
        ];
        colors[3] = [
          Math.round((colors[0][0] + 2 * colors[1][0]) / 3),
          Math.round((colors[0][1] + 2 * colors[1][1]) / 3),
          Math.round((colors[0][2] + 2 * colors[1][2]) / 3),
        ];

        const colorIndices = view.getUint32(ptr, true);
        ptr += 4;

        for (let py = 0; py < 4; py++) {
          for (let px = 0; px < 4; px++) {
            const x = bx * 4 + px;
            const y = by * 4 + py;

            if (x < width && y < height) {
              const pixelIndex = py * 4 + px;
              const colCode = (colorIndices >> (pixelIndex * 2)) & 3;
              const alphaCode = Number((alphaBits >> BigInt(pixelIndex * 3)) & BigInt(7));

              const col = colors[colCode];
              const outIdx = (y * width + x) * 4;

              output[outIdx] = col[0];
              output[outIdx + 1] = col[1];
              output[outIdx + 2] = col[2];
              output[outIdx + 3] = alphas[alphaCode];
            }
          }
        }
      }
    }
  }

  private static decodeARGB8888(
    buffer: ArrayBuffer,
    offset: number,
    width: number,
    height: number,
    output: Uint8ClampedArray
  ) {
    const bytes = new Uint8Array(buffer, offset);
    let src = 0;
    let dst = 0;
    const total = width * height;
    for (let i = 0; i < total && src + 4 <= bytes.length; i++) {
      const b = bytes[src++];
      const g = bytes[src++];
      const r = bytes[src++];
      const a = bytes[src++];

      output[dst++] = r;
      output[dst++] = g;
      output[dst++] = b;
      output[dst++] = a;
    }
  }

  private static decodeARGB4444(
    buffer: ArrayBuffer,
    offset: number,
    width: number,
    height: number,
    output: Uint8ClampedArray
  ) {
    const view = new DataView(buffer, offset);
    const total = width * height;
    let dst = 0;
    for (let i = 0; i < total && i * 2 + 2 <= view.byteLength; i++) {
      const val = view.getUint16(i * 2, true);
      const b = ((val & 0x000f) << 4) | (val & 0x000f);
      const g = (val & 0x00f0) | ((val & 0x00f0) >> 4);
      const r = ((val & 0x0f00) >> 4) | ((val & 0x0f00) >> 8);
      const a = ((val & 0xf000) >> 8) | ((val & 0xf000) >> 12);

      output[dst++] = r;
      output[dst++] = g;
      output[dst++] = b;
      output[dst++] = a;
    }
  }

  private static decodeARGB1555(
    buffer: ArrayBuffer,
    offset: number,
    width: number,
    height: number,
    output: Uint8ClampedArray
  ) {
    const view = new DataView(buffer, offset);
    const total = width * height;
    let dst = 0;
    for (let i = 0; i < total && i * 2 + 2 <= view.byteLength; i++) {
      const val = view.getUint16(i * 2, true);
      const b = ((val & 0x1f) * 255) / 31;
      const g = (((val >> 5) & 0x1f) * 255) / 31;
      const r = (((val >> 10) & 0x1f) * 255) / 31;
      const a = val & 0x8000 ? 255 : 0;

      output[dst++] = r;
      output[dst++] = g;
      output[dst++] = b;
      output[dst++] = a;
    }
  }

  private static decodeGeneric(
    buffer: ArrayBuffer,
    offset: number,
    width: number,
    height: number,
    output: Uint8ClampedArray
  ) {
    const bytes = new Uint8Array(buffer, offset);
    let dst = 0;
    for (let i = 0; i < output.length && i < bytes.length; i++) {
      output[dst] = bytes[i];
      dst++;
    }
  }

  private static unpack565(val: number): [number, number, number] {
    const r = ((val >> 11) & 0x1f) * (255 / 31);
    const g = ((val >> 5) & 0x3f) * (255 / 63);
    const b = (val & 0x1f) * (255 / 31);
    return [Math.round(r), Math.round(g), Math.round(b)];
  }

  /**
   * Convert an ImageData canvas into a Bohemia PAA (ARGB4444 uncompressed format)
   */
  public static encodeToPAA(imageData: ImageData): ArrayBuffer {
    const width = imageData.width;
    const height = imageData.height;
    const rgba = imageData.data;

    const dataSize = width * height * 2;
    const totalSize = 2 + 7 + dataSize + 8;
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    view.setUint16(0, 0x4444, true);
    view.setUint16(2, width, true);
    view.setUint16(4, height, true);
    bytes[6] = dataSize & 0xff;
    bytes[7] = (dataSize >> 8) & 0xff;
    bytes[8] = (dataSize >> 16) & 0xff;

    let src = 0;
    let dst = 9;
    for (let i = 0; i < width * height; i++) {
      const r = (rgba[src] >> 4) & 0x0f;
      const g = (rgba[src + 1] >> 4) & 0x0f;
      const b = (rgba[src + 2] >> 4) & 0x0f;
      const a = (rgba[src + 3] >> 4) & 0x0f;
      src += 4;

      const val = (a << 12) | (r << 8) | (g << 4) | b;
      view.setUint16(dst, val, true);
      dst += 2;
    }

    bytes[dst++] = 'T'.charCodeAt(0);
    bytes[dst++] = 'A'.charCodeAt(0);
    bytes[dst++] = 'G'.charCodeAt(0);
    bytes[dst++] = 'G'.charCodeAt(0);
    view.setUint32(dst, 0, true);

    return buffer;
  }
}
