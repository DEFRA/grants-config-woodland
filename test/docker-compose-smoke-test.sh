#!/bin/bash
set -e

# Detect and set up container runtime (Docker or Podman)
CONTAINER_RUNTIME=""
if command -v docker &> /dev/null; then
    CONTAINER_RUNTIME="docker"
    echo "Using Docker as container runtime"
    # Test that docker actually works
    if ! docker --version &> /dev/null; then
        echo "Warning: docker command found but not working properly"
    fi
elif command -v podman &> /dev/null; then
    CONTAINER_RUNTIME="podman"
    echo "Using Podman as container runtime"
    # Test that podman actually works
    if ! podman --version &> /dev/null; then
        echo "Error: podman command found but not working properly"
        exit 1
    fi
    # Create docker function that calls podman
    docker() {
        podman "$@"
    }
else
    echo "Error: Neither docker nor podman is installed or in PATH"
    echo "Please install either Docker or Podman to run this script"
    exit 1
fi

BASE='https://github.com/DEFRA/grants-ui.git#main:'
BASE_COMPOSE=${BASE}compose.yml

docker compose version

COMPOSE_COMMAND="docker compose \
  -f ${BASE_COMPOSE} \
  -f ${BASE}compose.ha.yml \
  -f ${BASE}compose.land-grants.yml \
  -f ${BASE}compose.ci.yml \
  -f $(dirname "$0")/compose.localconfig.yml"

echo "Running pre-emptive volume cleanse..."
docker volume prune -f

echo "Building docker compose containers..."
eval "${COMPOSE_COMMAND} build --quiet  > /dev/null 2>&1"
echo "Starting services with docker compose..."
START_SERVICES="${COMPOSE_COMMAND} up -d --quiet-pull"
if [ "${CI}" = "true" ]; then
  START_SERVICES="yes | ${START_SERVICES}"
fi
eval "${START_SERVICES}"

echo "Waiting for services to be healthy..."
ATTEMPTS=0
MAX_ATTEMPTS=60

echo "Waiting for grants-ui service to start..."
until docker compose -f ${BASE_COMPOSE} ps grants-ui | grep -q "Up"; do
    if [ ${ATTEMPTS} -eq ${MAX_ATTEMPTS} ]; then
        echo "Error: Timed out waiting for grants-ui service to start."
        docker compose -f ${BASE_COMPOSE} ps
        eval "${COMPOSE_COMMAND} down -v"
        exit 1
    fi
    printf '.'
    ATTEMPTS=$(($ATTEMPTS+1))
    sleep 2
done

echo "Service started, now waiting for health check to pass..."

ATTEMPTS=0

until curl -skf https://localhost:4000/health >/dev/null 2>&1; do
    if [ ${ATTEMPTS} -eq ${MAX_ATTEMPTS} ]; then
        echo "Error: Timed out waiting for grants-ui service to be accessible."
        echo "--- Current Service Status ---"
        docker compose ${BASE_COMPOSE} ps
        echo "--- grants-ui Service Logs ---"
        docker compose ${BASE_COMPOSE} logs grants-ui
        echo "--- Redis Service Logs ---"
        docker compose ${BASE_COMPOSE} logs redis
        eval "${COMPOSE_COMMAND} down"
        exit 1
    fi
    printf 'h'
    ATTEMPTS=$(($ATTEMPTS+1))
    sleep 3
done

echo "All services are healthy!"
echo "Service Status:"
docker compose -f ${BASE_COMPOSE} ps

if [ -n "${ACCEPTANCE_TESTS_HOOK:-}" ]; then
  echo "Running Journey Tests..."
  eval "${ACCEPTANCE_TESTS_HOOK}"
fi

eval "${COMPOSE_COMMAND} down -v"
echo ""
echo "Tests complete."
