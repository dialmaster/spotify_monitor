#!/bin/bash

# Get list of running containers
RUNNING_CONTAINERS=$(docker compose ls --format json)

# Check if a container name was provided
if [ $# -ne 1 ]; then
  echo "Usage: $0 <container_name>"
  echo "Currently running containers:"
  docker compose ls
  exit 1
fi

CONTAINER_NAME=$1

# Check if the specified container is running
if echo "$RUNNING_CONTAINERS" | grep -q "\"Name\":\"$CONTAINER_NAME\""; then
  echo "Stopping container: $CONTAINER_NAME"
  docker compose -p "$CONTAINER_NAME" down
else
  echo "Container '$CONTAINER_NAME' is not running."
  echo "Currently running containers:"
  docker compose ls
fi
