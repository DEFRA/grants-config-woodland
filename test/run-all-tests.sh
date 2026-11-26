#!/bin/bash
set -eo pipefail

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

# Resolve once so the downloaded config and readiness check use the same release.
# Override LAND_GRANTS_TAG to reproduce a run against a particular released tag.
LAND_GRANTS_TAG="${LAND_GRANTS_TAG:-$(curl -fsSL --retry 3 \
  https://api.github.com/repos/DEFRA/grants-config-land-grants/tags | jq -er '.[0].name | select(type == "string" and length > 0)')}"
echo "Using Land Grants config release $LAND_GRANTS_TAG"
LAND_GRANTS_TMP="$(mktemp -d)"
trap 'rm -rf "$LAND_GRANTS_TMP"' EXIT
git clone --depth 1 --single-branch --branch "$LAND_GRANTS_TAG" \
  https://github.com/DEFRA/grants-config-land-grants.git "$LAND_GRANTS_TMP"
echo "Land Grants config commit: $(git -C "$LAND_GRANTS_TMP" rev-parse HEAD)"

# Rebuild the input directory so previous runs cannot leave stale config files.
rm -rf test/testconfig
mkdir -p test/testconfig/land-grants@0.0.0
cp -r "$LAND_GRANTS_TMP/configurations/land-grants/." test/testconfig/land-grants@0.0.0/
export LAND_GRANTS_PA3_VERSION
LAND_GRANTS_PA3_VERSION="$(jq -ser '
  map(select(.code == "PA3"))
  | max_by(.semanticVersion | split(".") | map(tonumber))
  | .semanticVersion
  | select(type == "string" and test("^[0-9]+\\.[0-9]+\\.[0-9]+$"))
' test/testconfig/land-grants@0.0.0/actions_config/PA3/*.json)"
echo "Waiting for PA3 $LAND_GRANTS_PA3_VERSION during stack startup"
cp -r configurations/woodland/ test/testconfig/woodland@0.0.0
cp $(dirname "$0")/release.yml test/testconfig/
curl -fsSL \
  https://raw.githubusercontent.com/DEFRA/grants-ui/main/compose/config-broker/local-allowlists/woodland.yaml \
  -o test/testconfig/woodland@0.0.0/grants-ui/allowlist.yaml

"$(dirname "$0")/docker-compose-smoke-test.sh"
