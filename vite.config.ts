import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',

      // Si usás ngrok, descomentá:
       allowedHosts: ['.9088db599dfa.ngrok-free.app'],
    },

    plugins: [react()],

    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),

        // ✅ Fuerza PDF.js a legacy (evita top-level await en pdf.mjs)
        'pdfjs-dist/build/pdf.mjs': 'pdfjs-dist/legacy/build/pdf',
        'pdfjs-dist/build/pdf': 'pdfjs-dist/legacy/build/pdf',
      },
    },

    // ✅ Fix extra para el prebundle (por las dudas)
    esbuild: {
      target: 'esnext',
      supported: { 'top-level-await': true },
    },
    optimizeDeps: {
      exclude: ['pdfjs-dist'],
      esbuildOptions: {
        target: 'esnext',
        supported: { 'top-level-await': true },
      },
    },
    build: {
      target: 'esnext',
    },
  }
})
