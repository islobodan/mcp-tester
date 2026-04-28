/**
 * Performance benchmarks for MCP Tester.
 *
 * Run with: npm run benchmark
 *
 * These benchmarks measure:
 * - Connection startup time
 * - Tool call latency (single and batch)
 * - Concurrent operations throughput
 * - Large payload handling
 * - Sequential operation chains
 * - Resource and prompt listing latency
 * - Full client lifecycle
 *
 * Benchmarks run against the mock server for consistent, reproducible results.
 */

import { performance } from 'perf_hooks';
import { MCPClient } from '../client/MCPClient.js';

// Benchmark result type
interface BenchmarkResult {
  name: string;
  runs: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  p95: number;
  p99: number;
  unit: string;
}

type BenchmarkFn = (client: MCPClient) => Promise<void>;

/**
 * Run a benchmark multiple times and collect timing statistics.
 */
async function runBenchmark(
  name: string,
  fn: BenchmarkFn,
  runs: number,
  warmupRuns: number,
  unit: string = 'ms'
): Promise<BenchmarkResult> {
  // Warmup runs (not counted)
  const warmupClient = new MCPClient({
    name: 'benchmark-warmup',
    version: '1.0.0',
    logLevel: 'error',
  });
  await warmupClient.start({ command: 'node', args: ['./examples/mock-server.js'] });
  for (let i = 0; i < warmupRuns; i++) {
    await fn(warmupClient);
  }
  await warmupClient.stop();

  // Actual benchmark runs
  const timings: number[] = [];
  const client = new MCPClient({ name: 'benchmark', version: '1.0.0', logLevel: 'error' });
  await client.start({ command: 'node', args: ['./examples/mock-server.js'] });

  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    await fn(client);
    const end = performance.now();
    timings.push(end - start);
  }

  await client.stop();

  // Calculate statistics
  timings.sort((a, b) => a - b);
  const sum = timings.reduce((acc, t) => acc + t, 0);
  const mean = sum / timings.length;
  const median = timings[Math.floor(timings.length / 2)];
  const p95Index = Math.floor(timings.length * 0.95);
  const p99Index = Math.floor(timings.length * 0.99);

  return {
    name,
    runs,
    min: timings[0],
    max: timings[timings.length - 1],
    mean,
    median,
    p95: timings[p95Index],
    p99: timings[p99Index],
    unit,
  };
}

/**
 * Format a number with a fixed number of decimal places.
 */
function fmt(n: number, decimals: number = 2): string {
  return n.toFixed(decimals);
}

/**
 * Print section header.
 */
function section(title: string): void {
  console.log(`\n${title}`);
  console.log(
    '  ' +
      'Benchmark'.padEnd(45) +
      'Min (ms)'.padEnd(8) +
      'Mean (ms)'.padEnd(9) +
      'Median (ms)'.padEnd(10) +
      'P95 (ms)'.padEnd(9) +
      'P99 (ms)'.padEnd(9) +
      'Unit'
  );
  console.log('  ' + '-'.repeat(100));
}

// ─────────────────────────────────────────────────────────────────────────────
// BENCHMARKS
// ─────────────────────────────────────────────────────────────────────────────

const BENCHMARK_RUNS = 50;
const WARMUP_RUNS = 3;

