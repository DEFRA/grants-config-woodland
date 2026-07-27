#!/bin/bash
set -e

# Usage:
#   Run all journey/acceptance tests:
#     ./test/run-all-tests.sh

TEST_COMMAND='npm run test:ci'

export COMPOSE_EXPERIMENTAL_GIT_REMOTE=true

export ACCEPTANCE_TESTS_HOOK="
  docker compose -f https://github.com/DEFRA/grants-ui.git#main:compose.tests.yml -f test/compose.testlocal.yml run --interactive=false -T --quiet-pull --rm grants-ui-woodland-tests $TEST_COMMAND &&
  docker compose -f https://github.com/DEFRA/grants-ui.git#main:compose.tests.yml down
"

if [ "${CI}" = "true" ]; then
  export ACCEPTANCE_TESTS_HOOK="yes | ${ACCEPTANCE_TESTS_HOOK}"
fi

mkdir -p test/testconfig
cp -r configurations/woodland/ test/testconfig/woodland@0.0.0
cp $(dirname "$0")/release.yml test/testconfig/
cp configurations/woodland/gas/gas.json test/testconfig/gas.schema.json
curl -fsSL \
  https://raw.githubusercontent.com/DEFRA/grants-ui/main/localstack/config-broker/local-allowlists/woodland.yaml \
  -o test/testconfig/woodland@0.0.0/grants-ui/allowlist.yaml

"$(dirname "$0")/docker-compose-smoke-test.sh"
