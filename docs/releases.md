# Releases

## Quick Release

```bash
npm run release:patch     # 1.0.0 → 1.0.1
npm run release:minor     # 1.0.0 → 1.1.0
npm run release:major     # 1.0.0 → 2.0.0
npm run release:prerelease # 1.0.0 → 1.0.1-beta.0
```

## Release Process

1. **Update version** with one of the commands above
2. **Update CHANGELOG.md** — move items from `[Unreleased]` to the new version section
3. **Commit and tag:**
   ```bash
   git add package.json CHANGELOG.md
   git commit -m "chore: release v1.0.1"
   git tag v1.0.1
   git push origin main --tags
   ```
4. The GitHub Actions release workflow automatically:
   - Runs tests across Node.js 18, 20, 21
   - Builds the project
   - Publishes to npm
   - Creates a GitHub release with CHANGELOG notes

## Prerequisites

- `NPM_TOKEN` set in GitHub repository secrets
- CHANGELOG.md updated
- All tests passing locally (`npm test`)
- Build succeeds (`npm run build`)
