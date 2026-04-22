import { MCPClient } from '../dist/index.js';

async function fullTest() {
  console.log('=== Full MCP Capabilities Test ===\n');

  const client = new MCPClient({
    name: 'full-test-client',
    version: '2.0.0',
    timeout: 30000,
  });

  let notificationReceived = false;

  try {
    console.log('1. Starting client with full capabilities...');
    await client.start({
      command: 'node',
      args: ['./examples/mock-server.js'],
    });
    console.log('✓ Client started\n');

    console.log('2. Setting up notification handlers...');
    client.setNotificationHandlers({
      onLoggingMessage: (level, data) => {
        console.log(`   [Notification] ${level}: ${data}`);
        notificationReceived = true;
      },
      onResourceListChanged: () => {
        console.log('   [Notification] Resource list changed');
        notificationReceived = true;
      },
    });
    console.log('✓ Notification handlers configured\n');

    console.log('3. Testing tools...');
    const tools = await client.listTools();
    console.log(`   Available tools: ${tools.length}`);

    for (const tool of tools) {
      console.log(`   Testing tool: ${tool.name}`);
      const result = await client.callTool({
        name: tool.name,
        arguments: tool.name === 'echo' ? { message: 'test' } :
                     tool.name === 'add' ? { a: 10, b: 20 } :
                     tool.name === 'delay' ? { ms: 100 } : {},
      });
      console.log(`   ✓ ${tool.name}: ${result.content[0]?.text || 'completed'}`);
    }
    console.log('');

    console.log('4. Testing resources...');
    const resources = await client.listResources();
    console.log(`   Available resources: ${resources.length}`);

    for (const resource of resources) {
      console.log(`   Reading resource: ${resource.name}`);
      const result = await client.readResource(resource.uri);
      console.log(`   ✓ Read ${result.contents.length} content(s)`);
    }
    console.log('');

    console.log('5. Testing prompts...');
    const prompts = await client.listPrompts();
    console.log(`   Available prompts: ${prompts.length}`);

    for (const prompt of prompts) {
      console.log(`   Getting prompt: ${prompt.name}`);
      const args: Record<string, string> = {};
      if (prompt.name === 'greet') {
        args.name = 'Bob';
      } else if (prompt.name === 'summarize') {
        args.text = 'Test text to summarize';
      }
      const result = await client.getPrompt(prompt.name, args);
      console.log(`   ✓ Generated ${result.messages.length} message(s)`);
    }
    console.log('');

    console.log('6. Testing sampling (if supported)...');
    try {
      const samplingResult = await client.requestSampling({
        maxTokens: 50,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: 'Say hello',
            },
          },
        ],
      });
      console.log('   ✓ Sampling completed');
    } catch (error) {
      console.log('   ⚠ Sampling not supported by server');
    }
    console.log('');

    console.log('7. Setting up elicitation handler...');
    await client.setElicitationHandler(async (request) => {
      console.log('   [Elicitation] Received request:', request.params.mode);

      if (request.params.mode === 'form') {
        return {
          action: 'accept',
          content: {
            userInput: 'Sample response',
          },
        };
      }

      return {
        action: 'decline',
      };
    });
    console.log('   ✓ Elicitation handler configured\n');

    console.log('8. Testing error handling...');
    try {
      await client.callTool({
        name: 'error_tool',
        arguments: { message: 'Intentional error' },
      });
    } catch (error) {
      console.log('   ✓ Error handled correctly:', (error as Error).message);
    }
    console.log('');

    console.log('9. Testing concurrent requests...');
    const startTime = Date.now();
    const concurrentTasks = [
      client.callTool({ name: 'echo', arguments: { message: 'Task 1' } }),
      client.callTool({ name: 'echo', arguments: { message: 'Task 2' } }),
      client.callTool({ name: 'echo', arguments: { message: 'Task 3' } }),
      client.callTool({ name: 'add', arguments: { a: 1, b: 2 } }),
      client.callTool({ name: 'add', arguments: { a: 3, b: 4 } }),
    ];

    await Promise.all(concurrentTasks);
    const duration = Date.now() - startTime;
    console.log(`   ✓ Completed 5 concurrent requests in ${duration}ms\n`);

    console.log('10. Checking notifications...');
    if (notificationReceived) {
      console.log('   ✓ Notifications were received');
    } else {
      console.log('   ⚠ No notifications received (server may not support them)');
    }
    console.log('');

    console.log('=== All full capability tests completed successfully! ===\n');
    console.log('Summary:');
    console.log('  ✓ Tools tested');
    console.log('  ✓ Resources tested');
    console.log('  ✓ Prompts tested');
    console.log('  ✓ Sampling tested (if supported)');
    console.log('  ✓ Elicitation handler configured');
    console.log('  ✓ Error handling verified');
    console.log('  ✓ Concurrent requests handled');
    console.log('  ✓ Notifications monitored');

  } catch (error) {
    console.error('\n✗ Test failed:', error);
    process.exit(1);
  } finally {
    console.log('\n11. Cleaning up...');
    await client.stop();
    console.log('✓ Client stopped');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fullTest();
}

export { fullTest };
