# Node.js Compatibility

## Supported Versions

| Node.js Version | Status | Notes |
|----------------|--------|-------|
| 18.x | ✅ Fully Supported | Minimum required version |
| 20.x (LTS) | ✅ Fully Supported | **Recommended** |
| 21.x | ✅ Fully Supported | Latest stable |
| 22.x+ | ✅ Compatible | Tested, works |

## Requirements

- **Node.js** >= 18
- **npm** >= 9
- ES2022 Modules (ESM)
- Async/await support

The `package.json` enforces the minimum version:

```json
{
  "engines": {
    "node": ">=18"
  }
}
```

## TypeScript Compatibility

Targets TypeScript 5.3+ with ES2022 output.

## Platform Support

- ✅ macOS (Intel & Apple Silicon)
- ✅ Linux (Ubuntu, Debian, CentOS, Alpine)
- ✅ Windows 10/11 (via WSL or native Node.js)

## CI/CD Version Specification

**GitHub Actions:**
```yaml
- uses: actions/setup-node@v3
  with:
    node-version: '20'
```

**CircleCI:**
```yaml
docker:
  - image: cimg/node:20.11.0
```

**Jenkins:**
```groovy
tools {
  nodejs 'Node.js 20.11.0'
}
```

## Upgrading Node.js

**Using nvm:**
```bash
nvm install 20
nvm use 20
nvm alias default 20
```

**Using n:**
```bash
n 20
```

## Known Issues

| Version | Issue | Workaround |
|---------|-------|------------|
| < 18 | Not supported | Upgrade to 18+ |
| 18.0–18.16 | Potential ESM issues | Use 18.17+ |
| Any | Memory limits for large ops | Increase `--max-old-space-size` |
