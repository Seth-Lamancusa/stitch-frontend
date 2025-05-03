export default {
  // View-based state
  viewConnection: null, // The current view's WebSocket connection
  viewCallbacks: [], // Callbacks for view events
  visibleMessageIds: [], // IDs of all visible messages in the current view
  lastVisibleMessageId: null, // ID of the last visible message in the current view
  pingInterval: null, // Interval for ping-pong
  debugMode: true, // Enable detailed debug logging

  // Connect to WebSocket server for the current view
  connectToView(viewId) {
    // Close existing connection if there is one
    if (this.viewConnection) {
      this.closeViewConnection();
    }
    
    const baseWsUrl = import.meta.env.VITE_WS_URL || `ws://${window.location.host}`;
    const wsUrl = `${baseWsUrl}/ws/view/${viewId}`;
    
    if (this.debugMode) {
      console.log(`[WebSocket] Connecting to ${wsUrl}`);
    }
    
    // Create a new WebSocket connection
    const socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
      console.log(`[WebSocket] Connected for view ${viewId}`);
      
      // Re-subscribe to visible messages if any
      if (this.visibleMessageIds.length > 0) {
        if (this.debugMode) {
          console.log(`[WebSocket] Re-subscribing to ${this.visibleMessageIds.length} messages after connection`);
        }
        this.sendSubscription(this.visibleMessageIds);
      } else {
        console.log(`[WebSocket] No messages to subscribe to after connection`);
      }
    };
    
    socket.onmessage = (event) => {
      try {
        // Handle ping/pong
        if (event.data === 'pong') {
          return;
        }
        
        const data = JSON.parse(event.data);
        
        if (this.debugMode) {
          if (data.type === 'subscription_ack') {
            console.log(`[WebSocket] Subscription acknowledged: ${data.message_ids?.length || 0} messages`);
          } else if (data.type === 'new_reply') {
            console.log(`[WebSocket] Received new reply: ${data.data?.id} to parent ${data.data?.parent_id}`);
          } else {
            console.log(`[WebSocket] Received message of type: ${data.type}`);
          }
        }
        
        this.handleViewMessage(data);
      } catch (error) {
        console.error('[WebSocket] Error handling message:', error);
      }
    };
    
    socket.onclose = () => {
      console.log(`[WebSocket] Connection closed for view ${viewId}`);
      this.viewConnection = null;
      
      // Reconnect after delay if needed
      if (this.viewCallbacks.length > 0) {
        setTimeout(() => this.connectToView(viewId), 3000);
      }
    };
    
    socket.onerror = (error) => {
      console.error(`[WebSocket] Error for view ${viewId}:`, error);
    };
    
    // Store the socket connection
    this.viewConnection = socket;
    
    // Set up ping interval to keep connection alive
    this.pingInterval = setInterval(() => {
      if (this.viewConnection && this.viewConnection.readyState === WebSocket.OPEN) {
        this.viewConnection.send('ping');
      }
    }, 30000); // Every 30 seconds
    
    return socket;
  },
  
  // Close view connection
  closeViewConnection() {
    if (this.viewConnection) {
      this.viewConnection.close();
      this.viewConnection = null;
    }
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    this.visibleMessageIds = [];
    this.lastVisibleMessageId = null;
    this.viewCallbacks = [];
    
    if (this.debugMode) {
      console.log(`[WebSocket] Connection and subscriptions cleared`);
    }
  },
  
  // Handle messages from view WebSocket
  handleViewMessage(data) {
    // Handle subscription acknowledgment
    if (data.type === 'subscription_ack') {
      return;
    }
    
    // Check if this is a new reply to a visible message
    if (data.type === 'new_reply' && data.data && data.data.parent_id) {
      // Check if the parent message is in our visible messages
      const parentId = data.data.parent_id;
      const isParentVisible = this.visibleMessageIds.includes(parentId);
      
      // Special handling for replies to the last visible message
      const isReplyToLastMessage = parentId === this.lastVisibleMessageId;
      
      // Add special flags to the data before passing to callbacks
      data.isParentVisible = isParentVisible;
      data.isReplyToLastMessage = isReplyToLastMessage;
    
      if (this.debugMode) {
        console.log(`[WebSocket] Processing new reply ${data.data.id} to ${parentId}. Parent visible: ${isParentVisible}`);
      }
    }
    
    // Notify all callbacks of the event
    this.viewCallbacks.forEach(callback => {
      callback(data);
    });
  },
  
  // Send subscription to server
  sendSubscription(messageIds) {
    if (!messageIds || messageIds.length === 0) {
      console.warn('[WebSocket] Attempted to subscribe with empty message IDs list');
      return;
    }
    
    if (this.viewConnection && this.viewConnection.readyState === WebSocket.OPEN) {
      const subscription = {
        type: 'subscribe',
        messageIds: messageIds
      };
      
      if (this.debugMode) {
        console.log(`[WebSocket] Sending subscription for ${messageIds.length} messages: ${messageIds.join(', ')}`);
      }
      
      this.viewConnection.send(JSON.stringify(subscription));
    } else {
      console.warn('[WebSocket] Cannot subscribe: View WebSocket not connected');
      
      // Create a new connection if needed
      if (!this.viewConnection) {
        console.log('[WebSocket] Creating new connection for subscription');
        const viewId = `view_${Date.now()}`;
        this.connectToView(viewId);
        // The onopen handler will re-attempt subscription
      } else {
        console.log(`[WebSocket] Connection state: ${this.viewConnection.readyState}`);
      }
    }
  },
  
  // Subscribe to all visible messages in the current view
  subscribeToVisibleMessages(viewId, messageIds, lastMessageId, callback) {
    if (this.debugMode) {
      console.log(`[WebSocket] subscribeToVisibleMessages called for ${messageIds.length} messages`);
    }
    
    // Store the message IDs
    this.visibleMessageIds = [...messageIds];
    this.lastVisibleMessageId = lastMessageId;
    
    // Add the callback
    if (callback && !this.viewCallbacks.includes(callback)) {
      this.viewCallbacks.push(callback);
      if (this.debugMode) {
        console.log(`[WebSocket] Added new callback, total callbacks: ${this.viewCallbacks.length}`);
      }
    }
    
    // Make sure we have a connection
    if (!this.viewConnection) {
      if (this.debugMode) {
        console.log(`[WebSocket] No active connection, creating new one for view ${viewId}`);
      }
      this.connectToView(viewId);
    } else if (this.viewConnection.readyState === WebSocket.OPEN) {
      // If already connected, send subscription
      if (this.debugMode) {
        console.log(`[WebSocket] Using existing connection to subscribe`);
      }
      this.sendSubscription(messageIds);
    } else {
      if (this.debugMode) {
        console.log(`[WebSocket] Connection not ready (state: ${this.viewConnection.readyState}), will subscribe when open`);
      }
    }
    
    // Return unsubscribe function
    return () => {
      this.viewCallbacks = this.viewCallbacks.filter(cb => cb !== callback);
      
      // If no more callbacks, close connection
      if (this.viewCallbacks.length === 0) {
        this.closeViewConnection();
      }
    };
  },
  
  // Update the list of visible messages
  updateVisibleMessages(messageIds, lastMessageId) {
    if (!messageIds || messageIds.length === 0) {
      console.warn('[WebSocket] Attempted to update with empty message IDs');
      return;
    }
    
    const hasChanges = 
      messageIds.length !== this.visibleMessageIds.length || 
      lastMessageId !== this.lastVisibleMessageId ||
      messageIds.some(id => !this.visibleMessageIds.includes(id));
      
    if (hasChanges) {
      if (this.debugMode) {
        const added = messageIds.filter(id => !this.visibleMessageIds.includes(id));
        if (added.length > 0) {
          console.log(`[WebSocket] Adding ${added.length} new message subscriptions: ${added.join(', ')}`);
        }
      }
      
      this.visibleMessageIds = [...messageIds];
      this.lastVisibleMessageId = lastMessageId;
      
      // Re-subscribe if connection is open
      if (this.viewConnection && this.viewConnection.readyState === WebSocket.OPEN) {
        this.sendSubscription(messageIds);
      } else {
        if (this.debugMode) {
          console.log(`[WebSocket] Connection not ready for subscription update, state: ${this.viewConnection?.readyState}`);
        }
      }
    } else {
      if (this.debugMode) {
        console.log(`[WebSocket] No changes in visible messages, skipping update`);
      }
    }
  },
  
  // Subscribe to a specific message
  subscribeToMessage(messageId) {
    if (!messageId) {
      console.warn('[WebSocket] Attempted to subscribe to invalid message ID');
      return;
    }
    
    // Always create a connection if we don't have one yet
    if (!this.viewConnection) {
      const viewId = `view_${Date.now()}`;
      console.log(`[WebSocket] Creating new connection for subscribing to message ${messageId}`);
      this.connectToView(viewId);
      // Ensure we have a non-empty list to start with
      this.visibleMessageIds = [messageId];
      // The connection's onopen handler will send the subscription
      return;
    }
    
    // Add to existing subscriptions
    if (!this.visibleMessageIds.includes(messageId)) {
      console.log(`[WebSocket] Adding message ${messageId} to subscriptions`);
      this.visibleMessageIds.push(messageId);
      
      // Send updated subscription if connected
      if (this.viewConnection && this.viewConnection.readyState === WebSocket.OPEN) {
        this.sendSubscription(this.visibleMessageIds);
      } else {
        console.log(`[WebSocket] Connection not ready (state: ${this.viewConnection.readyState}), will subscribe when open`);
      }
    } else {
      if (this.debugMode) {
        console.log(`[WebSocket] Message ${messageId} already in subscription list`);
      }
    }
  }
};
