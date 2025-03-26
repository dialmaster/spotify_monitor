#!/bin/bash

# Default values
CONFIG_FILE="config.json"
DB_USER="spotify"
DB_PASSWORD="spotify_password"
DB_PORT="5432"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --config=*)
      CONFIG_FILE="${1#*=}"
      shift
      ;;
    --port=*)
      # Keep for backward compatibility but print a message
      echo "Note: Using port from config file instead of command-line argument"
      shift
      ;;
    --db-user=*)
      DB_USER="${1#*=}"
      shift
      ;;
    --db-password=*)
      DB_PASSWORD="${1#*=}"
      shift
      ;;
    --db-port=*)
      DB_PORT="${1#*=}"
      shift
      ;;
    *)
      echo "Unknown parameter: $1"
      exit 1
      ;;
  esac
done

# Check if config file exists
if [ ! -f "$CONFIG_FILE" ]; then
  echo "Error: Config file '$CONFIG_FILE' not found!"
  exit 1
fi

# Extract the port from the config file
PORT=$(grep -o '"port": *[0-9]*' "$CONFIG_FILE" | awk '{print $2}')
if [ -z "$PORT" ]; then
  echo "Warning: No port found in config file, using default port 8888"
  PORT=8888
fi

# Extract the name from config file for the project name
USERNAME=$(grep -o '"spotifyUserName": *"[^"]*"' "$CONFIG_FILE" | cut -d'"' -f4)
if [ -z "$USERNAME" ]; then
  USERNAME="spotify-user"
fi

# Create a valid project name (lowercase, alphanumeric, hyphens, and underscores)
PROJECT_NAME="spotify-monitor-$(echo $USERNAME | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9_-]/-/g')"

# Ensure the shared network exists
NETWORK_NAME="spotify-shared-network"
if ! docker network ls | grep -q "$NETWORK_NAME"; then
  echo "Creating shared network: $NETWORK_NAME"
  docker network create "$NETWORK_NAME"
fi

# Export variables for docker-compose
export DB_USER
export DB_PASSWORD
export DB_PORT

# Check if the shared database is running
if ! docker ps | grep -q "spotify-shared-db"; then
  echo "Shared database not running. Starting it now..."

  # Start the shared database
  docker compose -f db-compose.yml -p spotify-shared-db up -d

  # Wait for database to be ready (simple approach)
  echo "Waiting for database to be ready..."
  sleep 10
else
  echo "Using existing shared database instance"
fi

# Export variables for spotify-monitor
export PORT=$PORT
export CONFIG_PATH=$(realpath "$CONFIG_FILE")

# Run docker-compose with a unique project name
docker compose -p "$PROJECT_NAME" up -d --build

echo "Started Spotify Monitor for user '$USERNAME' on port $PORT using config '$CONFIG_FILE'"
echo "Using shared database with user '$DB_USER' (password not shown)"
echo "View logs with: docker compose -p $PROJECT_NAME logs -f"