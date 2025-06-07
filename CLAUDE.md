# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Spotify Monitor is a web application for parents to monitor Spotify listening activity in real-time, with features including lyrics analysis, AI-powered age appropriateness evaluation, auto-skip functionality, and Signal notifications.

## Notes

This project is a work in progress. The structure below will probably change and should be updated anytime edits are made or if, during the course of work, it is discovered that this document is out of date.

## Key Architecture

### Tech Stack
- **Backend**: Node.js + Express
- **Database**: PostgreSQL with Sequelize ORM
- **Frontend**: Server-side rendering (EJS) + Vanilla JS modules
- **Container**: Docker with multi-instance support
- **APIs**: Spotify Web API, Genius API, OpenAI API
- **Web Scraping**: Puppeteer for fallback lyrics retrieval

### Database Schema (via Sequelize migrations)
- `tracks`: Track metadata and lyrics
- `ai_evaluations`: Age appropriateness evaluations
- `recently_played`: Playback history
- `spotify_auth`: OAuth tokens

### Core Services Architecture
- **spotifyService.js**: Manages Spotify API authentication and playback monitoring
- **lyricsService.js**: Retrieves lyrics (priority: Spotify Web → Genius API → Web scraping)
- **ageEvaluationService.js**: Uses OpenAI GPT-4o-mini for content evaluation
- **monitoringDaemon.js**: Background process checking playback at configured intervals
- **sseService.js**: Server-Sent Events for real-time frontend updates

## Development Commands

### Running the Application

**With Docker (Recommended)**:
```bash
# Start instance with config
./start.sh config.json

# Stop instance
./stop.sh spotify-monitor-<username>

# View logs
docker compose -p spotify-monitor-<username> logs -f

# List all instances
docker compose ls
```

**Local Development**:
```bash
# Install dependencies
npm install

# Build TypeScript files
npm run build

# Run the built application (requires local PostgreSQL)
npm start

# Run with auto-reload and TypeScript watch
npm run dev
```

### Database Operations
```bash
# Access PostgreSQL in Docker
docker exec -it spotify-shared-db psql -U spotify -d spotify_data

# Run migrations (automatic on startup)
# Migrations are in src/migrations/ and run via src/utils/migrationRunner.js
```

## Development Guidelines

### Code Style (from .cursorrules)
- Use early returns to avoid nested conditions
- Prefer constants over functions where possible
- Use descriptive names, prefix event handlers with "handle"
- Write DRY, functional, immutable code
- Add JSDoc comments for JavaScript functions
- Minimal code changes - only modify what's necessary

### Testing Approach
No predefined test scripts. When implementing tests:
1. Check for existing test patterns in the codebase
2. Ask user for preferred testing framework/approach
3. Consider writing tests to CLAUDE.md for future reference

### Common Tasks

**Adding New Features**:
1. Check existing patterns in similar files
2. Follow the MVC structure (routes → services → repositories → models)
3. Update migrations if database changes needed
4. Add frontend modules in `/public/js/nowplaying/` following existing patterns

**Debugging**:
- User-specific logs in `logs/<username>_playback.log`
- Check Docker logs: `docker compose -p spotify-monitor-<username> logs`
- Frontend uses modular JS - check browser console for client-side issues

**Configuration Changes**:
- Edit appropriate `config.json` file
- Restart container for changes to take effect
- Multiple instances require different ports

### API Integration Notes

**Spotify Authentication**:
- OAuth tokens stored in PostgreSQL
- Auto-refresh handled by spotifyService
- Redirect URI must match Spotify app settings

**Lyrics Retrieval Priority**:
1. Spotify Web (requires cookies with sp_dc, sp_t, sp_adid, sp_gaid, sp_key)
2. Genius API (requires API key)
3. Web scraping fallback (Puppeteer)

**Age Evaluation**:
- Uses OpenAI GPT-4o-mini model
- Confidence levels based on lyrics source quality
- Customizable age thresholds in config

## Current Development Focus

Branch: `feat/switch-to-typescript`
- Migrating project from JavaScript to TypeScript
- Following incremental migration approach
- Maintaining functionality throughout the process

## TypeScript Migration

A comprehensive plan for migrating this project to TypeScript is available:
- [TypeScript Migration Plan](./TYPESCRIPT_MIGRATION_PLAN.md)

### TypeScript Development

**Build Commands**:
```bash
# Build TypeScript files
npm run build

# Build with watch mode
npm run build:watch

# Run development server with auto-rebuild
npm run dev

# Type check without building
npx tsc --noEmit
```

**Type Organization**:
The project uses a modular type system located in `src/types/`:
- `config.types.ts` - Application configuration interfaces
- `spotify.types.ts` - Spotify API types (auth, tracks, playback, etc.)
- `database.types.ts` - Sequelize model types
- `api.types.ts` - Express request/response types
- `service.types.ts` - Service layer types (lyrics, evaluation, SSE, etc.)
- `common.types.ts` - Shared types (status, errors, pagination)
- `index.ts` - Central export point for all types

**Import Examples**:
```typescript
// Import specific types
import { AppConfig, SpotifyTrack } from '../types';

// Import from specific type files
import { AgeEvaluationResponse } from '../types/service.types';
```

**TypeScript Guidelines**:
- All TypeScript files compile to `dist/` directory
- Source maps are generated for debugging
- Currently using `allowJs: true` for incremental migration
- Type files use `.types.ts` suffix for clarity
- Interfaces preferred over type aliases where applicable

**Build Process Details**:
- TypeScript compilation: `tsc` compiles all `.ts` and `.js` files to `dist/`
- Static assets: Views (EJS templates) and public files (CSS, JS, images) are copied to `dist/` using copyfiles
- Build command: `npm run build` runs TypeScript compilation followed by asset copying
- Important: During migration, do NOT exclude any JavaScript files from `tsconfig.json` that are still needed by the app
- The `dist/` directory structure mirrors the source structure:
  - `dist/src/` - Compiled TypeScript/JavaScript files
  - `dist/views/` - EJS templates
  - `dist/public/` - Static assets (CSS, client-side JS, images, manifest)

**Common Build Issues**:
- If models are undefined at runtime: Check that no `.js` files are excluded in `tsconfig.json`
- If views are not found: Ensure `copy-views` script is running in the build process
- If static assets (CSS/JS) return 404: Verify `copy-public` script is copying all files with `-a` flag
- Always run `npm run clean` before `npm run build` if experiencing issues