import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],

  build: {
    sourcemap: false,

    rollupOptions: {
      output: {
        // Rolldown (Vite 8) requires manualChunks as a function, not an object
        manualChunks(id) {
          if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/react-router-dom/') || id.includes('/react-router/')) {
            return 'vendor'
          }
          if (id.includes('/recharts/')) return 'charts'
          if (id.includes('/jspdf'))     return 'pdf'
          if (id.includes('/lucide-react/')) return 'icons'
        },
        chunkFileNames:  'assets/[name]-[hash].js',
        entryFileNames:  'assets/[name]-[hash].js',
        assetFileNames:  'assets/[name]-[hash].[ext]',
      },
    },

    chunkSizeWarningLimit: 600,
  },
})
