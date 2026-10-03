# Build from the repository root so the GAS schema (configurations/woodland/gas/gas.json)
# can be copied in; the spec validates submitted applications against it.
# Example: docker build -f test/grants-ui/Dockerfile .
FROM mcr.microsoft.com/playwright:v1.59.1-noble

ENV TZ="Europe/London"

WORKDIR /app/test/grants-ui

COPY test/grants-ui/package*.json test/grants-ui/.npmrc ./
RUN npm ci

COPY configurations/woodland/gas/gas.json /app/configurations/woodland/gas/gas.json
COPY test/grants-ui/playwright.*.config.js ./
COPY test/grants-ui/test ./test

CMD ["npm", "run", "test:ci"]
