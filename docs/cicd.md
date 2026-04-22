# CI/CD Integration

Using MCP Tester in continuous integration pipelines.

## GitHub Actions

Create `.github/workflows/test.yml`:

```yaml
name: Test MCP Server

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18, 20, 21]

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}

      - name: Install dependencies
        run: npm ci

      - name: Build TypeScript
        run: npm run build

      - name: Run tests
        run: npm test

      - name: Run tests with coverage
        run: npm run test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          flags: unittests
          name: codecov-umbrella
```

## CircleCI

Create `.circleci/config.yml`:

```yaml
version: 2.1
jobs:
  test:
    docker:
      - image: cimg/node:20
    steps:
      - checkout
      - run: npm ci
      - run: npm run build
      - run: npm test
```

## Jenkins

Create `Jenkinsfile`:

```groovy
pipeline {
  agent any
  stages {
    stage('Test') {
      steps {
        sh 'npm ci'
        sh 'npm run build'
        sh 'npm test'
      }
    }
  }
}
```

## Using the CLI in CI

```bash
# Quick smoke test
npx @slbdn/mcp-tester test node ./server.js

# List tools and verify
npx @slbdn/mcp-tester list-tools node ./server.js --json

# Call a tool and check result
npx @slbdn/mcp-tester call-tool health-check node ./server.js --json
```
