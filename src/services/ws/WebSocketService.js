import store from '../../store';
import TokenManager from '../../services/TokenManager';
import WebSocketClient from './WebSocketClient';
import IdleManager from './IdleManager';
import NetworkVisibility from './NetworkVisibility';
import ReconnectBackoff from './ReconnectBackoff';

const WS_BASE_URL = '/ws/v1'

const WebSocketService = {
  // Core state
  connection: null,
  connectionPromise: null,
  userId: null,
  messageListeners: new Set(),
  pingInterval: null,
  // Removed idle overlay/timer
  debugMode: false, // Trim logging by default
  authToken: null,
  connectionEstablished: false,

  // Global state management
  isInitialized: false,
  unsubscribeFunction: null,
  connectionAttempts: 0,
  maxReconnectAttempts: 5,
  // Prevent hammering refresh/connect on handshake failures
  refreshCooldownMs: 2 * 60 * 1000, // 2 minutes
  lastRefreshAttemptAt: null,
  isConnecting: false,
  
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
  idleTimeoutMs: 3 * 60 * 1000, // 3 minutes
  lastActivityAt: null,
  activityListenerRegistered: false,
  idleTimerGeneration: 0,
  // Expanded activity events to better capture mobile activity
  activityEvents: ['mousemove', 'pointermove', 'touchstart', 'touchmove', 'keydown', 'scroll', 'wheel'],

  // Network/visibility robustness
  networkVisibilityListenerRegistered: false,
  isOnline: typeof navigator !== 'undefined' ? !!navigator.onLine : true,
  
  // Debug logging helper
  log(...messages) {
    if (this.debugMode) {
      try {
        const status = this.getConnectionStatus?.();
        console.log('[WebSocket]', ...messages, status ? { status } : '');
      } catch (_) {
        console.log('[WebSocket]', ...messages);
      }
    }
  },
  warn(...messages) {
    if (this.debugMode) {
      console.warn('[WebSocket]', ...messages);
    }
  },
  ensureDebugFlag() {
    try {
      const ss = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('ws_debug') : null;
      const ls = typeof localStorage !== 'undefined' ? localStorage.getItem('ws_debug') : null;
      if (ss === '1' || ls === '1') this.debugMode = true;
    } catch (_) {}
  },
  logTokenClaims(token, label = 'token') {
    try {
      if (!this.debugMode) return;
      const claims = TokenManager && TokenManager.decodeJwt ? (TokenManager.decodeJwt(token) || {}) : {};
      const sub = claims?.sub || null;
      const actSub = (claims?.act && claims.act.sub) || null;
      const amr = Array.isArray(claims?.amr) ? claims.amr : (claims?.amr ? [claims.amr] : []);
      const scope = claims?.scope || null;
      const exp = claims?.exp ? new Date(claims.exp * 1000).toISOString() : null;
      this.log('Claims', { label, sub, actSub, amr, scope, exp });
    } catch (_) {}
  },
  // Central token getters to avoid stale closures
  getToken() {
    try { return TokenManager.accessToken; } catch (_) { return null; }
  },
  getRefreshToken() { return null; },
  
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
        const token = this.getToken();
        if (this.tokenRefreshInProgress) {
          this.warn('Skipping activity reconnect during token refresh');
          return;
        }
        if (token) this.safeConnect(token);
      }
    } catch (e) {
      // no-op
    }
  },

  // Removed idle timeout helpers and overlay dispatch
  
  
  error(...messages) {
    console.error('[WebSocket]', ...messages);
  },
  
  setupNetworkVisibilityListeners() {
    if (this.networkVisibilityListenerRegistered) return;
    this.netVis = new NetworkVisibility({
      onOnline: async () => {
        this.isOnline = true;
        const isOpen = this.connection && this.connection.readyState === WebSocket.OPEN;
        if (!isOpen) {
          let token = this.getToken();
          if (!token || this.shouldRefreshToken()) {
            try {
              const refreshed = await TokenManager.refreshAccessToken({ initiator: 'ws_checkHealth' });
              if (refreshed) {
                this.lastTokenRefresh = Date.now();
                token = refreshed;
              }
            } catch (e) {}
          }
          if (token) this.safeConnect(token);
        }
        
      },
      onOffline: () => {
        this.isOnline = false;
      },
      onVisible: () => {
        const isOpen = this.connection && this.connection.readyState === WebSocket.OPEN;
        if (!isOpen && this.isOnline) {
          const token = this.getToken();
          if (token) this.safeConnect(token);
        }
        
      },
      onHidden: () => {
        // Disconnect when tab becomes hidden, app is minimized, or page is backgrounded
        this.disconnectUser();
      }
    });
    this.netVis.start();
    this.networkVisibilityListenerRegistered = true;
  },
  teardownNetworkVisibilityListeners() {
    if (!this.networkVisibilityListenerRegistered) return;
    try { this.netVis?.stop(); } catch (e) {}
    this.networkVisibilityListenerRegistered = false;
    this.netVis = null;
  },
  handleOnline() {
    this.isOnline = true;
    // Attempt reconnect when coming online if not connected
    const isOpen = this.connection && this.connection.readyState === WebSocket.OPEN;
    if (!isOpen) {
      const token = this.getToken();
      if (token) this.safeConnect(token);
    }
    
  },
  handleOffline() {
    this.isOnline = false;
    // No banner handling
  },
  handleVisibilityChange() {
    const isHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    if (!isHidden) {
      // Visible: try to reconnect if needed
      const isOpen = this.connection && this.connection.readyState === WebSocket.OPEN;
      if (!isOpen && this.isOnline) {
        const token = this.getToken();
        if (token) this.safeConnect(token);
      }
      
    }
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
      this.log('Removing primary message handler');
      this.unsubscribeFunction();
      this.unsubscribeFunction = null;
    }
  },
  
  async attemptRefreshAndReconnect() {
    if (!this.isOnline) {
      this.warn('Skipping token refresh while offline');
      return;
    }
    const now = Date.now();
    if (this.lastRefreshAttemptAt && (now - this.lastRefreshAttemptAt) < this.refreshCooldownMs) {
      this.warn('Refresh cooldown active; scheduling backoff reconnect instead of refreshing again');
      const tokenToUse = TokenManager.accessToken;
      if (!tokenToUse) { this.warn('No token available during refresh cooldown; skipping reconnect'); return; }
      this.scheduleReconnect(tokenToUse);
      return;
    }
    if (this.tokenRefreshInProgress) {
      this.warn('Token refresh already in progress; skipping duplicate attempt');
      return;
    }
    this.tokenRefreshInProgress = true;
    try {
      const corrId = `ws_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
      this.log('Attempting token refresh due to authentication failure', { corrId });
      // Refresh token is httpOnly; refresh directly via TokenManager
      const newAccess = await TokenManager.refreshAccessToken({ initiator: 'ws_attemptRefresh', corrId, reason: 'ws_auth_failure' });
      if (!newAccess) {
        this.error('Token refresh failed; skipping WS disconnected banner', { corrId });
        return;
      }
      this.log('Token refresh succeeded, scheduling reconnect with new token', { corrId });
      this.scheduleReconnect(newAccess);
    } catch (e) {
      this.error('Error during refresh-and-reconnect:', e);
    }
    finally {
      this.tokenRefreshInProgress = false;
      this.lastTokenRefresh = Date.now();
      this.lastRefreshAttemptAt = Date.now();
    }
  },

  // Centralized backoff-aware reconnect scheduler
  scheduleReconnect(token) {
    try {
      if (!token) { this.warn('scheduleReconnect called without token; skipping'); return; }
      if (!this.backoff) this.backoff = new ReconnectBackoff({ initialMs: 1000, maxMs: 30000, jitterMs: 500, maxAttempts: this.maxReconnectAttempts });
      const delay = this.backoff.nextDelay();
      if (delay == null) { this.error(`Max reconnection attempts (${this.maxReconnectAttempts}) exceeded`); return; }
      setTimeout(async () => {
        try {
          await this.connectUser(token);
        } catch (err) {
          this.error(`Reconnection attempt failed: ${err.message}`);
        }
      }, delay);
    } catch (e) {
      this.warn('scheduleReconnect failed', e?.message || e);
    }
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
    this.ensureDebugFlag();
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
        // Get token via TokenManager exclusively
        let authToken = TokenManager.accessToken;
        if (!authToken || this.shouldRefreshToken()) {
          try {
            const refreshed = await TokenManager.refreshAccessToken({ initiator: 'ws_initialize' });
            if (refreshed) {
              this.lastTokenRefresh = Date.now();
              authToken = refreshed;
            }
          } catch (e) {}
        }
        
        if (!authToken) {
          this.log('Failed to get fresh auth token');
          return;
        }
        
        this.log('Got fresh auth token');
        this.logTokenClaims(authToken, 'initialize');
        
        // Register message handler for store updates via messages store action
        this.log('Registering message handler');
        this.unsubscribeFunction = this.handleNewMessage((msg) => {
          try { store.dispatch('messages/handleIncomingWsMessage', msg); } catch (e) { this.warn('dispatch handleIncomingWsMessage failed', e?.message || e); }
        });
        
        // Set up activity listeners and idle timer
        this.setupActivityListeners();
        this.setupNetworkVisibilityListeners();
        this.resetIdleTimer();

        // Connect to WebSocket server (non-blocking)
        this.log(`Connecting to WebSocket server for user ${user.uid}`);
        this.safeConnect(authToken);
        this.isInitialized = true;
        this.log(`Global connection attempt started for user ${user.uid}`);
        
        // Activity-based reconnect enabled via global activity handlers
      } catch (error) {
        this.error('Failed to start WebSocket connection:', error);
        // Do not throw; allow app to continue mounting even if WS fails initially
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
    this.teardownNetworkVisibilityListeners();
    
    // Reset state
    this.isInitialized = false;
    this.connectionEstablished = false;
    // Clear any dangling message listeners owned by this service
    try { this.messageListeners && this.messageListeners.clear(); } catch (_) {}
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
      const visibleMessages = store.getters['messages/getFullVisibleBranch'](urlMessageId);
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
    let isFromCurrentUser = false;
    let isToCurrentUser = false;
    
    if (user) {
      // Check if message is from current user
      // Use nested author object (preferred) or legacy flat field
      const authorUid = messageData.author?.uid || messageData.content_author;
      const authorTag = messageData.author?.user_tag || messageData.author_user_tag;
      
      isFromCurrentUser = authorUid === user.uid || authorTag === user.user_tag;
      
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
      
      // Auto-mark as read if message is next in visible branch (user is actively viewing this thread)
      if (isNextInBranch) {
        this.log('Message is next in visible branch - auto-marking as read');
        store.dispatch('messages/batchMarkAsRead', [messageData.id]);
      }
      
      if (shouldNotify) {
        // Extract author name from nested object or flat fields
        const authorName = messageData.author?.display_name || 
                          messageData.author?.user_tag || 
                          messageData.author_display_name || 
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
    this.logTokenClaims(token, 'connectUser');

    // If already connected with the same token, do nothing
    if (this.client && this.client.isOpen && this.authToken === token) {
      this.log(`Already connected with token ${token.substring(0, 10)}...`);
      return Promise.resolve();
    }

    // Prevent overlapping connect attempts with the same token
    if (this.isConnecting && this.authToken === token && this.connectionPromise) {
      this.warn('Connect already in progress; reusing existing promise');
      return this.connectionPromise;
    }

    // Ensure client exists
    if (!this.client) {
      this.client = new WebSocketClient({
        buildUrl: (t) => {
          const isSecure = window.location.protocol === 'https:';
          const wsProtocol = isSecure ? 'wss:' : 'ws:';
          const host = window.location.host;
          return `${wsProtocol}//${host}${WS_BASE_URL}?access_token=${encodeURIComponent(t)}`;
        },
        logger: console,
        // Disable client heartbeat; rely on server pings only
        pingIntervalMs: 0,
        pingTimeoutMs: this.pingTimeoutMs,
      });

      // Wire client events
      this.client.on('open', () => {
        this.connection = this.client.socket;
        // Ensure activity listeners are active after reconnects
        this.setupActivityListeners();
        this.resetIdleTimer();
        this.connectionAttempts = 0;
        try { this.backoff?.reset(); } catch (e) {}
        try { store.dispatch('messages/fetchUnreadMessageCount'); } catch (e) {}
        this.isConnecting = false;
      });

      this.client.on('json', (data) => {
        // All other data types
        this.log('WebSocket data received:', data);
        
        try {
          if (data?.type === 'connection_established') {
            this.userId = data.user_id;
            this.connectionEstablished = true;
            this.log(`Connection established for user ${this.userId}`);
            return;
          }
          
          // Handle new notification payload structure
          if (data?.type === 'notification') {
            try {
              const payload = data.data || {};
              const content = payload.content || {};
              const messages = content.messages || payload.messages || [];
              const notificationType = payload.notification_type || payload.type || 'sent';
              
              if (messages.length > 0) {
                this.log(`Received notification type=${notificationType} with ${messages.length} messages`);
                
                if (this.messageListeners && this.messageListeners.size > 0) {
                  for (const cb of Array.from(this.messageListeners)) {
                    // Dispatch each message individually to maintain compatibility
                    for (const msg of messages) {
                      try { cb(msg); } catch (e) { this.error('Error in message listener:', e); }
                    }
                  }
                }
              }
            } catch (e) {
              this.error('Error handling notification payload:', e);
            }
            return;
          }

          // Legacy format support
          if (data?.type === 'new_message') {
            try {
              if (this.messageListeners && this.messageListeners.size > 0) {
                for (const cb of Array.from(this.messageListeners)) {
                  try { cb(data.data); } catch (_) {}
                }
              }
            } catch (_) {}
            return;
          }
          if (data?.type === 'error') {
            this.error('Server error:', data.message);
            return;
          }
        } catch (e) {
          this.error('Error handling JSON message:', e);
        }
      });

      this.client.on('close', (event) => {
        this.warn('Socket closed', { code: event?.code, reason: event?.reason, wasClean: event?.wasClean });
        this.connection = null;
        this.userId = null;
        this.connectionEstablished = false;
        this.isConnecting = false;

        

        if (event.code === 1008) {
          this.error('Authentication failed (1008). Attempting refresh and reconnect');
          this.authToken = null;
          this.attemptRefreshAndReconnect();
          try {
            const ap = store.getters['auth/activePrincipalUid'];
            const mu = store.getters['auth/managerUid'];
            this.warn('Auth context on 1008', { activePrincipalUid: ap, managerUid: mu });
          } catch (_) {}
          return;
        }

        const likelyHandshakeFailure = !this.connectionEstablished && event.code === 1006;
        if (likelyHandshakeFailure) {
          this.error('Possible handshake/auth failure (1006). Forcing refresh-and-reconnect');
          this.authToken = null;
          this.attemptRefreshAndReconnect();
          try {
            const ap = store.getters['auth/activePrincipalUid'];
            const mu = store.getters['auth/managerUid'];
            this.warn('Auth context on 1006', { activePrincipalUid: ap, managerUid: mu });
          } catch (_) {}
          return;
        }

        const shouldReconnect = !event.wasClean &&
                               event.code !== 1000 &&
                               event.code !== 1001 &&
                               this.isInitialized &&
                               this.isOnline;
        if (shouldReconnect) {
          this.connectionAttempts++;
          const tokenToUse = TokenManager.accessToken;
          if (!tokenToUse) { this.warn('Reconnect requested but no token available; skipping'); return; }
          this.scheduleReconnect(tokenToUse);
        }
      });

      this.client.on('error', (err) => {
        this.error('WebSocket client error:', err);
      });
    }

    // Track token and connect
    this.authToken = token;
    this.connectionAttempts++;
    this.isConnecting = true;
    this.connectionPromise = this.client.connect(token);
    return this.connectionPromise;
  },
  
  // For backward compatibility
  async connectToThread(threadId, messageId) {
    // deprecated: no-op retained for compatibility
    return Promise.resolve();
  },
  
  // Disconnect from current thread
  disconnectUser() {
    this.log(`DisconnectUser called`);
    
    // No JSON heartbeat to stop
    
    if (this.client && this.client.socket) {
      this.log(`Disconnecting user ${this.userId}`);
      
      try {
        this.client.disconnect(1000, "User disconnected intentionally");
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
    if (callback && typeof callback === 'function') {
      this.messageListeners.add(callback);
    }
    // Return unsubscribe function
    return () => {
      this.log(`Unsubscribe called for a message listener`);
      try { this.messageListeners.delete(callback); } catch (_) {}
      // Do not auto-disconnect here; lifecycle is managed by initialize/cleanup
    };
  },
  
  // For backward compatibility - does nothing now as we subscribe to all messages for the user
  async updateSelectedMessage(messageId) {
    // deprecated: no-op retained for compatibility
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
          let token = TokenManager.accessToken;
          if (!token || this.shouldRefreshToken()) {
            try {
              const refreshed = await TokenManager.refreshAccessToken({ initiator: 'ws_health_missing_or_stale' });
              if (refreshed) {
                this.lastTokenRefresh = Date.now();
                token = refreshed;
              }
            } catch (e) {}
          }
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
      hasAuthToken: !!this.authToken,
      hasRefreshToken: undefined,  // Refresh token is in httpOnly cookie only (not accessible to JS)
      authTokenPrefix: this.authToken ? this.authToken.slice(0, 10) : null,
    };
    
    return status;
  }
  ,
  // Internal helper to avoid unhandled promise rejections on fire-and-forget connects
  safeConnect(token) {
    try {
      const p = this.connectUser(token);
      if (p && typeof p.catch === 'function') {
        p.catch(err => this.warn('connectUser error suppressed', err?.message || err));
      }
    } catch (e) {
      this.warn('safeConnect threw synchronously', e?.message || e);
    }
  },
  // Debug helper to print a one-shot status line
  debugStatus(label = 'status') {
    try {
      const s = this.getConnectionStatus();
      console.log('[WebSocket][debug]', label, s);
      return s;
    } catch (e) {
      console.log('[WebSocket][debug]', label, 'failed to get status', e);
      return null;
    }
  },
  // Activity and idle helpers
  setupActivityListeners() {
    if (this.activityListenerRegistered) return;
    this.idleManager = new IdleManager({
      timeoutMs: this.idleTimeoutMs,
      events: this.activityEvents,
      onActivity: () => this.handleActivity(),
      onTimeout: () => this.onIdleTimeout()
    });
    this.idleManager.start();
    this.activityListenerRegistered = true;
    this.lastActivityAt = Date.now();
  },
  teardownActivityListeners() {
    if (!this.activityListenerRegistered) return;
    try { this.idleManager?.stop(); } catch (e) {}
    this.activityListenerRegistered = false;
    this.idleManager = null;
  },
  handleActivity() {
    this.lastActivityAt = Date.now();
    
    // Attempt reconnect if not open
    this.maybeActivityReconnect();
    // Reset idle timer
    this.resetIdleTimer();
  },
  resetIdleTimer() {
    try { this.idleManager?.reset(); } catch (e) {}
  },
  onIdleTimeout() {
    // Double-check inactivity to avoid false positives from throttled timers
    try {
      const now = Date.now();
      const lastActivity = this.lastActivityAt || 0;
      const timeSinceActivity = now - lastActivity;
      if (timeSinceActivity < this.idleTimeoutMs - 250) {
        this.warn('Idle timer fired but recent activity detected; resetting timer');
        this.resetIdleTimer();
        return;
      }
    } catch (e) {}
    this.log('Idle timeout reached, disconnecting WebSocket');
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

// Optional: expose for console debugging in dev
if (typeof window !== 'undefined') {
  try { window.WebSocketService = WebSocketService; } catch (e) {}
}
