# Release Guide

This guide explains how to create and publish new releases of MCP Tester.

## Prerequisites

1. **NPM Token Setup**
   - Go to [npmjs.com](https://www.npmjs.com/settings/tokens)
   - Create a new automation token
   - Add it to GitHub repository secrets as `NPM_TOKEN`
     - Navigate to: Repository Settings → Secrets and variables → Actions
     - Click "New repository secret"
     - Name: `NPM_TOKEN`
     - Value: Your npm automation token

2. **GitHub Token**
   - The `GITHUB_TOKEN` is automatically provided by GitHub Actions
   - Ensure the workflow has permission to create releases (already configured)

## Release Process

### Option 1: Quick Release (Recommended)

Use this for routine releases (patch, minor, or major version bumps):

```bash
# For patch release (1.0.0 → 1.0.1)
npm run release:patch

# For minor release (1.0.0 → 1.1.0)
npm run release:minor

# For major release (1.0.0 → 2.0.0)
npm run release:major

# For prerelease (1.0.0 → 1.0.1-beta.0)
npm run release:prerelease
```

Then commit and create tag:

```bash
# Commit the version bump and CHANGELOG updates
npm run release:commit

# Create and push the tag
git tag v$(node -p "require('./package.json').version")
git push origin main --tags
```

The release workflow will automatically:
- ✅ Verify version matches tag
- ✅ Run tests across Node.js versions (18, 20, 21)
- ✅ Build the project
- ✅ Run security audits
- ✅ Publish to npm
- ✅ Create GitHub release with notes from CHANGELOG
- ✅ Upload coverage to Codecov

### Option 2: Manual Release

For full control over the release process:

```bash
# 1. Update version in package.json
npm version patch  # or minor, major, prerelease

# 2. Update CHANGELOG.md
#    - Move items from [Unreleased] to new version section
#    - Add date to version header: ## [1.0.1] - 2025-01-20
#    - Keep [Unreleased] section for next changes

# 3. Verify tests pass
npm test

# 4. Build project
npm run build

# 5. Commit changes
git add package.json CHANGELOG.md
git commit -m "chore: release v1.0.1"

# 6. Create and push tag
git tag v1.0.1
git push origin main --tags
```

### Option 3: Custom Version

To set a specific version:

```bash
# Set specific version
npm version 1.2.3

# Update CHANGELOG.md manually
# ... edit CHANGELOG.md ...

# Commit
git add package.json CHANGELOG.md
git commit -m "chore: release v1.2.3"

# Create tag and push
git tag v1.2.3
git push origin main --tags
```

## Version Numbering

Follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (X.0.0): Breaking changes or major features
  - Example: 1.0.0 → 2.0.0
  - Use when: API changes that break compatibility

- **MINOR** (0.X.0): New features, backward compatible
  - Example: 1.0.0 → 1.1.0
  - Use when: Adding new features without breaking changes

- **PATCH** (0.0.X): Bug fixes
  - Example: 1.0.0 → 1.0.1
  - Use when: Fixing bugs without adding features

- **PRERELEASE** (0.0.0-X): Pre-release versions
  - Example: 1.0.0 → 1.1.0-alpha.1
  - Use when: Testing unreleased features

## Pre-Release Checklist

Before creating a release:

### 1. Update CHANGELOG.md
```markdown
## [1.0.1] - 2025-01-20

### Added
- New feature X

### Fixed
- Bug Y fixed

### Changed
- Updated dependency Z

## [Unreleased]

### Added
- Next feature A (stays here)
```

### 2. Run Tests
```bash
npm test
npm run test:coverage
```

### 3. Verify Build
```bash
npm run build
npm run lint
npm run format:check
```

### 4. Check Dependencies
```bash
npm audit
npm outdated
```

### 5. Review Documentation
- [ ] README.md is up to date
- [ ] CHANGELOG.md includes all changes
- [ ] Examples work correctly
- [ ] API documentation is accurate

### 6. Verify Version
```bash
npm version patch  # This updates package.json
cat package.json | grep version
```

## Release Workflow

When you push a version tag (e.g., `v1.0.1`), the release workflow:

1. **Trigger**: Starts automatically on tag push
2. **Verify**: Confirms tag version matches package.json
3. **Test**: Runs all tests across Node.js 18, 20, 21
4. **Build**: Compiles TypeScript to JavaScript
5. **Audit**: Runs security audits
6. **Lint**: Checks code quality
7. **Publish**: Publishes package to npm registry
8. **Release**: Creates GitHub release with CHANGELOG notes
9. **Verify**: Verifies package can be installed from npm

## Monitoring Release Progress

After pushing the tag:

1. Go to: `https://github.com/islobodan/mcp-tester/actions`
2. Click on the "Release" workflow run
3. Monitor the progress through each step

Expected duration: ~5-8 minutes

## Post-Release

### 1. Verify on npm
```bash
# Check if package is available
npm view @slbdn/mcp-tester

# Install and test
npm install @slbdn/mcp-tester@latest
```

### 2. Verify GitHub Release
- Go to: `https://github.com/islobodan/mcp-tester/releases`
- Check release notes are correct
- Verify release assets are attached

### 3. Update Documentation
- Update README.md if needed
- Update examples if API changed
- Update AGENTS.md with new features

### 4. Announce Release
- Create GitHub Discussion
- Post issue about the release
- Update project documentation

## Troubleshooting

### Release Workflow Failed

**Check:**
1. Version tag format (must be `vX.Y.Z`)
2. Version matches package.json exactly
3. Tests are passing locally
4. NPM_TOKEN is set correctly

**Fix:**
```bash
# Delete and recreate tag
git tag -d v1.0.1
git push origin :refs/tags/v1.0.1

# Fix issues, then recreate
git tag v1.0.1
git push origin v1.0.1
```

### NPM Publish Failed

**Check:**
1. NPM_TOKEN has publish permissions
2. Package name is not already taken
3. Version doesn't already exist on npm

**Fix:**
```bash
# Verify token
npm whoami

# Check if version exists
npm view @slbdn/mcp-tester@1.0.1

# If version exists, increment it
npm version patch
git commit package.json -m "chore: increment version"
git tag v1.0.2
git push origin v1.0.2
```

### GitHub Release Not Created

**Check:**
1. GITHUB_TOKEN has write permissions
2. Workflow has permission to create releases
3. Tag format is correct

**Fix:**
- Manually create release from GitHub UI
- Or delete tag and push again

### Tests Failing in CI

**Check:**
1. All tests pass locally
2. Node.js version compatibility
3. Dependencies are installed correctly

**Fix:**
```bash
# Clean and reinstall
rm -rf node_modules package-lock.json
npm install

# Run tests
npm test
```

## Rollback Procedure

If you need to rollback a release:

### 1. Yank NPM Version
```bash
npm deprecate @slbdn/mcp-tester@1.0.1 "Release rollback due to bug"
```

### 2. Delete GitHub Release
1. Go to repository releases page
2. Edit or delete the release
3. Delete the tag if needed

### 3. Create Hotfix
```bash
# Create hotfix branch
git checkout -b hotfix/issue

# Fix issue
git commit -am "fix: critical bug"

# Bump version
npm version patch

# Release
git tag v1.0.2
git push origin v1.0.2
```

## Best Practices

1. **Update CHANGELOG First**
   - Always update CHANGELOG.md before version bump
   - Include all changes in the release
   - Reference issues/PRs if helpful

2. **Test Before Release**
   - Run all tests locally
   - Build the project
   - Install and test locally

3. **Use Semantic Versioning**
   - MAJOR: Breaking changes
   - MINOR: New features
   - PATCH: Bug fixes

4. **Tag Naming**
   - Always use `v` prefix: `v1.0.1`
   - Follow semver format: `vX.Y.Z`

5. **Review Before Pushing**
   - Check CHANGELOG is complete
   - Verify version is correct
   - Confirm tests pass

6. **Monitor Release**
   - Watch GitHub Actions workflow
   - Check npm publication
   - Verify GitHub release creation

7. **Document Breaking Changes**
   - Clearly document breaking changes in CHANGELOG
   - Add migration guide if needed
   - Update examples to use new API

## Example: Complete Release Workflow

```bash
# 1. Update CHANGELOG.md
# Edit CHANGELOG.md, move items from [Unreleased] to new version

# 2. Bump version (patch release)
npm run release:patch

# 3. Verify tests pass
npm test

# 4. Build project
npm run build

# 5. Commit changes
npm run release:commit

# 6. Create and push tag
VERSION=$(node -p "require('./package.json').version")
git tag v$VERSION
git push origin main --tags

# 7. Monitor release at:
# https://github.com/islobodan/mcp-tester/actions
```

## Additional Resources

- [Semantic Versioning](https://semver.org/)
- [npm Publishing](https://docs.npmjs.com/cli/publish)
- [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)
- [GitHub Actions](https://docs.github.com/en/actions)

## Support

If you encounter issues with releases:

1. Check GitHub Actions logs for detailed error messages
2. Review this guide's troubleshooting section
3. Open an issue on GitHub with:
   - Version being released
   - Error messages
   - Steps taken
   - Expected vs actual behavior
