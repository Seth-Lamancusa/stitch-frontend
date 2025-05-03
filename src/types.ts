/**
 * User profile information from authentication
 */
export interface User {
  uid: string;
  email: string | null;
  username: string | null;
  contacts: string[];
}

/**
 * A recursive thread that can contain replies
 */
export interface Message {
  /** Unique identifier for the thread */
  id: number;
  
  /** DEFAULT Thread title */
  title: string;
  
  /** DEFAULT Thread description */
  desc: string;
  
  /** List of user IDs who are direct recipients */
  recipients: string[];
  
  /** Whether the thread is publicly viewable */
  public: boolean;
  
  /** Main content of the thread */
  content: string;
  
  /** User ID of the content author */
  content_author: string;
  
  /** List of threaded replies */
  replies: Message[];
  
  /** Timestamp when the thread was created */
  timestamp: string;
}

/**
 * A chat message in the system
 */
export interface ChatMessage {
  /** The text content of the message */
  text: string;
  /** Whether the message was sent by the current user */
  isUser: boolean;
  /** Whether the message is in a private conversation */
  isPrivate: boolean;
  /** ISO timestamp when the message was sent */
  timestamp: string;
  /** Whether there was an error with this message */
  error?: boolean;
}

/**
 * Store state definition
 */
export interface StoreState {
  user: User | null;
  isAuthenticated: boolean;
  activeTab: 'public' | 'private';
  
  /** All public threads */
  publicThreads: Message[];
  
  /** Private threads where the user is a recipient */
  privateThreads: Message[];
  
  /** Currently viewed thread */
  currentThread: Message | null;
  
  /** Navigation history for thread branches */
  threadHistory: number[];
}

/**
 * API response from thread endpoints
 */
export interface ThreadResponse {
  thread: Message;
  timestamp: string;
}

/**
 * Request to create a new thread
 */
export interface CreateThreadRequest {
  title?: string;
  desc?: string;
  recipients?: string[];
  public: boolean;
  content: string;
  parent_id?: number;
}

/**
 * API response from chat endpoint
 */
export interface ChatResponse {
  response: string;
  timestamp: string;
} 