async function main(): Promise<void> {
  console.log('\n🧪 MCP Tester Performance Benchmarks');
  console.log(`   Runs: ${BENCHMARK_RUNS} per benchmark (${WARMUP_RUNS} warmup runs)\n`);

  const results: BenchmarkResult[] = [];

  // ── 1. Connection Startup ──────────────────────────────────────────────────
  section('1. Connection Startup');

  results.push(
    await runBenchmark(
      'Reconnect to mock server',
      async (client) => {
        await client.stop();
        await client.start({ command: 'node', args: ['./examples/mock-server.js'] });
      },
      BENCHMARK_RUNS,
      WARMUP_RUNS
    )
  );

  results.push(
    await runBenchmark(
      'Disconnect from server',
      async (client) => {
        await client.stop();
        await client.start({ command: 'node', args: ['./examples/mock-server.js'] });
      },
      BENCHMARK_RUNS,
      WARMUP_RUNS
    )
  );

  // ── 2. Tool Call Latency ───────────────────────────────────────────────────
  section('2. Tool Call Latency');

  results.push(
    await runBenchmark(
      'Call echo tool (string)',
      async (client) => {
        await client.callTool({ name: 'echo', arguments: { message: 'hello' } });
      },
      BENCHMARK_RUNS,
      WARMUP_RUNS
    )
  );

  results.push(
    await runBenchmark(
      'Call add tool (numbers)',
      async (client) => {
        await client.callTool({ name: 'add', arguments: { a: 1, b: 2 } });
      },
      BENCHMARK_RUNS,
      WARMUP_RUNS
    )
  );

  results.push(
    await runBenchmark(
      'Call delay tool (10ms simulated)',
      async (client) => {
        await client.callTool({ name: 'delay', arguments: { ms: 10 } });
      },
      BENCHMARK_RUNS,
      WARMUP_RUNS
    )
  );

  // ── 3. Batch Tool Calls (sequential) ──────────────────────────────────────
  section('3. Batch Tool Calls (sequential)');

  results.push(
    await runBenchmark(
      'Call 5 tools sequentially',
      async (client) => {
        await client.callTool({ name: 'echo', arguments: { message: '1' } });
        await client.callTool({ name: 'echo', arguments: { message: '2' } });
        await client.callTool({ name: 'echo', arguments: { message: '3' } });
        await client.callTool({ name: 'echo', arguments: { message: '4' } });
        await client.callTool({ name: 'echo', arguments: { message: '5' } });
      },
      BENCHMARK_RUNS,
      WARMUP_RUNS
    )
  );

  results.push(
    await runBenchmark(
      'Call 10 tools sequentially',
      async (client) => {
        for (let i = 0; i < 10; i++) {
          await client.callTool({ name: 'echo', arguments: { message: String(i) } });
        }
      },
      BENCHMARK_RUNS,
      WARMUP_RUNS
    )
  );

  // ── 4. Concurrent Operations ───────────────────────────────────────────────
  section('4. Concurrent Operations (parallel)');

  results.push(
    await runBenchmark(
      'Call 5 tools in parallel',
      async (client) => {
        await Promise.all([
          client.callTool({ name: 'echo', arguments: { message: '1' } }),
          client.callTool({ name: 'echo', arguments: { message: '2' } }),
          client.callTool({ name: 'echo', arguments: { message: '3' } }),
          client.callTool({ name: 'echo', arguments: { message: '4' } }),
          client.callTool({ name: 'echo', arguments: { message: '5' } }),
        ]);
      },
      BENCHMARK_RUNS,
      WARMUP_RUNS
    )
  );

  results.push(
    await runBenchmark(
      'Call 10 tools in parallel',
      async (client) => {
        await Promise.all(
          Array.from({ length: 10 }, (_, i) =>
            client.callTool({ name: 'echo', arguments: { message: String(i) } })
          )
        );
      },
      BENCHMARK_RUNS,
      WARMUP_RUNS
    )
  );

  results.push(
    await runBenchmark(
      'Call 20 tools in parallel',
      async (client) => {
        await Promise.all(
          Array.from({ length: 20 }, (_, i) =>
            client.callTool({ name: 'echo', arguments: { message: String(i) } })
          )
        );
      },
      BENCHMARK_RUNS,
      WARMUP_RUNS
    )
  );

  // ── 5. Large Payload Handling ──────────────────────────────────────────────
  section('5. Large Payload Handling');

  results.push(
    await runBenchmark(
      'Call echo with 10KB payload',
      async (client) => {
        const payload = 'x'.repeat(10 * 1024);
        await client.callTool({ name: 'echo', arguments: { message: payload } });
      },
      BENCHMARK_RUNS,
      WARMUP_RUNS
    )
  );

  results.push(
    await runBenchmark(
      'Call echo with 100KB payload',
      async (client) => {
        const payload = 'x'.repeat(100 * 1024);
        await client.callTool({ name: 'echo', arguments: { message: payload } });
      },
      BENCHMARK_RUNS,
      WARMUP_RUNS
    )
  );

  results.push(
    await runBenchmark(
      'Call echo with 1MB payload',
      async (client) => {
        const payload = 'x'.repeat(1024 * 1024);
        await client.callTool({ name: 'echo', arguments: { message: payload } });
      },
      Math.floor(BENCHMARK_RUNS / 5), // fewer runs for large payloads
      1
    )
  );

  // ── 6. Metadata Listing ─────────────────────────────────────────────────────
  section('6. Metadata Listing (tools / resources / prompts)');

  results.push(
    await runBenchmark(
      'List all tools',
      async (client) => {
        await client.listTools();
      },
      BENCHMARK_RUNS,
      WARMUP_RUNS
    )
  );

  results.push(
    await runBenchmark(
      'List all resources',
      async (client) => {
        await client.listResources();
      },
      BENCHMARK_RUNS,
      WARMUP_RUNS
    )
  );

  results.push(
    await runBenchmark(
      'List all prompts',
      async (client) => {
        await client.listPrompts();
      },
      BENCHMARK_RUNS,
      WARMUP_RUNS
    )
  );

  results.push(
    await runBenchmark(
      'Get greet prompt with args',
      async (client) => {
        await client.getPrompt('greet', { name: 'Alice' });
      },
      BENCHMARK_RUNS,
      WARMUP_RUNS
    )
  );

  // ── 7. Full Client Lifecycle ─────────────────────────────────────────────────
  section('7. Full Client Lifecycle');

  results.push(
    await runBenchmark(
      'Full lifecycle: start → list → call → stop',
      async (_client) => {
        const c = new MCPClient({
          name: 'benchmark-lifecycle',
          version: '1.0.0',
          logLevel: 'error',
        });
        await c.start({ command: 'node', args: ['./examples/mock-server.js'] });
        await c.listTools();
        await c.callTool({ name: 'echo', arguments: { message: 'ping' } });
        await c.stop();
      },
      BENCHMARK_RUNS,
      WARMUP_RUNS
    )
  );

  results.push(
    await runBenchmark(
      'Full lifecycle: start → list → 5 parallel → stop',
      async (_client) => {
        const c = new MCPClient({
          name: 'benchmark-lifecycle',
          version: '1.0.0',
          logLevel: 'error',
        });
        await c.start({ command: 'node', args: ['./examples/mock-server.js'] });
        await c.listTools();
        await Promise.all([
          c.callTool({ name: 'echo', arguments: { message: '1' } }),
          c.callTool({ name: 'echo', arguments: { message: '2' } }),
          c.callTool({ name: 'echo', arguments: { message: '3' } }),
          c.callTool({ name: 'echo', arguments: { message: '4' } }),
          c.callTool({ name: 'echo', arguments: { message: '5' } }),
        ]);
        await c.stop();
      },
      BENCHMARK_RUNS,
      WARMUP_RUNS
    )
  );

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n');
  console.log('─'.repeat(100));
  console.log(
    'Legend: Min = fastest run, Mean = average across all runs, Median = middle run, P95/P99 = 95th/99th percentile'
  );
  console.log('─'.repeat(100));

  // Print all results
  for (const r of results) {
    const ops = r.unit === 'ms' ? `~${fmt(1000 / r.mean, 0)} ops/s` : '';
    console.log(
      `  ${r.name.padEnd(45)} ${fmt(r.min).padStart(7)} ${fmt(r.mean).padStart(8)} ` +
        `${fmt(r.median).padStart(8)} ${fmt(r.p95).padStart(8)} ${fmt(r.p99).padStart(8)}  ` +
        `${r.unit.padEnd(3)}  ${ops}`
    );
  }

  // Print summary
  console.log('\n📊 Summary:\n');

  const singleOp = results.filter(
    (r) =>
      !r.name.includes('sequential') &&
      !r.name.includes('parallel') &&
      !r.name.includes('lifecycle') &&
      !r.name.includes('Disconnect') &&
      !r.name.includes('Reconnect')
  );

  const fast = singleOp.sort((a, b) => a.mean - b.mean)[0];
  const slow = singleOp.sort((a, b) => b.mean - a.mean)[0];

  if (fast) console.log(`  Fastest operation : ${fast.name} (${fmt(fast.mean)} ms avg)`);
  if (slow) console.log(`  Slowest operation: ${slow.name} (${fmt(slow.mean)} ms avg)`);

  const connect = results.find((r) => r.name === 'Reconnect to mock server');
  if (connect)
    console.log(`  Reconnect overhead: ~${fmt(connect.mean)} ms (process spawn + stdio handshake)`);

  const concurrent = results.find((r) => r.name === 'Call 10 tools in parallel');
  if (concurrent) {
    const throughput = (10 * 1000) / concurrent.mean;
    console.log(`  Parallel throughput: ~${fmt(throughput, 0)} tool calls/second (10 parallel)`);
  }

  const lifecycle = results.find((r) => r.name === 'Full lifecycle: start → list → call → stop');
  if (lifecycle) {
    console.log(`  Full lifecycle cost: ~${fmt(lifecycle.mean)} ms (start + list + call + stop)`);
  }

  const largePayload = results.find((r) => r.name === 'Call echo with 1MB payload');
  if (largePayload) {
    const throughput = (1024 * 1024 * 8) / (largePayload.mean / 1000) / 1_000_000;
    console.log(`  1MB payload throughput: ~${fmt(throughput, 1)} Mbps`);
  }

  console.log('\n');
}

main().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
