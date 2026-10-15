import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    strictPort: false,
    host: true,
    watch: {
      ignored: ['**/data/**', '**/.git/**']
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/instagram': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/go': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/whatsapp': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/track': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
});
