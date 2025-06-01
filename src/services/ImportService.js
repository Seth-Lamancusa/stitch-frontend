import axios from 'axios';
import { getFirebaseAuth } from '../firebase.js';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

// Helper function to get auth headers
const getAuthHeaders = async () => {
  const auth = getFirebaseAuth();
  if (!auth || !auth.currentUser) {
    return {};
  }
  
  try {
    const token = await auth.currentUser.getIdToken();
    return {
      Authorization: `Bearer ${token}`
    };
  } catch (error) {
    console.error('Error getting auth token:', error);
    return {};
  }
};

class ImportService {
  /**
   * Import a ChatGPT conversation
   * @param {Array} messages - Array of message objects with role and content
   * @param {String} title - Optional title for the imported thread
   * @param {String} description - Optional description
   * @returns {Promise} - API response with thread_id
   */
  async importChatGPTConversation(messages, title = null, description = null) {
    const headers = await getAuthHeaders();
    
    const importData = {
      messages: messages,
      title: title || 'Imported ChatGPT Conversation',
      description: description
    };
    
    console.log('[ImportService] Importing ChatGPT conversation:', {
      messageCount: messages.length,
      title: title,
      hasDescription: !!description
    });
    
    try {
      const response = await axios.post(
        `${apiBaseUrl}/messages/import/chatgpt`,
        importData,
        { headers }
      );
      
      console.log('[ImportService] Import successful:', response.data);
      return response.data;
    } catch (error) {
      console.error('[ImportService] Import failed:', error);
      throw error;
    }
  }
  
  /**
   * Parse ChatGPT conversation text into message objects
   * @param {String} text - The conversation text to parse
   * @returns {Array} - Array of message objects
   */
  parseChatGPTConversation(text) {
    const messages = [];
    
    // Check if this uses "You said:" / "ChatGPT said:" format
    if (text.includes('You said:\n') || text.includes('ChatGPT said:\n')) {
      return this.parseExplicitMarkerFormat(text);
    }
    
    // Check if this uses "ChatGPT said:" format (without "You said:")
    if (/^ChatGPT said:?\s*$/im.test(text)) {
      return this.parseChatGPTSaidFormat(text);
    }
    
    // Otherwise use standard format parsing
    return this.parseStandardFormat(text);
  }
  
  /**
   * Parse format with explicit "You said:" and "ChatGPT said:" markers
   * @param {String} text - The conversation text to parse
   * @returns {Array} - Array of message objects
   */
  parseExplicitMarkerFormat(text) {
    const messages = [];
    
    // Find all markers and their positions
    const markers = [];
    let position = 0;
    
    // Find all "You said:" markers
    while (true) {
      const index = text.indexOf('You said:\n', position);
      if (index === -1) break;
      markers.push({ type: 'user', position: index, marker: 'You said:\n' });
      position = index + 1;
    }
    
    // Find all "ChatGPT said:" markers
    position = 0;
    while (true) {
      const index = text.indexOf('ChatGPT said:\n', position);
      if (index === -1) break;
      markers.push({ type: 'assistant', position: index, marker: 'ChatGPT said:\n' });
      position = index + 1;
    }
    
    // Sort markers by position
    markers.sort((a, b) => a.position - b.position);
    
    // Check for content before the first marker (initial user message)
    if (markers.length > 0) {
      const firstMarker = markers[0];
      const contentBeforeFirstMarker = text.substring(0, firstMarker.position).trim();
      
      if (contentBeforeFirstMarker) {
        // Add the initial user message
        messages.push({
          role: 'user',
          content: contentBeforeFirstMarker
        });
      }
    }
    
    // Extract content between markers
    for (let i = 0; i < markers.length; i++) {
      const marker = markers[i];
      const nextMarker = markers[i + 1];
      
      const startPos = marker.position + marker.marker.length;
      const endPos = nextMarker ? nextMarker.position : text.length;
      
      let content = text.substring(startPos, endPos).trim();
      
      if (content) {
        messages.push({
          role: marker.type,
          content: content
        });
      }
    }
    
    return messages;
  }
  
