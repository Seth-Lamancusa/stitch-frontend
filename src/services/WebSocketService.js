import store from '../store';

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
   * Initialize global WebSocket connection for the authenticated user
   * Should be called when the application starts and when auth state changes
   */
  async initialize() {
    // Get current auth state
    const user = store.getters['auth/user'];
    const authToken = localStorage.getItem('auth_token');
    
    this.log(`Initialize called - User: ${user ? user.uid : 'none'}, Token: ${authToken ? 'present' : 'missing'}`);
    
    // Clean up existing connection if any
    this.cleanup();
    
    // Reset connection attempts
    this.connectionAttempts = 0;
    
    // Only connect if user is authenticated
    if (user && authToken) {
      this.log(`Initializing global connection for user ${user.uid}`);
      
      // Register message handler for store updates
      this.log('Registering message handler');
      this.unsubscribeFunction = this.handleNewMessage(this.handleIncomingMessage.bind(this));
      
      try {
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
      if (!user) {
        this.log('No authenticated user, skipping initialization');
      }
      if (!authToken) {
        this.log('No auth token available, skipping initialization');
      }
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
    
    // Add tab markers to the message if not present
    if (!messageData.for_tabs || !Array.isArray(messageData.for_tabs)) {
      messageData.for_tabs = [];
    }
    
    // Check if this is a direct message to the current user
    const user = store.getters['auth/user'];
    let isDirectMessage = false;
    
    if (user && messageData.recipients && Array.isArray(messageData.recipients)) {
      // If message is directed to the current user and not public, mark for Direct tab
      const isToCurrentUser = messageData.recipients.some(r => 
        (r.uid && r.uid === user.uid) || 
        (r.user_tag && r.user_tag === user.user_tag)
      );
      
      const isFromCurrentUser = messageData.content_author === user.uid || 
                               messageData.author_user_tag === user.user_tag;
      
      const isPrivateMessage = messageData.public === false;
      
      // Add to Direct tab if:
      // 1. Message is private, AND
      // 2. Either sent to current user or from current user
      if (isPrivateMessage && (isToCurrentUser || isFromCurrentUser)) {
        isDirectMessage = true;
        if (!messageData.for_tabs.includes('private')) {
          this.log(`Adding 'private' tab marker to message ${messageData.id}`);
          messageData.for_tabs.push('private');
        }
      }
    }
    
    // Add to the store
    this.log(`Adding message ${messageData.id} to store`);
    store.commit('messages/SET_MESSAGE', messageData);
    
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
      
      // Check if we need to update the unread count
      const user = store.getters['auth/user'];
      if (user) {
        // Only increment unread count if message is directed to the user
        // and it's from someone other than the user
        const isToCurrentUser = messageData.recipients && 
                               messageData.recipients.some(r => 
                                 (r.uid && r.uid === user.uid) || 
                                 (r.user_tag && r.user_tag === user.user_tag));
        
        const isFromCurrentUser = messageData.content_author === user.uid || 
                                 messageData.author_user_tag === user.user_tag;
        
        this.log(`Message to current user: ${isToCurrentUser}, from current user: ${isFromCurrentUser}`);
        
        if (isToCurrentUser && !isFromCurrentUser) {
          this.log('Incrementing unread message count');
          // Update unread count in store
          const currentCount = store.getters['messages/getUnreadMessageCount'];
          store.commit('messages/SET_UNREAD_MESSAGE_COUNT', currentCount + 1);
          
          // Also refresh unread count from the server to ensure accuracy
          store.dispatch('messages/fetchUnreadMessageCount');
        }
      }
    }
    
    // Mark the message as read if it's in the current branch path
    const currentRoute = store.getters['navigation/currentRoute'];
    const currentThreadId = currentRoute?.params?.id;
    
    if (currentThreadId) {
      this.log(`Current thread ID: ${currentThreadId}`);
      
      // Get current branch path
      const branchPath = store.getters['messages/getMessageBranch'](parseInt(currentThreadId));
      
      // Check if message is in the branch path
      const isInBranchPath = branchPath.some(msg => msg.id === messageData.id);
          
      this.log(`Message in branch path: ${isInBranchPath}`);
      
      if (isInBranchPath) {
        this.log(`Marking message ${messageData.id} as read`);
        
        // Set loading state for "to you" badge
        store.commit('ui/SET_TO_YOU_BADGE_LOADING', true);
        
        // Mark as read and handle completion
        this.log(`🔍 Calling backend to mark message ${messageData.id} as read`);
        store.dispatch('messages/markMessageAsRead', messageData.id)
          .then(() => {
            this.log(`✅ Successfully marked message ${messageData.id} as read on backend`);
            // Force refresh unread count from server to ensure consistency
            return store.dispatch('messages/fetchUnreadMessageCount');
          })
          .catch(error => {
            this.log(`❌ Error marking message ${messageData.id} as read: ${error.message}`);
            console.error(`[WebSocket] Error marking message as read:`, error);
          })
          .finally(() => {
            // Reset loading state when request completes
            store.commit('ui/SET_TO_YOU_BADGE_LOADING', false);
          });
      }
    }
    
    // Update unread message count
    this.log('Fetching updated unread message count');
    store.dispatch('messages/fetchUnreadMessageCount');
    
    // Additional processing based on current tab
    const activeTab = store.getters['ui/activeTab'];
    this.log(`Current active tab: ${activeTab}`);
    
    // If we're on the Direct tab and this is a direct message, trigger a refresh
    if (activeTab === 'private') {
      if (isDirectMessage) {
        this.log('New direct message received while on Direct tab, triggering refresh');
        // Create a refresh trigger mutation to tell the UI to update
        store.commit('messages/REFRESH_DIRECT_MESSAGES');
      } else {
        this.log('User is on Direct tab, refreshing messages');
        // For backward compatibility, still do the fetch on non-direct messages
        store.dispatch('messages/fetchDirectMessages', { cursor: null });
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
      // Create WebSocket connection - use backend URL, not frontend
      const apiUrl = import.meta.env.VITE_API_URL || 'https://stitch-backend-659986757275.us-central1.run.app';
      this.log(`Using API URL: ${apiUrl}`);
      
      // Parse the URL to handle any path format
      let wsUrl;
      try {
        // Create URL object to easily work with parts
        const apiUrlObj = new URL(apiUrl);
        
        // Switch protocol
        apiUrlObj.protocol = apiUrlObj.protocol === 'https:' ? 'wss:' : 'ws:';
        
        // WebSocket endpoint should not have /api prefix
        // Replace /api/ or /api in the pathname
        apiUrlObj.pathname = apiUrlObj.pathname
          .replace(/\/api\/?$/, '/') // Replace /api/ or /api at the end
          .replace(/\/api\//, '/');  // Replace /api/ in the middle
          
        // Ensure pathname ends with /
        if (!apiUrlObj.pathname.endsWith('/')) {
          apiUrlObj.pathname += '/';
        }
        
        // Generate a random view ID for this connection
        const viewId = `view_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        
        // Append WebSocket path with user token
        wsUrl = `${apiUrlObj.toString()}ws/user/${token}/${viewId}`;
        
        // Clean up any double slashes (except in protocol)
        wsUrl = wsUrl.replace(/([^:])\/\//g, '$1/');
        
        this.log(`WebSocket URL constructed: ${wsUrl.replace(token, '[TOKEN]')}`);
      } catch (e) {
        // Fallback if URL parsing fails
        this.log(`Error parsing URL: ${e}. Using simple string manipulation.`);
        const baseWsUrl = apiUrl
          .replace('https://', 'wss://')
          .replace('http://', 'ws://')
          .replace(/\/api\/?$/, '') // Remove trailing /api or /api/
          .replace(/\/api\//, '/'); // Replace /api/ in the path
          
        const viewId = `view_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        wsUrl = `${baseWsUrl}/ws/user/${token}/${viewId}`;
        
        this.log(`WebSocket URL (fallback): ${wsUrl.replace(token, '[TOKEN]')}`);
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
          
          setTimeout(() => {
            if (this.authToken) {
              this.log(`Attempting reconnection with token ${this.authToken.substring(0, 10)}...`);
              this.connectUser(this.authToken).catch(err => {
                this.log(`Reconnection attempt failed: ${err.message}`);
              });
            } else {
              this.log(`Cannot reconnect: no auth token available`);
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
