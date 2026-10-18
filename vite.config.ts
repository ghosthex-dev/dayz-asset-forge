import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { dayzBackendPlugin } from './src/server/dayzPlugin';

export default defineConfig({
  plugins: [react(), tailwindcss(), dayzBackendPlugin()],
  server: {
    port: 3000,
    open: false,
    watch: {
      ignored: [
        '**/.cache/**',
        '**/*.png',
        '**/*.obj',
        '**/*.p3d',
        '**/*.paa',
        '**/*.json',
        '**/*.cfg',
        '**/tools/**',
        '**/*.mjs',
        '**/.edge-temp/**',
        '**/unpacked/**',
      ],
    },
  },
});
