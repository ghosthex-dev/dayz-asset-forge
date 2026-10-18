import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import type { IncomingMessage, ServerResponse } from 'http';
import { PBOParser } from '../utils/pboParser';
import { convertPAAToPNG } from './paaConverter';
import { detectDayZInstallations, saveSettings, getToolsDir } from './dayzDetector';

export function createDayZBackendHandler(cacheDir: string) {
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  return async function handleDayZRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const rawUrl = req.url || '';
    if (!rawUrl.startsWith('/api/dayz/')) {
      return false; // not a DayZ API request
    }

    const host = req.headers?.host || 'localhost';
    const parsedUrl = new URL(rawUrl, `http://${host}`);
    const pathname = parsedUrl.pathname;

    try {
      // 1. Detect DayZ & system dependencies
      if (pathname === '/api/dayz/detect') {
        const result = detectDayZInstallations();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));
        return true;
      }

      // 1b. Set active path
      if (pathname === '/api/dayz/set-active-path') {
        const customPath = parsedUrl.searchParams.get('path');
        if (!customPath || !fs.existsSync(customPath)) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: `Directory does not exist: ${customPath}` }));
          return true;
        }

        const pbos = fs.readdirSync(customPath).filter((f) => f.toLowerCase().endsWith('.pbo'));
        saveSettings({ customDayZPath: customPath });

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: true,
          activePath: customPath,
          pboCount: pbos.length,
        }));
        return true;
      }

      // 1c. Browse folder native dialog
      if (pathname === '/api/dayz/browse-folder') {
        try {
          const psCommand = `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = 'Select DayZ Addons Directory'; $f.ShowNewFolderButton = $false; if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.SelectedPath }"`;
          const selected = execSync(psCommand, { encoding: 'utf-8', timeout: 60000 }).trim();

          if (selected && fs.existsSync(selected)) {
            const pbos = fs.readdirSync(selected).filter((f) => f.toLowerCase().endsWith('.pbo'));
            saveSettings({ customDayZPath: selected });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, selectedPath: selected, pboCount: pbos.length }));
          } else {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, cancelled: true }));
          }
        } catch (e: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: e.message }));
        }
        return true;
      }

      // 2. List PBOs in directory
      if (pathname === '/api/dayz/pbos') {
        const detection = detectDayZInstallations();
        const dir = parsedUrl.searchParams.get('dir') || detection.activePath;

        if (!dir || !fs.existsSync(dir)) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: `Directory not found: ${dir}` }));
          return true;
        }

        const files = fs.readdirSync(dir);
        const pbos = files
          .filter((f) => f.toLowerCase().endsWith('.pbo'))
          .map((f) => {
            const fullPath = path.join(dir, f);
            const stats = fs.statSync(fullPath);
            const lower = f.toLowerCase();

            let category = 'Other';
            if (lower.includes('weapon')) category = 'Weapons';
            else if (lower.includes('gear') || lower.includes('food') || lower.includes('drink')) category = 'Gear & Items';
            else if (lower.includes('character') || lower.includes('top') || lower.includes('pant') || lower.includes('vest')) category = 'Clothing';
            else if (lower.includes('vehicle')) category = 'Vehicles';
            else if (lower.includes('structure') || lower.includes('building') || lower.includes('house')) category = 'Structures';
            else if (lower.includes('animal') || lower.includes('infected')) category = 'AI & Characters';
            else if (lower.includes('world') || lower.includes('terrain') || lower.includes('plant')) category = 'Environment';

            return {
              name: f,
              fullPath,
              size: stats.size,
              category,
            };
          });

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ dir, pbos }));
        return true;
      }

      // 3. PBO contents index
      if (pathname === '/api/dayz/pbo/contents') {
        const pboPath = parsedUrl.searchParams.get('pboPath');
        if (!pboPath || !fs.existsSync(pboPath)) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'PBO file not found' }));
          return true;
        }

        const fd = fs.openSync(pboPath, 'r');
        const stat = fs.fstatSync(fd);
        const headSize = Math.min(stat.size, 2 * 1024 * 1024);
        const headBuf = Buffer.alloc(headSize);
        fs.readSync(fd, headBuf, 0, headSize, 0);
        fs.closeSync(fd);

        const arrayBuf = headBuf.buffer.slice(headBuf.byteOffset, headBuf.byteOffset + headBuf.byteLength);
        const parsed = PBOParser.parse(arrayBuf, path.basename(pboPath));

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          pboPath,
          pboName: parsed.pboName,
          prefix: parsed.prefix,
          entries: parsed.entries,
          totalFiles: parsed.entries.length,
        }));
        return true;
      }

      // 4. Extract single file
      if (pathname === '/api/dayz/pbo/extract-file') {
        const pboPath = parsedUrl.searchParams.get('pboPath');
        const fileName = parsedUrl.searchParams.get('fileName');

        if (!pboPath || !fileName || !fs.existsSync(pboPath)) {
          res.statusCode = 404;
          res.end('PBO or file not specified');
          return true;
        }

        const fileBuf = extractBufferFromPBO(pboPath, fileName);
        if (!fileBuf) {
          res.statusCode = 404;
          res.end(`File ${fileName} not found inside ${pboPath}`);
          return true;
        }

        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${path.basename(fileName)}"`);
        res.end(fileBuf);
        return true;
      }

      // 5. Load 3D model
      if (pathname === '/api/dayz/model/load-game-model') {
        const pboPath = parsedUrl.searchParams.get('pboPath');
        const fileName = parsedUrl.searchParams.get('fileName');

        if (!pboPath || !fileName || !fs.existsSync(pboPath)) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Valid pboPath and fileName are required' }));
          return true;
        }

        const p3dBuf = extractBufferFromPBO(pboPath, fileName);
        if (!p3dBuf) {
          throw new Error(`Failed to extract ${fileName} from ${pboPath}`);
        }

        const safeBase = path.basename(fileName, path.extname(fileName)).replace(/[^a-zA-Z0-9_-]/g, '_');
        const cacheP3d = path.join(cacheDir, `${safeBase}.p3d`);
        const cacheObj = path.join(cacheDir, `${safeBase}.obj`);
        const cacheJson = path.join(cacheDir, `${safeBase}.json`);

        fs.writeFileSync(cacheP3d, p3dBuf);

        // Run standalone helper or python
        const helperCandidates = [
          path.resolve(process.cwd(), 'tools', 'bin', 'dayz_helper.exe'),
          path.resolve(process.cwd(), 'resources', 'tools', 'bin', 'dayz_helper.exe'),
          (process as any).resourcesPath ? path.join((process as any).resourcesPath, 'tools', 'bin', 'dayz_helper.exe') : '',
        ].filter(Boolean);

        let converted = false;
        for (const h of helperCandidates) {
          if (fs.existsSync(h)) {
            execSync(`"${h}" convert-p3d "${cacheP3d}" "${cacheObj}" "${cacheJson}"`, { stdio: 'pipe' });
            converted = true;
            break;
          }
        }

        if (!converted) {
          const scriptPath = path.resolve(process.cwd(), 'tools', 'dayz_helper.py');
          execSync(`python "${scriptPath}" convert-p3d "${cacheP3d}" "${cacheObj}" "${cacheJson}"`, { stdio: 'pipe' });
        }

        if (!fs.existsSync(cacheObj) || !fs.existsSync(cacheJson)) {
          throw new Error('Conversion failed to produce OBJ / metadata');
        }

        const objText = fs.readFileSync(cacheObj, 'utf-8');
        const meta = JSON.parse(fs.readFileSync(cacheJson, 'utf-8'));

        let primaryTextureUrl: string | null = null;
        let primaryTextureName: string | null = null;

        if (meta.textures && meta.textures.length > 0) {
          const rawTexPath = meta.textures[0];
          primaryTextureName = path.basename(rawTexPath);

          const texBuf = findAndExtractTexture(pboPath, rawTexPath);
          if (texBuf) {
            const safeTexName = `${safeBase}_${path.basename(rawTexPath)}`;
            const cacheTex = path.join(cacheDir, safeTexName);
            fs.writeFileSync(cacheTex, texBuf);

            if (safeTexName.toLowerCase().endsWith('.paa')) {
              const pngName = safeTexName.replace(/\.paa$/i, '.png');
              const cachePng = path.join(cacheDir, pngName);
              try {
                convertPAAToPNG(cacheTex, cachePng);
                primaryTextureUrl = `/api/dayz/cache-file?file=${encodeURIComponent(pngName)}`;
                primaryTextureName = pngName;
              } catch (convErr) {
                console.warn('Failed to convert PAA to PNG, serving raw PAA:', convErr);
                primaryTextureUrl = `/api/dayz/cache-file?file=${encodeURIComponent(safeTexName)}`;
              }
            } else {
              primaryTextureUrl = `/api/dayz/cache-file?file=${encodeURIComponent(safeTexName)}`;
            }
          }
        }

        if (!primaryTextureUrl) {
          const modelDir = path.dirname(fileName);
          const fallbackTexBuf = findCompanionColorTextureInPBO(pboPath, modelDir, safeBase);
          if (fallbackTexBuf) {
            const safeTexName = `${safeBase}_companion_co.paa`;
            const cacheTex = path.join(cacheDir, safeTexName);
            fs.writeFileSync(cacheTex, fallbackTexBuf);
            const pngName = `${safeBase}_companion_co.png`;
            const cachePng = path.join(cacheDir, pngName);
            try {
              convertPAAToPNG(cacheTex, cachePng);
              primaryTextureUrl = `/api/dayz/cache-file?file=${encodeURIComponent(pngName)}`;
              primaryTextureName = pngName;
            } catch (convErr) {
              console.warn('Failed to convert companion PAA to PNG:', convErr);
              primaryTextureUrl = `/api/dayz/cache-file?file=${encodeURIComponent(safeTexName)}`;
              primaryTextureName = safeTexName;
            }
          }
        }

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: true,
          name: path.basename(fileName, path.extname(fileName)),
          obj: objText,
          meta,
          primaryTextureUrl,
          primaryTextureName,
        }));
        return true;
      }

      // 6. Direct PAA conversion
      if (pathname === '/api/dayz/texture/convert-paa') {
        const pboPath = parsedUrl.searchParams.get('pboPath');
        const fileName = parsedUrl.searchParams.get('fileName');

        if (!pboPath || !fileName || !fs.existsSync(pboPath)) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Valid pboPath and fileName are required' }));
          return true;
        }

        const texBuf = extractBufferFromPBO(pboPath, fileName);
        if (!texBuf) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: `File not found in PBO: ${fileName}` }));
          return true;
        }

        const safeBase = path.basename(fileName).replace(/[^a-zA-Z0-9_-]/g, '_');
        const cachePaa = path.join(cacheDir, safeBase);
        const pngName = safeBase.replace(/\.paa$/i, '') + '.png';
        const cachePng = path.join(cacheDir, pngName);

        fs.writeFileSync(cachePaa, texBuf);
        const conv = convertPAAToPNG(cachePaa, cachePng);

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: true,
          fileName: path.basename(fileName),
          pngName,
          pngUrl: `/api/dayz/cache-file?file=${encodeURIComponent(pngName)}`,
          width: conv.width,
          height: conv.height,
        }));
        return true;
      }

      // 7. Unpack full PBO archive
      if (pathname === '/api/dayz/pbo/unpack') {
        const pboPath = parsedUrl.searchParams.get('pboPath');
        if (!pboPath || !fs.existsSync(pboPath)) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Valid pboPath required' }));
          return true;
        }

        const pboBase = path.basename(pboPath, '.pbo');
        const outDir = path.resolve(process.cwd(), 'unpacked', pboBase);
        if (!fs.existsSync(outDir)) {
          fs.mkdirSync(outDir, { recursive: true });
        }

        const fd = fs.openSync(pboPath, 'r');
        const stat = fs.fstatSync(fd);
        const headSize = Math.min(stat.size, 5 * 1024 * 1024);
        const headBuf = Buffer.alloc(headSize);
        fs.readSync(fd, headBuf, 0, headSize, 0);

        const arrayBuf = headBuf.buffer.slice(headBuf.byteOffset, headBuf.byteOffset + headBuf.byteLength);
        const parsed = PBOParser.parse(arrayBuf, path.basename(pboPath));

        let extractedCount = 0;
        for (const entry of parsed.entries) {
          if (entry.size === 0) continue;
          const relPath = entry.name.replace(/\\/g, path.sep);
          const targetFile = path.join(outDir, relPath);
          const targetDir = path.dirname(targetFile);

          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }

          const fileBuf = Buffer.alloc(entry.size);
          fs.readSync(fd, fileBuf, 0, entry.size, entry.offset);
          fs.writeFileSync(targetFile, fileBuf);
          extractedCount++;
        }

        fs.closeSync(fd);

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: true,
          pboName: path.basename(pboPath),
          outDir,
          extractedCount,
        }));
        return true;
      }

      // 8. Serve cached files
      if (pathname === '/api/dayz/cache-file') {
        const fileName = parsedUrl.searchParams.get('file');
        if (!fileName) {
          res.statusCode = 400;
          res.end('Missing file parameter');
          return true;
        }

        const safeName = path.basename(fileName);
        const filePath = path.join(cacheDir, safeName);
        if (!fs.existsSync(filePath)) {
          res.statusCode = 404;
          res.end('Cached file not found');
          return true;
        }

        const ext = path.extname(safeName).toLowerCase();
        let mime = 'application/octet-stream';
        if (ext === '.png') mime = 'image/png';
        else if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
        else if (ext === '.obj') mime = 'text/plain; charset=utf-8';
        else if (ext === '.json') mime = 'application/json';

        res.setHeader('Content-Type', mime);
        res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
        fs.createReadStream(filePath).pipe(res);
        return true;
      }

      return false;
    } catch (err: any) {
      console.error('DayZ Backend API Error:', err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message || 'Server error' }));
      return true;
    }
  };
}

