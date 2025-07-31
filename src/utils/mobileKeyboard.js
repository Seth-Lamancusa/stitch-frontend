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
} 