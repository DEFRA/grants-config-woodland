#!/bin/bash
set -e

# Usage:
#   Run all journey/acceptance tests:
#     ./test/run-all-tests.sh

# grants-ui is private while the CRN/SBI exposure is dealt with (TGC-1813). These tests
# take grants-ui's compose files, source and allowlist anonymously and pull the
# grants-ui-backend and land-grants-api images from Docker Hub, so run only once all of
# those are publicly readable again; until then skip rather than fail the check.
for url in \
  https://raw.githubusercontent.com/DEFRA/grants-ui/main/package.json \
  https://hub.docker.com/v2/repositories/defradigital/grants-ui-backend/ \
  https://hub.docker.com/v2/repositories/defradigital/land-grants-api/; do
  if ! curl -fso /dev/null "$url"; then
    echo "Not publicly readable yet: $url; skipping grants-ui journey tests"
    exit 0
  fi
done

TEST_COMMAND='npm run test:ci'

export COMPOSE_EXPERIMENTAL_GIT_REMOTE=true

export ACCEPTANCE_TESTS_HOOK="
  docker compose -f https://github.com/DEFRA/grants-ui.git#main:compose.tests.yml -f test/compose.testlocal.yml run --interactive=false -T --quiet-pull --rm grants-config-woodland-grants-ui-tests $TEST_COMMAND &&
  docker compose -f https://github.com/DEFRA/grants-ui.git#main:compose.tests.yml down
"

if [ "${CI}" = "true" ]; then
  export ACCEPTANCE_TESTS_HOOK="yes | ${ACCEPTANCE_TESTS_HOOK}"
fi

mkdir -p test/testconfig
cp -r configurations/woodland/ test/testconfig/woodland@0.0.0
cp $(dirname "$0")/release.yml test/testconfig/
curl -fsSL \
  https://raw.githubusercontent.com/DEFRA/grants-ui/main/compose/config-broker/local-allowlists/woodland.yaml \
  -o test/testconfig/woodland@0.0.0/grants-ui/allowlist.yaml

"$(dirname "$0")/docker-compose-smoke-test.sh"
