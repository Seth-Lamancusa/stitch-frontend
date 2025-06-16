import { ref, reactive, onMounted, onBeforeUnmount } from 'vue'

export function useBrowserCapabilities() {
  // Reactive browser capabilities state
  const capabilities = reactive({
    // Device & Hardware
    isMobile: false,
    isTablet: false,
    isDesktop: false,
    hasTouch: false,
    devicePixelRatio: 1,
    screenSize: { width: 0, height: 0 },
    viewportSize: { width: 0, height: 0 },
    orientation: 'landscape',
    
    // Performance & Network
    connection: {
      effectiveType: 'unknown',
      downlink: 0,
      rtt: 0,
      saveData: false
    },
    memory: null,
    cores: 1,
    
    // User Preferences
    prefersReducedMotion: false,
    prefersHighContrast: false,
    prefersColorScheme: 'light',
    language: 'en',
    timezone: 'UTC',
    
    // Browser Features
    supportsWebGL: false,
    supportsWebRTC: false,
    supportsWebAudio: false,
    supportsServiceWorker: false,
    supportsIndexedDB: false,
    supportsPushAPI: false,
    supportsNotifications: false,
    
    // Interaction Capabilities
    hasKeyboard: true,
    hasMouse: false,
    hasPointer: false,
    maxTouchPoints: 0,
    
    // Accessibility
    isHighZoom: false,
    isLowBandwidth: false,
    isLowPower: false,
    
    // Platform Details
    platform: 'unknown',
    browserEngine: 'unknown',
    browserName: 'unknown',
    browserVersion: '0',
    
    // Performance Timing
    timing: {
      domContentLoaded: 0,
      firstPaint: 0,
      firstContentfulPaint: 0
    }
  })

  // Reactive user agent info
  const userAgent = ref('')
  
  // Device detection based on user agent and screen size
  const detectDevice = () => {
    const ua = navigator.userAgent.toLowerCase()
    const width = window.innerWidth
    
    // Mobile detection
    capabilities.isMobile = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua) || width < 768
    
    // Tablet detection
    capabilities.isTablet = (/ipad|android(?!.*mobile)|tablet/i.test(ua) && width >= 768 && width <= 1024) || 
                           (width >= 768 && width <= 1024 && capabilities.hasTouch)
    
    // Desktop detection
    capabilities.isDesktop = !capabilities.isMobile && !capabilities.isTablet
  }

  // Detect hardware capabilities
  const detectHardware = () => {
    // Screen and viewport
    capabilities.screenSize.width = screen.width
    capabilities.screenSize.height = screen.height
    capabilities.viewportSize.width = window.innerWidth
    capabilities.viewportSize.height = window.innerHeight
    capabilities.devicePixelRatio = window.devicePixelRatio || 1
    
    // Orientation
    capabilities.orientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
    
    // Touch capabilities
    capabilities.hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    capabilities.maxTouchPoints = navigator.maxTouchPoints || 0
    
    // Hardware concurrency (CPU cores)
    capabilities.cores = navigator.hardwareConcurrency || 1
    
    // Memory (if available)
    if ('memory' in navigator) {
      capabilities.memory = navigator.memory.jsHeapSizeLimit
    }
    
    // High zoom detection
    capabilities.isHighZoom = capabilities.devicePixelRatio > 1.5 && window.innerWidth < 1200
  }

  // Detect network capabilities
  const detectNetwork = () => {
    if ('connection' in navigator) {
      const conn = navigator.connection
      capabilities.connection = {
        effectiveType: conn.effectiveType || 'unknown',
        downlink: conn.downlink || 0,
        rtt: conn.rtt || 0,
        saveData: conn.saveData || false
      }
      
      // Low bandwidth detection
      capabilities.isLowBandwidth = conn.effectiveType === 'slow-2g' || 
                                   conn.effectiveType === '2g' || 
                                   conn.saveData
    }
  }

  // Detect user preferences
  const detectPreferences = () => {
    // Motion preferences
    if (window.matchMedia) {
      capabilities.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      capabilities.prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches
      capabilities.prefersColorScheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    
    // Language and locale
    capabilities.language = navigator.language || navigator.languages[0] || 'en'
    capabilities.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  }

  // Detect browser features
  const detectFeatures = () => {
    // WebGL support
    try {
      const canvas = document.createElement('canvas')
      capabilities.supportsWebGL = !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    } catch (e) {
      capabilities.supportsWebGL = false
    }
    
    // Other API support
    capabilities.supportsWebRTC = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    capabilities.supportsWebAudio = !!(window.AudioContext || window.webkitAudioContext)
    capabilities.supportsServiceWorker = 'serviceWorker' in navigator
    capabilities.supportsIndexedDB = 'indexedDB' in window
    capabilities.supportsPushAPI = 'PushManager' in window
    capabilities.supportsNotifications = 'Notification' in window
  }

  // Detect input capabilities
  const detectInput = () => {
    // Mouse detection
    capabilities.hasMouse = window.matchMedia('(pointer: fine)').matches
    
    // Pointer detection
    capabilities.hasPointer = window.matchMedia('(pointer: coarse)').matches || capabilities.hasMouse
    
    // Keyboard detection (assume true unless proven otherwise)
    capabilities.hasKeyboard = !capabilities.isMobile || window.matchMedia('(pointer: fine)').matches
  }

  // Parse user agent for detailed browser info
  const parseUserAgent = () => {
    const ua = navigator.userAgent
    userAgent.value = ua
    
    // Platform detection
    if (/Windows/i.test(ua)) capabilities.platform = 'Windows'
    else if (/Macintosh|Mac OS X/i.test(ua)) capabilities.platform = 'macOS'
    else if (/Linux/i.test(ua)) capabilities.platform = 'Linux'
    else if (/Android/i.test(ua)) capabilities.platform = 'Android'
    else if (/iPhone|iPad|iPod/i.test(ua)) capabilities.platform = 'iOS'
    
    // Browser engine detection
    if (/webkit/i.test(ua)) capabilities.browserEngine = 'WebKit'
    else if (/gecko/i.test(ua)) capabilities.browserEngine = 'Gecko'
    else if (/trident/i.test(ua)) capabilities.browserEngine = 'Trident'
    
    // Browser name detection
    if (/chrome/i.test(ua) && !/edge|edg/i.test(ua)) capabilities.browserName = 'Chrome'
    else if (/firefox/i.test(ua)) capabilities.browserName = 'Firefox'
    else if (/safari/i.test(ua) && !/chrome/i.test(ua)) capabilities.browserName = 'Safari'
    else if (/edge|edg/i.test(ua)) capabilities.browserName = 'Edge'
    
    // Version extraction (simplified)
    const versionMatch = ua.match(new RegExp(capabilities.browserName + '/([0-9.]+)', 'i'))
    if (versionMatch) capabilities.browserVersion = versionMatch[1]
  }

  // Get performance timing data
  const getPerformanceTiming = () => {
    if ('performance' in window && 'timing' in performance) {
      const timing = performance.timing
      capabilities.timing = {
        domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
        firstPaint: 0,
        firstContentfulPaint: 0
      }
      
      // Get paint timings if available
      if ('getEntriesByType' in performance) {
        const paintEntries = performance.getEntriesByType('paint')
        paintEntries.forEach(entry => {
          if (entry.name === 'first-paint') {
            capabilities.timing.firstPaint = entry.startTime
          } else if (entry.name === 'first-contentful-paint') {
            capabilities.timing.firstContentfulPaint = entry.startTime
          }
        })
      }
    }
  }

  // Battery status detection (deprecated but still useful where available)
  const detectBattery = async () => {
    if ('getBattery' in navigator) {
      try {
        const battery = await navigator.getBattery()
        capabilities.isLowPower = battery.level < 0.2 || battery.charging === false
      } catch (e) {
        // Silently fail - not critical
      }
    }
  }

  // Update capabilities that might change
  const updateDynamicCapabilities = () => {
    detectDevice()
    detectHardware()
    detectNetwork()
    detectPreferences()
  }

  // Set up event listeners for dynamic updates
  const setupEventListeners = () => {
    window.addEventListener('resize', updateDynamicCapabilities)
    window.addEventListener('orientationchange', updateDynamicCapabilities)
    
    // Listen for network changes
    if ('connection' in navigator) {
      navigator.connection.addEventListener('change', detectNetwork)
    }
    
    // Listen for preference changes
    if (window.matchMedia) {
      const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
      const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const contrastQuery = window.matchMedia('(prefers-contrast: high)')
      
      reducedMotionQuery.addEventListener('change', detectPreferences)
      colorSchemeQuery.addEventListener('change', detectPreferences)
      contrastQuery.addEventListener('change', detectPreferences)
    }
  }

  // Clean up event listeners
  const cleanupEventListeners = () => {
    window.removeEventListener('resize', updateDynamicCapabilities)
    window.removeEventListener('orientationchange', updateDynamicCapabilities)
    
    if ('connection' in navigator) {
      navigator.connection.removeEventListener('change', detectNetwork)
    }
  }

  // Initialize all detections
  const initialize = async () => {
    detectDevice()
    detectHardware()
    detectNetwork()
    detectPreferences()
    detectFeatures()
    detectInput()
    parseUserAgent()
    getPerformanceTiming()
    await detectBattery()
    setupEventListeners()
  }

  // Computed helpers for common use cases
  const isLowEnd = () => {
    return capabilities.cores <= 2 || 
           capabilities.memory < 1000000000 || // Less than 1GB
           capabilities.connection.effectiveType === 'slow-2g' ||
           capabilities.connection.effectiveType === '2g'
  }

  const shouldUseReducedAnimations = () => {
    return capabilities.prefersReducedMotion || 
           capabilities.isLowPower || 
           capabilities.isLowBandwidth ||
           isLowEnd()
  }

  const getOptimalImageFormat = () => {
    // Return optimal image format based on browser support
    if (capabilities.browserName === 'Chrome' || capabilities.browserName === 'Edge') return 'webp'
    if (capabilities.browserName === 'Safari' && parseFloat(capabilities.browserVersion) >= 14) return 'webp'
    return 'jpg'
  }

  const getRecommendedQuality = () => {
    if (capabilities.isLowBandwidth || capabilities.connection.saveData) return 'low'
    if (capabilities.devicePixelRatio >= 2) return 'high'
    return 'medium'
  }

  // Lifecycle management
  onMounted(initialize)
  onBeforeUnmount(cleanupEventListeners)

  return {
    capabilities,
    userAgent,
    isLowEnd,
    shouldUseReducedAnimations,
    getOptimalImageFormat,
    getRecommendedQuality,
    updateDynamicCapabilities
  }
} 