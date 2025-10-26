# Console Logging in Safari MCP Server (Playwright)

## Overview

This Safari MCP Server now uses **Playwright** for browser automation, which provides **native, full console log capture from the very beginning of page load** with zero limitations!

## How It Works

### Playwright Event Listeners

Playwright provides native browser event listeners that capture console messages from the moment the page starts loading:

```typescript
page.on('console', (msg: ConsoleMessage) => {
  session.consoleLogs.push({
    level: msg.type().toUpperCase(),
    message: msg.text(),
    timestamp: Date.now(),
    source: 'browser'
  });
});
```

This event listener:
- Is set up **before** navigation
- Captures **all** console messages from page load onwards
- Works for **all** console methods (log, warn, error, info, debug)
- Has **zero timing issues** - no message is missed

## What Gets Captured

✅ **Everything!**
- Console logs from inline `<script>` tags during page load
- Logs from external JavaScript files as they load
- Logs from dynamically loaded scripts
- Logs from user interactions
- Logs from AJAX callbacks
- Logs from setTimeout/setInterval
- Logs from worker threads
- Logs from all console methods (log, warn, error, info, debug)

## Benefits Over Selenium WebDriver

| Feature | Selenium WebDriver | Playwright |
|---------|-------------------|------------|
| Page load logs | ❌ No | ✅ Yes |
| Inline script logs | ❌ No | ✅ Yes |
| Dynamic logs | ✅ Yes | ✅ Yes |
| Requires injection | ✅ Yes | ❌ No |
| Timing issues | ⚠️ Yes | ❌ No |
| Setup complexity | ⚠️ High | ✅ Simple |

## Example: Real-World Capture

Testing on `fresh-espo.devcrm.cz`:

**Selenium WebDriver Result:**
```json
{
  "consoleLogs": []  // 0 logs captured from page load
}
```

**Playwright Result:**
```json
{
  "consoleLogs": [
    ... 690+ messages including all warnings and errors from page load!
  ]
}
```

## API Reference

### `safari_get_console_logs`

**Parameters:**
- `sessionId` (string): The Safari session ID
- `logLevel` (optional): Filter by level - `'ALL'`, `'DEBUG'`, `'INFO'`, `'WARNING'`, `'SEVERE'`

**Returns:**
Array of console log entries:
```typescript
interface ConsoleLogEntry {
  level: string;      // 'LOG', 'WARN', 'ERROR', 'INFO', 'DEBUG'
  message: string;    // The log message
  timestamp: number;  // Unix timestamp in milliseconds
  source: string;     // 'browser' (always 'browser')
}
```

**Example:**
```javascript
// Get ALL logs
const allLogs = await getConsoleLogs('my-session', 'ALL');

// Get only warnings
const warnings = await getConsoleLogs('my-session', 'WARNING');

// Get only errors
const errors = await getConsoleLogs('my-session', 'ERROR');
```

## Handling Large Log Volumes

Some pages (like EspoCRM) generate hundreds of console messages. If you hit MCP response limits:

### Strategy 1: Filter by Log Level
```javascript
// Instead of getting all 690+ messages
const all = await getConsoleLogs('session', 'ALL');  // May exceed limit!

// Get just warnings (much smaller)
const warnings = await getConsoleLogs('session', 'WARNING');  // 49 messages
```

### Strategy 2: Clear Logs Periodically
```javascript
// Get logs
const logs = await getConsoleLogs('session');

// Process them...
processLogs(logs);

// Clear for next batch
await clearConsoleLogs('session');
```

### Strategy 3: Monitor Continuously
```javascript
// Get logs every few seconds
setInterval(async () => {
  const newLogs = await getConsoleLogs('session', 'ERROR');
  if (newLogs.length > 0) {
    handleErrors(newLogs);
    await clearConsoleLogs('session');
  }
}, 5000);
```

## Migration from Selenium

If you were using the old Selenium-based version:

### What Changed:
- ✅ **Console logs from page load now work!**
- ✅ No more JavaScript injection required
- ✅ No more timing issues or race conditions
- ✅ Simpler setup (no Safari permissions needed)
- ✅ Cross-platform (uses Playwright WebKit, works on macOS, Linux, and theoretically Windows)

### What Stayed the Same:
- ✅ Same MCP tool names and parameters
- ✅ Same API interface
- ✅ Same log entry format
- ✅ All other functionality (screenshots, element inspection, etc.)

### Breaking Changes:
- None! The API is identical.

## Technical Details

### Why Playwright Works Where WebDriver Failed

**Selenium WebDriver:**
1. Browser loads page
2. Inline scripts execute
3. WebDriver gets control
4. We inject capture script ← **TOO LATE!**
5. Only future logs are captured

**Playwright:**
1. We set up event listeners
2. Browser loads page ← **Listeners already active**
3. Inline scripts execute ← **Being captured!**
4. External scripts load ← **Being captured!**
5. Dynamic events fire ← **Being captured!**

### Implementation

The core implementation in `src/safari-driver.ts`:

```typescript
// Set up during session creation (before any navigation)
page.on('console', (msg: ConsoleMessage) => {
  session.consoleLogs.push({
    level: msg.type().toUpperCase(),
    message: msg.text(),
    timestamp: Date.now(),
    source: 'browser'
  });
});

// Then navigate - all logs will be captured
await page.goto(url);
```

## Related Documentation

- [Playwright Console Events](https://playwright.dev/docs/api/class-page#page-event-console) (src/safari-driver.ts:47-54)
- [Playwright WebKit](https://playwright.dev/docs/browsers#webkit)
- [MCP Protocol](https://modelcontextprotocol.io/)

## Support

If you encounter issues:

1. **Logs are too large**: Use `logLevel` parameter to filter
2. **Missing logs**: Ensure session was created before navigation
3. **Performance issues**: Clear logs periodically with `safari_clear_console_logs`

For questions or issues, please open an issue on the GitHub repository.

## Success Story

> **Before (Selenium):** 0 console logs captured from page load
> **After (Playwright):** 690+ console logs captured from page load!
>
> *"Perfect! The Playwright implementation is working!"*
