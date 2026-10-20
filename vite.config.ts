import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    rolldownOptions: {
      output: {
        // The 3D engine and React rarely change, so give them their own files:
        // after an app update, browsers keep these cached.
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\\/](three|three-stdlib|@react-three)[\\/]/ },
            { name: 'vendor', test: /node_modules[\\/]/ },
          ],
        },
      },
    },
    // three.js + React Three Fiber/Drei come to ~1.2 MB minified (~320 kB
    // gzipped), which is expected for a 3D app.
    chunkSizeWarningLimit: 1300,
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
