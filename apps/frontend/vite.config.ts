import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: {
    // Force production React regardless of build mode
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    // Ensure minification is enabled
    minify: 'esbuild', // or 'terser'
  },
}));
