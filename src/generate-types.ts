/**
 * TypeScript type generator — connects to an MCP server, reads tool schemas,
 * and generates a `.d.ts` TypeScript declaration file with typed interfaces.
 *
 * @module generate-types
 */

import { MCPClient } from './client/MCPClient.js';
import type { Tool, Resource, Prompt } from '@modelcontextprotocol/sdk/types.js';
import { readFileSync } from 'fs';
import { join } from 'path';

// ─── Options ────────────────────────────────────────────────────────

/**
 * Options for type generation.
 */
export interface GenerateTypesOptions {
  /** Command to run the MCP server. */
  command: string;
  /** Arguments for the server command. */
  args?: string[];
  /** Timeout in ms for connecting to the server. @defaultValue 30000 */
  timeout?: number;
  /** Include resource URI types. @defaultValue true */
  includeResources?: boolean;
  /** Include prompt argument types. @defaultValue true */
  includePrompts?: boolean;
  /** Module name for the import type. @defaultValue '@slbdn/mcp-tester' */
  moduleName?: string;
}

// ─── JSON Schema → TypeScript ───────────────────────────────────────

type JsonSchema = Record<string, unknown>;

/**
 * Convert a JSON Schema type to a TypeScript type string.
 * Handles primitives, arrays, objects, enums, nullable, and compositions.
 * Exported for unit testing.
 */
export function schemaToType(schema: JsonSchema, indent: number = 0): string {
  // Handle enum
  if (schema['enum'] && Array.isArray(schema['enum']) && schema['enum'].length > 0) {
    return (schema['enum'] as unknown[])
      .map((v) => (typeof v === 'string' ? `'${escapeString(v)}'` : String(v)))
      .join(' | ');
  }

  // Handle oneOf / anyOf → union type
  if (schema.oneOf && Array.isArray(schema.oneOf)) {
    return (schema.oneOf as JsonSchema[])
      .map((s) => wrapNullable(schemaToType(s, indent), s))
      .join(' | ');
  }
  if (schema.anyOf && Array.isArray(schema.anyOf)) {
    return (schema.anyOf as JsonSchema[])
      .map((s) => wrapNullable(schemaToType(s, indent), s))
      .join(' | ');
  }

  // Handle allOf → intersection
  if (schema.allOf && Array.isArray(schema.allOf)) {
    return (schema.allOf as JsonSchema[]).map((s) => schemaToType(s, indent)).join(' & ');
  }

  // Handle $ref
  if (schema.$ref && typeof schema.$ref === 'string') {
    return refToTypeName(schema.$ref);
  }

  const type = schema.type as string | undefined;

  // Handle const
  if (schema.const !== undefined) {
    if (typeof schema.const === 'string') return `'${escapeString(schema.const)}'`;
    if (typeof schema.const === 'number' || typeof schema.const === 'boolean')
      return String(schema.const);
    return JSON.stringify(schema.const);
  }

  // No type — check if it has properties (implicit object)
  if (!type) {
    if (schema.properties) return objectToType(schema, indent);
    if (schema.additionalProperties) {
      const valType = schemaToType(
        typeof schema.additionalProperties === 'object'
          ? (schema.additionalProperties as JsonSchema)
          : {},
        indent
      );
      return `Record<string, ${valType}>`;
    }
    return 'unknown';
  }

  switch (type) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
    case 'array':
      return arrayToType(schema, indent);
    case 'object':
      return objectToType(schema, indent);
    default:
      return 'unknown';
  }
}

/**
 * Generate an array type from a schema.
 */
function arrayToType(schema: JsonSchema, indent: number): string {
  if (schema.items && typeof schema.items === 'object' && !Array.isArray(schema.items)) {
    const itemType = schemaToType(schema.items as JsonSchema, indent);
    // Wrap complex types in parens
    if (itemType.includes('|') || itemType.includes('&') || itemType.includes('{')) {
      return `Array<${itemType}>`;
    }
    return `${itemType}[]`;
  }
  if (Array.isArray(schema.items)) {
    const types = (schema.items as JsonSchema[]).map((s) => schemaToType(s, indent));
    return `[${types.join(', ')}]`;
  }
  return 'unknown[]';
}

/**
 * Generate an object type from a schema.
 */
function objectToType(schema: JsonSchema, indent: number): string {
  const props = schema.properties as Record<string, JsonSchema> | undefined;
  const required = new Set((schema.required as string[]) || []);
  const pad = '  '.repeat(indent + 1);
  const closePad = '  '.repeat(indent);

  if (!props || Object.keys(props).length === 0) {
    // Check additionalProperties
    if (schema.additionalProperties) {
      const valType =
        typeof schema.additionalProperties === 'object'
          ? schemaToType(schema.additionalProperties as JsonSchema, indent)
          : 'unknown';
      return `Record<string, ${valType}>`;
    }
    return 'Record<string, unknown>';
  }

  const lines: string[] = ['{'];

  for (const [name, propSchema] of Object.entries(props)) {
    const isRequired = required.has(name);
    const tsType = schemaToType(propSchema, indent + 1);
    const opt = isRequired ? '' : '?';
    const desc = propSchema.description
      ? `${pad}/** ${String(propSchema.description).replace(/\*\//g, '*\\/')} */\n`
      : '';
    lines.push(`${desc}${pad}${escapePropertyName(name)}${opt}: ${tsType};`);
  }

  lines.push(`${closePad}}`);
  return lines.join('\n');
}

