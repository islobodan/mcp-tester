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

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build TypeScript
        run: npm run build

      - name: Run tests
        run: npm test

  coverage:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build TypeScript
        run: npm run build

      - name: Run tests with coverage
        run: npm run test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info
          flags: unittests
          name: codecov-umbrella
          fail_ci_if_error: false
          verbose: true

      - name: Generate coverage summary
        id: coverage
        run: |
          SUMMARY=$(cat coverage/coverage-summary.json 2>/dev/null || echo '{}')
          STATEMENTS=$(echo "$SUMMARY" | jq -r '.total.statements.pct // "N/A"')
          BRANCHES=$(echo "$SUMMARY" | jq -r '.total.branches.pct // "N/A"')
          FUNCTIONS=$(echo "$SUMMARY" | jq -r '.total.functions.pct // "N/A"')
          LINES=$(echo "$SUMMARY" | jq -r '.total.lines.pct // "N/A"')

          echo "statements=$STATEMENTS" >> $GITHUB_OUTPUT
          echo "branches=$BRANCHES" >> $GITHUB_OUTPUT
          echo "functions=$FUNCTIONS" >> $GITHUB_OUTPUT
          echo "lines=$LINES" >> $GITHUB_OUTPUT

          {
            echo "## 📊 Test Coverage Report"
            echo ""
            echo "| Metric | Coverage |"
            echo "|--------|----------|"
            echo "| Statements | ${STATEMENTS}% |"
            echo "| Branches | ${BRANCHES}% |"
            echo "| Functions | ${FUNCTIONS}% |"
            echo "| Lines | ${LINES}% |"
            echo ""
            echo "Thresholds: Statements ≥67% · Branches ≥61% · Functions ≥60% · Lines ≥67%"
          } > coverage-comment.md

      - name: Comment PR with coverage
        if: github.event_name == 'pull_request'
        uses: marocchino/sticky-pull-request-comment@v2
        with:
          header: coverage
          path: coverage-comment.md

  lint:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Check formatting
        run: npm run format:check

  security:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run security audit
        run: npm audit --audit-level=moderate
```

### How It Works

| Job | Purpose | Node Version |
|-----|---------|---------------|
| `test` | Run full test suite | Matrix: 18, 20, 21 |
| `coverage` | Generate coverage report, upload to Codecov, comment on PRs | 20 |
| `lint` | ESLint + Prettier checks | 20 |
| `security` | npm audit for vulnerabilities | 20 |

### PR Coverage Comments

Every pull request receives an automated coverage comment like:

> ## 📊 Test Coverage Report
>
> | Metric | Coverage |
> |--------|----------|
> | Statements | 68% |
> | Branches | 61% |
> | Functions | 60% |
> | Lines | 68% |
>
> Thresholds: Statements ≥67% · Branches ≥61% · Functions ≥60% · Lines ≥67%

The comment updates on each push (using `sticky-pull-request-comment` with a `header` key).

### Coverage Thresholds

Jest enforces minimum coverage thresholds in `jest.config.js`:

| File | Stmts | Branch | Func | Lines |
|------|-------|--------|------|-------|
| Global | 67% | 61% | 60% | 67% |
| `assert.ts` | 96% | 87% | 100% | 96% |
| `matchers.ts` | 68% | 28% | 42% | 64% |
| `MCPClient.ts` | 68% | 54% | 75% | 68% |
| `logger.ts` | 84% | 82% | 94% | 83% |
| `masking.ts` | 100% | 88% | 100% | 100% |
| `errors.ts` | 100% | 100% | 100% | 100% |
| `env.ts` | 80% | 100% | 60% | 87% |
| `mock-server.ts` | 96% | 64% | 94% | 96% |

If coverage drops below these thresholds, the `test:coverage` command will exit with an error — failing the CI build.

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

  coverage:
    docker:
      - image: cimg/node:20
    steps:
      - checkout
      - run: npm ci
      - run: npm run build
      - run: npm run test:coverage
      - store_artifacts:
          path: coverage
          destination: coverage

workflows:
  version: 2
  test_and_coverage:
    jobs:
      - test
      - coverage
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
    stage('Coverage') {
      steps {
        sh 'npm run test:coverage'
        publishHTML(target: [
          reportDir: 'coverage/lcov-report',
          reportFiles: 'index.html',
          reportName: 'Coverage'
        ])
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