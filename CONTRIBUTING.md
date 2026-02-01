# Contributing to MCP Tester

Thank you for your interest in contributing to MCP Tester! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9
- Git

### Setup Development Environment

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/mcp-tester.git
   cd mcp-tester
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Build the project:
   ```bash
   npm run build
   ```

## Development Workflow

### Branch Naming

- `feature/your-feature-name` - New features
- `bugfix/bug-description` - Bug fixes
- `refactor/refactor-description` - Code refactoring
- `docs/documentation-update` - Documentation updates
- `test/test-improvements` - Test improvements

### Making Changes

1. Create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and write tests:
   ```bash
   # Write your code
   npm run build
   npm test
   npm run lint
   ```

3. Format your code:
   ```bash
   npm run format
   ```

4. Commit your changes:
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

5. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

6. Create a Pull Request

### Commit Message Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` A new feature
- `fix:` A bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks
- `perf:` Performance improvements

Examples:
```
feat: add HTTP transport support
fix: resolve timeout handling issue
docs: update API documentation
test: add integration tests
```

## Code Style

### TypeScript

- Use TypeScript for all new code
- Enable strict mode checking
- Use interfaces for object shapes
- Avoid `any` types
- Use proper type assertions

### Formatting

We use [Prettier](https://prettier.io/) for code formatting:
```bash
npm run format      # Format code
npm run format:check # Check formatting
```

### Linting

We use [ESLint](https://eslint.org/) for linting:
```bash
npm run lint        # Run linter
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Writing Tests

- Write unit tests for all new functionality
- Aim for >80% code coverage
- Test both success and error cases
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

Example:
```typescript
describe('MCPClient', () => {
  describe('listTools', () => {
    it('should return list of tools', async () => {
      // Arrange
      const client = new MCPClient();
      await client.start({ command: 'node', args: ['server.js'] });

      // Act
      const tools = await client.listTools();

      // Assert
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });
  });
});
```

## Documentation

### Code Comments

- Add JSDoc comments for all public APIs
- Comment complex logic
- Explain "why", not "what"
- Keep comments up-to-date with code

### README Updates

- Update README for user-facing changes
- Add examples for new features
- Update version compatibility notes
- Keep installation instructions current

### CHANGELOG

- Update CHANGELOG.md for all changes
- Follow [Keep a Changelog](https://keepachangelog.com/) format
- Group changes by type: Added, Changed, Deprecated, Removed, Fixed, Security

## Pull Request Process

### Before Submitting

1. Run all checks:
   ```bash
   npm run build
   npm run lint
   npm test
   npm run format:check
   ```

2. Ensure all tests pass

3. Update documentation (README, CHANGELOG)

4. Add tests for new functionality

### PR Description

Include in your PR description:
- Clear description of changes
- Motivation for the change
- Breaking changes (if any)
- Related issues
- Screenshots (if applicable)
- Testing performed

### Review Process

- Maintainers will review your PR
- Address feedback promptly
- Keep the PR focused and small
- Respond to all review comments

## Project Structure

```
mcp-tester/
├── src/
│   ├── client/          # Main client implementation
│   ├── utils/           # Utility functions
│   └── __tests__/       # Test files
├── examples/           # Usage examples
├── dist/              # Compiled output
└── .github/           # GitHub Actions workflows
```

## Issue Reporting

### Bug Reports

Include:
- Clear description of the bug
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details (Node.js version, OS)
- Code example or reproduction case
- Log output (if available)

### Feature Requests

Include:
- Clear description of the feature
- Use case and motivation
- Proposed implementation
- Alternative approaches considered

## Questions?

- Open an issue for questions
- Join our discussions
- Check existing documentation

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Thank You!

Thank you for contributing to MCP Tester! Your contributions help make this project better for everyone.
