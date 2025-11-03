#!/bin/sh

COMPOSE_FILE="$HOME/rhiva-ag/docker-compose.yml"

if [ -f "$COMPOSE_FILE" ]; then
  sudo docker compose -f "$COMPOSE_FILE" up -d
else
  echo "Compose file not found at $COMPOSE_FILE"
fi
