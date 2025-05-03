# Frontend App

Vue.js frontend for the Stitch application.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Run development server:
   ```
   npm run dev
   ```

3. Build for production:
   ```
   npm run build
   ```

## Docker

Build and run using Docker:
```
docker build -t stitch-frontend .
docker run -p 8080:8080 stitch-frontend
```

Or use docker-compose from the parent directory:
```
docker-compose up frontend
```

## Environment Variables

Key environment variables to configure in `.env` or `.env.local`:
- `VITE_API_URL` - Backend API URL (default in container: http://backend:8081)
- `VITE_FIREBASE_API_KEY` - Firebase API key
- `VITE_FIREBASE_AUTH_DOMAIN` - Firebase Auth domain
- `VITE_FIREBASE_PROJECT_ID` - Firebase project ID

## Project Structure

- `src/components/` - Vue components
- `src/views/` - Page components
- `src/store/` - Vuex store modules
- `src/assets/` - Static assets
- `src/router.js` - Vue Router configuration 