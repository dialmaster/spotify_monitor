# TypeScript Migration Plan for Spotify Monitor

This document outlines a step-by-step plan to migrate the Spotify Monitor project from JavaScript to TypeScript. The migration is designed to be incremental, ensuring the application remains functional throughout the process.

## Migration Principles

1. **Incremental Migration**: Convert one module at a time
2. **No Breaking Changes**: Application must remain functional after each step
3. **Type Safety First**: Add types before refactoring logic
4. **Test as You Go**: Validate each component after migration
5. **Documentation**: Update relevant docs as we progress
6. **Track Discoveries**: As tasks are completed, always document any issues encountered, workarounds applied, or information that subsequent steps will need. Update future steps proactively when dependencies or prerequisites are discovered.
7. **Progress Tracking**: **IMPORTANT**: As tasks are completed, update this migration plan by marking items with `[x]` and adding completion notes. This ensures we can track our progress and maintain an accurate record of what has been accomplished.

## Phase 0: Foundation Setup (No Code Changes)

### 0.1 TypeScript Infrastructure
- [x] Install TypeScript and related dependencies
  ```bash
  npm install --save-dev typescript @types/node ts-node tsconfig-paths
  ```
- [x] Install type definitions for existing dependencies
  ```bash
  npm install --save-dev @types/express @types/cookie-parser @types/ejs @types/pg @types/sequelize
  ```
- [x] Create `tsconfig.json` for backend with `allowJs: true`
  - Note: `declaration` is temporarily set to `false` due to TS4094 errors in monitoringDaemon.js
- [x] Create `tsconfig.frontend.json` for frontend code
- [x] Update `.gitignore` to exclude `dist/` and `*.tsbuildinfo`
- [x] **Validation**: Run `npx tsc --noEmit` - should complete without errors

### 0.2 Build Process Setup
- [x] Install development dependencies
  ```bash
  npm install --save-dev concurrently rimraf
  ```
- [x] Add npm scripts to `package.json`:
  - [x] `"build": "tsc"`
  - [x] `"build:watch": "tsc --watch"`
  - [x] `"dev": "concurrently \"npm run build:watch\" \"nodemon dist/app.js\""`
  - [x] `"clean": "rimraf dist"`
  - [x] `"start": "node dist/app.js"`
- [x] Update `nodemon.json` to watch `dist/` directory
  - **Note**: Created new `nodemon.json` file to watch `dist/` directory with JS extensions
- [x] **Validation**: Run `npm run build` - should copy all JS files to `dist/`
  - **Completed**: Build successfully generates all JS files with source maps in `dist/` directory

### 0.3 Docker Configuration Updates
- [ ] Update `Dockerfile` to include build step
- [ ] Ensure `dist/` directory is used for production
- [ ] Update volume mounts in `docker-compose.yml` if needed
- [ ] **Validation**: Build and run Docker container - application should work normally

## Phase 1: Type Definitions and Simple Modules

### 1.1 Create Type Definition Files
- [ ] Create `src/types/index.d.ts` for shared types
- [ ] Define configuration interface based on `config.json.example`
  - [ ] Main config structure
  - [ ] Age evaluation config
  - [ ] Optional API keys
- [ ] Define common types (User, Track, Evaluation, etc.)
- [ ] **Validation**: Types compile without errors

### 1.2 Migrate Configuration Module
- [ ] Convert `src/config/index.js` to `index.ts`
  - [ ] Add proper typing for config object
  - [ ] Type the validation functions
  - [ ] Export typed config
- [ ] Convert `src/config/database.js` to `database.ts`
  - [ ] Type Sequelize configuration
- [ ] **Validation**: Application starts and loads config correctly

### 1.3 Migrate Simple Utilities
- [ ] Convert `src/types/statusTypes.js` to `statusTypes.ts`
- [ ] Convert logging utilities if any
- [ ] **Validation**: Check logs are still being written correctly

## Phase 2: Data Layer Migration

### 2.1 Sequelize Setup for TypeScript
- [ ] Install Sequelize TypeScript dependencies
  ```bash
  npm install --save-dev @types/sequelize sequelize-typescript
  ```
- [ ] Create base model configuration with TypeScript
- [ ] Set up proper Sequelize instance typing

