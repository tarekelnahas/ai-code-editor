import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'path';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { analyzer } from 'vite-bundle-analyzer';
import { VitePWA } from 'vite-plugin-pwa';

// Vite configuration for the renderer process with performance optimizations
// Includes bundle analysis, PWA support, and advanced build optimizations

export default defineConfig(({ command, mode }) => {
  const isProduction = mode === 'production';
  const isAnalyze = process.env.ANALYZE === 'true';

  return {
    plugins: [
      react({
        // Enable React Fast Refresh optimizations
        fastRefresh: true,
        // Exclude test files from React plugin processing
        exclude: /\.test\.(ts|tsx)$/,
      }),
      
      // Bundle analyzer (only when ANALYZE=true)
      ...(isAnalyze ? [analyzer({ analyzerMode: 'server', openAnalyzer: true })] : []),
      
      // PWA plugin for offline support
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
        },
        manifest: {
          name: 'AI Code Editor',
          short_name: 'AI Editor',
          description: 'AI-powered code editor',
          theme_color: '#2196f3',
          background_color: '#0f0f23',
          display: 'standalone',
          icons: [
            {
              src: 'icon-192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'icon-512.png', 
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      }),
    ],
    
    server: {
      port: 5173,
      strictPort: true,
      proxy: { 
        '/api': 'http://127.0.0.1:8000',
        '/ws': {
          target: 'ws://127.0.0.1:8000',
          ws: true
        }
      },
      // Enable CORS for development
      cors: true,
      // Optimize HMR performance
      hmr: {
        overlay: true
      }
    },
    
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@components': path.resolve(__dirname, 'src/components'),
        '@design': path.resolve(__dirname, 'src/design'),
        '@types': path.resolve(__dirname, 'src/types'),
        '@utils': path.resolve(__dirname, 'src/utils')
      }
    },
    
    css: {
      postcss: {
        plugins: [tailwindcss, autoprefixer]
      },
      // Enable CSS code splitting
      devSourcemap: !isProduction
    },
    
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: !isProduction,
      
      // Optimize bundle size
      minify: isProduction ? 'terser' : false,
      terserOptions: {
        compress: {
          drop_console: isProduction,
          drop_debugger: isProduction,
          pure_funcs: isProduction ? ['console.log', 'console.debug'] : []
        }
      },
      
      // Configure chunk splitting for better caching
      rollupOptions: {
        output: {
          // Separate vendor chunks for better caching
          manualChunks: {
            vendor: ['react', 'react-dom'],
            monaco: ['@monaco-editor/react', 'monaco-editor'],
            terminal: ['xterm', 'xterm-addon-fit'],
            utils: ['date-fns', 'lodash-es']
          },
          
          // Optimize chunk file names
          chunkFileNames: (chunkInfo) => {
            const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : 'chunk';
            return `js/${facadeModuleId}-[hash].js`;
          },
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name.split('.');
            let extType = info[info.length - 1];
            if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
              extType = 'img';
            } else if (/woff|woff2|eot|ttf|otf/i.test(extType)) {
              extType = 'fonts';
            }
            return `${extType}/[name]-[hash][extname]`;
          }
        },
        
        // External dependencies for Electron
        external: ['electron']
      },
      
      // Target modern browsers for better optimization
      target: 'es2020',
      
      // Optimize asset handling
      assetsInlineLimit: 4096, // 4KB
      
      // Enable CSS code splitting
      cssCodeSplit: true,
      
      // Report compressed file sizes
      reportCompressedSize: true,
      
      // Chunk size warning limit
      chunkSizeWarningLimit: 1000
    },
    
    // Optimize dependencies
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        '@monaco-editor/react',
        'xterm',
        'xterm-addon-fit'
      ],
      // Exclude large dependencies from pre-bundling
      exclude: ['monaco-editor']
    },
    
    // Performance settings
    esbuild: {
      // Drop console statements in production
      drop: isProduction ? ['console', 'debugger'] : [],
      // Target modern syntax
      target: 'es2020'
    },
    
    base: './',
    
    // Define global constants
    define: {
      __DEV__: !isProduction,
      __VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString())
    }
  };
});