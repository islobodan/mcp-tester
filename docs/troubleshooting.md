# Troubleshooting

## Common Issues

### "Client not started" Error

**Problem:** Calling methods before `start()`

```typescript
// ✗ Wrong
const client = new MCPClient();
const tools = await client.listTools(); // Error!

// ✓ Correct
const client = new MCPClient();
await client.start({ command: 'node', args: ['./server.js'] });
const tools = await client.listTools(); // Works
```

### Timeout Errors

**Problem:** Requests timing out

```typescript
// Increase global timeout
const client = new MCPClient({ timeout: 60000 });

// Or per-call timeout
await client.callTool({
  name: 'slow-tool',
  arguments: {},
  timeout: 30000,
});
```

### Server Process Fails to Start

**Problem:** Server command not found or crashes immediately

```bash
# Verify server exists and runs standalone
ls -la ./my-server.js
node ./my-server.js
```

### "Module not found" Errors

**Problem:** ESM import without `.js` extension

```typescript
// ✗ Wrong
import { MCPClient } from './client/MCPClient';

// ✓ Correct
import { MCPClient } from './client/MCPClient.js';
```

### TypeScript Build Errors

```bash
# Clean and rebuild
rm -rf dist/
npm run build
```

### Tests Fail in CI but Pass Locally

- Check Node.js version matches (>= 18)
- Verify server paths are correct
- Ensure environment variables are set
- Check `maxWorkers: 1` in Jest config (avoids SIGSEGV crashes)

## Debug Mode

Enable verbose logging:

```typescript
const client = new MCPClient({
  logLevel: 'debug',
  enableProtocolLogging: true,
});
```

All log output goes to stderr.

## Test Coverage

```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

Coverage thresholds: **80%** for branches, functions, lines, and statements.

## Known Limitations

- Only supports **stdio** transport (HTTP not yet implemented)
- Designed for **Node.js** servers (other runtimes may need adjustments)
- Mock server is minimal (real servers may behave differently)
