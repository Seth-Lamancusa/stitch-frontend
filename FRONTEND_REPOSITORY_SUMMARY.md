# Frontend Repository Summary

## Overview
**Stitch** is a Vue.js-based single-page application (SPA) for collaborative AI conversations. It enables users to have threaded conversations with AI bots, share conversations, visualize message relationships as graphs, and collaborate on prompting strategies.

## Tech Stack

### Core Framework
- **Vue 3** (v3.5.13) - Composition API with `<script setup>`
- **Vite** (v6.2.1) - Build tool and dev server
- **Vue Router** (v4.5.0) - Client-side routing
- **Vuex** (v4.1.0) - State management

### Key Dependencies
- **axios** (v1.8.4) - HTTP client with auth interceptors
- **d3-force, d3-hierarchy, d3-scale, d3-selection, d3-zoom** - Graph visualization
- **markdown-it** (v14.0.0) - Markdown parsing
- **katex** (v0.16.9) - LaTeX rendering
- **highlight.js** (v11.9.0) - Code syntax highlighting
- **date-fns** (v4.1.0) - Date formatting
- **vue-virtual-scroller** (v2.0.0-beta.8) - Virtual scrolling for performance
- **lodash/lodash-es** - Utility functions

## Project Structure

```
src/
├── main.js                 # Application entry point
├── App.vue                 # Root component
├── router.js               # Route definitions and guards
├── assets/                 # CSS and static assets
├── components/             # Reusable Vue components
│   ├── buttons/           # Login/Register buttons
│   ├── common/            # Shared components (UserDisplay)
│   ├── FormattedContent/  # Rich text rendering system
│   ├── graph/             # D3 graph visualization components
│   ├── layouts/           # Layout components (TabView, InfoView, MobileTabBar)
│   └── modals/            # Modal dialogs (Login, Profile, Tags, etc.)
├── composables/           # Vue 3 composition functions
│   ├── useAuthentication.js
│   ├── useBrowserCapabilities.js
│   └── usePermissions.js
├── config/                # Configuration files
│   ├── appConfig.js       # App settings (admin origin)
│   └── graphConfig.js     # Graph visualization settings
├── directives/             # Custom Vue directives
│   └── v-can.js           # Permission-based rendering
├── services/              # Business logic and API clients
│   ├── apiClient.js       # Axios instance with auth interceptors
│   ├── TokenManager.js    # JWT token management
│   ├── MessageService.js  # Message CRUD operations
│   ├── UserService.js     # User management
│   ├── AttachmentService.js
│   ├── GraphLayoutService.js
│   └── ws/                # WebSocket services
│       ├── WebSocketService.js    # Main WS service
│       ├── WebSocketClient.js     # Low-level WS client
│       ├── IdleManager.js        # Idle timeout handling
│       ├── NetworkVisibility.js  # Network/visibility monitoring
│       └── ReconnectBackoff.js   # Exponential backoff
├── store/                 # Vuex store modules
│   ├── index.js           # Store root
│   └── modules/
│       ├── auth.js        # Authentication state
│       ├── messages.js    # Message state and operations
│       ├── navigation.js  # Navigation state
│       ├── ui.js          # UI state (notifications, modals)
│       └── graphView.js   # Graph view state
├── utils/                 # Utility functions
│   ├── error.js
│   ├── permissions.js
│   ├── scopes.js
│   ├── mobileKeyboard.js
│   └── graph/
│       └── layoutAlgorithms.js
└── views/                 # Route components
    ├── app_views/         # Main application views
    │   ├── ThreadView.vue
    │   ├── GraphView.vue
    │   ├── MessageListView.vue
    │   ├── SearchView.vue
    │   ├── NewThreadView.vue
    │   └── PasswordResetView.vue
    └── info_views/        # Marketing/info pages
        ├── HomeView.vue
        ├── AboutView.vue
        ├── ArchitectureView.vue
        ├── TermsView.vue
        └── HowView.vue
```

## Key Features

### 1. Authentication & Authorization
- Firebase-based authentication (handled in store)
- JWT token management with automatic refresh
- Permission-based rendering via `v-can` directive
- Token refresh on 401 responses via axios interceptors
- Support for managed users (impersonation)

### 2. Real-time Communication
- WebSocket service for real-time message delivery
- Automatic reconnection with exponential backoff
- Activity-based reconnection (reconnects on user activity)
- Network visibility monitoring (online/offline, tab visibility)
- Idle timeout disconnection (3 minutes)
- Connection health monitoring

### 3. Message System
- Threaded conversations with parent-child relationships
- Multiple message views:
  - **Inbox** - Messages to the user
  - **Public** - Publicly shared messages
  - **History** - User's message history
  - **Saved** - Bookmarked messages
- Message search functionality
- Unread count tracking
- Branch-based navigation (sibling navigator)

