# mcp-server-tester — Spec

## What
GitHub Action + CLI that tests MCP (Model Context Protocol) servers in CI: health checks, schema validation, tool/resource discovery, and protocol compliance.

## Problem
MCP ecosystem is exploding (Google ADK, enterprise adoption). Zero GitHub Actions exist for testing MCP servers in CI. Current tools (mcp-server-tester 34★, mcp-validator 75★) are manual CLI-only, no CI integration.

## Features (MVP v1.0.0)
1. **Health Check** — connect to MCP server (stdio/HTTP/SSE), verify it responds
2. **Protocol Compliance** — validate server follows MCP spec (initialize handshake, capabilities)
3. **Tool Discovery** — enumerate tools, validate schemas (name, description, inputSchema)
4. **Resource Discovery** — enumerate resources, validate URIs and mimeTypes
5. **Prompt Discovery** — enumerate prompts, validate arguments
6. **Tool Invocation Tests** — call tools with test inputs, validate responses
7. **CI Report** — GitHub Actions job summary + JSON artifact with full test results
8. **Fail on Error** — configurable fail-on: errors|warnings|none

## Architecture
- TypeScript GitHub Action + companion CLI (npx mcp-server-tester)
- Transport support: stdio (command), HTTP, SSE
- MCP spec version: 2024-11-05
- Inputs: server-command, server-url, transport, test-tools, fail-on, timeout
- Outputs: passed, failed, warnings, report-path

## Config Example
```yaml
- uses: ollieb89/mcp-server-tester@v1
  with:
    transport: stdio
    server-command: "node dist/server.js"
    test-tools: true
    test-resources: true
    fail-on: errors
    timeout: 30
```

## CLI Usage
```bash
npx mcp-server-tester --transport stdio --command "node server.js"
npx mcp-server-tester --transport http --url http://localhost:3000/mcp
```

## Deliverables
- action.yml
- src/: index.ts, client.ts, validator.ts, reporter.ts, checks/health.ts, checks/tools.ts, checks/resources.ts, checks/prompts.ts
- bin/cli.ts (npx support)
- tests/ (Jest, 25+ tests)
- README.md with badges, usage, transport docs, config reference
- LICENSE (MIT, ollieb89)
- .github/workflows/ci.yml
- Tag v1.0.0, GitHub Release
- Publish CLI to npm as mcp-server-tester

## SEO Topics
mcp, model-context-protocol, github-actions, testing, ci-cd, mcp-server, validation, developer-tools, ai-agents, protocol-testing
