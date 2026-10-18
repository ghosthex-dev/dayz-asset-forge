import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import lzo from 'lzo-decompress';

function unpack565(val: number): [number, number, number] {
  const r = ((val >> 11) & 0x1f) * (255 / 31);
  const g = ((val >> 5) & 0x3f) * (255 / 63);
  const b = (val & 0x1f) * (255 / 31);
  return [Math.round(r), Math.round(g), Math.round(b)];
}

function decodeDXT1(bytes: Uint8Array, width: number, height: number): Buffer {
  const output = Buffer.alloc(width * height * 4);
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
      if (ptr + 8 > bytes.length) break;

      const c0 = view.getUint16(ptr, true);
      const c1 = view.getUint16(ptr + 2, true);
      ptr += 4;

      colors[0] = unpack565(c0);
      colors[1] = unpack565(c1);

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
  return output;
}

function decodeDXT5(bytes: Uint8Array, width: number, height: number): Buffer {
  const output = Buffer.alloc(width * height * 4);
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
      if (ptr + 16 > bytes.length) break;

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

      colors[0] = unpack565(c0);
      colors[1] = unpack565(c1);

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
  return output;
}

function decodeARGB8888(bytes: Uint8Array, offset: number, width: number, height: number): Buffer {
  const output = Buffer.alloc(width * height * 4);
  let p = offset;
  for (let i = 0; i < width * height; i++) {
    if (p + 4 > bytes.length) break;
    const a = bytes[p];
    const r = bytes[p + 1];
    const g = bytes[p + 2];
    const b = bytes[p + 3];
    p += 4;
    const outIdx = i * 4;
    output[outIdx] = r;
    output[outIdx + 1] = g;
    output[outIdx + 2] = b;
    output[outIdx + 3] = a;
  }
  return output;
}

export function convertPAAToPNG(paaBufferOrPath: Buffer | string, outPngPath: string): { width: number; height: number; outPngPath: string } {
  const buf = typeof paaBufferOrPath === 'string' ? fs.readFileSync(paaBufferOrPath) : paaBufferOrPath;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const magic = view.getUint16(0, true);

  let offset = 2;
  let mipOffset = -1;

  while (offset + 8 <= buf.length) {
    const tag = buf.subarray(offset, offset + 4).toString('latin1');
    if (tag === 'GGAT' || tag === 'TAGG') {
      const name = buf.subarray(offset + 4, offset + 8).toString('latin1');
      const len = buf.readUInt32LE(offset + 8);
      if (name === 'OFFS' || name === 'SFFO') {
        mipOffset = buf.readUInt32LE(offset + 12);
      }
      offset += 12 + len;
    } else {
      break;
    }
  }

  if (mipOffset === -1 || mipOffset >= buf.length) {
    mipOffset = offset;
  }

  const rawW = buf.readUInt16LE(mipOffset);
  const rawH = buf.readUInt16LE(mipOffset + 2);
  const width = rawW & 0x7fff;
  const height = rawH & 0x7fff;

  if (width === 0 || height === 0 || width > 8192 || height > 8192) {
    throw new Error(`Invalid PAA dimensions: ${width}x${height}`);
  }

  const dataSize =
    buf[mipOffset + 4] |
    (buf[mipOffset + 5] << 8) |
    (buf[mipOffset + 6] << 16);
  const compData = buf.subarray(mipOffset + 7, mipOffset + 7 + dataSize);

  let rgbaBuffer: Buffer;

  if (magic === 0xff01) {
    // DXT1
    const expected = Math.ceil(width / 4) * Math.ceil(height / 4) * 8;
    let dxtData: Uint8Array;
    if (dataSize < expected) {
      dxtData = lzo.decompress(compData, expected);
    } else {
      dxtData = compData;
    }
    rgbaBuffer = decodeDXT1(dxtData, width, height);
  } else if (magic === 0xff02 || magic === 0xff03 || magic === 0xff05) {
    // DXT3 / DXT5
    const expected = Math.ceil(width / 4) * Math.ceil(height / 4) * 16;
    let dxtData: Uint8Array;
    if (dataSize < expected) {
      dxtData = lzo.decompress(compData, expected);
    } else {
      dxtData = compData;
    }
    rgbaBuffer = decodeDXT5(dxtData, width, height);
  } else if (magic === 0x8888) {
    rgbaBuffer = decodeARGB8888(buf, mipOffset + 7, width, height);
  } else {
    rgbaBuffer = Buffer.alloc(width * height * 4, 128);
  }

  const tempRgba = `${outPngPath}.tmp.rgba`;
  fs.writeFileSync(tempRgba, rgbaBuffer);

  const helperCandidates = [
    path.resolve(process.cwd(), 'tools', 'bin', 'dayz_helper.exe'),
    path.resolve(process.cwd(), 'resources', 'tools', 'bin', 'dayz_helper.exe'),
    (process as any).resourcesPath ? path.join((process as any).resourcesPath, 'tools', 'bin', 'dayz_helper.exe') : '',
  ].filter(Boolean);

  let executed = false;
  for (const h of helperCandidates) {
    if (fs.existsSync(h)) {
      execSync(`"${h}" rgba-to-png "${tempRgba}" ${width} ${height} "${outPngPath}"`, { stdio: 'pipe' });
      executed = true;
      break;
    }
  }

  if (!executed) {
    const rgbaToPngScript = path.resolve(process.cwd(), 'tools', 'rgba_to_png.py');
    execSync(`python "${rgbaToPngScript}" "${tempRgba}" ${width} ${height} "${outPngPath}"`, { stdio: 'pipe' });
  }

  try {
    fs.unlinkSync(tempRgba);
  } catch (e) {
    // ignore
  }

  return { width, height, outPngPath };
}
