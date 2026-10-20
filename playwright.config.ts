import { defineConfig } from '@playwright/test';

// Real GPU (Metal) on macOS; elsewhere fall back to SwiftShader's software
// WebGL, which is slow enough with the animated island to stall the UI.
const glArgs =
  process.platform === 'darwin'
    ? ['--use-angle=metal', '--enable-gpu']
    : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

// End-to-end tests run against the real Supabase project in .env.local. Test
// players' sessions are reused from tests/e2e/.auth/ (see tests/e2e/players.ts).
export default defineConfig({
  testDir: 'tests/e2e',
  // Tests share the same saved players, so running them side by side would
  // have them overwrite each other's avatars and rooms.
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:5174',
    launchOptions: { args: glArgs },
  },
  webServer: {
    command: 'npx vite --port 5174 --strictPort',
    url: 'http://localhost:5174',
    reuseExistingServer: true,
  },
});
