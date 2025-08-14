/**
 * Context 7 Design System
 * Modern, accessible, and user-centered design tokens
 */

// Color Palette - Based on modern design principles
export const colors = {
  // Primary Brand Colors
  primary: {
    50: '#e3f2fd',
    100: '#bbdefb',
    500: '#2196f3',
    600: '#1976d2',
    700: '#1565c0',
    900: '#0d47a1'
  },
  
  // Neutral Colors - Enhanced contrast for accessibility
  neutral: {
    0: '#ffffff',
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#eeeeee',
    300: '#e0e0e0',
    400: '#bdbdbd',
    500: '#9e9e9e',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121',
    950: '#0a0a0a'
  },
  
  // Dark Theme Colors
  dark: {
    bg: '#0f0f23',
    surface: '#1a1a2e',
    elevated: '#16213e',
    border: '#2a2a4a',
    text: '#e4e4e7',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a'
  },
  
  // Semantic Colors
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  
  // Code Editor Colors
  editor: {
    background: '#0f0f23',
    gutter: '#1a1a2e',
    selection: 'rgba(59, 130, 246, 0.2)',
    activeLine: '#16213e',
    keyword: '#8b5cf6',
    string: '#10b981',
    comment: '#6b7280',
    number: '#f59e0b',
    operator: '#ef4444'
  }
};

// Typography Scale
export const typography = {
  fonts: {
    sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace",
    display: "'Poppins', sans-serif"
  },
  
  sizes: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem'   // 36px
  },
  
  weights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700
  },
  
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75
  }
};

// Spacing Scale - 4px base unit
export const spacing = {
  0: '0',
  1: '0.25rem',  // 4px
  2: '0.5rem',   // 8px
  3: '0.75rem',  // 12px
  4: '1rem',     // 16px
  5: '1.25rem',  // 20px
  6: '1.5rem',   // 24px
  8: '2rem',     // 32px
  10: '2.5rem',  // 40px
  12: '3rem',    // 48px
  16: '4rem',    // 64px
  20: '5rem',    // 80px
  24: '6rem'     // 96px
};

// Border Radius
export const borderRadius = {
  none: '0',
  sm: '0.125rem',  // 2px
  base: '0.375rem', // 6px
  md: '0.5rem',    // 8px
  lg: '0.75rem',   // 12px
  xl: '1rem',      // 16px
  full: '9999px'
};

// Shadows - Subtle and modern
export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)'
};

// Animation Timing
export const transitions = {
  fast: '150ms ease',
  base: '300ms ease',
  slow: '500ms ease'
};

// Breakpoints for Responsive Design
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px'
};

// Z-Index Scale
export const zIndex = {
  base: 0,
  dropdown: 1000,
  modal: 2000,
  tooltip: 3000,
  toast: 4000
};