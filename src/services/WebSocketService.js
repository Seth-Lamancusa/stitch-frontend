import store from '../store';

const WS_BASE_URL = '/ws'

const WebSocketService = {
  // Core state
  connection: null,
  connectionPromise: null,
  userId: null,
  messageCallback: null,
  pingInterval: null,
  debugMode: true, // Enable debug logging by default
  authToken: null,

  // Global state management
  isInitialized: false,
  unsubscribeFunction: null,
  connectionAttempts: 0,
  maxReconnectAttempts: 3,
  
  // Debug logging helper
  log(...messages) {
    if (this.debugMode) {
      console.log('[WebSocket]', ...messages);
    }
  },
  
  /**
   * Get a fresh authentication token from Firebase
   * @returns {Promise<string|null>} Fresh token or null if not available
   */
  async getFreshAuthToken() {
    try {
      // Try to get fresh token from Firebase auth
      const { getFirebaseAuth } = await import('../firebase.js');
      const auth = getFirebaseAuth();
      const currentUser = auth.currentUser;
      
      if (currentUser) {
        this.log('Getting fresh token from Firebase');
        const token = await currentUser.getIdToken(true); // Force refresh
        
        // Update localStorage with fresh token
        localStorage.setItem('auth_token', token);
        this.log('Fresh token obtained and stored');
        
        return token;
      } else {
        this.log('No current Firebase user available');
        return null;
      }
    } catch (error) {
      console.error('[WebSocket] Error getting fresh token:', error);
      this.log(`Error getting fresh token: ${error.message}`);
      return null;
    }
  },
  
  /**
   * Initialize global WebSocket connection for the authenticated user
   * Should be called when the application starts and when auth state changes
   */
  async initialize() {
    // Get current auth state
    const user = store.getters['auth/user'];
    
    this.log(`Initialize called - User: ${user ? user.uid : 'none'}`);
    
    // Clean up existing connection if any
    this.cleanup();
    
    // Reset connection attempts
    this.connectionAttempts = 0;
    
    // Only connect if user is authenticated
    if (user) {
      this.log(`Initializing global connection for user ${user.uid}`);
      
      try {
        // Get fresh token from Firebase instead of localStorage
        const authToken = await this.getFreshAuthToken();
        
        if (!authToken) {
          this.log('Failed to get fresh auth token');
          return;
        }
        
        this.log('Got fresh auth token');
        
        // Register message handler for store updates
        this.log('Registering message handler');
        this.unsubscribeFunction = this.handleNewMessage(this.handleIncomingMessage.bind(this));
        
        // Connect to WebSocket server
        this.log(`Connecting to WebSocket server for user ${user.uid}`);
        await this.connectUser(authToken);
        this.isInitialized = true;
        this.log(`Global connection established for user ${user.uid}`);
      } catch (error) {
        console.error('[WebSocket] Failed to connect:', error);
        this.log(`Connection failed: ${error.message}`);
        this.cleanup();
      }
    } else {
      this.log('No authenticated user, skipping initialization');
    }
  },
  
  /**
   * Clean up WebSocket connections and handlers
   */
  cleanup() {
    this.log('Cleanup called');
    if (this.unsubscribeFunction) {
      this.log('Removing message handler');
      this.unsubscribeFunction();
      this.unsubscribeFunction = null;
    }
    
    if (this.connection) {
      this.log(`Disconnecting user ${this.userId || 'unknown'}`);
      this.disconnectUser();
    } else {
      this.log('No active connection to clean up');
    }
    
    this.isInitialized = false;
    this.log('Cleanup completed');
  },
  
  /**
   * Handle incoming WebSocket messages and update store
   * @param {Object} messageData - The message data from the WebSocket
   */
  handleIncomingMessage(messageData) {
    this.log('Received message:', messageData?.id ? `ID: ${messageData.id}` : 'Invalid message');
    
    // Skip if no message data
    if (!messageData || !messageData.id) {
      console.warn('[WebSocket] Received invalid message data');
      return;
    }
    
    // Add to the store
    this.log(`Adding message ${messageData.id} to store`);
    store.commit('messages/SET_MESSAGE', messageData);
    
    // Get current user for notification logic
    const user = store.getters['auth/user'];
    let isFromCurrentUser = false;
    let isToCurrentUser = false;
    
    if (user) {
      // Check if message is from current user
      isFromCurrentUser = messageData.content_author === user.uid || 
                         messageData.author_user_tag === user.user_tag;
      
      // Check if message is to current user
      isToCurrentUser = messageData.recipients && 
                       messageData.recipients.some(r => 
                         (r.uid && r.uid === user.uid) || 
                         (r.user_tag && r.user_tag === user.user_tag));
    }
    
    // Trigger notification for messages to current user (but not from current user)
    if (isToCurrentUser && !isFromCurrentUser) {
      // Check if user is currently viewing this thread/message
      const currentRoute = store.getters['navigation/currentRoute'] || window.location.pathname;
      const isViewingThisThread = currentRoute.includes('/messages/') && 
                                 (currentRoute.includes(messageData.id) || 
                                  (messageData.parent_id && currentRoute.includes(messageData.parent_id)));
      
      // Only show notification if not currently viewing this thread
      if (!isViewingThisThread) {
        const authorName = messageData.author_display_name || 
                          messageData.author_user_tag || 
                          'Someone';
        
        const contentPreview = messageData.content ? 
          (messageData.content.length > 60 ? 
            messageData.content.substring(0, 60) + '...' : 
            messageData.content) : 
          'New message';
        
        const notificationData = {
          id: messageData.id,
          title: `New message from ${authorName}`,
          message: contentPreview,
          messageData: messageData,
          timestamp: new Date().toISOString()
        };
        
        this.log(`Triggering notification for message from ${authorName}`);
        store.dispatch('ui/setMessageNotification', notificationData);
      } else {
        this.log(`Skipping notification - user is viewing this thread`);
      }
    }
    
    // Get the parent message if it exists
    const parentId = messageData.parent_id;
    if (parentId) {
      this.log(`Message ${messageData.id} has parent ${parentId}`);
      const parentMessage = store.getters['messages/getMessage'](parentId);
      
      // If parent exists in the store, add this message as a child
      if (parentMessage) {
        this.log(`Parent ${parentId} found in store, adding child relationship`);
        store.commit('messages/ADD_CHILD_TO_PARENT', { 
          parentId, 
          childId: messageData.id 
        });
        
        // Get updated parent message with the new child added
        const updatedParent = store.getters['messages/getMessage'](parentId);
        const parentChildren = updatedParent.child_ids || [];
        
        // If this is the first reply to parent, set it as branch_child
        if (parentChildren.length === 1) {
          this.log(`First reply to parent ${parentId}, setting as branch_child`);
          store.commit('messages/SET_BRANCH_CHILD', { 
            messageId: parentId,
            childId: messageData.id
          });
        }
      } else {
        this.log(`Parent ${parentId} not found in store`);
      }
      
      // Log message details for debugging
      if (user) {
        this.log(`Message to current user: ${isToCurrentUser}, from current user: ${isFromCurrentUser}`);
      }
    }
  },

  // Connection method - returns a promise that resolves when connected
  async connectUser(token) {
    this.log(`ConnectUser called with token starting with: ${token ? token.substring(0, 10) + '...' : 'null'}`);
    
    // If already connected with the same token, do nothing
    if (this.connection && 
        this.authToken === token && 
        this.connection.readyState === WebSocket.OPEN) {
      this.log(`Already connected with token ${token.substring(0, 10)}...`);
      return Promise.resolve();
    }
    
    // If connected with a different token, disconnect first
    if (this.connection) {
      this.log('Already connected with a different token, disconnecting first');
      this.disconnectUser();
    }
    
    // Increment connection attempts
    this.connectionAttempts++;
    this.log(`Connection attempt ${this.connectionAttempts} of ${this.maxReconnectAttempts}`);
    
    // Store auth token
    this.authToken = token;
    
    // Create a new connection promise
    this.connectionPromise = new Promise((resolve, reject) => {
      
      // Build WebSocket URL using current window location
      let wsUrl;
      try {
        // Get current protocol and host from window.location
        const isSecure = window.location.protocol === 'https:';
        const wsProtocol = isSecure ? 'wss:' : 'ws:';
        const host = window.location.host;
        
        // Generate a random view ID for this connection
        const viewId = `view_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        
        // Construct WebSocket URL
        wsUrl = `${wsProtocol}//${host}${WS_BASE_URL}/user/${token}/${viewId}`;
        
        this.log(`WebSocket URL constructed: ${wsUrl.replace(token, '[TOKEN]')}`);
      } catch (e) {
        this.log(`Error constructing WebSocket URL: ${e}`);
        reject(new Error(`Failed to construct WebSocket URL: ${e.message}`));
        return;
      }
      
      this.log(`Connecting to ${wsUrl.replace(token, '[TOKEN]')}`);
      const socket = new WebSocket(wsUrl);
      
      // Track connection state
      this.log('WebSocket connection state: CONNECTING');
      
      // Set up event handlers
      socket.onopen = () => {
        this.log(`Connection opened with token ${token.substring(0, 10)}...`);
        this.log('WebSocket connection state: OPEN');
        // Reset connection attempts on successful connection
        this.connectionAttempts = 0;
        resolve(); // Resolve the connection promise
      };
      
      socket.onmessage = (event) => {
        try {
          // Handle ping/pong
          if (event.data === 'pong') {
            this.log('Received pong from server');
            return;
          }
          
          this.log(`Received message: ${event.data.substring(0, 100)}${event.data.length > 100 ? '...' : ''}`);
          
          const data = JSON.parse(event.data);
          
          if (data.type === 'connection_established') {
            this.userId = data.user_id;
            this.log(`Connection established for user ${this.userId}`);
          } else if (data.type === 'new_reply') {
            this.log(`===== NEW REPLY RECEIVED =====`);
            this.log(`Message ID: ${data.data?.id}`);
            this.log(`Parent ID: ${data.data?.parent_id}`);
            this.log(`Author: ${data.data?.author_display_name || data.data?.author_user_tag || data.data?.content_author}`);
            this.log(`Content: "${data.data?.content?.substring(0, 50)}${data.data?.content?.length > 50 ? '...' : ''}"`);
            
            // Process all new_reply messages where current user is a recipient
            if (this.messageCallback) {
              this.log(`Passing message to callback`);
              this.messageCallback(data.data);
            } else {
              this.log(`No message callback registered`);
            }
          }
        } catch (error) {
          console.error('[WebSocket] Error handling message:', error);
          this.log(`Error handling message: ${error.message}`);
        }
      };
      
      socket.onclose = (event) => {
        this.log(`Connection closed for user ${this.userId}`, event.code, event.reason);
        this.log('WebSocket connection state: CLOSED');
        this.log(`Clean close: ${event.wasClean}, Code: ${event.code}, Reason: ${event.reason || 'none'}`);
        
        this.connection = null;
        this.userId = null;
        
        // Only clear the promise if it's our current one
        if (this.connectionPromise && !event.wasClean) {
          this.connectionPromise = null;
          reject(new Error(`Connection closed unexpectedly: code ${event.code}, reason: ${event.reason || 'none'}`));
        }
        
        // Attempt to reconnect if connection closed unexpectedly and we're within retry limits
        if (!event.wasClean && this.connectionAttempts < this.maxReconnectAttempts) {
          this.log(`Connection closed unexpectedly, attempting to reconnect (attempt ${this.connectionAttempts} of ${this.maxReconnectAttempts})`);
          
          // Use exponential backoff for reconnection
          const backoffTime = Math.min(1000 * Math.pow(2, this.connectionAttempts - 1), 10000);
          this.log(`Reconnecting in ${backoffTime}ms`);
          
          setTimeout(async () => {
            try {
              // Get fresh token for reconnection
              const freshToken = await this.getFreshAuthToken();
              if (freshToken) {
                this.log(`Attempting reconnection with fresh token`);
                await this.connectUser(freshToken);
              } else {
                this.log(`Cannot reconnect: failed to get fresh token`);
              }
            } catch (err) {
              this.log(`Reconnection attempt failed: ${err.message}`);
            }
          }, backoffTime);
        }
      };
      
      socket.onerror = (error) => {
        console.error(`[WebSocket] Error for user ${this.userId}:`, error);
        this.log(`WebSocket error: ${error.type || 'unknown error'}`);
        reject(error);
      };
      
      // Store the connection
      this.connection = socket;
      
    });
    
    return this.connectionPromise;
  },
  
  // For backward compatibility
  async connectToThread(threadId, messageId) {
    console.warn('connectToThread is deprecated, use connectUser instead');
    
    // If we have a token, use that to connect
    const token = localStorage.getItem('auth_token');
    if (token) {
      return this.connectUser(token);
    }
    
    // Otherwise, do nothing - user must be authenticated to receive updates
    console.warn('Cannot connect to WebSocket: No authentication token available');
    return Promise.resolve();
  },
  
  // Disconnect from current thread
  disconnectUser() {
    this.log(`DisconnectUser called`);
    
    if (this.connection) {
      this.log(`Disconnecting user ${this.userId}`);
      
      try {
        this.log(`Closing WebSocket connection`);
        this.connection.close(1000, "User disconnected intentionally");
      } catch (e) {
        console.error('[WebSocket] Error closing connection:', e);
        this.log(`Error closing connection: ${e.message}`);
      }
      
      this.connection = null;
      this.userId = null;
      this.authToken = null;
    } else {
      this.log(`No active connection to disconnect`);
    }
    
    // Clear ping interval
    if (this.pingInterval) {
      this.log(`Clearing ping interval`);
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    // Clear connection promise
    this.connectionPromise = null;
    this.log(`DisconnectUser completed`);
  },
  
  // Register callback for new messages
  handleNewMessage(callback) {
    this.log(`HandleNewMessage called with callback: ${callback ? 'provided' : 'null'}`);
    this.messageCallback = callback;
    
    // Return unsubscribe function
    return () => {
      this.log(`Unsubscribe function called, removing message callback`);
      this.messageCallback = null;
      
      // If no callback, we can disconnect
      if (!this.messageCallback) {
        this.log(`No active callbacks, disconnecting`);
        this.disconnectUser();
      }
    };
  },
  
  // For backward compatibility - does nothing now as we subscribe to all messages for the user
  async updateSelectedMessage(messageId) {
    // No-op - we're now subscribed to all messages for the user
    this.log(`updateSelectedMessage called but not needed anymore (messageId: ${messageId})`);
      return;
    }
};

export default WebSocketService;
