/**
 * Configuration constants for graph view
 * Centralizes layout parameters, visual settings, and behavior options
 */

export const LAYOUT_CONFIG = {
  // Node layout
  layerHeight: 100,
  nodeSpacing: 60,
  rootSpacing: 150,
  maxWidth: 1200,
  
  // Node dimensions
  nodeWidth: {
    default: 120,
    root: 140,
    leaf: 100,
    max: 200
  },
  
  nodeHeight: {
    default: 48,
    root: 60,
    leaf: 40,
    min: 30
  },
  
  // Spacing and padding
  padding: {
    horizontal: 16,
    vertical: 12,
    canvas: 50
  }
};

export const VIEWPORT_CONFIG = {
  // Zoom settings
  minScale: 0.1,
  maxScale: 4,
  defaultScale: 1,
  zoomSensitivity: 0.001,
  zoomSteps: [0.25, 0.5, 1, 1.5, 2, 3, 4],
  
  // Pan settings
  panSensitivity: 1,
  momentum: true,
  
  // Viewport bounds
  defaultWidth: 800,
  defaultHeight: 600
};

export const VISUAL_CONFIG = {
  // Colors (CSS custom properties will override these)
  colors: {
    background: '#ffffff',
    surface: '#f8fafc',
    border: '#e2e8f0',
    primary: '#3b82f6',
    accent: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    textPrimary: '#1a202c',
    textSecondary: '#718096'
  },
  
  // Animation durations
  transitions: {
    default: 200,
    fast: 100,
    slow: 300,
    selection: 150
  },
  
  // LOD (Level of Detail) thresholds
  lodThresholds: {
    hideText: 0.3,
    simplifyNodes: 0.5,
    showPreview: 1.5,
    showDetails: 2.5
  },
  
  // Edge styling
  edges: {
    strokeWidth: 2,
    strokeWidthHover: 2.5,
    strokeWidthSelected: 3,
    curveTension: 0.6,
    arrowSize: 8,
    arrowWidth: 6
  },
  
  // Node styling
  nodes: {
    borderRadius: 8,
    borderWidth: 1,
    borderWidthSelected: 2,
    shadowBlur: 4,
    shadowOffset: 2
  }
};

export const INTERACTION_CONFIG = {
  // Selection behavior
  selection: {
    multiSelectKey: 'ctrlKey', // or 'metaKey' for Mac
    clearOnEmptyClick: true,
    maxSelection: 50 // Prevent performance issues
  },
  
  // Hover behavior
  hover: {
    delay: 100,
    tooltip: true,
    highlightPath: true
  },
  
  // Keyboard shortcuts
  shortcuts: {
    zoomIn: ['+', '='],
    zoomOut: ['-', '_'],
    fitToScreen: [' ', 'f'],
    selectAll: ['a'],
    clearSelection: ['Escape'],
    delete: ['Delete', 'Backspace']
  }
};

export const PERFORMANCE_CONFIG = {
  // Rendering optimization
  viewportCulling: true,
  cullingMargin: 100, // Extra pixels around viewport
  maxVisibleNodes: 500,
  
  // Layout calculation
  useWebWorker: false, // Disabled for Phase 1
  debounceDelay: 100,
  maxLayoutTime: 5000, // ms
  
  // Caching
  layoutCache: {
    maxSize: 50,
    maxAge: 300000 // 5 minutes
  },
  
  // Progressive loading
  progressiveRadius: true,
  initialRadius: 3,
  maxRadius: 10
};

export const ACCESSIBILITY_CONFIG = {
  // Keyboard navigation
  keyboardNavigation: true,
  focusVisible: true,
  announceChanges: true,
  
  // Screen reader support
  ariaLabels: true,
  roleDefinitions: true,
  
  // High contrast support
  highContrastMode: false,
  respectsReducedMotion: true,
  
  // Minimum contrast ratios
  contrastRatios: {
    normal: 4.5,
    large: 3,
    nonText: 3
  }
};

// Export combined configuration
export const GRAPH_CONFIG = {
  layout: LAYOUT_CONFIG,
  viewport: VIEWPORT_CONFIG,
  visual: VISUAL_CONFIG,
  interaction: INTERACTION_CONFIG,
  performance: PERFORMANCE_CONFIG,
  accessibility: ACCESSIBILITY_CONFIG
};

export default GRAPH_CONFIG; 