### 2.2 Migrate Database Models
- [ ] Convert `src/models/Track.js` to `Track.ts`
  - [ ] Define interface for Track attributes
  - [ ] Add proper Sequelize decorators if using sequelize-typescript
  - [ ] Type all model methods
- [ ] Convert `src/models/AiEvaluation.js` to `AiEvaluation.ts`
- [ ] Convert `src/models/RecentlyPlayed.js` to `RecentlyPlayed.ts`
- [ ] Convert `src/models/SpotifyAuth.js` to `SpotifyAuth.ts`
- [ ] Update `src/models/index.js` to `index.ts`
  - [ ] Ensure associations are properly typed
- [ ] **Validation**: Run database queries, check migrations still work

### 2.3 Migrate Repositories
- [ ] Convert `src/repositories/trackRepository.js` to `trackRepository.ts`
  - [ ] Type all function parameters and return values
  - [ ] Add proper error handling types
- [ ] Convert `src/repositories/aiEvaluationRepository.js` to `aiEvaluationRepository.ts`
- [ ] Convert `src/repositories/recentlyPlayedRepository.js` to `recentlyPlayedRepository.ts`
- [ ] Convert `src/repositories/spotifyAuthRepository.js` to `spotifyAuthRepository.ts`
- [ ] **Validation**: Test CRUD operations for each repository

## Phase 3: Service Layer Migration

### 3.1 Simple Services
- [ ] Convert `src/services/logService.js` to `logService.ts`
  - [ ] Type Winston logger configuration
  - [ ] Type log methods
- [ ] Convert `src/services/cacheService.js` to `cacheService.ts`
  - [ ] Type cache storage
  - [ ] Type cache methods
- [ ] Convert `src/services/dbService.js` to `dbService.ts`
- [ ] **Validation**: Check logging and caching still function

### 3.2 External Integration Services
- [ ] Convert `src/services/callMeBotService.js` to `callMeBotService.ts`
  - [ ] Type API responses
  - [ ] Type notification methods
- [ ] Convert `src/services/lyricsService.js` to `lyricsService.ts`
  - [ ] Type Genius API responses
  - [ ] Type Puppeteer operations
  - [ ] Type lyrics response structure
- [ ] **Validation**: Test lyrics retrieval from all sources

### 3.3 Core Services
- [ ] Convert `src/services/spotifyService.js` to `spotifyService.ts`
  - [ ] Type Spotify API responses
  - [ ] Type authentication flow
  - [ ] Type playback state
- [ ] Convert `src/services/ageEvaluationService.js` to `ageEvaluationService.ts`
  - [ ] Type OpenAI API interactions
  - [ ] Type evaluation responses
- [ ] Convert `src/services/recentlyPlayed.js` to `recentlyPlayed.ts`
- [ ] Convert `src/services/sseService.js` to `sseService.ts`
  - [ ] Type SSE events
  - [ ] Type client connections
- [ ] **Validation**: Full monitoring flow works end-to-end

### 3.4 Monitoring Daemon
- [ ] Convert `src/services/monitoringDaemon.js` to `monitoringDaemon.ts`
  - [ ] Type daemon state
  - [ ] Type monitoring intervals
  - [ ] Ensure proper async typing
  - [ ] **Important**: This file exports a class instance (`module.exports = new MonitoringDaemon()`), which causes TS4094 errors when `declaration: true`. Will need to refactor the export pattern or keep declarations disabled until resolved.
- [ ] **Validation**: Daemon starts and monitors correctly

## Phase 4: Routes and Middleware

### 4.1 Route Migration
- [ ] Convert `src/routes/authRoutes.js` to `authRoutes.ts`
  - [ ] Type Express request/response
  - [ ] Type route handlers
- [ ] Convert `src/routes/apiRoutes.js` to `apiRoutes.ts`
  - [ ] Type API responses
  - [ ] Type request parameters
- [ ] Convert `src/routes/webRoutes.js` to `webRoutes.ts`
  - [ ] Type view rendering
- [ ] **Validation**: Test all endpoints with Postman/curl

### 4.2 Main Application Files
- [ ] Convert `src/app.js` to `app.ts`
  - [ ] Type Express application
  - [ ] Type middleware
  - [ ] Type error handlers
- [ ] Convert root `app.js` to `app.ts`
- [ ] Update package.json to point to compiled version
- [ ] **Validation**: Application starts and serves all routes

