import { MCPClient } from '../dist/index.js';

async function basicTest() {
  console.log('=== Basic MCP Client Test ===\n');

  const client = new MCPClient({
    name: 'basic-test-client',
    version: '1.0.0',
  });

  try {
    console.log('1. Starting MCP server...');
    await client.start({
      command: 'node',
      args: ['./examples/mock-server.js'],
      env: {
        NODE_ENV: 'test',
      },
    });
    console.log('✓ Server started successfully\n');

    console.log('2. Listing available tools...');
    const tools = await client.listTools();
    console.log(`✓ Found ${tools.length} tools:`);
    tools.forEach((tool) => {
      console.log(`   - ${tool.name}: ${tool.description}`);
    });
    console.log('');

    console.log('3. Calling echo tool...');
    const echoResult = await client.callTool({
      name: 'echo',
      arguments: { message: 'Hello from MCP!' },
    });
    console.log('✓ Echo result:', echoResult.content[0].text);
    console.log('');

    console.log('4. Calling add tool...');
    const addResult = await client.callTool({
      name: 'add',
      arguments: { a: 42, b: 58 },
    });
    console.log('✓ Add result:', addResult.content[0].text);
    console.log('');

    console.log('5. Listing resources...');
    const resources = await client.listResources();
    console.log(`✓ Found ${resources.length} resources:`);
    resources.forEach((resource) => {
      console.log(`   - ${resource.name}: ${resource.uri}`);
    });
    console.log('');

    console.log('6. Reading a resource...');
    const resourceResult = await client.readResource('text://example');
    console.log('✓ Resource content:', resourceResult.contents[0].text);
    console.log('');

    console.log('7. Listing prompts...');
    const prompts = await client.listPrompts();
    console.log(`✓ Found ${prompts.length} prompts:`);
    prompts.forEach((prompt) => {
      console.log(`   - ${prompt.name}: ${prompt.description}`);
    });
    console.log('');

    console.log('8. Getting a prompt...');
    const promptResult = await client.getPrompt('greet', { name: 'Alice' });
    console.log('✓ Prompt message:', promptResult.messages[0].content.text);
    console.log('');

    console.log('All tests passed! ✓');

  } catch (error) {
    console.error('✗ Test failed:', error);
    process.exit(1);
  } finally {
    console.log('\n9. Stopping client...');
    await client.stop();
    console.log('✓ Client stopped');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  basicTest();
}

export { basicTest };
