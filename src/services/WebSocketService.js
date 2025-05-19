export default {
  // Core state
  connection: null,
  connectionPromise: null,
  threadId: null,
  selectedMessageId: null,
  messageCallback: null,
  pingInterval: null,
  debugMode: false,

  // Simple connection method - returns a promise that resolves when connected
  async connectToThread(threadId, messageId) {
    // If already connected to this thread with the same message, do nothing
    if (this.connection && 
        this.threadId === threadId && 
        this.selectedMessageId === messageId && 
        this.connection.readyState === WebSocket.OPEN) {
      this.log(`Already connected to thread ${threadId} with selected message ${messageId}`);
      return Promise.resolve();
    }
    
    // If connected to a different thread or different message, disconnect first
    if (this.connection) {
      this.disconnectFromThread();
    }
    
    // Store thread info
    this.threadId = threadId;
    this.selectedMessageId = messageId;
    
    // Create a new connection promise
    this.connectionPromise = new Promise((resolve, reject) => {
      // Create WebSocket connection - use backend URL, not frontend
      const apiUrl = import.meta.env.VITE_API_URL || 'https://stitch-backend-659986757275.us-central1.run.app';
      
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
        
        // Append WebSocket path
        wsUrl = `${apiUrlObj.toString()}ws/view/${threadId}`;
        
        // Clean up any double slashes (except in protocol)
        wsUrl = wsUrl.replace(/([^:])\/\//g, '$1/');
      } catch (e) {
        // Fallback if URL parsing fails
        this.log(`Error parsing URL: ${e}. Using simple string manipulation.`);
        const baseWsUrl = apiUrl
          .replace('https://', 'wss://')
          .replace('http://', 'ws://')
          .replace(/\/api\/?$/, '') // Remove trailing /api or /api/
          .replace(/\/api\//, '/'); // Replace /api/ in the path
          
        wsUrl = `${baseWsUrl}/ws/view/${threadId}`;
      }
      
      this.log(`Connecting to ${wsUrl}`);
      const socket = new WebSocket(wsUrl);
      
      // Set up event handlers
      socket.onopen = () => {
        this.log(`Connected to thread ${threadId}`);
        
        // Once connected, subscribe to the selected message
        if (this.selectedMessageId) {
          this.log(`Subscribing to selected message ${this.selectedMessageId}`);
          this.sendSubscription(socket, [this.selectedMessageId]);
        }
        
        resolve(); // Resolve the connection promise
      };
      
      socket.onmessage = (event) => {
        try {
          // Handle ping/pong
          if (event.data === 'pong') {
            return;
          }
          
          const data = JSON.parse(event.data);
          
          if (data.type === 'subscription_ack') {
            this.log(`Subscription acknowledged: ${data.message_ids?.length || 0} messages`);
          } else if (data.type === 'new_reply') {
            this.log(`===== NEW REPLY RECEIVED =====`);
            this.log(`Message ID: ${data.data?.id}`);
            this.log(`Parent ID: ${data.data?.parent_id}`);
            this.log(`Author: ${data.data?.author_display_name || data.data?.author_user_tag || data.data?.content_author}`);
            this.log(`Content: "${data.data?.content?.substring(0, 50)}${data.data?.content?.length > 50 ? '...' : ''}"`);
            
            // Process all new_reply messages, regardless of parent_id
            if (this.messageCallback) {
              this.log(`Passing message to callback`);
              this.messageCallback(data.data);
            }
          }
        } catch (error) {
          console.error('[WebSocket] Error handling message:', error);
        }
      };
      
      socket.onclose = (event) => {
        this.log(`Connection closed for thread ${threadId}`, event.code, event.reason);
        this.connection = null;
        
        // Only clear the promise if it's our current one
        if (this.connectionPromise && !event.wasClean) {
          this.connectionPromise = null;
          reject(new Error('Connection closed unexpectedly'));
        }
      };
      
      socket.onerror = (error) => {
        console.error(`[WebSocket] Error for thread ${threadId}:`, error);
        reject(error);
      };
      
      // Store the connection
      this.connection = socket;
      
      // Set up ping interval
      this.pingInterval = setInterval(() => {
        if (this.connection?.readyState === WebSocket.OPEN) {
          this.connection.send('ping');
        }
      }, 30000);
    });
    
    return this.connectionPromise;
  },
  
  // Disconnect from current thread
  disconnectFromThread() {
    if (this.connection) {
      this.log(`Disconnecting from thread ${this.threadId}`);
      
      try {
        this.connection.close();
      } catch (e) {
        console.error('[WebSocket] Error closing connection:', e);
      }
      
      this.connection = null;
    }
    
    // Clear ping interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    // Clear thread state
    this.threadId = null;
    this.selectedMessageId = null;
    this.connectionPromise = null;
  },
  
  // Register callback for new messages
  handleNewMessage(callback) {
    this.messageCallback = callback;
    
    // Return unsubscribe function
    return () => {
      this.messageCallback = null;
      
      // If no callback, we can disconnect
      if (!this.messageCallback) {
        this.disconnectFromThread();
      }
    };
  },
  
  // Update the selected message we're subscribed to
  async updateSelectedMessage(messageId) {
    // If same message, do nothing
    if (messageId === this.selectedMessageId) {
      return;
    }
    
    this.log(`Updating selected message from ${this.selectedMessageId} to ${messageId}`);
    this.selectedMessageId = messageId;
    
    // If connected, send new subscription
    if (this.connection?.readyState === WebSocket.OPEN) {
      this.sendSubscription(this.connection, [messageId]);
    }
  },
  
  // Send subscription to server (private helper)
  sendSubscription(socket, messageIds) {
    if (!messageIds || messageIds.length === 0) {
      return;
    }
    
    if (socket.readyState === WebSocket.OPEN) {
      const subscription = {
        type: 'subscribe',
        messageIds: messageIds
      };
      
      this.log(`Sending subscription for messages: ${messageIds.join(', ')}`);
      socket.send(JSON.stringify(subscription));
    }
  },
  
  // Helper for logging with debug mode
  log(...messages) {
    if (this.debugMode) {
      console.log('[WebSocket]', ...messages);
    }
  }
};
