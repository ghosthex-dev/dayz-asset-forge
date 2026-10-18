import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';

export interface DayZDetectionResult {
  activePath: string;
  detectedPaths: string[];
  steamPath: string | null;
  hasDayZTools: boolean;
  dayzToolsPath: string | null;
  pboCount: number;
  systemDependencies: {
    hasVCRedist: boolean;
    hasOdolConvert: boolean;
    hasDayZHelper: boolean;
  };
}

export function getSettingsPath(): string {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const dir = path.join(appData, 'DayZAssetForge');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, 'settings.json');
}

export function loadSettings(): Record<string, any> {
  const p = getSettingsPath();
  if (fs.existsSync(p)) {
    try {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch {
      return {};
    }
  }
  return {};
}

export function saveSettings(settings: Record<string, any>): boolean {
  const p = getSettingsPath();
  try {
    const current = loadSettings();
    fs.writeFileSync(p, JSON.stringify({ ...current, ...settings }, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to save settings:', err);
    return false;
  }
}

export function getToolsDir(): string {
  const candidates = [
    // Production packaged resources
    path.join(process.cwd(), 'resources', 'tools', 'bin'),
    path.join(process.cwd(), 'resources', 'tools'),
    (process as any).resourcesPath ? path.join((process as any).resourcesPath, 'tools', 'bin') : '',
    (process as any).resourcesPath ? path.join((process as any).resourcesPath, 'tools') : '',
    // Local dev paths
    path.resolve(process.cwd(), 'tools', 'bin'),
    path.resolve(process.cwd(), 'tools'),
  ].filter(Boolean);

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }
  return path.resolve(process.cwd(), 'tools', 'bin');
}

export function checkSystemDependencies() {
  const sys32 = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32');
  const hasVCRedist =
    fs.existsSync(path.join(sys32, 'vcruntime140.dll')) &&
    fs.existsSync(path.join(sys32, 'msvcp140.dll'));

  const toolsDir = getToolsDir();
  const hasOdolConvert =
    fs.existsSync(path.join(toolsDir, 'odol-convert.exe')) ||
    fs.existsSync(path.join(toolsDir, 'odol-convert', 'odol-convert.exe')) ||
    fs.existsSync(path.resolve(process.cwd(), 'tools', 'odol-convert', 'odol-convert.exe'));

  const hasDayZHelper =
    fs.existsSync(path.join(toolsDir, 'dayz_helper.exe')) ||
    fs.existsSync(path.resolve(process.cwd(), 'tools', 'dayz_helper.py'));

  return {
    hasVCRedist,
    hasOdolConvert,
    hasDayZHelper,
  };
}

export function detectDayZInstallations(): DayZDetectionResult {
  const discovered = new Set<string>();
  const settings = loadSettings();
  let steamPath: string | null = null;
  let hasDayZTools = false;
  let dayzToolsPath: string | null = null;

  // 1. Saved custom user path
  if (settings.customDayZPath && fs.existsSync(settings.customDayZPath)) {
    discovered.add(settings.customDayZPath);
  }

  // 2. Query Windows Registry for Steam installation
  try {
    const stdout = execSync('reg query "HKCU\\Software\\Valve\\Steam" /v SteamPath', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    const match = stdout.match(/SteamPath\s+REG_SZ\s+(.+)/i);
    if (match && match[1]) {
      steamPath = match[1].trim().replace(/\//g, '\\');
    }
  } catch {
    // Registry query failed or not on Windows
  }

  // 3. Parse Steam libraryfolders.vdf across all drives
  if (steamPath && fs.existsSync(steamPath)) {
    const vdfCandidates = [
      path.join(steamPath, 'steamapps', 'libraryfolders.vdf'),
      path.join(steamPath, 'config', 'libraryfolders.vdf'),
    ];
    for (const vdf of vdfCandidates) {
      if (fs.existsSync(vdf)) {
        try {
          const content = fs.readFileSync(vdf, 'utf-8');
          const regex = /"path"\s+"([^"]+)"/g;
          let m: RegExpExecArray | null;
          while ((m = regex.exec(content)) !== null) {
            const libPath = m[1].replace(/\\\\/g, '\\');
            const dayzAddons = path.join(libPath, 'steamapps', 'common', 'DayZ', 'Addons');
            if (fs.existsSync(dayzAddons)) discovered.add(dayzAddons);

            const serverAddons = path.join(libPath, 'steamapps', 'common', 'DayZServer', 'addons');
            if (fs.existsSync(serverAddons)) discovered.add(serverAddons);

            const expAddons = path.join(libPath, 'steamapps', 'common', 'DayZ Server Exp', 'addons');
            if (fs.existsSync(expAddons)) discovered.add(expAddons);

            const toolsDir = path.join(libPath, 'steamapps', 'common', 'DayZ Tools');
            if (fs.existsSync(toolsDir)) {
              hasDayZTools = true;
              dayzToolsPath = toolsDir;
            }
          }
        } catch (e) {
          console.warn('Failed parsing libraryfolders.vdf:', e);
        }
      }
    }
  }

  // 4. Query Windows Registry for DayZ Uninstallation / Bohemia keys
  const regQueries = [
    'reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Steam App 221100" /v InstallLocation',
    'reg query "HKLM\\SOFTWARE\\WOW6432Node\\Bohemia Interactive\\DayZ" /v main',
    'reg query "HKLM\\SOFTWARE\\WOW6432Node\\Bohemia Interactive\\DayZ" /v Path',
  ];
  for (const q of regQueries) {
    try {
      const stdout = execSync(q, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
      const m = stdout.match(/REG_SZ\s+(.+)/i);
      if (m && m[1]) {
        const p = m[1].trim().replace(/\//g, '\\');
        const candidate = path.join(p, 'Addons');
        if (fs.existsSync(candidate)) discovered.add(candidate);
        if (fs.existsSync(p) && fs.readdirSync(p).some((f) => f.endsWith('.pbo'))) {
          discovered.add(p);
        }
      }
    } catch {}
  }

  // 5. Scan all Windows drive letters C to Z
  const drives = 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  for (const d of drives) {
    const candidates = [
      `${d}:\\Program Files (x86)\\Steam\\steamapps\\common\\DayZ\\Addons`,
      `${d}:\\Program Files\\Steam\\steamapps\\common\\DayZ\\Addons`,
      `${d}:\\SteamLibrary\\steamapps\\common\\DayZ\\Addons`,
      `${d}:\\Steam\\steamapps\\common\\DayZ\\Addons`,
      `${d}:\\Games\\Steam\\steamapps\\common\\DayZ\\Addons`,
      `${d}:\\Games\\DayZ\\Addons`,
      `${d}:\\DayZ\\Addons`,
      `${d}:\\DayZServer\\addons`,
      `${d}:\\Program Files (x86)\\Steam\\steamapps\\common\\DayZServer\\addons`,
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) discovered.add(c);
    }
  }

  const detectedPaths = Array.from(discovered);
  let activePath =
    settings.customDayZPath && fs.existsSync(settings.customDayZPath)
      ? settings.customDayZPath
      : detectedPaths[0] || '';

  let pboCount = 0;
  if (activePath && fs.existsSync(activePath)) {
    try {
      pboCount = fs.readdirSync(activePath).filter((f) => f.toLowerCase().endsWith('.pbo')).length;
    } catch {}
  }

  return {
    activePath,
    detectedPaths,
    steamPath,
    hasDayZTools,
    dayzToolsPath,
    pboCount,
    systemDependencies: checkSystemDependencies(),
  };
}