  /**
   * Parse the "ChatGPT said:" format (original implementation for backward compatibility)
   * @param {String} text - The conversation text to parse
   * @returns {Array} - Array of message objects
   */
  parseChatGPTSaidFormat(text) {
    const messages = [];
    
    // Split on "ChatGPT said:" to get segments
    const segments = text.split(/^ChatGPT said:?\s*$/im);
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i].trim();
      if (!segment) continue;
      
      if (i === 0) {
        // First segment is always user content (before first "ChatGPT said:")
        if (segment) {
          messages.push({
            role: 'user',
            content: segment
          });
        }
      } else {
        // Subsequent segments might contain ChatGPT response + user follow-up
        // Split on double newlines to find potential conversation breaks
        const parts = segment.split(/\n\s*\n/);
        
        let chatgptContent = '';
        let userContent = '';
        let foundUserPart = false;
        
        for (let j = 0; j < parts.length; j++) {
          const part = parts[j].trim();
          if (!part) continue;
          
          // Simple heuristic: if this part looks like a question or starts conversationally,
          // and we already have some ChatGPT content, treat it as user input
          if (!foundUserPart && chatgptContent && (
            part.includes('?') || 
            /^(are you|do you|can you|I |the question|what |how |why )/i.test(part)
          )) {
            foundUserPart = true;
            userContent = part;
          } else if (foundUserPart) {
            // Once we've found user content, everything after is also user content
            userContent += '\n\n' + part;
          } else {
            // Before finding user content, everything is ChatGPT content
            if (chatgptContent) chatgptContent += '\n\n';
            chatgptContent += part;
          }
        }
        
        // Add ChatGPT response
        if (chatgptContent) {
          messages.push({
            role: 'assistant',
            content: chatgptContent
          });
        }
        
        // Add user follow-up if found
        if (userContent) {
          messages.push({
            role: 'user',
            content: userContent
          });
        }
      }
    }
    
    return messages;
  }
  
  /**
   * Parse standard format with explicit prefixes
   * @param {String} text - The conversation text to parse
   * @returns {Array} - Array of message objects
   */
  parseStandardFormat(text) {
    const messages = [];
    const lines = text.split('\n');
    let currentMessage = null;
    
    // Common patterns for ChatGPT conversations
    const userPatterns = [
      /^You:/i,
      /^User:/i,
      /^Human:/i,
      /^Me:/i,
      /^\[You\]:/i,
      /^Q:/i,
      /^Question:/i,
      /^> /  // Markdown quote style
    ];
    
    const assistantPatterns = [
      /^ChatGPT:/i,
      /^Assistant:/i,
      /^AI:/i,
      /^Bot:/i,
      /^\[ChatGPT\]:/i,
      /^A:/i,
      /^Answer:/i,
      /^GPT:/i,
      /^Claude:/i,  // Support Claude imports too
      /^Gemini:/i   // Support Gemini imports
    ];
    
    // Helper function to clean speaker prefixes
    const cleanContent = (line, patterns) => {
      for (const pattern of patterns) {
        if (pattern.test(line)) {
          return line.replace(pattern, '').replace(/^\s*:?\s*/, '').trim();
        }
      }
      return line.trim();
    };
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Skip empty lines between messages
      if (!trimmedLine && !currentMessage) continue;
      
      // Check if this is a user message
      const isUserMessage = userPatterns.some(pattern => pattern.test(trimmedLine));
      if (isUserMessage) {
        // Save previous message if exists
        if (currentMessage) {
          currentMessage.content = currentMessage.content.trim();
          if (currentMessage.content) {
            messages.push(currentMessage);
          }
        }
        
        // Start new user message
        currentMessage = {
          role: 'user',
          content: cleanContent(trimmedLine, userPatterns)
        };
        continue;
      }
      
      // Check if this is an assistant message
      const isAssistantMessage = assistantPatterns.some(pattern => pattern.test(trimmedLine));
      if (isAssistantMessage) {
        // Save previous message if exists
        if (currentMessage) {
          currentMessage.content = currentMessage.content.trim();
          if (currentMessage.content) {
            messages.push(currentMessage);
          }
        }
        
        // Start new assistant message
        currentMessage = {
          role: 'assistant',
          content: cleanContent(trimmedLine, assistantPatterns)
        };
        continue;
      }
      
      // Special handling for numbered patterns (1. User: or 2. Assistant:)
      const numberedPattern = /^(\d+)\.\s*(User|You|Assistant|ChatGPT|AI):\s*/i;
      const numberedMatch = trimmedLine.match(numberedPattern);
      if (numberedMatch) {
        // Save previous message if exists
        if (currentMessage) {
          currentMessage.content = currentMessage.content.trim();
          if (currentMessage.content) {
            messages.push(currentMessage);
          }
        }
        
        const speaker = numberedMatch[2].toLowerCase();
        const isUser = ['user', 'you'].includes(speaker);
        currentMessage = {
          role: isUser ? 'user' : 'assistant',
          content: trimmedLine.replace(numberedPattern, '').trim()
        };
        continue;
      }
      
      // If we have a current message, this is a continuation
      if (currentMessage) {
        // Add line break if content exists
        if (currentMessage.content) {
          currentMessage.content += '\n';
        }
        currentMessage.content += trimmedLine;
      } else if (trimmedLine) {
        // No current message and no clear speaker
        // If we have previous messages, alternate
        if (messages.length > 0) {
          const lastRole = messages[messages.length - 1].role;
          currentMessage = {
            role: lastRole === 'user' ? 'assistant' : 'user',
            content: trimmedLine
          };
        } else {
          // First message defaults to user
          currentMessage = {
            role: 'user',
            content: trimmedLine
          };
        }
      }
    }
    
    // Don't forget the last message
    if (currentMessage) {
      currentMessage.content = currentMessage.content.trim();
      if (currentMessage.content) {
        messages.push(currentMessage);
      }
    }
    
    // Post-processing: merge consecutive messages from same role
    const mergedMessages = [];
    for (const msg of messages) {
      if (mergedMessages.length > 0 && 
          mergedMessages[mergedMessages.length - 1].role === msg.role) {
        // Merge with previous message
        mergedMessages[mergedMessages.length - 1].content += '\n\n' + msg.content;
      } else {
        mergedMessages.push(msg);
      }
    }
    
    return mergedMessages;
  }
  
  /**
   * Validate parsed messages before import
   * @param {Array} messages - Array of message objects
   * @returns {Object} - Validation result with isValid and errors
   */
  validateMessages(messages) {
    const errors = [];
    
    if (!Array.isArray(messages) || messages.length === 0) {
      errors.push('No messages found.');
      return { isValid: false, errors };
    }
    
    if (messages.length > 100) {
      errors.push('Conversation too long.');
      return { isValid: false, errors };
    }
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      
      if (!msg.role || !['user', 'assistant'].includes(msg.role)) {
        errors.push('Invalid message format.');
      }
      
      if (!msg.content || msg.content.trim().length === 0) {
        errors.push('Empty message found.');
      }
      
      if (msg.content && msg.content.length > 50000) {
        errors.push('Message too long.');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Detect the format of the conversation text
   * @param {String} text - The conversation text to analyze
   * @returns {Object} - Detection result with format and confidence
   */
  detectConversationFormat(text) {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      return { format: 'unknown', confidence: 0, hint: 'Paste your conversation text to begin' };
    }
    
    // Check for explicit marker format first
    const hasYouSaid = text.includes('You said:\n');
    const hasChatGPTSaid = text.includes('ChatGPT said:\n');
    
    if (hasYouSaid || hasChatGPTSaid) {
      const hasThinking = /^Thought for .+$/im.test(text);
      return {
        format: 'explicit-markers',
        confidence: 1.0,
        hint: hasThinking 
          ? 'Ready to import!'
          : 'Ready to import!'
      };
    }
    
    // Count occurrences of different patterns
    const patterns = {
      'You:': 0,
      'ChatGPT:': 0,
      'Cursor:': 0,
      'ChatGPT said:': 0,
      'User:': 0,
      'Assistant:': 0,
      'Human:': 0,
      'AI:': 0,
      'Me:': 0,
      'Thought for': 0,
      'markdown_headers': 0
    };
    
    lines.forEach(line => {
      const trimmed = line.trim();
      Object.keys(patterns).forEach(pattern => {
        if (pattern === 'ChatGPT said:') {
          if (/^ChatGPT said:?\s*$/i.test(trimmed)) {
            patterns[pattern]++;
          }
        } else if (pattern === 'Thought for') {
          if (/^Thought for .+$/i.test(trimmed)) {
            patterns[pattern]++;
          }
        } else if (pattern === 'markdown_headers') {
          if (/^#{1,6}\s+(You|User|Human|Cursor|Assistant|AI)\s*$/i.test(trimmed) ||
              /^\*\*(You|User|Human|Cursor|Assistant|AI):\*\*\s*$/i.test(trimmed) ||
              /^\*\*(User)\*\*$/i.test(trimmed) ||
              /^\*\*(Cursor)\*\*$/i.test(trimmed)) {
            patterns[pattern]++;
          }
        } else if (trimmed.startsWith(pattern)) {
          patterns[pattern]++;
        }
      });
    });
    
    // Determine the most likely format
    const totalPatterns = Object.values(patterns).reduce((a, b) => a + b, 0);
    
    if (totalPatterns === 0) {
      return {
        format: 'unstructured',
        confidence: 0.3,
        hint: 'No conversation detected.'
      };
    }
    
    // Check for "ChatGPT said:" format (with or without thinking times)
    if (patterns['ChatGPT said:'] > 0) {
      const hasThinking = patterns['Thought for'] > 0;
      return {
        format: 'chatgpt-web',
        confidence: 1.0,
        hint: hasThinking 
          ? 'Ready to import!'
          : 'Ready to import!'
      };
    }
    
    // Check for standard formats
    if (patterns['You:'] > 0 && patterns['ChatGPT:'] > 0) {
      return {
        format: 'standard',
        confidence: 1.0,
        hint: 'Ready to import!'
      };
    }
    
    if (patterns['You:'] > 0 && patterns['Cursor:'] > 0) {
      return {
        format: 'cursor',
        confidence: 1.0,
        hint: 'Ready to import!'
      };
    }
    
    // Check for markdown conversation format
    if (patterns['markdown_headers'] > 1) {
      return {
        format: 'cursor-markdown',
        confidence: 1.0,
        hint: 'Ready to import!'
      };
    }
    
    if (patterns['User:'] > 0 && patterns['Assistant:'] > 0) {
      return {
        format: 'openai',
        confidence: 0.9,
        hint: 'Ready to import!'
      };
    }
    
    if (patterns['Human:'] > 0 && patterns['AI:'] > 0) {
      return {
        format: 'anthropic',
        confidence: 0.9,
        hint: 'Ready to import!'
      };
    }
    
    // Some patterns detected but not matching pairs
    return {
      format: 'partial',
      confidence: 0.5,
      hint: 'Ready to import!'
    };
  }
  
  /**
   * Import a Cursor conversation
   * @param {Array} messages - Array of message objects with role and content
   * @param {String} title - Optional title for the imported thread
   * @param {String} model - The AI model used (chatgpt, claude, gemini)
   * @param {String} description - Optional description
   * @returns {Promise} - API response with thread_id
   */
  async importCursorConversation(messages, title = null, model = 'chatgpt', description = null) {
    const headers = await getAuthHeaders();
    
    const importData = {
      messages: messages,
      title: title || 'Imported Cursor Conversation',
      model: model,
      description: description
    };
    
    console.log('[ImportService] Importing Cursor conversation:', {
      messageCount: messages.length,
      title: title,
      model: model,
      hasDescription: !!description
    });
    
    try {
      const response = await axios.post(
        `${apiBaseUrl}/messages/import/cursor`,
        importData,
        { headers }
      );
      
      console.log('[ImportService] Import successful:', response.data);
      return response.data;
    } catch (error) {
      console.error('[ImportService] Import failed:', error);
      throw error;
    }
  }
  
  /**
   * Parse Cursor conversation text into message objects
   * Enhanced for markdown file content
   * @param {String} text - The conversation text to parse
   * @returns {Array} - Array of message objects
   */
  parseCursorConversation(text) {
    const messages = [];
    
    // First try to parse as markdown with headers
    if (this.hasMarkdownHeaders(text)) {
      return this.parseMarkdownFormat(text);
    }
    
    // Check if this uses "You:" / "Cursor:" format or similar patterns
    if (text.includes('You:') || text.includes('Cursor:')) {
      return this.parseCursorStandardFormat(text);
    }
    
    // Check if this uses "User:" / "Assistant:" format
    if (text.includes('User:') || text.includes('Assistant:')) {
      return this.parseStandardFormat(text);
    }
    
    // Otherwise try to parse as unstructured conversation
    return this.parseCursorUnstructuredFormat(text);
  }
  
  /**
   * Check if text contains markdown headers that indicate conversation structure
   * @param {String} text - The text to check
   * @returns {Boolean} - True if markdown headers are present
   */
  hasMarkdownHeaders(text) {
    // Look for common patterns in Cursor markdown exports
    const markdownPatterns = [
      /^#{1,6}\s+(You|User|Human)$/im,
      /^#{1,6}\s+(Cursor|Assistant|AI)$/im,
      /^## (You|User|Human)$/im,
      /^## (Cursor|Assistant|AI)$/im,
      /^\*\*(You|User|Human):\*\*/im,
      /^\*\*(Cursor|Assistant|AI):\*\*/im,
      /^\*\*(User)\*\*$/im,
      /^\*\*(Cursor)\*\*$/im
    ];
    
    return markdownPatterns.some(pattern => pattern.test(text));
  }
  
  /**
   * Parse markdown format with headers for conversation structure
   * @param {String} text - The markdown text to parse
   * @returns {Array} - Array of message objects
   */
  parseMarkdownFormat(text) {
    const messages = [];
    let currentMessage = null;
    
    // Split by --- separators first to get conversation blocks
    const blocks = text.split(/\n---\n|\n--- \n/).map(block => block.trim());
    
    for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
      const block = blocks[blockIndex];
      if (!block) continue;
      
      const lines = block.split('\n');
      let blockRole = null;
      let blockContent = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        
        // Skip empty lines at the start of a block
        if (!trimmedLine && blockContent.length === 0) continue;
        
        // Check for conversation markers
        if (trimmedLine === '**User**') {
          blockRole = 'user';
          continue;
        } else if (trimmedLine === '**Cursor**') {
          blockRole = 'assistant';
          continue;
        }
        
        // Check for other header patterns
        const userHeaderPatterns = [
          /^#{1,6}\s+(You|User|Human)\s*$/i,
          /^\*\*(You|User|Human):\*\*\s*$/i,
          /^##\s+(You|User|Human)\s*$/i
        ];
        
        const assistantHeaderPatterns = [
          /^#{1,6}\s+(Cursor|Assistant|AI)\s*$/i,
          /^\*\*(Cursor|Assistant|AI):\*\*\s*$/i,
          /^##\s+(Cursor|Assistant|AI)\s*$/i
        ];
        
        const isUserHeader = userHeaderPatterns.some(pattern => pattern.test(trimmedLine));
        const isAssistantHeader = assistantHeaderPatterns.some(pattern => pattern.test(trimmedLine));
        
        if (isUserHeader) {
          blockRole = 'user';
          continue;
        } else if (isAssistantHeader) {
          blockRole = 'assistant';
          continue;
        }
        
        // Skip metadata lines (like export timestamps)
        if (trimmedLine.startsWith('_') && trimmedLine.endsWith('_') && 
            (trimmedLine.includes('Exported') || trimmedLine.includes('from Cursor'))) {
          continue;
        }
        
        // Skip title headers if they're not conversation markers
        if (trimmedLine.startsWith('#') && blockIndex === 0 && !blockRole) {
          continue;
        }
        
        // Add content to current block
        if (trimmedLine) {
          blockContent.push(line);
        } else if (blockContent.length > 0) {
          // Preserve empty lines within content
          blockContent.push(line);
        }
      }
      
      // Create message from this block if we have role and content
      if (blockRole && blockContent.length > 0) {
        const content = blockContent.join('\n').trim();
        if (content) {
          messages.push({
            role: blockRole,
            content: content
          });
        }
      } else if (blockContent.length > 0 && blockIndex > 0) {
        // If no explicit role but we have content and it's not the first block,
        // inherit role from the pattern or default to user
        const content = blockContent.join('\n').trim();
        if (content) {
          // Simple heuristic: if it looks like a response, make it assistant
          const looksLikeResponse = content.toLowerCase().includes('i can') || 
                                   content.toLowerCase().includes('let me') ||
                                   content.toLowerCase().includes('here\'s') ||
                                   content.toLowerCase().includes('you can');
          
          messages.push({
            role: looksLikeResponse ? 'assistant' : 'user',
            content: content
          });
        }
      }
    }
    
    return messages;
  }
  
  /**
   * Parse Cursor conversation with explicit "You:" and "Cursor:" markers
   * @param {String} text - The conversation text to parse
   * @returns {Array} - Array of message objects
   */
  parseCursorStandardFormat(text) {
    const messages = [];
    const lines = text.split('\n');
    let currentMessage = null;
    
    // Common patterns for Cursor conversations
    const userPatterns = [
      /^You:/i,
      /^User:/i,
      /^Human:/i,
      /^Me:/i,
      /^\[You\]:/i,
      /^Q:/i,
      /^Question:/i,
      /^> /  // Markdown quote style
    ];
    
    const assistantPatterns = [
      /^Cursor:/i,
      /^Assistant:/i,
      /^AI:/i,
      /^Bot:/i,
      /^\[Cursor\]:/i,
      /^A:/i,
      /^Answer:/i,
      /^GPT:/i,
      /^Claude:/i,
      /^Gemini:/i
    ];
    
    // Helper function to clean speaker prefixes
    const cleanContent = (line, patterns) => {
      for (const pattern of patterns) {
        if (pattern.test(line)) {
          return line.replace(pattern, '').replace(/^\s*:?\s*/, '').trim();
        }
      }
      return line.trim();
    };
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Skip empty lines between messages
      if (!trimmedLine && !currentMessage) continue;
      
      // Check if this is a user message
      const isUserMessage = userPatterns.some(pattern => pattern.test(trimmedLine));
      if (isUserMessage) {
        // Save previous message if exists
        if (currentMessage) {
          currentMessage.content = currentMessage.content.trim();
          if (currentMessage.content) {
            messages.push(currentMessage);
          }
        }
        
        // Start new user message
        currentMessage = {
          role: 'user',
          content: cleanContent(trimmedLine, userPatterns)
        };
        continue;
      }
      
      // Check if this is an assistant message
      const isAssistantMessage = assistantPatterns.some(pattern => pattern.test(trimmedLine));
      if (isAssistantMessage) {
        // Save previous message if exists
        if (currentMessage) {
          currentMessage.content = currentMessage.content.trim();
          if (currentMessage.content) {
            messages.push(currentMessage);
          }
        }
        
        // Start new assistant message
        currentMessage = {
          role: 'assistant',
          content: cleanContent(trimmedLine, assistantPatterns)
        };
        continue;
      }
      
      // Special handling for numbered patterns (1. User: or 2. Assistant:)
      const numberedPattern = /^(\d+)\.\s*(User|You|Assistant|Cursor|AI):\s*/i;
      const numberedMatch = trimmedLine.match(numberedPattern);
      if (numberedMatch) {
        // Save previous message if exists
        if (currentMessage) {
          currentMessage.content = currentMessage.content.trim();
          if (currentMessage.content) {
            messages.push(currentMessage);
          }
        }
        
        // Determine role from the matched speaker
        const speaker = numberedMatch[2].toLowerCase();
        const role = ['user', 'you'].includes(speaker) ? 'user' : 'assistant';
        
        // Start new message
        currentMessage = {
          role: role,
          content: trimmedLine.replace(numberedPattern, '').trim()
        };
        continue;
      }
      
      // If we have a current message, add this line to its content
      if (currentMessage) {
        if (currentMessage.content) {
          currentMessage.content += '\n' + line;
        } else {
          currentMessage.content = line;
        }
      } else if (trimmedLine) {
        // If no current message but we have content, start a user message
        currentMessage = {
          role: 'user',
          content: line
        };
      }
    }
    
    // Don't forget the last message
    if (currentMessage) {
      currentMessage.content = currentMessage.content.trim();
      if (currentMessage.content) {
        messages.push(currentMessage);
      }
    }
    
    return messages;
  }
  
  /**
   * Parse unstructured Cursor conversation (fallback method)
   * @param {String} text - The conversation text to parse
   * @returns {Array} - Array of message objects
   */
  parseCursorUnstructuredFormat(text) {
    // For unstructured text, we'll try to split by common conversation indicators
    // or create a single user message if no clear structure is found
    
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      return [];
    }
    
    // If it's just a few lines with no clear structure, treat as a single user message
    if (lines.length <= 3) {
      return [{
        role: 'user',
        content: text.trim()
      }];
    }
    
    // Try to detect conversation breaks (empty lines, timestamps, etc.)
    const messages = [];
    let currentContent = '';
    let currentRole = 'user'; // Start with user
    
    for (const line of lines) {
      // Check for potential role switches based on content patterns
      const lowerLine = line.toLowerCase();
      
      // Patterns that might indicate assistant responses
      const assistantIndicators = [
        'here\'s', 'i can', 'let me', 'i\'ll', 'i would', 'i suggest',
        'based on', 'according to', 'the answer is', 'you can',
        'here are', 'this is', 'that\'s', 'it looks like'
      ];
      
      // Patterns that might indicate user questions/requests
      const userIndicators = [
        'how do i', 'can you', 'please', 'what is', 'why', 'when',
        'where', 'who', 'help me', 'i need', 'i want', '?'
      ];
      
      const hasAssistantPattern = assistantIndicators.some(pattern => 
        lowerLine.includes(pattern)
      );
      const hasUserPattern = userIndicators.some(pattern => 
        lowerLine.includes(pattern)
      );
      
      // Simple heuristic: if we see assistant-like language after user-like language
      if (currentRole === 'user' && hasAssistantPattern && !hasUserPattern && currentContent) {
        // Save current user message
        messages.push({
          role: 'user',
          content: currentContent.trim()
        });
        
        // Start assistant message
        currentRole = 'assistant';
        currentContent = line;
      } else if (currentRole === 'assistant' && hasUserPattern && !hasAssistantPattern && currentContent) {
        // Save current assistant message
        messages.push({
          role: 'assistant',
          content: currentContent.trim()
        });
        
        // Start user message
        currentRole = 'user';
        currentContent = line;
      } else {
        // Continue current message
        if (currentContent) {
          currentContent += '\n' + line;
        } else {
          currentContent = line;
        }
      }
    }
    
    // Don't forget the last message
    if (currentContent.trim()) {
      messages.push({
        role: currentRole,
        content: currentContent.trim()
      });
    }
    
    return messages;
  }
}

export default new ImportService(); 