### 4. Rich Text Formatting
- Markdown support
- LaTeX math rendering (KaTeX)
- Code syntax highlighting (highlight.js)
- Mentions (@user) and hashtags (#tag)
- HTML link rendering
- MCP (Model Context Protocol) examples formatting
- Custom protection/escaping helpers

### 5. Graph Visualization
- D3.js-based force-directed graph
- Visual representation of message relationships
- Interactive node/edge rendering
- Graph search highlighting
- Custom layout algorithms
- Configurable graph settings

### 6. User Interface
- Responsive design with mobile support
- Tab-based navigation (mobile)
- Virtual scrolling for performance
- Global notifications system
- Multiple modal dialogs:
  - Login/Register
  - Profile editing
  - Tags management
  - Recipients selection
  - Bot prompts
  - Links display
- Loading states and error handling

## Architecture Patterns

### State Management
- **Vuex modules** for domain separation:
  - `auth` - User authentication and permissions
  - `messages` - Message data and operations
  - `navigation` - Route and navigation state
  - `ui` - UI state (notifications, modals)
  - `graphView` - Graph visualization state

### Service Layer
- Centralized API client with auth interceptors
- Service classes for domain operations (MessageService, UserService, etc.)
- WebSocket service as singleton pattern
- TokenManager for JWT handling

### Component Architecture
- Composition API (`<script setup>`) throughout
- Reusable components in `components/`
- Route-specific views in `views/`
- Layout components for consistent structure

## Development & Build

### Scripts
- `npm run dev` - Start Vite dev server
- `npm run build` - Production build
- `npm run preview` - Preview production build

### Dev Server Configuration
- Proxy for `/ws` → WebSocket server (ws://127.0.0.1:8081)
- Proxy for `/v1` → API server (http://127.0.0.1:8081)
- Proxy for `/metrics` → Metrics endpoint
- HMR (Hot Module Replacement) enabled
- Path aliases: `@` → `src/`, `@buttons` → `src/components/buttons`

### Production Build
- Multi-stage Docker build:
  1. Node.js build stage (npm install + build)
  2. Nginx Alpine stage (serves static files)
- Nginx configuration:
  - Serves static assets with long cache headers
  - SPA fallback to `index.html`
  - Proxies WebSocket connections to backend
  - Proxies API requests (`/v1/`) to backend
  - Security headers (CSP, X-Frame-Options, etc.)
  - Error handling for backend unavailability

## API Integration

### REST API
- Base URL: `/v1` (proxied to backend)
- Axios instance with:
  - Automatic auth token injection
  - 401 → token refresh → retry logic
  - Request correlation IDs
  - Response timing logs

### WebSocket API
- Endpoint: `/ws/v1`
- Message types:
  - `connection_established` - Connection confirmation
  - `new_message` - Incoming message
  - `error` - Server errors
- Authentication via query parameter (`access_token`)
- Automatic reconnection on failures
- Activity-based reconnection

## Security Features

### Content Security Policy
- Restricts script sources to self and trusted CDNs
- Allows Plausible analytics
- Restricts connect-src to API domain

### Authentication
- HttpOnly refresh tokens (handled by backend)
- Access tokens in memory only
- Automatic token refresh before expiry
- Logout on auth failures

### Headers
- X-Content-Type-Options: nosniff
- X-Frame-Options: SAMEORIGIN
- X-XSS-Protection: enabled

## Performance Optimizations

1. **Virtual Scrolling** - For long message lists
2. **Lazy Loading** - Route-based code splitting
3. **Asset Caching** - Long cache headers for static assets
4. **WebSocket Efficiency** - Single connection per user, not per thread
5. **Idle Disconnection** - Disconnects WebSocket after 3 minutes idle
6. **Activity-Based Reconnect** - Only reconnects on user activity

## Documentation

The repository includes documentation in `_docs/`:
- Product description and philosophy
- Copy guidelines
- Feature specifications
- Architecture reviews
- Pending features and migrations

## Notable Implementation Details

1. **Token Refresh Strategy**: Automatic refresh on 401, with cooldown to prevent refresh loops
2. **WebSocket Resilience**: Multiple reconnection strategies (backoff, activity-based, network-aware)
3. **Permission System**: Both legacy scopes and new permissions meta keys supported
4. **Mobile Support**: Tab bar navigation, mobile keyboard handling, touch event support
5. **Graph Layout**: Custom force-directed algorithms for message relationship visualization
6. **Formatted Content**: Plugin-based system for extensible content formatting

## Environment & Deployment

- **Domain**: stitch.fyi (production)
- **API Domain**: api.stitch.fyi
- **Admin UI**: Separate admin subdomain (configurable)
- **Analytics**: Plausible.io integration
- **Port**: 8080 (production nginx)

## Dependencies Summary

- **Vue Ecosystem**: Vue 3, Vue Router, Vuex
- **Build Tools**: Vite, Vue DevTools plugin
- **HTTP**: Axios
- **Visualization**: D3.js suite
- **Content**: markdown-it, KaTeX, highlight.js
- **Utilities**: lodash, date-fns
- **UI**: vue-virtual-scroller

---

*Generated from repository analysis*
