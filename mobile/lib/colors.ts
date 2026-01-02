/**
 * Venturr Design System v1.0
 * Color palette following brand guidelines
 */
export const colors = {
  // Primary Brand
  primary: '#F25F5C', // Coral 500 - Primary CTAs
  primaryLight: '#FCEAEA', // Light coral for backgrounds
  
  // Gunmetal - Text hierarchy
  text: '#1F2933', // Gunmetal 900 - Headlines, primary text
  textSecondary: '#3A4753', // Gunmetal 700 - Secondary text
  textMuted: '#6B7280', // Gunmetal 500 - Metadata, icons
  
  // Neutrals - Layout & surfaces
  background: '#F8FAFC', // Neutral 50 - App background
  surface: '#FFFFFF', // Neutral 0 - Cards
  border: '#E2E8F0', // Neutral 200 - Borders
  
  // Semantic
  success: '#4CAF93',
  error: '#F25F5C', // Use primary for destructive
  warning: '#F4B740',
  info: '#4C82F7',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 14, // Primary card radius
  lg: 18, // Large cards
  xl: 24,
  full: 9999,
};

export const shadow = {
  sm: {
    shadowColor: '#1F2933',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
};
