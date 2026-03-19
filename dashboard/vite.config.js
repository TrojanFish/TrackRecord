import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  build: {
    // Raise warning threshold slightly since we're splitting manually
    chunkSizeWarningLimit: 600,

    rollupOptions: {
      output: {
        manualChunks: {
          // Map libraries — largest bundle (~400 KB gz), load only when Heatmap tab opens
          'vendor-leaflet': ['leaflet', 'react-leaflet', '@react-leaflet/core'],

          // Chart library — second largest, load only when analytics pages open
          'vendor-charts': ['recharts'],

          // Animation library — used everywhere but can be deferred
          'vendor-motion': ['framer-motion'],

          // React core — must be eagerly loaded, but isolated for long-term cache stability
          'vendor-react': ['react', 'react-dom'],

          // Utility libraries — small, grouped together
          'vendor-utils': ['axios', 'polyline', 'lucide-react'],
        },
      },
    },
  },
})