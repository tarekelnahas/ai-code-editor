/**
 * Context 7 Component System
 * Reusable styled components following design principles
 */

import { colors, spacing, borderRadius, shadows, typography, transitions } from './theme';

// Base button styles with accessibility features
export const buttonStyles = {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    padding: `${spacing[2]} ${spacing[4]}`,
    borderRadius: borderRadius.md,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    fontFamily: typography.fonts.sans,
    border: 'none',
    cursor: 'pointer',
    transition: transitions.fast,
    outline: 'none',
    position: 'relative' as const,
    userSelect: 'none' as const,
    
    // Focus ring for accessibility
    ':focus-visible': {
      outline: `2px solid ${colors.primary[500]}`,
      outlineOffset: '2px'
    }
  },
  
  primary: {
    background: `linear-gradient(135deg, ${colors.primary[500]}, ${colors.primary[600]})`,
    color: colors.neutral[0],
    boxShadow: shadows.sm,
    
    ':hover': {
      background: `linear-gradient(135deg, ${colors.primary[600]}, ${colors.primary[700]})`,
      transform: 'translateY(-1px)',
      boxShadow: shadows.md
    },
    
    ':active': {
      transform: 'translateY(0)',
      boxShadow: shadows.sm
    }
  },
  
  secondary: {
    background: colors.dark.surface,
    color: colors.dark.text,
    border: `1px solid ${colors.dark.border}`,
    
    ':hover': {
      background: colors.dark.elevated,
      borderColor: colors.primary[500]
    }
  },
  
  ghost: {
    background: 'transparent',
    color: colors.dark.textSecondary,
    
    ':hover': {
      background: 'rgba(255, 255, 255, 0.05)',
      color: colors.dark.text
    }
  }
};

// Input field styles
export const inputStyles = {
  base: {
    width: '100%',
    padding: `${spacing[3]} ${spacing[4]}`,
    background: colors.dark.surface,
    border: `1px solid ${colors.dark.border}`,
    borderRadius: borderRadius.md,
    color: colors.dark.text,
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.sans,
    outline: 'none',
    transition: transitions.fast,
    
    ':focus': {
      borderColor: colors.primary[500],
      boxShadow: `0 0 0 3px rgba(33, 150, 243, 0.1)`
    },
    
    '::placeholder': {
      color: colors.dark.textMuted
    }
  }
};

// Card/Panel styles
export const cardStyles = {
  base: {
    background: colors.dark.surface,
    border: `1px solid ${colors.dark.border}`,
    borderRadius: borderRadius.lg,
    overflow: 'hidden' as const
  },
  
  elevated: {
    background: colors.dark.elevated,
    boxShadow: shadows.md
  }
};

// Layout container styles
export const layoutStyles = {
  container: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: `0 ${spacing[6]}`
  },
  
  flexCenter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  
  flexBetween: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  
  grid: {
    display: 'grid',
    gap: spacing[4]
  }
};

// Text styles
export const textStyles = {
  heading: {
    fontFamily: typography.fonts.display,
    fontWeight: typography.weights.bold,
    lineHeight: typography.lineHeight.tight,
    color: colors.dark.text
  },
  
  body: {
    fontFamily: typography.fonts.sans,
    fontSize: typography.sizes.base,
    lineHeight: typography.lineHeight.normal,
    color: colors.dark.text
  },
  
  caption: {
    fontFamily: typography.fonts.sans,
    fontSize: typography.sizes.sm,
    color: colors.dark.textSecondary
  },
  
  code: {
    fontFamily: typography.fonts.mono,
    fontSize: typography.sizes.sm,
    background: colors.dark.elevated,
    padding: `${spacing[1]} ${spacing[2]}`,
    borderRadius: borderRadius.sm,
    color: colors.primary[400]
  }
};

// Status indicator styles
export const statusStyles = {
  online: {
    color: colors.success,
    ':before': {
      content: '"●"',
      marginRight: spacing[2]
    }
  },
  
  offline: {
    color: colors.error,
    ':before': {
      content: '"●"',
      marginRight: spacing[2]
    }
  },
  
  processing: {
    color: colors.warning,
    ':before': {
      content: '"●"',
      marginRight: spacing[2],
      animation: 'pulse 2s infinite'
    }
  }
};

// Scrollbar styles
export const scrollbarStyles = {
  '::-webkit-scrollbar': {
    width: '8px',
    height: '8px'
  },
  
  '::-webkit-scrollbar-track': {
    background: colors.dark.bg
  },
  
  '::-webkit-scrollbar-thumb': {
    background: colors.dark.border,
    borderRadius: borderRadius.full,
    
    ':hover': {
      background: colors.neutral[600]
    }
  }
};