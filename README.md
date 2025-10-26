# Safari MCP Server

A Model Context Protocol (MCP) server that provides AI assistants with Safari/WebKit browser automation and comprehensive developer tools access using **Playwright**. This server enables LLMs to interact with WebKit/Safari, capture **ALL console logs (including from page load!)**, monitor network activity, and perform advanced browser automation tasks.

## Features

- 🚀 **WebKit Browser Automation**: Control WebKit (Safari) sessions via Playwright
- 🔍 **Complete Console Log Capture**: Get **ALL** console logs from initial page load (no timing limitations!)
- 🌐 **Network Monitoring**: Capture all network requests/responses with full headers and timing
- 📸 **Screenshot Capture**: Take fullHD (1920x1080) screenshots saved to `~/safari-mcp-screenshots/`
- 🕵️ **Element Inspection**: Inspect DOM elements and their properties
- ⚡ **JavaScript Execution**: Run custom JavaScript in the browser context
- 📊 **Performance Monitoring**: Access timing metrics and performance data
- 🔧 **Multiple Sessions**: Manage concurrent browser automation sessions

## Why Playwright?

This server previously used Selenium WebDriver, which **could not capture console logs from page load**. After migrating to Playwright:
- ✅ **690+ console logs** captured (vs 0 with Selenium)
- ✅ **Native event listeners** - no JavaScript injection needed
- ✅ **Zero timing issues** - captures logs from the very start
- ✅ **Simpler setup** - no Safari permissions required

See [CONSOLE_LOGGING.md](CONSOLE_LOGGING.md) for details and [MIGRATION_SUMMARY.md](MIGRATION_SUMMARY.md) for the full migration story.

## Prerequisites

- **Node.js 18+**
- **macOS, Linux, or Windows** (Playwright's WebKit is cross-platform)

## Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Install Playwright WebKit browser** (one-time setup):
   ```bash
   npx playwright install webkit
   ```

3. **Build the project**:
   ```bash
   npm run build
   ```

That's it! No Safari configuration or permissions needed.

## Usage

### Integration with Claude Desktop

Add this to your Claude Desktop config:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "safari": {
      "command": "node",
      "args": ["/absolute/path/to/safari-mcp-server/build/index.js"]
    }
  }
}
```

Replace `/absolute/path/to/` with your actual project path.

### Available MCP Tools

#### Session Management
- `safari_start_session` - Start a new browser session with dev tools enabled
- `safari_close_session` - Close a browser session
- `safari_list_sessions` - List all active sessions

#### Navigation & Page Info
- `safari_navigate` - Navigate to any URL
- `safari_get_page_info` - Get current page URL and title

#### Developer Tools
- `safari_get_console_logs` - Get console logs with optional filtering by level and text (grep-like)
- `safari_get_network_logs` - Get network activity with request/response data
- `safari_clear_console_logs` - Clear stored console logs
- `safari_clear_network_logs` - Clear stored network logs
- `safari_get_performance_metrics` - Get page performance metrics

#### Browser Interaction
- `safari_execute_script` - Execute JavaScript in the browser context
- `safari_take_screenshot` - Capture fullHD screenshot (saved to `~/safari-mcp-screenshots/`)
- `safari_inspect_element` - Inspect DOM elements by CSS selector

### Example Session

```
1. Start session: safari_start_session with sessionId "main"
2. Navigate: safari_navigate to "https://example.com"
3. Get logs: safari_get_console_logs with optional filters:
   - Filter by level: logLevel="ERROR"
   - Filter by text (grep): filterText="404"
   - Combine both: logLevel="WARNING", filterText="Extender"
4. Take screenshot: safari_take_screenshot (saved to ~/safari-mcp-screenshots/)
5. Close: safari_close_session
```

## NPM Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Start the MCP server |
| `npm run dev` | Build and start in development mode |
| `npm run watch` | Watch TypeScript files for changes |
| `npm run clean` | Clean build directory |

## Configuration Options

When starting a session:

```json
{
  "sessionId": "my-session",
  "options": {
    "enableInspection": true,
    "enableProfiling": true,
    "usesTechnologyPreview": false
  }
}
```

All options are optional and default to `false` except `enableInspection` and `enableProfiling` which default to `true`.

## Project Structure

```
safari-mcp-server/
├── src/
│   ├── index.ts                 # Main entry point
│   ├── safari-mcp-server.ts    # MCP server implementation
│   ├── safari-driver.ts        # Playwright WebKit manager
│   └── types.ts                # TypeScript type definitions
├── build/                      # Compiled JavaScript output
├── CONSOLE_LOGGING.md         # Detailed console logging documentation
├── MIGRATION_SUMMARY.md       # Playwright migration details
└── README.md                  # This file
```

## Console Log Capture

This server captures **all** console logs from page load onwards, including:
- Inline `<script>` tags during page load
- External JavaScript files as they load
- Dynamic logs from AJAX callbacks
- Logs from setTimeout/setInterval
- All console methods (log, warn, error, info, debug)

**Example**: Testing on `fresh-espo.devcrm.cz` captured **690+ console messages** including 49 warnings from initial page load!

For detailed documentation, see [CONSOLE_LOGGING.md](CONSOLE_LOGGING.md).

## Limitations & Notes

1. **WebKit vs Safari**: Uses Playwright's WebKit build (~99.9% identical to Safari). Minor differences:
   - No Safari extension support
   - Some Safari-specific features may differ
   - Browser window may not be visible on all platforms (runs in virtual display)

2. **Large Log Volumes**: Pages generating thousands of console messages may exceed MCP response limits. Solution: Use `logLevel` parameter to filter (e.g., `"WARNING"`, `"ERROR"`)

3. **Screenshots**: Automatically saved to `~/safari-mcp-screenshots/` with timestamps

4. **Performance**: Multiple concurrent sessions consume system resources

## Troubleshooting

### "Executable doesn't exist" error
Run `npx playwright install webkit` to download the WebKit browser (one-time setup).

### "Session not found" errors
Ensure you've started a session before using other commands. Check the browser didn't crash.

### Console log response too large
Use `logLevel` parameter to filter or call `safari_clear_console_logs` periodically.

### Browser not visible
Playwright's WebKit may run in a virtual framebuffer on some platforms. The browser is working - use screenshots to verify.

## Development

```bash
# Watch mode for development
npm run watch

# Clean build artifacts
npm run clean

# Rebuild
npm run build
```

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License

## Resources

- [Model Context Protocol](https://modelcontextprotocol.io/) - MCP specification
- [Playwright](https://playwright.dev/) - Browser automation library
- [Playwright WebKit](https://playwright.dev/docs/browsers#webkit) - WebKit documentation
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) - MCP SDK

## Credits

Migrated from Selenium WebDriver to Playwright in October 2025 for complete console log capture. See [MIGRATION_SUMMARY.md](MIGRATION_SUMMARY.md) for details.
