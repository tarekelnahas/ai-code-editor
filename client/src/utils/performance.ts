/**
 * Frontend Performance Utilities
 * Provides tools for monitoring and optimizing client-side performance
 */

// Performance monitoring
export interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  interactionTime: number;
  memoryUsage: number;
  bundleSize: number;
}

// Web Vitals monitoring
export const measureWebVitals = (): Promise<PerformanceMetrics> => {
  return new Promise((resolve) => {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      
      const navigationEntry = entries.find(entry => entry.entryType === 'navigation') as PerformanceNavigationTiming;
      const paintEntries = entries.filter(entry => entry.entryType === 'paint');
      
      const metrics: PerformanceMetrics = {
        loadTime: navigationEntry ? navigationEntry.loadEventEnd - navigationEntry.loadEventStart : 0,
        renderTime: paintEntries.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0,
        interactionTime: entries.find(entry => entry.entryType === 'first-input')?.processingStart || 0,
        memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
        bundleSize: 0 // Will be calculated dynamically
      };
      
      resolve(metrics);
    });
    
    observer.observe({ entryTypes: ['navigation', 'paint', 'first-input'] });
    
    // Fallback timeout
    setTimeout(() => {
      resolve({
        loadTime: performance.now(),
        renderTime: 0,
        interactionTime: 0,
        memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
        bundleSize: 0
      });
    }, 1000);
  });
};

// Code splitting utilities
export const lazyLoad = <T extends React.ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  fallback?: React.ComponentType
) => {
  const LazyComponent = React.lazy(importFunc);
  
  return (props: React.ComponentProps<T>) => (
    <React.Suspense fallback={fallback ? React.createElement(fallback) : <div>Loading...</div>}>
      <LazyComponent {...props} />
    </React.Suspense>
  );
};

// Image optimization
export const optimizeImage = (src: string, options: {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png';
} = {}) => {
  const { width, height, quality = 80, format = 'webp' } = options;
  
  // For production, this would integrate with an image optimization service
  // For now, return the original src with basic optimization hints
  if (width || height) {
    return `${src}?w=${width}&h=${height}&q=${quality}&f=${format}`;
  }
  
  return src;
};

// Bundle analyzer integration
export const analyzeBundleSize = async (): Promise<{
  totalSize: number;
  chunkSizes: Record<string, number>;
  recommendations: string[];
}> => {
  // In production, this would integrate with webpack-bundle-analyzer data
  const mockData = {
    totalSize: 2500000, // 2.5MB
    chunkSizes: {
      'vendor-react': 500000,
      'vendor-monaco': 1200000,
      'vendor-terminal': 300000,
      'vendor-libs': 200000,
      'main': 300000
    },
    recommendations: [
      'Consider code splitting for Monaco Editor',
      'Enable tree shaking for unused libraries',
      'Implement dynamic imports for heavy components',
      'Optimize images using modern formats (WebP, AVIF)'
    ]
  };
  
  return Promise.resolve(mockData);
};

// Resource hints for preloading
export const addResourceHints = (urls: string[], type: 'preload' | 'prefetch' | 'preconnect') => {
  urls.forEach(url => {
    const link = document.createElement('link');
    link.rel = type;
    link.href = url;
    if (type === 'preload') {
      link.as = 'script';
    }
    document.head.appendChild(link);
  });
};

// Service Worker utilities
export const registerServiceWorker = async (): Promise<boolean> => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('ServiceWorker registered successfully:', registration.scope);
      return true;
    } catch (error) {
      console.log('ServiceWorker registration failed:', error);
      return false;
    }
  }
  return false;
};

// Memory management
export const optimizeMemoryUsage = () => {
  // Force garbage collection if available (Chrome DevTools)
  if (window.gc && typeof window.gc === 'function') {
    window.gc();
  }
  
  // Clear any large objects from global scope
  (window as any).performanceCache = undefined;
  
  // Report memory usage
  if ((performance as any).memory) {
    const memory = (performance as any).memory;
    console.log('Memory usage:', {
      used: Math.round(memory.usedJSHeapSize / 1024 / 1024) + 'MB',
      total: Math.round(memory.totalJSHeapSize / 1024 / 1024) + 'MB',
      limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024) + 'MB'
    });
  }
};

// Performance monitoring hook
export const usePerformanceMonitoring = () => {
  const [metrics, setMetrics] = React.useState<PerformanceMetrics | null>(null);
  
  React.useEffect(() => {
    measureWebVitals().then(setMetrics);
    
    // Monitor memory usage every 30 seconds
    const memoryInterval = setInterval(() => {
      if ((performance as any).memory) {
        const memory = (performance as any).memory;
        const usage = memory.usedJSHeapSize;
        
        // Alert if memory usage exceeds 100MB
        if (usage > 100 * 1024 * 1024) {
          console.warn('High memory usage detected:', Math.round(usage / 1024 / 1024) + 'MB');
          optimizeMemoryUsage();
        }
      }
    }, 30000);
    
    return () => clearInterval(memoryInterval);
  }, []);
  
  return metrics;
};

// React import for lazy loading
import React from 'react';

// Global type declarations
declare global {
  interface Window {
    gc?: () => void;
  }
}