// Helpers
function extractBufferFromPBO(pboPath: string, fileName: string): Buffer | null {
  const fd = fs.openSync(pboPath, 'r');
  const stat = fs.fstatSync(fd);
  const headSize = Math.min(stat.size, 2 * 1024 * 1024);
  const headBuf = Buffer.alloc(headSize);
  fs.readSync(fd, headBuf, 0, headSize, 0);

  const arrayBuf = headBuf.buffer.slice(headBuf.byteOffset, headBuf.byteOffset + headBuf.byteLength);
  const parsed = PBOParser.parse(arrayBuf, path.basename(pboPath));

  const normTarget = fileName.replace(/\//g, '\\').toLowerCase();
  const targetBase = path.basename(normTarget);
  const normPrefix = (parsed.prefix || '').replace(/\//g, '\\').toLowerCase();

  const target = parsed.entries.find((e) => {
    const eNorm = e.name.replace(/\//g, '\\').toLowerCase();
    const withPrefix = normPrefix ? `${normPrefix}\\${eNorm}` : eNorm;
    return (
      eNorm === normTarget ||
      withPrefix === normTarget ||
      eNorm.endsWith(normTarget) ||
      normTarget.endsWith(eNorm) ||
      path.basename(eNorm) === targetBase
    );
  });

  if (!target) {
    fs.closeSync(fd);
    return null;
  }

  const fileBuf = Buffer.alloc(target.size);
  fs.readSync(fd, fileBuf, 0, target.size, target.offset);
  fs.closeSync(fd);
  return fileBuf;
}

function findAndExtractTexture(currentPboPath: string, texPath: string): Buffer | null {
  const texBase = path.basename(texPath).toLowerCase();
  const normTex = texPath.replace(/\//g, '\\').toLowerCase();

  try {
    const fd = fs.openSync(currentPboPath, 'r');
    const headBuf = Buffer.alloc(2 * 1024 * 1024);
    fs.readSync(fd, headBuf, 0, headBuf.length, 0);
    const parsed = PBOParser.parse(
      headBuf.buffer.slice(headBuf.byteOffset, headBuf.byteOffset + headBuf.byteLength),
      path.basename(currentPboPath)
    );

    const entry = parsed.entries.find((e) => {
      const eNorm = e.name.replace(/\//g, '\\').toLowerCase();
      return eNorm === normTex || eNorm.endsWith(texBase);
    });

    if (entry) {
      const buf = Buffer.alloc(entry.size);
      fs.readSync(fd, buf, 0, entry.size, entry.offset);
      fs.closeSync(fd);
      return buf;
    }
    fs.closeSync(fd);
  } catch {}

  const addonsDir = path.dirname(currentPboPath);
  if (fs.existsSync(addonsDir)) {
    try {
      const files = fs.readdirSync(addonsDir);
      for (const pbo of files) {
        if (!pbo.toLowerCase().endsWith('.pbo')) continue;
        const candidatePbo = path.join(addonsDir, pbo);
        if (candidatePbo === currentPboPath) continue;

        const pboLower = pbo.toLowerCase();
        const seemsRelevant =
          (normTex.includes('gear') && pboLower.includes('gear')) ||
          (normTex.includes('weapon') && pboLower.includes('weapon')) ||
          (normTex.includes('character') && pboLower.includes('character')) ||
          (normTex.includes('vehicle') && pboLower.includes('vehicle')) ||
          (normTex.includes('data') && pboLower.includes('data'));

        if (!seemsRelevant) continue;

        const buf = extractBufferFromPBO(candidatePbo, texPath);
        if (buf) return buf;

        const fd = fs.openSync(candidatePbo, 'r');
        const headBuf = Buffer.alloc(2 * 1024 * 1024);
        fs.readSync(fd, headBuf, 0, headBuf.length, 0);
        const parsed = PBOParser.parse(
          headBuf.buffer.slice(headBuf.byteOffset, headBuf.byteOffset + headBuf.byteLength),
          pbo
        );
        const entry = parsed.entries.find((e) => path.basename(e.name).toLowerCase() === texBase);
        if (entry) {
          const entryBuf = Buffer.alloc(entry.size);
          fs.readSync(fd, entryBuf, 0, entry.size, entry.offset);
          fs.closeSync(fd);
          return entryBuf;
        }
        fs.closeSync(fd);
      }
    } catch {}
  }

  return null;
}

function findCompanionColorTextureInPBO(pboPath: string, modelDir: string, modelBase: string): Buffer | null {
  try {
    const fd = fs.openSync(pboPath, 'r');
    const headBuf = Buffer.alloc(2 * 1024 * 1024);
    fs.readSync(fd, headBuf, 0, headBuf.length, 0);
    const parsed = PBOParser.parse(
      headBuf.buffer.slice(headBuf.byteOffset, headBuf.byteOffset + headBuf.byteLength),
      path.basename(pboPath)
    );

    const normDir = modelDir.replace(/\//g, '\\').toLowerCase();
    const modelBaseLower = modelBase.toLowerCase();

    const entry = parsed.entries.find((e) => {
      const eLower = e.name.toLowerCase();
      return (
        eLower.endsWith('.paa') &&
        (eLower.includes(modelBaseLower) || eLower.includes('_co.paa')) &&
        (normDir === '' || e.name.toLowerCase().includes(normDir))
      );
    });

    if (entry) {
      const buf = Buffer.alloc(entry.size);
      fs.readSync(fd, buf, 0, entry.size, entry.offset);
      fs.closeSync(fd);
      return buf;
    }
    fs.closeSync(fd);
  } catch {}
  return null;
}
