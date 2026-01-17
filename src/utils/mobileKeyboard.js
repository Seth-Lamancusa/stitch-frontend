/**
 * Cross-platform mobile keyboard utilities
 * Provides best practices for keyboard detection and positioning
 */

/**
 * Detect if the current device is iOS
 */
export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Detect if the current device is Android
 */
export function isAndroid() {
  if (typeof navigator === 'undefined') return false;
  return /Android/.test(navigator.userAgent);
}

/**
 * Detect if device is mobile
 */
export function isMobileDevice() {
  if (typeof window === 'undefined') return false;
  return window.innerWidth <= 768 || isIOS() || isAndroid();
}

/**
 * Utility to dismiss mobile keyboard by blurring all active text inputs
 * This is useful when opening modals to prevent keyboard from staying open
 */
export function dismissMobileKeyboard() {
  // Get the currently focused element
  const activeElement = document.activeElement;
  
  // Check if the active element is a text input
  if (activeElement && (
    activeElement.tagName === 'INPUT' ||
    activeElement.tagName === 'TEXTAREA' ||
    activeElement.contentEditable === 'true'
  )) {
    activeElement.blur();
  }
  
  // Additionally, blur any other text inputs that might be focused
  const textInputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="search"], textarea, [contenteditable="true"]');
  textInputs.forEach(input => {
    if (input === document.activeElement) {
      input.blur();
    }
  });
  
  // iOS-specific: also try to blur any shadow DOM inputs
  if (isIOS()) {
    try {
      document.body.focus();
    } catch (e) {
      // Silently fail - not all browsers support this
    }
  }
}

/**
 * Get the current keyboard height using visualViewport API
 * Returns 0 if keyboard is not visible or API not available
 */
export function getKeyboardHeight() {
  if (typeof window === 'undefined') return 0;
  
  // Use visualViewport API (best cross-platform support)
  if (window.visualViewport) {
    const viewportHeight = window.visualViewport.height;
    const windowHeight = window.innerHeight;
    const diff = windowHeight - viewportHeight;
    
    // Only consider it a keyboard if diff > 150px (avoid false positives)
    return diff > 150 ? diff : 0;
  }
  
  // Fallback for older browsers: compare screen height to window height
  const screenHeight = window.screen.height;
  const windowHeight = window.innerHeight;
  const diff = screenHeight - windowHeight;
  
  // This is less reliable, so use a higher threshold
  return diff > 250 ? diff : 0;
}

/**
 * Check if virtual keyboard is currently visible
 */
export function isKeyboardVisible() {
  return getKeyboardHeight() > 0;
}

/**
 * Create a keyboard visibility observer
 * @param {Function} callback - Called with (isVisible, height) when keyboard state changes
 * @returns {Function} Cleanup function to remove the observer
 */
export function observeKeyboardVisibility(callback) {
  if (typeof window === 'undefined') return () => {};
  
  let lastHeight = 0;
  let lastVisible = false;
  
  const checkKeyboard = () => {
    const height = getKeyboardHeight();
    const visible = height > 0;
    
    if (visible !== lastVisible || Math.abs(height - lastHeight) > 10) {
      lastVisible = visible;
      lastHeight = height;
      callback(visible, height);
    }
  };
  
  // Use visualViewport resize event for best accuracy
  if (window.visualViewport) {
    const handler = () => {
      // Debounce slightly to avoid rapid firing
      requestAnimationFrame(checkKeyboard);
    };
    
    window.visualViewport.addEventListener('resize', handler);
    window.visualViewport.addEventListener('scroll', handler);
    
    // Initial check
    checkKeyboard();
    
    return () => {
      window.visualViewport.removeEventListener('resize', handler);
      window.visualViewport.removeEventListener('scroll', handler);
    };
  }
  
  // Fallback: use resize event
  const handler = () => {
    requestAnimationFrame(checkKeyboard);
  };
  
  window.addEventListener('resize', handler);
  checkKeyboard();
  
  return () => {
    window.removeEventListener('resize', handler);
  };
}

/**
 * Scroll an element into view, accounting for keyboard
 * @param {HTMLElement} element - Element to scroll into view
 * @param {Object} options - Scroll options
 */
export function scrollIntoViewWithKeyboard(element, options = {}) {
  if (!element) return;
  
  const keyboardHeight = getKeyboardHeight();
  const {
    behavior = 'smooth',
    block = 'center',
    offsetBottom = keyboardHeight + 20 // Add buffer above keyboard
  } = options;
  
  const rect = element.getBoundingClientRect();
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  const safeArea = viewportHeight - offsetBottom;
  
  // Check if element is already visible in safe area
  if (rect.top >= 0 && rect.bottom <= safeArea) {
    return; // Already visible
  }
  
  // Calculate ideal scroll position
  let targetY;
  if (block === 'center') {
    targetY = rect.top + window.scrollY - (safeArea / 2) + (rect.height / 2);
  } else if (block === 'start') {
    targetY = rect.top + window.scrollY - 20;
  } else {
    targetY = rect.bottom + window.scrollY - safeArea + 20;
  }
  
  window.scrollTo({
    top: Math.max(0, targetY),
    behavior
  });
} 