## Phase 5: Frontend Migration

### 5.1 Frontend Build Setup
- [ ] Choose and set up bundler (Vite recommended)
  ```bash
  npm install --save-dev vite @vitejs/plugin-legacy
  ```
- [ ] Create `vite.config.ts` for frontend build
- [ ] Set up frontend TypeScript configuration
- [ ] Add frontend build scripts to package.json
- [ ] **Validation**: Frontend builds without errors

### 5.2 Convert to ES Modules
- [ ] Create `public/js/nowplaying/types.ts` for frontend types
- [ ] Convert each module to use ES6 imports/exports:
  - [ ] `elements.js` → `elements.ts`
  - [ ] `utils.js` → `utils.ts`
  - [ ] `toast.js` → `toast.ts`
  - [ ] `user-profile.js` → `user-profile.ts`
  - [ ] `ui.js` → `ui.ts`
  - [ ] `player.js` → `player.ts`
  - [ ] `lyrics.js` → `lyrics.ts`
  - [ ] `history.js` → `history.ts`
  - [ ] `history-modal.js` → `history-modal.ts`
  - [ ] `age-evaluation.js` → `age-evaluation.ts`
  - [ ] `transcript.js` → `transcript.ts`
  - [ ] `main.js` → `main.ts` (entry point)
- [ ] Update HTML to load bundled JavaScript
- [ ] **Validation**: Frontend functionality remains intact

## Phase 6: Testing and Documentation

### 6.1 Add Type Checking to CI
- [ ] Add `tsc --noEmit` to pre-commit hooks
- [ ] Update GitHub Actions (if any) to include type checking
- [ ] Add type checking to Docker build process
- [ ] **Validation**: CI/CD pipeline works with TypeScript

### 6.2 Update Documentation
- [ ] Update README.md with new build instructions
- [ ] Update CLAUDE.md with TypeScript development info
- [ ] Document any new npm scripts
- [ ] Add TypeScript best practices for the project
- [ ] **Validation**: New developers can follow docs to get started

## Phase 7: Cleanup and Optimization

### 7.1 Remove JavaScript Files
- [ ] Delete original `.js` files after successful migration
- [ ] Update imports throughout the codebase
- [ ] Remove `allowJs` from tsconfig.json
- [ ] **Validation**: Project builds and runs with pure TypeScript

### 7.2 Type Refinement
- [ ] Re-enable TypeScript declarations
  - [ ] Set `declaration: true` in tsconfig.json
  - [ ] Set `declarationMap: true` in tsconfig.json
  - [ ] Ensure all TS4094 errors have been resolved
- [ ] Add stricter TypeScript compiler options
  - [ ] Enable `strict: true`
  - [ ] Enable `noImplicitAny: true`
  - [ ] Enable `strictNullChecks: true`
- [ ] Fix any new type errors that arise
- [ ] Add more specific types where `any` was used
- [ ] **Validation**: No TypeScript errors with strict mode

### 7.3 Performance Optimization
- [ ] Optimize build process for production
- [ ] Set up proper source maps
- [ ] Configure tree shaking for frontend
- [ ] **Validation**: Production build is optimized

## Validation Checklist

After completing the migration, ensure:

- [ ] Application starts without errors
- [ ] All Spotify authentication flows work
- [ ] Real-time monitoring functions correctly
- [ ] Lyrics retrieval works from all sources
- [ ] Age evaluation processes correctly
- [ ] Auto-skip functionality works (if enabled)
- [ ] Signal notifications are sent properly
- [ ] Database operations complete successfully
- [ ] Frontend updates in real-time
- [ ] Docker deployment works
- [ ] Multiple instance support remains functional
- [ ] All API endpoints respond correctly
- [ ] No regression in functionality

## Risk Mitigation

1. **Create a branch**: Do all migration work in a dedicated branch
2. **Backup database**: Before running migrated code against production data
3. **Test thoroughly**: After each phase, test all related functionality
4. **Monitor logs**: Watch for any new errors or warnings
5. **Have rollback plan**: Keep the original JS version tagged and ready

## Notes

- Estimated timeline: 2-4 weeks for complete migration
- Can pause after any phase if needed
- Each phase is designed to leave the app in a working state
- Consider adding tests during migration for critical paths