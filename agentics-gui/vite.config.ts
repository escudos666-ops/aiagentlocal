import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const toolsApiTarget = env.VITE_TOOLS_API_URL || 'http://127.0.0.1:8765';

  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: false,
      proxy: {
        '/api/tools': {
          target: toolsApiTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api\/tools/, ''),
        },
      },
    },
    preview: {
      host: '127.0.0.1',
      port: 4173,
    },
  };
});
