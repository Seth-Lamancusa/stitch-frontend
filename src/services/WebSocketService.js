export default {
  // Core state
  connection: null,
  connectionPromise: null,
  threadId: null,
  endMessageId: null,
  messageCallback: null,
  pingInterval: null,
  debugMode: true,

  // Simple connection method - returns a promise that resolves when connected
  async connectToThread(threadId, endMessageId) {
    // If already connected to this thread with the same end message, do nothing
    if (this.connection && 
        this.threadId === threadId && 
        this.endMessageId === endMessageId && 
        this.connection.readyState === WebSocket.OPEN) {
      this.log(`Already connected to thread ${threadId} with end message ${endMessageId}`);
      return Promise.resolve();
    }
    
    // If connected to a different thread or different end message, disconnect first
    if (this.connection) {
      this.disconnectFromThread();
    }
    
    // Store thread info
    this.threadId = threadId;
    this.endMessageId = endMessageId;
    
    // Create a new connection promise
    this.connectionPromise = new Promise((resolve, reject) => {
      // Create WebSocket connection - use backend URL, not frontend
      const apiUrl = import.meta.env.VITE_API_URL || 'https://stitch-backend-659986757275.us-central1.run.app';
      // Convert HTTPS URL to WSS URL
      const baseWsUrl = apiUrl.replace('https://', 'wss://');
      const wsUrl = `${baseWsUrl}/ws/view/${threadId}`;
      
      this.log(`Connecting to ${wsUrl}`);
      const socket = new WebSocket(wsUrl);
      
      // Set up event handlers
      socket.onopen = () => {
        this.log(`Connected to thread ${threadId}`);
        
        // Once connected, subscribe to the end message
        if (this.endMessageId) {
          this.log(`Subscribing to end message ${this.endMessageId}`);
          this.sendSubscription(socket, [this.endMessageId]);
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
            this.log(`Received new reply: ${data.data?.id} to parent ${data.data?.parent_id}`);
            
            // Only process messages for our end message
            if (data.data?.parent_id === this.endMessageId && this.messageCallback) {
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
    this.endMessageId = null;
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
  
  // Update the end message we're subscribed to
  async updateEndMessage(endMessageId) {
    // If same end message, do nothing
    if (endMessageId === this.endMessageId) {
      return;
    }
    
    this.log(`Updating end message from ${this.endMessageId} to ${endMessageId}`);
    this.endMessageId = endMessageId;
    
    // If connected, send new subscription
    if (this.connection?.readyState === WebSocket.OPEN) {
      this.sendSubscription(this.connection, [endMessageId]);
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
  },
  
  // Backward compatibility functions
  subscribeToEndOfBranchMessages(viewId, endMessageId, isAtEnd, callback) {
    // Only subscribe if at the end of the thread
    if (!isAtEnd) {
      this.disconnectFromThread();
      return () => {};
    }
    
    // Connect and register callback
    this.connectToThread(viewId, endMessageId)
      .catch(error => console.error('[WebSocket] Connection error:', error));
    
    return this.handleNewMessage(callback);
  }
};
