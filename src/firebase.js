import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

let app = null;
let auth = null;
let initializationPromise = null;

export async function initializeFirebase() {
  if (initializationPromise) {
    return initializationPromise;
  }
  
  initializationPromise = new Promise(async (resolve, reject) => {
    if (!app) {
      try {
        const response = await fetch('/api/config');
        
        let configToUse;
        
        if (response.ok) {
          try {
            // Get the config from the API response
            const apiConfig = await response.json();
            configToUse = apiConfig.firebase;
          } catch (parseError) {
            console.error("Error parsing API response:", parseError);
            console.log("Falling back to environment variables");
            configToUse = fallbackConfig;
          }
        } else {
          console.error("API request failed with status:", response.status);
          console.log("Falling back to environment variables");
          configToUse = fallbackConfig;
        }
        
        // Check if all required config values are present
        const requiredKeys = ['apiKey', 'authDomain', 'projectId'];
        const missingKeys = requiredKeys.filter(key => !configToUse[key]);
        
        if (missingKeys.length > 0) {
          throw new Error(`Missing required Firebase config: ${missingKeys.join(', ')}`);
        }
        
        app = initializeApp(configToUse);
        auth = getAuth(app);
        resolve({ app, auth });
      } catch (error) {
        console.error("Firebase initialization error:", error);
        reject(error);
      }
    } else {
      resolve({ app, auth });
    }
  });
  
  return initializationPromise;
}

// Export getters
export const getFirebaseApp = () => app;
export const getFirebaseAuth = () => {
  if (!auth) {
    console.warn("Firebase auth accessed before initialization - will be available once initialization completes");
    // Trigger initialization if it hasn't started
    initializeFirebase().catch(err => console.error("Lazy initialization failed:", err));
  }
  return auth;
};

// Add this function to get the current user's token
export async function getFirebaseToken() {
  try {
    await initializeFirebase();
    const auth = getFirebaseAuth();
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      console.debug("No user is signed in - proceeding as guest");
      return null;
    }
    
    // Get the token
    const token = await currentUser.getIdToken(true);
    return token;
  } catch (error) {
    console.error("Error getting Firebase token:", error);
    return null;
  }
} 