#!/bin/bash
# Use --fresh to wipe DB and volumes (needed after schema changes)
if [ "$1" = "--fresh" ]; then
  docker compose down -v
fi
docker compose up --build
