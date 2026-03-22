# mcp-server-tester

[![CI](https://github.com/ollieb89/mcp-server-tester/actions/workflows/ci.yml/badge.svg)](https://github.com/ollieb89/mcp-server-tester/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/mcp-server-tester)](https://www.npmjs.com/package/mcp-server-tester)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![GitHub release](https://img.shields.io/github/v/release/ollieb89/mcp-server-tester)](https://github.com/ollieb89/mcp-server-tester/releases)

> **The first GitHub Action + CLI for testing MCP servers in CI.**

The Model Context Protocol (MCP) ecosystem is exploding — Google ADK, enterprise tool platforms, and thousands of community servers. `mcp-server-tester` gives you health checks, protocol compliance validation, tool/resource/prompt schema validation, and CI reports for any MCP server.

## Features

- **Health Check** — connect to the server and verify it responds to the MCP initialize handshake
- **Protocol Compliance** — validate protocol version, capabilities, serverInfo against the 2024-11-05 spec
- **Tool Discovery** — enumerate tools, validate schemas (name, description, inputSchema)
- **Resource Discovery** — enumerate resources, validate URIs and mimeTypes
- **Prompt Discovery** — enumerate prompts, validate argument schemas
- **CI Report** — GitHub Actions job summary + JSON artifact with full results
- **CLI** — use via `npx mcp-server-tester` in any shell or CI script
- **Fail policy** — configurable `fail-on: errors | warnings | none`

## Transports Supported

| Transport | Description |
|-----------|-------------|
| `stdio` | Start server as subprocess, communicate over stdin/stdout |
| `http` | Connect to HTTP endpoint (health check only in MVP) |
| `sse` | Connect to SSE endpoint (health check only in MVP) |

## GitHub Action

### Quick Start

```yaml
- name: Test MCP Server
  uses: ollieb89/mcp-server-tester@v1
  with:
    transport: stdio
    server-command: "node dist/server.js"
    test-tools: true
    test-resources: true
    test-prompts: true
    fail-on: errors
```

### Full Example

```yaml
- name: Build MCP Server
  run: npm run build

- name: Test MCP Server
  uses: ollieb89/mcp-server-tester@v1
  with:
    transport: stdio
    server-command: "node dist/server.js"
    test-tools: true
    test-resources: true
    test-prompts: true
    fail-on: errors
    timeout: 30
    output-file: mcp-test-report.json

- name: Upload Report
  uses: actions/upload-artifact@v4
  with:
    name: mcp-test-report
    path: mcp-test-report.json
```

### HTTP Server

```yaml
- name: Start MCP HTTP Server
  run: node server.js &

- name: Wait for server
  run: sleep 3

- name: Test MCP Server
  uses: ollieb89/mcp-server-tester@v1
  with:
    transport: http
    server-url: http://localhost:3000/mcp
    fail-on: errors
```

## Action Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `transport` | `stdio`, `http`, or `sse` | `stdio` |
| `server-command` | Command to start MCP server (stdio) | — |
| `server-url` | URL of MCP server endpoint (http/sse) | — |
| `test-tools` | Run tool discovery and schema validation | `true` |
| `test-resources` | Run resource discovery and validation | `true` |
| `test-prompts` | Run prompt discovery and validation | `true` |
| `fail-on` | `errors`, `warnings`, or `none` | `errors` |
| `timeout` | Connection timeout in seconds | `30` |
| `output-file` | Path to write JSON report | — |

## Action Outputs

| Output | Description |
|--------|-------------|
| `passed` | Number of checks that passed |
| `failed` | Number of checks that failed |
| `warnings` | Number of checks with warnings |
| `report-path` | Path to JSON report artifact |

## CLI

### Install

```bash
npm install -g mcp-server-tester
# or use npx (no install):
npx mcp-server-tester --command "node server.js"
```

### Usage

```bash
# Test a stdio MCP server
mcp-server-tester --command "node dist/server.js"

# Test with all checks
mcp-server-tester --command "node dist/server.js" --all

# Test an HTTP server
mcp-server-tester --transport http --url http://localhost:3000/mcp

# Fail on warnings, output JSON
mcp-server-tester --command "node server.js" --all --fail-on warnings --format json

# Write report to file
mcp-server-tester --command "node server.js" --all --output report.json
```

### CLI Options

```text
  --transport <stdio|http|sse>     Transport type (default: stdio)
  --command <cmd>                  Server command for stdio transport
  --url <url>                      Server URL for http/sse transport
  --test-tools                     Run tool discovery check
  --test-resources                 Run resource discovery check
  --test-prompts                   Run prompt discovery check
  --all                            Run all checks
  --fail-on <errors|warnings|none> Fail exit code policy (default: errors)
  --timeout <seconds>              Timeout in seconds (default: 30)
  --output <file>                  Write JSON report to file
  --format <text|json|markdown>    Output format (default: text)
  --help                           Show help
```

## Example Output

```text
mcp-server-tester v1.0.0 | transport: stdio
Command: node dist/server.js

[ok] health: Server connected and initialized successfully
[pass] tools: 3 tool(s) discovered
[pass] resources: 2 resource(s) discovered
[warn] prompts: 1 prompt(s) discovered, 1 warning(s)

Overall: WARN
```

## Checks Explained

### Health Check
Connects to the server and runs the MCP `initialize` handshake. Validates the server returns a valid response with `protocolVersion`, `serverInfo`, and `capabilities`.

### Tool Discovery
Calls `tools/list` and validates each tool has:
- `name` — required, alphanumeric/underscore
- `description` — recommended
- `inputSchema.type` — should be `"object"`

### Resource Discovery
Calls `resources/list` and validates each resource has:
- `uri` — required, valid URI format
- `mimeType` — valid MIME type format if present

### Prompt Discovery
Calls `prompts/list` and validates each prompt has:
- `name` — required
- `arguments[].name` — required for each argument, must be unique

## Protocol Compliance

Validates against MCP spec version `2024-11-05`:
- `protocolVersion` must be set
- `serverInfo.name` and `serverInfo.version` should be present
- `capabilities` object must be present

## Tests

```bash
npm test
```

57 tests covering validator, all check types, reporter, and build/fail logic.

## License

MIT — see [LICENSE](LICENSE)
