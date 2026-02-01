#!/usr/bin/env node

import { spawn } from 'child_process';

const server = spawn('node', [process.argv[2] || 'mock-server.js'], {
  stdio: ['pipe', 'pipe', 'inherit'],
});

server.on('error', (error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

process.on('SIGINT', () => {
  server.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  server.kill();
  process.exit(0);
});
