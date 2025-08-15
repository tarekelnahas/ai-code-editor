#!/usr/bin/env node

/**
 * Bundle Analysis Script for AI Code Editor
 * Analyzes build output and provides optimization recommendations
 */

const fs = require('fs');
const path = require('path');

// Configuration
const BUILD_DIR = path.join(__dirname, '../client/dist');
const ASSETS_DIR = path.join(BUILD_DIR, 'assets');

// Size thresholds (in bytes)
const THRESHOLDS = {
  javascript: {
    warning: 500 * 1024,  // 500KB
    error: 1024 * 1024    // 1MB
  },
  css: {
    warning: 100 * 1024,  // 100KB
    error: 200 * 1024     // 200KB
  },
  image: {
    warning: 200 * 1024,  // 200KB
    error: 500 * 1024     // 500KB
  },
  font: {
    warning: 100 * 1024,  // 100KB
    error: 200 * 1024     // 200KB
  }
};

function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (error) {
    return 0;
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileType(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (['.js', '.mjs', '.jsx', '.ts', '.tsx'].includes(ext)) return 'javascript';
  if (['.css', '.scss', '.sass', '.less'].includes(ext)) return 'css';
  if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif'].includes(ext)) return 'image';
  if (['.woff', '.woff2', '.eot', '.ttf', '.otf'].includes(ext)) return 'font';
  return 'other';
}

function analyzeFile(filePath, filename) {
  const size = getFileSize(filePath);
  const type = getFileType(filename);
  const threshold = THRESHOLDS[type];
  
  let status = 'good';
  if (threshold) {
    if (size >= threshold.error) {
      status = 'error';
    } else if (size >= threshold.warning) {
      status = 'warning';
    }
  }
  
  return {
    name: filename,
    path: filePath,
    size,
    formattedSize: formatBytes(size),
    type,
    status
  };
}

function generateRecommendations(analysis) {
  const recommendations = [];
  
  // Check for large JavaScript files
  const largeJsFiles = analysis.files.filter(f => f.type === 'javascript' && f.status !== 'good');
  if (largeJsFiles.length > 0) {
    recommendations.push({
      type: 'javascript',
      severity: 'high',
      message: `Large JavaScript files detected (${largeJsFiles.length} files)`,
      suggestions: [
        'Enable code splitting with dynamic imports',
        'Use tree shaking to remove unused code',
        'Consider lazy loading for non-critical components',
        'Analyze bundle composition with webpack-bundle-analyzer'
      ],
      files: largeJsFiles.map(f => f.name)
    });
  }
  
  // Check for unoptimized images
  const largeImages = analysis.files.filter(f => f.type === 'image' && f.status !== 'good');
  if (largeImages.length > 0) {
    recommendations.push({
      type: 'image',
      severity: 'medium',
      message: `Large image files detected (${largeImages.length} files)`,
      suggestions: [
        'Convert images to modern formats (WebP, AVIF)',
        'Implement responsive images with different sizes',
        'Use image optimization tools or services',
        'Consider lazy loading for images'
      ],
      files: largeImages.map(f => f.name)
    });
  }
  
  // Check for large CSS files
  const largeCssFiles = analysis.files.filter(f => f.type === 'css' && f.status !== 'good');
  if (largeCssFiles.length > 0) {
    recommendations.push({
      type: 'css',
      severity: 'medium',
      message: `Large CSS files detected (${largeCssFiles.length} files)`,
      suggestions: [
        'Enable CSS code splitting',
        'Remove unused CSS with PurgeCSS',
        'Use critical CSS inlining for above-the-fold styles',
        'Consider CSS-in-JS for component-specific styles'
      ],
      files: largeCssFiles.map(f => f.name)
    });
  }
  
  // Check total bundle size
  const totalSize = analysis.totalSize;
  if (totalSize > 2 * 1024 * 1024) { // 2MB
    recommendations.push({
      type: 'bundle',
      severity: 'high',
      message: `Large total bundle size: ${formatBytes(totalSize)}`,
      suggestions: [
        'Implement aggressive code splitting',
        'Use service worker for caching',
        'Enable compression (gzip/brotli) on server',
        'Consider CDN for static assets',
        'Audit and remove unused dependencies'
      ]
    });
  }
  
  return recommendations;
}

function analyzeBuild() {
  console.log('🔍 Analyzing bundle...\n');
  
  // Check if build directory exists
  if (!fs.existsSync(BUILD_DIR)) {
    console.error('❌ Build directory not found. Please run "npm run build" first.');
    process.exit(1);
  }
  
  if (!fs.existsSync(ASSETS_DIR)) {
    console.error('❌ Assets directory not found in build output.');
    process.exit(1);
  }
  
  // Read all files in assets directory
  const files = [];
  const assetFiles = fs.readdirSync(ASSETS_DIR);
  
  for (const filename of assetFiles) {
    const filePath = path.join(ASSETS_DIR, filename);
    const stats = fs.statSync(filePath);
    
    if (stats.isFile()) {
      files.push(analyzeFile(filePath, filename));
    }
  }
  
  // Calculate totals
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const typeBreakdown = files.reduce((breakdown, file) => {
    breakdown[file.type] = (breakdown[file.type] || 0) + file.size;
    return breakdown;
  }, {});
  
  const analysis = {
    files: files.sort((a, b) => b.size - a.size), // Sort by size descending
    totalSize,
    typeBreakdown,
    buildTime: new Date().toISOString()
  };
  
  // Generate recommendations
  const recommendations = generateRecommendations(analysis);
  
  // Output results
  console.log('📊 Bundle Analysis Results');
  console.log('=' .repeat(50));
  console.log(`Total bundle size: ${formatBytes(totalSize)}`);
  console.log(`Number of files: ${files.length}`);
  console.log('');
  
  // Type breakdown
  console.log('📁 Size by type:');
  Object.entries(typeBreakdown).forEach(([type, size]) => {
    console.log(`  ${type}: ${formatBytes(size)}`);
  });
  console.log('');
  
  // Largest files
  console.log('📦 Largest files:');
  analysis.files.slice(0, 10).forEach(file => {
    const statusIcon = file.status === 'error' ? '🔴' : file.status === 'warning' ? '🟡' : '🟢';
    console.log(`  ${statusIcon} ${file.name} (${file.formattedSize})`);
  });
  console.log('');
  
  // Recommendations
  if (recommendations.length > 0) {
    console.log('💡 Optimization Recommendations:');
    console.log('-'.repeat(40));
    
    recommendations.forEach((rec, index) => {
      const severityIcon = rec.severity === 'high' ? '🔴' : rec.severity === 'medium' ? '🟡' : '🔵';
      console.log(`${index + 1}. ${severityIcon} ${rec.message}`);
      
      if (rec.files && rec.files.length > 0) {
        console.log(`   Files: ${rec.files.join(', ')}`);
      }
      
      console.log('   Suggestions:');
      rec.suggestions.forEach(suggestion => {
        console.log(`   • ${suggestion}`);
      });
      console.log('');
    });
  } else {
    console.log('✅ No optimization issues found!');
  }
  
  // Save detailed report
  const reportPath = path.join(BUILD_DIR, 'bundle-analysis.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    ...analysis,
    recommendations
  }, null, 2));
  
  console.log(`📄 Detailed report saved to: ${reportPath}`);
  
  // Exit with error code if there are high-severity issues
  const highSeverityIssues = recommendations.filter(r => r.severity === 'high');
  if (highSeverityIssues.length > 0) {
    console.log(`\n⚠️  ${highSeverityIssues.length} high-severity optimization issues found.`);
    process.exit(1);
  }
  
  console.log('\n✅ Bundle analysis completed successfully!');
}

// Run analysis
if (require.main === module) {
  analyzeBuild();
}

module.exports = { analyzeBuild, analyzeFile, formatBytes };