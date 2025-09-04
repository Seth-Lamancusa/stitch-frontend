import store from '../store';
import TokenManager from './TokenManager';

const WS_BASE_URL = '/ws'

const WebSocketService = {
  // Core state
  connection: null,
  connectionPromise: null,
  userId: null,
  messageCallback: null,
  pingInterval: null,
  // Removed idle overlay/timer
  debugMode: true, // Enable debug logging by default
  authToken: null,
  connectionEstablished: false,

  // Global state management
  isInitialized: false,
  unsubscribeFunction: null,
  connectionAttempts: 0,
  maxReconnectAttempts: 5,
  reconnectDelay: 1000,
  
  // Activity-based reconnect
  lastActivityReconnectAt: 0,
  activityReconnectCooldownMs: 5000,
  
  // Token management
  tokenRefreshInProgress: false,
  lastTokenRefresh: null,
  tokenRefreshThreshold: 30 * 60 * 1000, // 30 minutes
  
  // Connection health monitoring
  lastPingTime: null,
  pingTimeoutMs: 60000, // 1 minute
  // Removed idle timeout; rely on activity-based reconnect only
  
  // Idle disconnect handling
  idleTimeoutId: null,
  idleTimeoutMs: 2 * 60 * 1000, // 2 minutes
  lastActivityAt: null,
  activityListenerRegistered: false,
  activityEvents: ['mousemove'], // per requirement: mouse movement triggers reconnect
  
  // Debug logging helper
  log(...messages) {
    if (this.debugMode) {
      console.log('[WebSocket]', ...messages);
    }
  },
  warn(...messages) {
    if (this.debugMode) {
      console.warn('[WebSocket]', ...messages);
    }
  },
  
  maybeActivityReconnect() {
    try {
      const now = Date.now();
      if (now - this.lastActivityReconnectAt < this.activityReconnectCooldownMs) {
        return;
      }
      this.lastActivityReconnectAt = now;
      const isOpen = this.connection && this.connection.readyState === WebSocket.OPEN;
      if (!isOpen) {
        this.log('Activity detected and WS not open; attempting reconnect');
        const token = TokenManager.accessToken;
        if (token) this.connectUser(token);
      }
    } catch (e) {
      // no-op
    }
  },

  // Removed idle timeout helpers and overlay dispatch
  
  
  error(...messages) {
    console.error('[WebSocket]', ...messages);
  },
  showWsDisconnectedBanner() {
    try {
      const user = store.getters['auth/user'];
      const channels = this.getUserNotifyChannels(user);
      store.dispatch('ui/setWebsocketDisconnected', { disconnected: true, channels });
    } catch (e) {}
  },
  clearWsDisconnectedBanner() {
    try {
      store.dispatch('ui/clearWebsocketDisconnected');
    } catch (e) {}
  },
  stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  },
  stopIdleTimer() {
    if (this.idleTimeoutId) {
      clearTimeout(this.idleTimeoutId);
      this.idleTimeoutId = null;
    }
  },
  clearClientSideHandlers() {
    this.stopPingInterval();
    this.stopIdleTimer();
    this.teardownActivityListeners();
  },
  removeMessageSubscription() {
    if (this.unsubscribeFunction) {
      this.log('Removing message handler');
      this.unsubscribeFunction();
      this.unsubscribeFunction = null;
    }
  },
  
  async attemptRefreshAndReconnect() {
    try {
      this.log('Attempting token refresh due to authentication failure');
      const newAccess = await TokenManager.refreshAccessToken();
      if (!newAccess) {
        this.error('Token refresh failed; keeping session and showing WS disconnected banner');
        try {
          this.showWsDisconnectedBanner();
        } catch (e) {}
        return;
      }
      this.log('Token refresh succeeded, reconnecting with new token');
      await this.connectUser(newAccess);
    } catch (e) {
      this.error('Error during refresh-and-reconnect:', e);
      try {
        this.showWsDisconnectedBanner();
      } catch (err) {}
    }
  },
  
  /**
   * Retrieve auth token from localStorage
   */
  async getFreshAuthToken() {
    return localStorage.getItem('auth_token');
  },
  
  /**
   * Check if token needs refresh
   * @returns {boolean} True if token should be refreshed
   */
  shouldRefreshToken() {
    if (!this.lastTokenRefresh) return true;
    return (Date.now() - this.lastTokenRefresh) > this.tokenRefreshThreshold;
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
        // Get token from localStorage
        const authToken = TokenManager.accessToken || await this.getFreshAuthToken();
        
        if (!authToken) {
          this.log('Failed to get fresh auth token');
          return;
        }
        
        this.log('Got fresh auth token');
        
        // Register message handler for store updates
        this.log('Registering message handler');
        this.unsubscribeFunction = this.handleNewMessage(this.handleIncomingMessage.bind(this));
        
        // Set up activity listeners and idle timer
        this.setupActivityListeners();
        this.resetIdleTimer();

        // Connect to WebSocket server
        this.log(`Connecting to WebSocket server for user ${user.uid}`);
        await this.connectUser(authToken);
        this.isInitialized = true;
        this.log(`Global connection established for user ${user.uid}`);
        
        // Activity-based reconnect enabled via global activity handlers
      } catch (error) {
        this.error('Failed to connect:', error);
        this.cleanup();
        throw error;
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
    
    // Remove message handler
    this.removeMessageSubscription();
    
    // Disconnect WebSocket or clear local handlers
    if (this.connection) {
      this.log(`Disconnecting user ${this.userId || 'unknown'}`);
      this.disconnectUser();
    } else {
      this.clearClientSideHandlers();
      this.log('No active connection to clean up');
    }
    
    // Reset state
    this.isInitialized = false;
    this.connectionEstablished = false;
    this.log('Cleanup completed');
  },
  
  
  
  /**
   * Check if incoming message is next in the currently visible branch
   * @param {Object} messageData - The incoming message data
   * @returns {boolean} True if the message is a direct reply to the last visible message
   */
  isNextInVisibleBranch(messageData) {
    try {
      // Extract message ID from current route
      const currentRoute = window.location.pathname;
      const messageIdMatch = currentRoute.match(/\/([^\/\?]+)$/);
      if (!messageIdMatch) {
        return false;
      }
      
      const urlMessageId = messageIdMatch[1];
      
      // Get visible branch messages for this thread
      const visibleMessages = store.getters['messages/getVisibleBranchMessages'](urlMessageId);
      if (!visibleMessages || visibleMessages.length === 0) {
        return false;
      }
      
      // Get the last message in the visible branch
      const lastVisibleMessage = visibleMessages[visibleMessages.length - 1];
      
      // Check if incoming message is a direct reply to the last visible message
      return messageData.parent_id === lastVisibleMessage.id;
    } catch (error) {
      this.error('Error checking if message is next in visible branch:', error);
      return false;
    }
  },

  /**
   * Handle incoming WebSocket messages and update store
   * @param {Object} messageData - The message data from the WebSocket
   */
  handleIncomingMessage(messageData) {
    this.log('Received message:', messageData?.id ? `ID: ${messageData.id}` : 'Invalid message');
    console.log('!!!!! messageData', messageData);

    // Skip if no message data
    if (!messageData || !messageData.id) {
      this.warn('Received invalid message data:', messageData);
      return;
    }
    
    // Add to the store
    this.log(`Adding message ${messageData.id} to store`);
    store.commit('messages/SET_MESSAGE', messageData);
    
    // Get current user for notification logic
    const user = store.getters['auth/user'];
    console.log('!!!!! user', user);
    let isFromCurrentUser = false;
    let isToCurrentUser = false;
    
    if (user) {
      // Check if message is from current user
      isFromCurrentUser = messageData.content_author === user.uid || 
                         messageData.author_user_tag === user.user_tag;
      
      // Check if message is to current user (improved logic)
      isToCurrentUser = messageData.recipients && Array.isArray(messageData.recipients) &&
                       messageData.recipients.some(r => {
                         if (typeof r === 'object' && r !== null) {
                           return (r.uid && r.uid === user.uid) || 
                                  (r.user_tag && r.user_tag === user.user_tag);
                         }
                         // Handle string recipients (backward compatibility)
                         return r === user.uid || r === user.user_tag;
                       });
      
      this.log(`Message analysis: isFromCurrentUser=${isFromCurrentUser}, isToCurrentUser=${isToCurrentUser}`);
    }
    
    // Trigger notification for messages to current user (but not from current user)
    if (isToCurrentUser && !isFromCurrentUser) {
      // Increment unread count for any message to current user (regardless of notifications)
      this.log('Incrementing unread count for message to current user');
      store.dispatch('messages/incrementUnreadCount');
      
      // Simple branch-based notification logic:
      // Only skip notification if message is next in the currently visible branch
      const isNextInBranch = this.isNextInVisibleBranch(messageData);
      const shouldNotify = !isNextInBranch;
      console.log('!!!!! shouldNotify', shouldNotify);
      
      // Auto-mark as read if message is next in visible branch (user is actively viewing this thread)
      if (isNextInBranch) {
        this.log('Message is next in visible branch - auto-marking as read');
        store.dispatch('messages/batchMarkAsRead', [messageData.id]);
      }
      
      if (shouldNotify) {
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
        this.log(`Skipping notification - message is next in visible branch`);
      }
    } else {
      this.log(`No notification needed (isToCurrentUser=${isToCurrentUser}, isFromCurrentUser=${isFromCurrentUser})`);
    }
    
    // Handle parent-child relationships
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
    }
  },

  // Connection method - returns a promise that resolves when connected
  async connectUser(token) {
    this.log(`ConnectUser called with token starting with: ${token ? token.substring(0, 10) + '...' : 'null'}`);
    
    // If already connected with the same token, do nothing
    if (this.connection && 
        this.connectionEstablished &&
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
        this.error(`Error constructing WebSocket URL: ${e}`);
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
        this.connectionEstablished = true;
        
        // JSON heartbeat removed; rely on text ping/pong only
        // Reset idle timer on successful open
        this.resetIdleTimer();
        
        // Reset connection attempts on successful connection
        this.connectionAttempts = 0;
        this.reconnectDelay = 1000; // Reset reconnect delay
        
        // Clear any WS disconnected banner and refresh unread count
        try {
          this.clearWsDisconnectedBanner();
          store.dispatch('messages/fetchUnreadMessageCount');
        } catch (e) {}

        resolve(); // Resolve the connection promise
      };
      
      socket.onmessage = (event) => {
        try {
          // Handle ping/pong
          if (event.data === 'pong') {
            this.log('Received pong from server');
            this.lastPingTime = Date.now();
            return;
          }
          
          if (event.data === 'ping') {
            this.log('Received ping from server, sending pong');
            socket.send('pong');
            return;
          }
          
          this.log(`Received message: ${event.data.substring(0, 100)}${event.data.length > 100 ? '...' : ''}`);
          
          const data = JSON.parse(event.data);
          
          if (data.type === 'connection_established') {
            this.userId = data.user_id;
            this.log(`Connection established for user ${this.userId}`);
          } else if (data.type === 'new_message') {
            // Unified event type -> route to message handler
            if (this.messageCallback) {
              this.log(`Passing message to callback`);
              this.messageCallback(data.data);
            } else {
              this.log(`No message callback registered`);
            }
          } else if (data.type === 'message_updated') {
            this.log(`===== MESSAGE UPDATED =====`);
            this.log(`Message ID: ${data.data?.id}`);
            store.commit('messages/SET_MESSAGE', data.data);
          } else if (data.type === 'error') {
            this.error('Server error:', data.message);
          } else {
            this.log(`Unknown message type: ${data.type}`);
          }
        } catch (error) {
          this.error('Error handling message:', error);
        }
      };
      
      socket.onclose = (event) => {
        this.log(`Connection closed for user ${this.userId}`, event.code, event.reason);
        this.log('WebSocket connection state: CLOSED');
        this.log(`Clean close: ${event.wasClean}, Code: ${event.code}, Reason: ${event.reason || 'none'}`);
        
        this.connection = null;
        this.userId = null;
        this.connectionEstablished = false;
        
        // No idle timer changes here
        
        // Only clear the promise if it's our current one
        if (this.connectionPromise && !event.wasClean) {
          this.connectionPromise = null;
          reject(new Error(`Connection closed unexpectedly: code ${event.code}, reason: ${event.reason || 'none'}`));
        }
        
        // Show persistent banner indicating WS disconnected with channels based on user notify prefs
        try {
          this.showWsDisconnectedBanner();
        } catch (e) {}

        // Handle authentication failures specifically: try refresh then reconnect
        if (event.code === 1008) {
          this.error('Authentication failed (1008). Attempting refresh and reconnect');
          this.attemptRefreshAndReconnect();
          return;
        }

        // Some proxies/browsers report handshake/auth failures as 1006 with empty reason
        // If we have no established connection yet and close quickly with 1006, attempt a refresh once
        const likelyHandshakeFailure = !this.connectionEstablished && event.code === 1006;
        if (likelyHandshakeFailure) {
          this.error('Possible handshake/auth failure (1006). Attempting refresh and reconnect');
          this.attemptRefreshAndReconnect();
          return;
        }

        // Determine if we should reconnect
        const shouldReconnect = !event.wasClean && 
                               this.connectionAttempts < this.maxReconnectAttempts &&
                               event.code !== 1000 && // Normal closure
                               event.code !== 1001 && // Going away
                               this.isInitialized; // Only reconnect if we're supposed to be connected
        
        if (shouldReconnect) {
          this.log(`Connection closed unexpectedly, attempting to reconnect (attempt ${this.connectionAttempts} of ${this.maxReconnectAttempts})`);
          
          // Use exponential backoff for reconnection
          this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000); // Max 30 seconds
          this.log(`Reconnecting in ${this.reconnectDelay}ms`);
          
          setTimeout(async () => {
            try {
              let tokenToUse = this.authToken || TokenManager.accessToken;
              
              this.log(`Attempting reconnection with ${tokenToUse === this.authToken ? 'existing' : 'fresh'} token`);
              await this.connectUser(tokenToUse);
            } catch (err) {
              this.error(`Reconnection attempt failed: ${err.message}`);
            }
          }, this.reconnectDelay);
        } else if (this.connectionAttempts >= this.maxReconnectAttempts) {
          this.error(`Max reconnection attempts (${this.maxReconnectAttempts}) exceeded`);
        }
      };
      
      socket.onerror = (error) => {
        this.error(`WebSocket error for user ${this.userId}:`, error);
        // If error occurs before open and we haven't established connection, try refresh once
        if (!this.connectionEstablished) {
          this.attemptRefreshAndReconnect();
        }
        reject(error);
      };
      
      // Store the connection
      this.connection = socket;
      
    });
    
    return this.connectionPromise;
  },
  
  // For backward compatibility
  async connectToThread(threadId, messageId) {
    this.warn('connectToThread is deprecated, use connectUser instead');
    
    // If we have a token, use that to connect
    const token = localStorage.getItem('auth_token');
    if (token) {
      return this.connectUser(token);
    }
    
    // Otherwise, do nothing - user must be authenticated to receive updates
    this.warn('Cannot connect to WebSocket: No authentication token available');
    return Promise.resolve();
  },
  
  // Disconnect from current thread
  disconnectUser() {
    this.log(`DisconnectUser called`);
    
    // No JSON heartbeat to stop
    
    if (this.connection) {
      this.log(`Disconnecting user ${this.userId}`);
      
      try {
        // Check if connection is still open before trying to close
        if (this.connection.readyState === WebSocket.OPEN) {
          this.log(`Closing WebSocket connection`);
          this.connection.close(1000, "User disconnected intentionally");
        } else {
          this.log(`Connection already closed (state: ${this.connection.readyState})`);
        }
      } catch (e) {
        this.error('Error closing connection:', e);
      }
      
      this.connection = null;
      this.userId = null;
      this.authToken = null;
      this.connectionEstablished = false;
    } else {
      this.log(`No active connection to disconnect`);
    }
    
    // Clear timers and activity listeners
    this.clearClientSideHandlers();

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
  },
  
  /**
   * Check connection health and reconnect if needed
   */
  async checkConnectionHealth() {
    if (!this.connection || this.connection.readyState !== WebSocket.OPEN) {
      this.log('Connection not open, attempting to reconnect');
      
      const user = store.getters['auth/user'];
      if (user) {
        try {
          const token = await this.getFreshAuthToken();
          if (token) {
            await this.connectUser(token);
          }
        } catch (error) {
          this.error('Failed to reconnect:', error);
        }
      }
    }
  },
  
  /**
   * Get connection status
   */
  getConnectionStatus() {
    const status = {
      connected: this.connection?.readyState === WebSocket.OPEN,
      established: this.connectionEstablished,
      userId: this.userId,
      connectionAttempts: this.connectionAttempts,
      lastPingTime: this.lastPingTime,
      hasAuthToken: !!this.authToken
    };
    
    return status;
  }
  ,
  // Activity and idle helpers
  setupActivityListeners() {
    if (this.activityListenerRegistered) return;
    const handler = this.handleActivity.bind(this);
    this._activityHandler = handler;
    try {
      this.activityEvents.forEach(evt => window.addEventListener(evt, handler, { passive: true }));
      this.activityListenerRegistered = true;
      this.lastActivityAt = Date.now();
    } catch (e) {}
  },
  teardownActivityListeners() {
    if (!this.activityListenerRegistered) return;
    try {
      this.activityEvents.forEach(evt => window.removeEventListener(evt, this._activityHandler));
    } catch (e) {}
    this.activityListenerRegistered = false;
    this._activityHandler = null;
  },
  handleActivity() {
    this.lastActivityAt = Date.now();
    // Clear WS disconnected banner immediately on activity
    try { this.clearWsDisconnectedBanner(); } catch (e) {}
    // Attempt reconnect if not open
    this.maybeActivityReconnect();
    // Reset idle timer
    this.resetIdleTimer();
  },
  resetIdleTimer() {
    try {
      if (this.idleTimeoutId) clearTimeout(this.idleTimeoutId);
      this.idleTimeoutId = setTimeout(() => this.onIdleTimeout(), this.idleTimeoutMs);
    } catch (e) {}
  },
  onIdleTimeout() {
    // Disconnect intentionally due to idle
    this.log('Idle timeout reached, disconnecting WebSocket');
    try {
      this.showWsDisconnectedBanner();
    } catch (e) {}
    this.disconnectUser();
  },
  getUserNotifyChannels(user) {
    try {
      const contacts = (user && Array.isArray(user.contacts)) ? user.contacts : [];
      const channels = [];
      const hasEmail = !!contacts.find(c => c.type === 'email' && c.verified && c.notify);
      const hasPhone = !!contacts.find(c => c.type === 'phone' && c.verified && c.notify);
      if (hasPhone) channels.push('phone');
      if (hasEmail) channels.push('email');
      return channels;
    } catch (e) { return []; }
  }
};

export default WebSocketService;
