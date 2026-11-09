import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig(({ command, mode }) => {
  const env = { ...loadEnv(mode, '.', 'VITE_'), ...process.env };
  if (command === 'build') {
    const missing = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'].filter(
      (name) => !env[name]?.trim(),
    );
    if (missing.length) {
      throw new Error(
        `Missing build environment variables: ${missing.join(', ')}. Add them to Cloudflare Build variables and secrets, then rebuild. VITE_ values must be available during the Vite build; Worker runtime variables are insufficient.`,
      );
    }
  }
  return {
    plugins: [react(), tailwindcss()],
    build: { rollupOptions: { output: { manualChunks: { supabase: ['@supabase/supabase-js'] } } } },
  };
});
