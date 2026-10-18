/**
 * Bohemia Interactive PBO Archive Parser
 * Extracts file directories and file contents from DayZ .pbo archives
 */

export interface PBOEntry {
  name: string;
  size: number;
  offset: number;
  type: 'model' | 'texture' | 'material' | 'config' | 'other';
  ext: string;
}

export interface PBODirectory {
  pboName: string;
  prefix: string;
  entries: PBOEntry[];
  totalSize: number;
}

export class PBOParser {
  /**
   * Parse a PBO buffer into a PBODirectory object
   */
  public static parse(buffer: ArrayBuffer, pboName: string = 'archive.pbo'): PBODirectory {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);

    let offset = 0;
    // Skip initial empty filename
    while (offset < bytes.length && bytes[offset] !== 0) offset++;
    offset++; // null byte

    if (offset + 20 > bytes.length) {
      throw new Error('PBO buffer is too small to contain valid header');
    }

    const packing = view.getUint32(offset, true);
    offset += 20; // 5 x 4 bytes

    let prefix = '';
    // Packing magic 0x56657273 ("sreV") or 0x50726573 ("sreP") indicates header with property tags
    if (packing === 0x56657273 || packing === 0x50726573 || packing === 0x53726556 || packing === 0x53726550) {
      while (offset < bytes.length && bytes[offset] !== 0) {
        let key = '';
        while (offset < bytes.length && bytes[offset] !== 0) {
          key += String.fromCharCode(bytes[offset++]);
        }
        offset++; // null

        let val = '';
        while (offset < bytes.length && bytes[offset] !== 0) {
          val += String.fromCharCode(bytes[offset++]);
        }
        offset++; // null

        if (key.toLowerCase() === 'prefix') {
          prefix = val;
        }
      }
      offset++; // terminating null of tags block
    }

    // Read entries
    const entries: PBOEntry[] = [];
    while (offset < bytes.length && bytes[offset] !== 0) {
      let name = '';
      while (offset < bytes.length && bytes[offset] !== 0) {
        name += String.fromCharCode(bytes[offset++]);
      }
      offset++; // null

      if (offset + 20 > bytes.length) break;

      const fPacking = view.getUint32(offset, true);
      const fOrigSize = view.getUint32(offset + 4, true);
      const fReserved = view.getUint32(offset + 8, true);
      const fTimestamp = view.getUint32(offset + 12, true);
      const fDataSize = view.getUint32(offset + 16, true);
      offset += 20;

      const ext = name.split('.').pop()?.toLowerCase() || '';
      let type: PBOEntry['type'] = 'other';
      if (ext === 'p3d') type = 'model';
      else if (ext === 'paa' || ext === 'png' || ext === 'jpg') type = 'texture';
      else if (ext === 'rvmat') type = 'material';
      else if (ext === 'cpp' || ext === 'bin') type = 'config';

      entries.push({
        name,
        size: fDataSize,
        offset: 0,
        type,
        ext,
      });
    }

    offset++; // terminal empty entry
    offset += 20; // terminal 20 bytes

    const dataStart = offset;
    let curDataOffset = dataStart;
    let totalSize = 0;

    for (const entry of entries) {
      entry.offset = curDataOffset;
      curDataOffset += entry.size;
      totalSize += entry.size;
    }

    return {
      pboName,
      prefix,
      entries,
      totalSize,
    };
  }

  /**
   * Extract a specific entry from a PBO buffer
   */
  public static extractFile(buffer: ArrayBuffer, entry: PBOEntry): ArrayBuffer {
    if (entry.offset + entry.size > buffer.byteLength) {
      throw new Error(`File offset ${entry.offset} + size ${entry.size} exceeds PBO buffer length`);
    }
    return buffer.slice(entry.offset, entry.offset + entry.size);
  }
}
