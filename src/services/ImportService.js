import axios from 'axios';
import { getFirebaseAuth } from '../firebase.js';

const apiBaseUrl = '/api';

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
   * @returns {Promise} - API response with thread_id
   */
  async importChatGPTConversation(messages) {
    const headers = await getAuthHeaders();
    
    const importData = {
      messages: messages
    };
    
    console.log('[ImportService] Importing ChatGPT conversation:', {
      messageCount: messages.length
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
    // Clean up the text first
    // Remove header text
    text = text.replace(/^Skip to content\s*Chat history\s*/i, '').trim();
    
    // Remove thinking time lines
    text = text.split('\n')
      .filter(line => !(/thought for.*seconds/i.test(line)))
      .join('\n');
    
    // Remove footer text
    text = text.replace(/(?:No file chosen\s*)+(?:ChatGPT can make mistakes\. Check important info\.?)*\s*$/i, '').trim();
    text = text.replace(/(?:ChatGPT can make mistakes\. Check important info\.?)*\s*$/i, '').trim();
    
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
      
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Detect the format of the conversation text
   * @param {String} text - The conversation text to analyze
   * @param {String} activeImportTab - The active import tab
   * @returns {Object} - Detection result with format and confidence
   */
  detectConversationFormat(text, activeImportTab) {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      return { format: 'unknown', confidence: 0, hint: 'Paste your conversation text to begin' };
    }

    // Try to parse the conversation and see if we get any messages
    let messages = [];
    
    if (activeImportTab === 'chatgpt') {
      messages = this.parseChatGPTConversation(text);
    } else if (activeImportTab === 'cursor') {
      messages = this.parseCursorConversation(text);
    } else if (activeImportTab === 'claude') {
      messages = this.parseClaudeConversation(text);
    } else if (activeImportTab === 'gemini') {
      messages = this.parseGeminiConversation(text);
    }

    // If we got any messages, the conversation was detected
    if (messages.length > 0) {
      return {
        format: activeImportTab,
        confidence: 1.0,
        hint: 'Ready to import!'
      };
    }

    // Otherwise no conversation was detected
    return {
      format: 'unknown',
      confidence: 0,
      hint: 'No conversation detected.'
    };
  }
  
  /**
   * Import a Claude conversation
   * @param {Array} messages - Array of message objects with role and content
   * @returns {Promise} - API response with thread_id
   */
  async importClaudeConversation(messages) {
    const headers = await getAuthHeaders();
    
    const importData = {
      messages: messages
    };
    
    console.log('[ImportService] Importing Claude conversation:', {
      messageCount: messages.length
    });
    
    try {
      const response = await axios.post(
        `${apiBaseUrl}/messages/import/claude`,
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
   * Import a Gemini conversation
   * @param {Array} messages - Array of message objects with role and content
   * @returns {Promise} - API response with thread_id
   */
  async importGeminiConversation(messages) {
    const headers = await getAuthHeaders();
    
    const importData = {
      messages: messages
    };
    
    console.log('[ImportService] Importing Gemini conversation:', {
      messageCount: messages.length
    });
    
    try {
      const response = await axios.post(
        `${apiBaseUrl}/messages/import/gemini`,
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
   * Import a Grok conversation
   * @param {Array} messages - Array of message objects with role and content
   * @returns {Promise} - API response with thread_id
   */
  async importGrokConversation(messages) {
    const headers = await getAuthHeaders();
    
    const importData = {
      messages: messages
    };
    
    console.log('[ImportService] Importing Grok conversation:', {
      messageCount: messages.length
    });
    
    try {
      const response = await axios.post(
        `${apiBaseUrl}/messages/import/grok`,
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
   * Import a Cursor conversation
   * @param {Array} messages - Array of message objects with role and content
   * @returns {Promise} - API response with thread_id
   */
  async importCursorConversation(messages) {
    const headers = await getAuthHeaders();
    
    const importData = {
      messages: messages
    };
    
    console.log('[ImportService] Importing Cursor conversation:', {
      messageCount: messages.length
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
   * Parse Claude conversation text into message objects
   * @param {String} text - The conversation text to parse
   * @returns {Array} - Array of message objects
   */
  parseClaudeConversation(text) {
    // Check for common Claude conversation patterns
    
    // Pattern 1: "Human:" and "Assistant:" markers (most common)
    if (text.includes('Human:') || text.includes('Assistant:')) {
      return this.parseClaudeStandardFormat(text);
    }
    
    // Pattern 2: Try explicit "You:" and "Claude:" markers
    if (text.includes('You:') && text.includes('Claude:')) {
      return this.parseClaudeExplicitFormat(text);
    }
    
    // Pattern 3: Use generic user/assistant parsing
    if (text.includes('User:') || text.includes('Assistant:')) {
      return this.parseStandardFormat(text);
    }
    
    // Pattern 4: Simple conversation - split by paragraphs and detect roles
    return this.parseClaudeSimpleFormat(text);
  }

  /**
   * Parse Claude conversation with "Human:" and "Assistant:" markers
   * @param {String} text - The conversation text to parse
   * @returns {Array} - Array of message objects
   */
  parseClaudeStandardFormat(text) {
    const messages = [];
    const lines = text.split('\n');
    let currentMessage = null;
    
    const humanPatterns = [
      /^Human:\s*/i,
      /^Human$/i
    ];
    
    const assistantPatterns = [
      /^Assistant:\s*/i,
      /^Assistant$/i,
      /^Claude:\s*/i,
      /^Claude$/i
    ];
    
    const cleanContent = (line, patterns) => {
      for (const pattern of patterns) {
        if (pattern.test(line)) {
          return line.replace(pattern, '').trim();
        }
      }
      return line.trim();
    };
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Skip empty lines between messages
      if (!trimmedLine && !currentMessage) continue;
      
      // Check if this is a human/user message
      const isHumanMessage = humanPatterns.some(pattern => pattern.test(trimmedLine));
      if (isHumanMessage) {
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
          content: cleanContent(trimmedLine, humanPatterns)
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
   * Parse Claude conversation with explicit "You:" and "Claude:" markers
   * @param {String} text - The conversation text to parse
   * @returns {Array} - Array of message objects
   */
  parseClaudeExplicitFormat(text) {
    const messages = [];
    const lines = text.split('\n');
    let currentMessage = null;
    
    const userPatterns = [
      /^You:\s*/i,
      /^You$/i
    ];
    
    const claudePatterns = [
      /^Claude:\s*/i,
      /^Claude$/i
    ];
    
    const cleanContent = (line, patterns) => {
      for (const pattern of patterns) {
        if (pattern.test(line)) {
          return line.replace(pattern, '').trim();
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
      
      // Check if this is a Claude message
      const isClaudeMessage = claudePatterns.some(pattern => pattern.test(trimmedLine));
      if (isClaudeMessage) {
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
          content: cleanContent(trimmedLine, claudePatterns)
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
   * Parse simple Claude conversation format using "Edit" markers
   * @param {String} text - The conversation text to parse
   * @returns {Array} - Array of message objects
   */
  parseClaudeSimpleFormat(text) {
    const messages = [];
    
    // Check if text contains "Edit" markers (Claude's response indicator)
    if (text.includes('\nEdit\n') || text.includes('Edit\n')) {
      return this.parseClaudeEditFormat(text);
    }
    
    // Fall back to content-based parsing for conversations without Edit markers
    return this.parseClaudeContentBasedFormat(text);
  }

  /**
   * Parse Claude conversation using "Edit" markers as role indicators
   * @param {String} text - The conversation text to parse
   * @returns {Array} - Array of message objects
   */
  parseClaudeEditFormat(text) {
    const messages = [];
    
    // Split by "Edit" markers, but keep track of positions
    const editMarkerRegex = /^Edit$/m;
    const parts = text.split(editMarkerRegex);
    
    // The first part before any "Edit" marker is the initial user message
    if (parts[0] && parts[0].trim()) {
      messages.push({
        role: 'user',
        content: parts[0].trim()
      });
    }
    
    // Process remaining parts - they alternate between Claude responses and user messages
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i].trim();
      if (!part) continue;
      
      // Each part after "Edit" starts with a Claude response
      // We need to check if there's a follow-up user question in the same part
      
      // Split by multiple newlines to find potential conversation breaks
      const segments = part.split(/\n\s*\n\s*\n+/).filter(segment => segment.trim());
      
      if (segments.length === 1) {
        // Only Claude response, no follow-up question
        messages.push({
          role: 'assistant',
          content: segments[0].trim()
        });
      } else if (segments.length > 1) {
        // Likely Claude response followed by user question(s)
        // First segment is always Claude response
        messages.push({
          role: 'assistant',
          content: segments[0].trim()
        });
        
        // Check remaining segments for user questions
        for (let j = 1; j < segments.length; j++) {
          const segment = segments[j].trim();
          if (!segment) continue;
          
          // This is likely a user question/follow-up
          messages.push({
            role: 'user',
            content: segment
          });
        }
      }
    }
    
    return messages;
  }

  /**
   * Parse Claude conversation without Edit markers (fallback method)
   * @param {String} text - The conversation text to parse
   * @returns {Array} - Array of message objects
   */
  parseClaudeContentBasedFormat(text) {
    // Split by triple newlines first (stronger separator)
    let blocks = text.split(/\n\s*\n\s*\n/).filter(block => block.trim());
    
    // If no triple newlines, try double newlines but be more selective
    if (blocks.length <= 1) {
      blocks = text.split(/\n\s*\n/).filter(block => block.trim());
    }
    
    if (blocks.length === 0) {
      return [];
    }
    
    // If only one block, treat as user message
    if (blocks.length === 1) {
      return [{
        role: 'user',
        content: blocks[0].trim()
      }];
    }
    
    // For two blocks, check if first is a question and second is a long answer
    if (blocks.length === 2) {
      const firstBlock = blocks[0].trim();
      const secondBlock = blocks[1].trim();
      
      // If first block is short and contains question words, and second is long
      if (firstBlock.length < 200 && 
          (firstBlock.includes('?') || 
           /\b(tell me|what|how|where|when|why|can you|please)\b/i.test(firstBlock)) &&
          secondBlock.length > firstBlock.length * 2) {
        
        return [
          { role: 'user', content: firstBlock },
          { role: 'assistant', content: secondBlock }
        ];
      }
    }
    
    // For multiple blocks, use content-based role detection
    const messages = [];
    let currentRole = 'user'; // Start with user
    let currentContent = '';
    
    for (let i = 0; i < blocks.length; i++) {
      const content = blocks[i].trim();
      if (!content) continue;
      
      const lowerContent = content.toLowerCase();
      
      // Strong indicators for assistant responses
      const strongAssistantIndicators = [
        'refers to the',
        'key improvements',
        'common issues',
        'best regions',
        'what to prioritize',
        'geographic buying considerations',
        'regions to approach cautiously',
        'you\'ve asked',
        'let me break this down',
        'that\'s deeply personal'
      ];
      
      // Strong indicators for user messages
      const strongUserIndicators = [
        '?',
        'tell me about',
        'where should i',
        'how do i',
        'can you help',
        'please explain',
        'what is the most important'
      ];
      
      const hasStrongAssistant = strongAssistantIndicators.some(pattern => 
        lowerContent.includes(pattern)
      );
      const hasStrongUser = strongUserIndicators.some(pattern => 
        lowerContent.includes(pattern)
      );
      
      // Determine if this should start a new message or continue current one
      let shouldStartNew = false;
      let newRole = currentRole;
      
      if (i === 0) {
        // First block - determine initial role
        newRole = hasStrongUser || (!hasStrongAssistant && content.length < 200) ? 'user' : 'assistant';
        shouldStartNew = true;
      } else if (hasStrongUser && currentRole !== 'user') {
        // Strong user indicator and we're not already in user mode
        newRole = 'user';
        shouldStartNew = true;
      } else if (hasStrongAssistant && currentRole !== 'assistant') {
        // Strong assistant indicator and we're not already in assistant mode
        newRole = 'assistant';
        shouldStartNew = true;
      } else if (currentRole === 'user' && content.length > 300 && !hasStrongUser) {
        // Long content after user message, likely assistant response
        newRole = 'assistant';
        shouldStartNew = true;
      } else {
        // Continue current message
        shouldStartNew = false;
      }
      
      if (shouldStartNew && currentContent) {
        // Save previous message
        messages.push({
          role: currentRole,
          content: currentContent.trim()
        });
        currentContent = '';
      }
      
      // Add content to current message
      if (currentContent) {
        currentContent += '\n\n' + content;
      } else {
        currentContent = content;
      }
      
      if (shouldStartNew) {
        currentRole = newRole;
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

  /**
   * Parse Gemini conversation text into message objects
   * @param {String} text - The conversation text to parse
   * @returns {Array} - Array of message objects
   */
  parseGeminiConversation(text) {
    // Check if this uses explicit "You:" / "Gemini:" format
    if (text.includes('You:') && text.includes('Gemini:')) {
      return this.parseGeminiExplicitFormat(text);
    }
    
    // Check if this uses "User:" / "Assistant:" format
    if (text.includes('User:') && text.includes('Assistant:')) {
      return this.parseStandardFormat(text);
    }
    
    // Otherwise use simple format parsing (most common for Gemini)
    return this.parseGeminiSimpleFormat(text);
  }

  /**
   * Parse Gemini conversation with explicit "You:" / "Gemini:" markers
   * @param {String} text - The conversation text to parse
   * @returns {Array} - Array of message objects
   */
  parseGeminiExplicitFormat(text) {
    const messages = [];
    const lines = text.split('\n');
    
    const cleanContent = (line, patterns) => {
      let cleaned = line;
      patterns.forEach(pattern => {
        cleaned = cleaned.replace(new RegExp(`^${pattern}\\s*`, 'i'), '');
      });
      return cleaned.trim();
    };
    
    let currentMessage = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (currentMessage && currentMessage.content) {
          currentMessage.content += '\n';
        }
        continue;
      }
      
      // Check for role markers
      if (/^You:\s*/i.test(trimmed)) {
        // Save previous message
        if (currentMessage && currentMessage.content.trim()) {
          messages.push({
            role: currentMessage.role,
            content: currentMessage.content.trim()
          });
        }
        
        // Start new user message
        currentMessage = {
          role: 'user',
          content: cleanContent(trimmed, ['You:'])
        };
      } else if (/^Gemini:\s*/i.test(trimmed)) {
        // Save previous message
        if (currentMessage && currentMessage.content.trim()) {
          messages.push({
            role: currentMessage.role,
            content: currentMessage.content.trim()
          });
        }
        
        // Start new assistant message
        currentMessage = {
          role: 'assistant',
          content: cleanContent(trimmed, ['Gemini:'])
        };
      } else if (currentMessage) {
        // Continue current message
        if (currentMessage.content) {
          currentMessage.content += '\n' + trimmed;
        } else {
          currentMessage.content = trimmed;
        }
      } else {
        // No current message, assume this is the start of a user message
        currentMessage = {
          role: 'user',
          content: trimmed
        };
      }
    }
    
    // Don't forget the last message
    if (currentMessage && currentMessage.content.trim()) {
      messages.push({
        role: currentMessage.role,
        content: currentMessage.content.trim()
      });
    }
    
    return messages;
  }

  /**
   * Parse simple Gemini conversation format (no explicit markers)
   * @param {String} text - The conversation text to parse
   * @returns {Array} - Array of message objects
   */
  parseGeminiSimpleFormat(text) {
    const messages = [];
    
    // Remove everything before and including "Conversation with Gemini"
    const parts = text.split(/^.*?Conversation with Gemini.*$/m);
    text = parts[parts.length - 1].trim();
    
    // Remove "Deep Research" line and everything after it
    text = text.split(/^Deep Research/m)[0].trim();
    
    // Split by multiple newlines to get conversation blocks
    let blocks = text.split(/\n\s*\n\s*\n+/).filter(block => block.trim());
    
    // If no triple newlines, try double newlines
    if (blocks.length <= 1) {
      blocks = text.split(/\n\s*\n/).filter(block => block.trim());
    }
    
    if (blocks.length === 0) {
      return [];
    }
    
    // Post-process blocks to merge "Sources" sections with preceding assistant responses
    const processedBlocks = [];
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i].trim();
      
      // Check if this block is just "Sources" or similar metadata
      if (/^Sources\s*$/i.test(block) || 
          /^Sources\s*\n*$/i.test(block) ||
          block.toLowerCase() === 'sources') {
        
        // Merge with the previous block if it exists and looks like an assistant response
        if (processedBlocks.length > 0) {
          const prevBlock = processedBlocks[processedBlocks.length - 1];
          // Only merge if previous block is long (likely assistant response)
          if (prevBlock.length > 200) {
            processedBlocks[processedBlocks.length - 1] = prevBlock + '\n\n' + block;
            continue;
          }
        }
      }
      
      processedBlocks.push(block);
    }
    
    // If only one block, treat as user message
    if (processedBlocks.length === 1) {
      return [{
        role: 'user',
        content: processedBlocks[0].trim()
      }];
    }
    
    // For Gemini, conversations typically alternate: user question, Gemini response, user question, etc.
    // Use content analysis to determine roles
    let currentRole = 'user'; // Start with user
    
    for (let i = 0; i < processedBlocks.length; i++) {
      const content = processedBlocks[i].trim();
      if (!content) continue;
      
      const lowerContent = content.toLowerCase();
      
      // Strong indicators for Gemini responses (assistant)
      const strongAssistantIndicators = [
        'here\'s a breakdown',
        'important note',
        'estimated cost',
        'description:',
        'benefits:',
        'why it\'s',
        'sources',
        'remember,',
        'always get',
        'good luck',
        'you\'re hitting on',
        'this is a popular',
        'manufacturers like'
      ];
      
      // Strong indicators for user messages
      const strongUserIndicators = [
        '?',
        'tell me about',
        'what about',
        'how much',
        'should i',
        'can you',
        'please',
        'lets create',
        'what mods'
      ];
      
      const hasStrongAssistant = strongAssistantIndicators.some(pattern => 
        lowerContent.includes(pattern)
      );
      const hasStrongUser = strongUserIndicators.some(pattern => 
        lowerContent.includes(pattern)
      );
      
      // Special case: if this block is very short and just says "sources", 
      // it should have been merged already, but if not, skip it
      if (/^sources\s*$/i.test(content) && content.length < 20) {
        continue;
      }
      
      // Determine role for this block
      let blockRole = currentRole;
      
      if (i === 0) {
        // First block - usually user question
        blockRole = hasStrongUser || (!hasStrongAssistant && content.length < 300) ? 'user' : 'assistant';
      } else {
        // For subsequent blocks, use strong indicators or alternate pattern
        if (hasStrongUser && !hasStrongAssistant) {
          blockRole = 'user';
        } else if (hasStrongAssistant && !hasStrongUser) {
          blockRole = 'assistant';
        } else if (currentRole === 'user' && content.length > 500) {
          // Long content after user message, likely assistant response
          blockRole = 'assistant';
        } else if (currentRole === 'assistant' && content.length < 300 && content.includes('?')) {
          // Short question after assistant response, likely user
          blockRole = 'user';
        } else {
          // Default to alternating pattern
          blockRole = currentRole === 'user' ? 'assistant' : 'user';
        }
      }
      
      // Check if we should merge this with the previous message of the same role
      if (messages.length > 0 && messages[messages.length - 1].role === blockRole) {
        // Merge with previous message of same role
        messages[messages.length - 1].content += '\n\n' + content;
      } else {
        // Create new message
        messages.push({
          role: blockRole,
          content: content
        });
      }
      
      currentRole = blockRole;
    }
    
    return messages;
  }

  /**
   * Parse Grok conversation text into message objects
   * @param {String} text - The conversation text to parse
   * @returns {Array} - Array of message objects
   */
  // parseGrokConversation(text) {  // Commented out entire Grok parsing
  //   // Check if this uses explicit "You:" / "Grok:" format
  //   if (text.includes('You:') && text.includes('Grok:')) {
  //     return this.parseGrokExplicitFormat(text);
  //   }
  //   
  //   // Check if this uses "User:" / "Assistant:" format
  //   if (text.includes('User:') && text.includes('Assistant:')) {
  //     return this.parseStandardFormat(text);
  //   }
  //   
  //   // Otherwise use simple format parsing (most common for Grok)
  //   return this.parseGrokSimpleFormat(text);
  // }

  /**
   * Parse Grok conversation with explicit "You:" / "Grok:" markers
   * @param {String} text - The conversation text to parse
   * @returns {Array} - Array of message objects
   */
  // parseGrokExplicitFormat(text) {  // Commented out Grok explicit format parsing
  //   const messages = [];
  //   const lines = text.split('\n');
  //   
  //   const cleanContent = (line, patterns) => {
  //     let cleaned = line;
  //     patterns.forEach(pattern => {
  //       cleaned = cleaned.replace(new RegExp(`^${pattern}\\s*`, 'i'), '');
  //     });
  //     return cleaned.trim();
  //   };
  //   
  //   let currentMessage = null;
  //   
  //   for (const line of lines) {
  //     const trimmed = line.trim();
  //     if (!trimmed) {
  //       if (currentMessage && currentMessage.content) {
  //         currentMessage.content += '\n';
  //       }
  //       continue;
  //     }
  //     
  //     // Check for user message start
  //     if (trimmed.startsWith('You:') || trimmed.startsWith('User:')) {
  //       if (currentMessage) {
  //         messages.push(currentMessage);
  //       }
  //       currentMessage = {
  //         role: 'user',
  //         content: cleanContent(trimmed, ['You:', 'User:'])
  //       };
  //       continue;
  //     }
  //     
  //     // Check for Grok message start
  //     if (trimmed.startsWith('Grok:') || trimmed.startsWith('Assistant:')) {
  //       if (currentMessage) {
  //         messages.push(currentMessage);
  //       }
  //       currentMessage = {
  //         role: 'assistant',
  //         content: cleanContent(trimmed, ['Grok:', 'Assistant:'])
  //       };
  //       continue;
  //     }
  //     
  //     // Add line to current message if exists
  //     if (currentMessage) {
  //       if (currentMessage.content) {
  //         currentMessage.content += '\n';
  //       }
  //       currentMessage.content += trimmed;
  //     }
  //   }
  //   
  //   // Add final message
  //   if (currentMessage) {
  //     messages.push(currentMessage);
  //   }
  //   
  //   return messages;
  // }

  /**
   * Parse simple Grok conversation format (no explicit markers)
   * @param {String} text - The conversation text to parse
   * @returns {Array} - Array of message objects
   */
  // parseGrokSimpleFormat(text) {  // Commented out Grok simple format parsing
  //   const messages = [];
  //   
  //   // Use a more direct approach for Grok conversations
  //   // Split the text into paragraphs and then intelligently group them
  //   const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
  //   
  //   if (paragraphs.length === 0) {
  //     return [];
  //   }
  //   
  //   // If only one paragraph, treat as user message
  //   if (paragraphs.length === 1) {
  //     return [{
  //       role: 'user',
  //       content: paragraphs[0].trim()
  //     }];
  //   }
  //   
  //   // Group paragraphs into conversation blocks
  //   const conversationBlocks = [];
  //   let currentBlock = '';
  //   let isInLongResponse = false;
  //   
  //   for (let i = 0; i < paragraphs.length; i++) {
  //     const paragraph = paragraphs[i].trim();
  //     if (!paragraph) continue;
  //     
  //     const lowerParagraph = paragraph.toLowerCase();
  //     
  //     // Check for metadata markers that indicate Grok responses
  //     if (lowerParagraph.includes('web pages') || 
  //         lowerParagraph.includes('search results') ||
  //         lowerParagraph.includes('sources:')) {
  //       
  //       // If we were building a block, save it
  //       if (currentBlock.trim()) {
  //         conversationBlocks.push(currentBlock.trim());
  //         currentBlock = '';
  //       }
  //       
  //       // Start a new response block
  //       isInLongResponse = true;
  //       currentBlock = paragraph;
  //       continue;
  //     }
  //     
  //     // Check for likely question/command starts
  //     const looksLikeQuestion = 
  //       /^(what|how|why|when|where|who|can you|could you|please|help|i want|i need)/i.test(lowerParagraph) ||
  //       paragraph.includes('?') ||
  //       paragraph.length < 200;
  //     
  //     if (looksLikeQuestion && !isInLongResponse) {
  //       // If we were building a block, save it
  //       if (currentBlock.trim()) {
  //         conversationBlocks.push(currentBlock.trim());
  //       }
  //       currentBlock = paragraph;
  //     } else {
  //       // Add to current block
  //       if (currentBlock) {
  //         currentBlock += '\n\n';
  //       }
  //       currentBlock += paragraph;
  //       
  //       // If this was a long paragraph, mark as potential response
  //       if (paragraph.length > 200) {
  //         isInLongResponse = true;
  //       }
  //     }
  //     
  //     // Reset long response flag if we see likely question markers
  //     if (looksLikeQuestion) {
  //       isInLongResponse = false;
  //     }
  //   }
  //   
  //   // Don't forget the last block
  //   if (currentBlock.trim()) {
  //     conversationBlocks.push(currentBlock.trim());
  //   }
  //   
  //   // Now convert blocks to messages, alternating roles
  //   let currentRole = 'user'; // Start with user
  //   
  //   for (let i = 0; i < conversationBlocks.length; i++) {
  //     const content = conversationBlocks[i].trim();
  //     if (!content) continue;
  //     
  //     const lowerContent = content.toLowerCase();
  //     
  //     // Determine role based on content analysis
  //     let blockRole = currentRole;
  //     
  //     if (i === 0) {
  //       // First block - check if it's a short question or long response
  //       const isShortQuestion = content.length < 300 && 
  //         (/\b(i want|help me|lets?|what|how|where|when|why|can you|should i|tell me)\b/i.test(lowerContent) || 
  //          content.includes('?'));
  //       blockRole = isShortQuestion ? 'user' : 'assistant';
  //     } else {
  //       // For subsequent blocks, use more sophisticated detection
  //       const hasMetadata = lowerContent.includes('web pages') || 
  //                          lowerContent.includes('search results') ||
  //                          lowerContent.includes('sources:');
  //                          
  //       const looksLikeQuestion = content.length < 300 && 
  //         (/\b(i want|help me|lets?|what|how|where|when|why|can you|should i|tell me)\b/i.test(lowerContent) || 
  //          content.includes('?'));
  //          
  //       const looksLikeResponse = content.length > 300 ||
  //         hasMetadata ||
  //         /\b(here's|based on|according to|i found|the answer|to answer)\b/i.test(lowerContent);
  //       
  //       if (looksLikeQuestion && !looksLikeResponse) {
  //         blockRole = 'user';
  //       } else if (looksLikeResponse && !looksLikeQuestion) {
  //         blockRole = 'assistant';
  //       } else {
  //         // If ambiguous, alternate roles
  //         blockRole = currentRole === 'user' ? 'assistant' : 'user';
  //       }
  //     }
  //     
  //     messages.push({
  //       role: blockRole,
  //       content: content
  //     });
  //     
  //     currentRole = blockRole === 'user' ? 'assistant' : 'user';
  //   }
  //   
  //   return messages;
  // }

  /**
   * Split Grok conversation by pattern recognition when normal splitting fails
   * @param {String} text - The conversation text to split
   * @returns {Array} - Array of conversation blocks
   */
  splitGrokConversationByPattern(text) {
    // Simplified fallback method - just split by paragraphs
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
    return paragraphs.length > 1 ? paragraphs : [text];
  }

  /**
   * Detect if text contains Gemini-specific content patterns
   * @param {String} text - The text to analyze
   * @returns {Boolean} - True if Gemini patterns are detected
   */
  detectGeminiContent(text) {
    const lowerText = text.toLowerCase();
    
    // Gemini-specific patterns
    const geminiPatterns = [
      'here\'s a breakdown',
      'important note on pricing',
      'estimated cost:',
      'description:',
      'why it\'s important:',
      'sources',
      'remember, these are ballpark figures',
      'always get specific quotes',
      'good luck with your',
      'you\'re hitting on a key',
      'manufacturers like',
      'benefits:'
    ];
    
    // Count how many patterns match
    const matchCount = geminiPatterns.filter(pattern => 
      lowerText.includes(pattern)
    ).length;
    
    // If we find multiple Gemini-specific patterns, it's likely Gemini
    return matchCount >= 2;
  }

  /**
   * Detect if text contains Grok-specific content patterns
   * @param {String} text - The text to analyze
   * @returns {Boolean} - True if Grok patterns are detected
   */
  detectGrokContent(text) {
    const lowerText = text.toLowerCase();
    
    // Grok-specific patterns
    const grokPatterns = [
      'deciding whether',
      'overview of the',
      'pros of choosing',
      'cons and challenges',
      'key considerations',
      'recommendations',
      'wear characteristics:',
      'lifespan:',
      'failure cost:',
      'mileage concern:',
      'would you like me to search',
      'alternatively, i can generate',
      'data is drawn from',
      'web pages'
    ];
    
    // Count how many patterns match
    const matchCount = grokPatterns.filter(pattern => 
      lowerText.includes(pattern)
    ).length;
    
    // If we find multiple Grok-specific patterns, it's likely Grok
    return matchCount >= 2;
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