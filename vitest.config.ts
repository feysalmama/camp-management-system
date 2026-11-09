import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { maxWorkers: 2, testTimeout: 15000 },
  resolve: { alias: { 'npm:@supabase/supabase-js@2': '@supabase/supabase-js' } },
  esbuild: { jsx: 'automatic' },
});
