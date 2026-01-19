# Stitch Frontend

Vue.js frontend application for Stitch.

## Structure

- `src/` - Application source code
  - `components/` - Vue components
  - `composables/` - Vue composables
  - `services/` - API and service layer
  - `store/` - Vuex store modules
  - `views/` - Page views
  - `utils/` - Utility functions
  - `config/` - Configuration files
- `_docs/` - Documentation
- `public/` - Static assets

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Related Services

- Backend API: See `../stitch-backend/README.md`
- Bots Service: See `../stitch-bots/README.md`

---

## Internal: High Level

### Architecture

**TODO:** Document which functions are in which files, in which folders, and how they call each other. Define principles for organizing groups of related files into folders hierarchically, splitting code into reasonably-sized files, and the responsibilities of different modules within the codebase.

**Current structure:**
- `src/components/` - Vue components organized by feature/domain
- `src/services/` - API clients and service layer
- `src/store/` - Vuex store modules (auth, messages, navigation, etc.)
- `src/views/` - Page-level components
- `src/composables/` - Reusable composition functions
- `src/utils/` - Utility functions

**Key principles:**
- Component-based architecture using Vue 3
- Service layer abstracts API communication
- State management via Vuex
- Composition API for reusable logic

### Testing

**TODO:** Document how code is tested for correct functionality. Define test suite domain, methodology, and implementation including manual and automated testing environments.

**Current state:**
- Test framework: TBD
- Unit tests: TBD
- Integration tests: TBD
- E2E tests: TBD
- Manual testing: TBD

### Observability

**TODO:** Document how records of code execution are organized, preserved and referenced. Pertains to API, application, and cost monitoring.

**Current state:**
- Client-side logging: `src/services/logger.js`
- Error tracking: TBD
- Performance monitoring: TBD
- User analytics: TBD
- API monitoring: TBD

### Version Control

**TODO:** Document how changes to the codebase proceed from development environments to production. Includes guidelines for testing and documenting changes.

**Current state:**
- Development workflow: TBD
- Testing requirements: TBD
- Build process: Vite-based build system
- Deployment process: Docker-based deployment with nginx
- Change documentation: TBD

