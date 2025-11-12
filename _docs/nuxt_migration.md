# Nuxt.js Exploration Notes

## What is Nuxt?
Nuxt is a meta-framework built on Vue 3 that adds:
- **File-based routing** - Directory structure defines routes automatically
- **Auto-imports** - Components, composables, and utilities available without explicit imports
- **Hybrid rendering** - Mix SSR, SSG, and SPA modes per route
- **Better conventions** - Opinionated structure that reduces boilerplate

## Why Consider It for Stitch?

### 1. Semantic Clarity (AI Agent Benefit)
File path = Route path. No router.js indirection.
```
pages/how/docs.vue → /how/docs
pages/messages/[id].vue → /messages/:id
```

When AI agents work on the codebase, they don't need to:
- Search router.js for route definitions
- Resolve import paths
- Track multiple files for one route

Direct mapping reduces cognitive load and context window usage.

### 2. Public Content SEO
Stitch has two categories of public content:
- **Info pages** (`/home`, `/architecture`, `/terms`, `/how/*`) - marketing/docs
- **Public message threads** (`/messages/:id` where public=true) - user-generated content

SSR makes these crawlable by search engines. Public threads could drive organic discovery.

**Why SSR doesn't help auth-gated content:**
- Search engines can't log in
- Server can't render user-specific data (inbox, saved messages)
- SSR overhead without benefit

But public threads are different - they're the same for everyone and could rank for long-tail keywords.

### 3. Developer Experience
- Less boilerplate (no import statements for common utilities)
- Self-documenting structure (file tree is route map)
- Modern state management (Pinia > Vuex)
- Better organized at scale

## Key Migration Concepts

### File-Based Routing
Replace `router.js` (120+ lines) with directory structure. Dynamic routes use bracket syntax `[id].vue`.

### Auto-Imports
Components in `/components`, composables in `/composables`, and utilities in `/utils` are automatically available. Vue APIs (ref, computed) and Nuxt APIs (useFetch, useRouter) also auto-imported.

### Pinia Migration (Vuex → Pinia)
Pinia uses Composition API style:
```javascript
// Vuex: mutations, actions, getters
// Pinia: just functions and reactive state
export const useAuthStore = defineStore('auth', () => {
  const user = ref(null);
  const isAuthenticated = computed(() => !!user.value);
  async function login(creds) { /* ... */ }
  return { user, isAuthenticated, login };
});
```

Simpler, better TypeScript support, auto-imported.

### Hybrid Rendering
Configure per-route in `nuxt.config.ts`:
```javascript
routeRules: {
  '/home': { ssr: true },           // Server-rendered
  '/terms': { prerender: true },    // Static at build time
  '/inbox': { ssr: false },         // Client-only (SPA mode)
}
```

### Layouts
Move `InfoViewLayout.vue` and `TabViewLayout.vue` to `/layouts` directory. Pages reference them with `definePageMeta({ layout: 'info' })` instead of wrapping in template.

## Setup Pointers

### Initialize New Project
```bash
npx nuxi init stitch-frontend-nuxt
cd stitch-frontend-nuxt
npm install
```

### Key Dependencies to Add
- `@pinia/nuxt` - State management (replaces Vuex)
- `@nuxtjs/tailwind` or CSS framework of choice
- Any existing Vue 3 libraries (should be compatible)

### Backend Proxy Config
In `nuxt.config.ts`:
```javascript
export default defineNuxtConfig({
  routeRules: {
    '/api/**': { proxy: 'http://127.0.0.1:8081/api/**' },
    '/ws/**': { proxy: 'ws://127.0.0.1:8081/ws/**' }
  }
})
```

## Migration Considerations

### What Changes
- `router.js` → `pages/` directory
- `views/` → `pages/` (same files, different location)
- `store/` (Vuex) → `stores/` (Pinia)
- Explicit imports → Auto-imports where applicable
- `App.vue` → `app.vue` (root layout)
- `components/layouts/` → `layouts/`

### What Stays Similar
- Components mostly unchanged (still Vue 3 Composition API)
- Composables work the same (just auto-imported)
- Services and utilities can remain as-is
- Styling/CSS unchanged

### Complexity Points
- SSR requires handling client-only code (Firebase, WebSockets)
- Testing auth flows with SSR
- Deployment setup (Node.js server vs static hosting)
- Learning Nuxt-specific conventions

### Incremental Approach Option
Could run both apps in parallel:
- Keep main app on Vue+Vite
- Nuxt app for info pages only
- Nginx routes `/home`, `/how/*`, etc. to Nuxt
- Measure benefits before full migration

## The "Geometry" Argument

File-based routing creates structural alignment:
- URL hierarchy = File hierarchy = Mental model
- No translation layer between concept and implementation
- Self-documenting (can visualize routes by looking at file tree)
- Scales better as route count grows

For AI agents, this matters more than for humans:
- Agents must navigate codebases frequently
- Each layer of indirection costs context
- Direct mappings reduce errors and improve efficiency

The organizational appeal isn't just aesthetics - it's reduced cognitive complexity that compounds over time.

## Resources

- Nuxt 3 docs: https://nuxt.com/docs
- Pinia docs: https://pinia.vuejs.org
- File-based routing: https://nuxt.com/docs/guide/directory-structure/pages
- Hybrid rendering: https://nuxt.com/docs/guide/concepts/rendering

## Status

Created demo project at `stitch-frontend-nuxt/` for reference. No commitment to migrate yet - this document exists to capture the evaluation for future consideration.