/**
 * Wrap a type in `null` union if the schema is nullable.
 */
function wrapNullable(tsType: string, schema: JsonSchema): string {
  if (schema.type && schema.type !== 'null') return tsType;
  // JSON Schema nullable conventions
  if (schema.nullable === true) return `${tsType} | null`;
  return tsType;
}

/**
 * Convert a $ref path like "#/definitions/MyType" to "MyType".
 */
function refToTypeName(ref: string): string {
  const parts = ref.split('/');
  return parts[parts.length - 1];
}

/**
 * Escape a string for use in a TypeScript string literal.
 */
function escapeString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** Escape a property name for use in TypeScript (quote if needed). Exported for testing. */
export function escapePropertyName(name: string): string {
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) return name;
  return `'${escapeString(name)}'`;
}

/** Sanitize a tool/prompt name into a valid TypeScript identifier. Exported for testing. */
export function toTypeName(name: string): string {
  // Split on non-alphanumeric, capitalize each segment
  const parts = name.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  return parts
    .map((p, i) => {
      const lower = p.toLowerCase();
      return i === 0
        ? lower.charAt(0).toUpperCase() + lower.slice(1)
        : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
}

// ─── Type File Generation ───────────────────────────────────────────

/**
 * Generate TypeScript interfaces for a single tool.
 */
function generateToolInterface(tool: Tool): string {
  const typeName = toTypeName(tool.name);
  const desc = tool.description ? `/** ${tool.description} */\n` : '';
  const schema = tool.inputSchema as JsonSchema;

  // If the schema has properties, generate an interface; otherwise unknown
  if (schema && schema.properties && typeof schema.properties === 'object') {
    const tsType = schemaToType(schema, 0);
    return `${desc}export interface ${typeName}Args ${tsType}`;
  }

  return `${desc}export type ${typeName}Args = Record<string, unknown>`;
}

/**
 * Generate a ToolInfo interface for a tool (name + arguments type).
 */
function generateToolInfoType(tool: Tool): string {
  const typeName = toTypeName(tool.name);
  return `  | { name: '${tool.name}'; arguments: ${typeName}Args }`;
}

/**
 * Generate type for a resource.
 */
function generateResourceType(resource: Resource): string {
  const desc = resource.description ? ` /** ${resource.description} */` : '';
  return `  | '${resource.uri}'${desc}`;
}

/**
 * Generate type for a prompt's arguments.
 */
function generatePromptType(prompt: Prompt): string {
  const typeName = toTypeName(prompt.name);
  const desc = prompt.description ? `/** ${prompt.description} */\n` : '';

  if (!prompt.arguments || !Array.isArray(prompt.arguments) || prompt.arguments.length === 0) {
    return `${desc}export type ${typeName}Args = Record<string, never>`;
  }

  const lines: string[] = ['{'];
  for (const arg of prompt.arguments) {
    const opt = arg.required ? '' : '?';
    const argDesc = arg.description ? ` /** ${arg.description} */` : '';
    lines.push(`  ${escapePropertyName(arg.name)}${opt}: string;${argDesc}`);
  }
  lines.push('}');

  return `${desc}export interface ${typeName}Args ${lines.join('\n')}`;
}

/**
 * Generate prompt info type.
 */
function generatePromptInfoType(prompt: Prompt): string {
  const typeName = toTypeName(prompt.name);
  return `  | { name: '${prompt.name}'; arguments: ${typeName}Args }`;
}

/**
 * Build the complete type declaration file.
 */
function buildTypeFile(
  tools: Tool[],
  resources: Resource[],
  prompts: Prompt[],
  options: GenerateTypesOptions
): string {
  const moduleName = options.moduleName || '@slbdn/mcp-tester';
  const includeResources = options.includeResources !== false;
  const includePrompts = options.includePrompts !== false;
  const includeTools = tools.length > 0;

  const sections: string[] = [];

  // Header
  sections.push('/**');
  sections.push(` * TypeScript types generated from MCP server.`);
  sections.push(` *`);
  sections.push(` * Server: ${options.command}${options.args ? ' ' + options.args.join(' ') : ''}`);
  sections.push(
    ` * Tools: ${tools.length} | Resources: ${resources.length} | Prompts: ${prompts.length}`
  );
  sections.push(` *`);
  sections.push(` * Generated by @slbdn/mcp-tester v${getVersion()}`);
  sections.push(
    ` * Re-generate: npx mcp-tester generate-types -- ${options.command}${options.args ? ' ' + options.args.join(' ') : ''}`
  );
  sections.push(' */');
  sections.push('');

  // Tool argument interfaces
  if (includeTools) {
    sections.push('// ─── Tool Argument Types ─────────────────────────────────────────');
    sections.push('');
    for (const tool of tools) {
      sections.push(generateToolInterface(tool));
      sections.push('');
    }

    // Tool name union
    sections.push('/** Union of all tool names */');
    sections.push(`export type ToolName = ${tools.map((t) => `'${t.name}'`).join(' | ')};`);
    sections.push('');

    // Arguments lookup type
    sections.push('/** Look up the argument type for a tool by name */');
    sections.push('export interface ToolArgsMap {');
    for (const tool of tools) {
      sections.push(`  '${tool.name}': ${toTypeName(tool.name)}Args;`);
    }
    sections.push('}');
    sections.push('');

    // Typed callTool overload helper
    sections.push('/**');
    sections.push(' * Typed tool call — use with callTool():');
    sections.push(' *');
    sections.push(` * import { MCPClient } from '${moduleName}';`);
    sections.push(` * import type { ToolArgsMap, ToolName } from './server-types.js';`);
    sections.push(' *');
    sections.push(' * const result = await client.callTool({');
    sections.push(" *   name: 'add',");
    sections.push(" *   arguments: { a: 1, b: 2 } as ToolArgsMap['add'],");
    sections.push(' * });');
    sections.push(' */');

    // ToolInfo discriminated union
    sections.push('export type ToolCall =');
    for (const tool of tools) {
      sections.push(generateToolInfoType(tool));
    }
    sections.push(';');
    sections.push('');
  }

  // Resource URI types
  if (includeResources && resources.length > 0) {
    sections.push('// ─── Resource URI Types ─────────────────────────────────────────');
    sections.push('');
    sections.push('/** Union of all resource URIs */');
    sections.push('export type ResourceUri =');
    for (const resource of resources) {
      sections.push(generateResourceType(resource));
    }
    sections.push(';');
    sections.push('');
  }

  // Prompt argument types
  if (includePrompts && prompts.length > 0) {
    sections.push('// ─── Prompt Argument Types ────────────────────────────────────────');
    sections.push('');
    for (const prompt of prompts) {
      sections.push(generatePromptType(prompt));
      sections.push('');
    }

    // Prompt name union
    sections.push('/** Union of all prompt names */');
    sections.push(`export type PromptName = ${prompts.map((p) => `'${p.name}'`).join(' | ')};`);
    sections.push('');

    // Prompt args lookup
    sections.push('/** Look up the argument type for a prompt by name */');
    sections.push('export interface PromptArgsMap {');
    for (const prompt of prompts) {
      sections.push(`  '${prompt.name}': ${toTypeName(prompt.name)}Args;`);
    }
    sections.push('}');
    sections.push('');

    // PromptCall discriminated union
    sections.push('export type PromptCall =');
    for (const prompt of prompts) {
      sections.push(generatePromptInfoType(prompt));
    }
    sections.push(';');
    sections.push('');
  }

  // Server overview interface
  sections.push('// ─── Server Overview ─────────────────────────────────────────────');
  sections.push('');
  sections.push('/**');
  sections.push(' * Typed overview of the MCP server capabilities.');
  sections.push(' * Useful for runtime type checking and IDE autocomplete.');
  sections.push(' */');
  sections.push('export interface ServerCapabilities {');
  if (includeTools) {
    sections.push(`  tools: ToolName[];`);
  }
  if (includeResources && resources.length > 0) {
    sections.push(`  resources: ResourceUri[];`);
  }
  if (includePrompts && prompts.length > 0) {
    sections.push(`  prompts: PromptName[];`);
  }
  sections.push('}');
  sections.push('');

  return sections.join('\n');
}

/**
 * Get the package version.
 */
function getVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
    if (pkg.name === '@slbdn/mcp-tester') return pkg.version || '1.0.0';
  } catch {
    /* fallback */
  }
  return '1.0.0';
}

// ─── Main API ───────────────────────────────────────────────────────

/**
 * Connect to an MCP server, inspect tool schemas, and generate TypeScript type declarations.
 *
 * @returns The generated `.d.ts` file content
 *
 * @example
 * ```typescript
 * import { generateTypes } from '@slbdn/mcp-tester';
 * import { writeFileSync } from 'fs';
 *
 * const types = await generateTypes({
 *   command: 'node',
 *   args: ['./my-server.js'],
 * });
 *
 * writeFileSync('my-server-types.d.ts', types);
 * ```
 */
export async function generateTypes(options: GenerateTypesOptions): Promise<string> {
  const client = new MCPClient({
    name: 'mcp-tester-gen-types',
    version: '1.0.0',
    timeout: options.timeout || 30000,
    logLevel: 'none',
  });

  try {
    await client.start({
      command: options.command,
      args: options.args,
    });

    const [tools, resources, prompts] = await Promise.all([
      client.listTools(),
      client.listResources(),
      client.listPrompts(),
    ]);

    return buildTypeFile(tools, resources, prompts, options);
  } finally {
    await client.stop();
  }
}
