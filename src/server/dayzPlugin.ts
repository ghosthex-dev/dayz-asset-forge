import type { Plugin } from 'vite';
import path from 'path';
import { createDayZBackendHandler } from './dayzBackend';

export function dayzBackendPlugin(): Plugin {
  const cacheDir = path.resolve(process.cwd(), '.cache');
  const handler = createDayZBackendHandler(cacheDir);

  return {
    name: 'dayz-backend-plugin',
    configureServer(server) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const handled = await handler(req, res);
        if (!handled) {
          next();
        }
      });
    },
  };
}
