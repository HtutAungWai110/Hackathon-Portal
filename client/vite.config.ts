import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss()
  ],
  resolve: {
    // shadcn ships components under `@/components/ui`; the alias keeps their
    // imports working without rewriting every generated file.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
