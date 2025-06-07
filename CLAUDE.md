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

# Run directly (requires local PostgreSQL)
node app.js

# Run with auto-reload
npx nodemon app.js
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