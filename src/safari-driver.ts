import { webkit, Browser, BrowserContext, Page, ConsoleMessage } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  SafariSession,
  SafariSessionOptions,
  ConsoleLogEntry,
  NetworkLogEntry,
  ElementInspectionResult,
  PerformanceMetrics,
  LogLevel
} from './types.js';

export class SafariDriverManager {
  private sessions: Map<string, SafariSession> = new Map();

  async createSession(sessionId: string, options: SafariSessionOptions = {}): Promise<SafariSession> {
    if (this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already exists`);
    }

    try {
      // Launch WebKit (Safari)
      const browser = await webkit.launch({
        headless: false, // Safari automation typically runs in headed mode (visible browser)
        // Note: Playwright's webkit doesn't support Technology Preview selection directly
      });

      // Create a new browser context with fullHD viewport
      const context = await browser.newContext({
        viewport: {
          width: 1920,
          height: 1080
        }
      });

      // Create a new page
      const page = await context.newPage();

      const session: SafariSession = {
        browser,
        context,
        page,
        sessionId,
        options,
        createdAt: new Date(),
        consoleLogs: [],
        networkLogs: []
      };

      // Set up console log capture - THIS WORKS FROM THE START!
      page.on('console', (msg: ConsoleMessage) => {
        session.consoleLogs.push({
          level: msg.type().toUpperCase(),
          message: msg.text(),
          timestamp: Date.now(),
          source: 'browser'
        });
      });

      // Set up network request capture
      page.on('request', (request) => {
        const timestamp = Date.now();
        const url = request.url();
        const method = request.method();

        session.networkLogs.push({
          method: 'Network.requestSent',
          url,
          status: undefined,
          requestHeaders: request.headers(),
          responseHeaders: undefined,
          timestamp
        });
      });

      // Set up network response capture
      page.on('response', async (response) => {
        const timestamp = Date.now();
        const request = response.request();

        // Find the matching request log and update it
        const requestLog = session.networkLogs.find(
          log => log.url === response.url() && log.method === 'Network.requestSent' && !log.status
        );

        if (requestLog) {
          requestLog.status = response.status();
          requestLog.responseHeaders = response.headers();
          requestLog.method = 'Network.responseReceived';
        } else {
          // If we didn't catch the request, add the response anyway
          session.networkLogs.push({
            method: 'Network.responseReceived',
            url: response.url(),
            status: response.status(),
            requestHeaders: request.headers(),
            responseHeaders: response.headers(),
            timestamp
          });
        }
      });

      this.sessions.set(sessionId, session);
      return session;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create Safari session: ${errorMessage}`);
    }
  }

  getSession(sessionId: string): SafariSession | undefined {
    return this.sessions.get(sessionId);
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    try {
      await session.browser.close();
      this.sessions.delete(sessionId);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to close session: ${errorMessage}`);
    }
  }

  async navigateToUrl(sessionId: string, url: string): Promise<void> {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    try {
      await session.page.goto(url, {
        waitUntil: 'load' // Wait for page load event
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Navigation failed: ${errorMessage}`);
    }
  }

  async getConsoleLogs(sessionId: string, logLevel: LogLevel = 'ALL'): Promise<ConsoleLogEntry[]> {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    try {
      // Filter by log level if needed
      const filteredLogs = logLevel === 'ALL'
        ? session.consoleLogs
        : session.consoleLogs.filter((log: ConsoleLogEntry) => log.level === logLevel);

      // Return a copy sorted by timestamp
      return [...filteredLogs].sort((a, b) => a.timestamp - b.timestamp);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get console logs: ${errorMessage}`);
    }
  }

  async getNetworkLogs(sessionId: string): Promise<NetworkLogEntry[]> {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    try {
      // Return a copy sorted by timestamp
      return [...session.networkLogs].sort((a, b) => a.timestamp - b.timestamp);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get network logs: ${errorMessage}`);
    }
  }

  async executeScript(sessionId: string, script: string, args: any[] = []): Promise<any> {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    try {
      // Playwright's evaluate passes args differently than Selenium
      return await session.page.evaluate(({ script, args }) => {
        // Create a function from the script and call it with args
        const fn = new Function('...args', script);
        return fn(...args);
      }, { script, args });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Script execution failed: ${errorMessage}`);
    }
  }

  async takeScreenshot(sessionId: string): Promise<string> {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    try {
      const screenshot = await session.page.screenshot({
        type: 'png',
        fullPage: false
      });

      // Save screenshot to disk
      const screenshotsDir = path.join(os.homedir(), 'safari-mcp-screenshots');
      if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `screenshot-${sessionId}-${timestamp}.png`;
      const filePath = path.join(screenshotsDir, filename);

      fs.writeFileSync(filePath, screenshot);
      console.error(`Screenshot saved to: ${filePath}`);

      return screenshot.toString('base64');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Screenshot failed: ${errorMessage}`);
    }
  }

  async inspectElement(sessionId: string, selector: string): Promise<ElementInspectionResult> {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    try {
      const element = await session.page.locator(selector).first();

      const [tagName, text, attributes, boundingBox] = await Promise.all([
        element.evaluate(el => el.tagName.toLowerCase()),
        element.textContent(),
        element.evaluate(el => {
          const attrs: Record<string, string> = {};
          for (const attr of el.attributes) {
            attrs[attr.name] = attr.value;
          }
          return attrs;
        }),
        element.boundingBox()
      ]);

      return {
        tagName,
        text: (text || '').substring(0, 500), // Limit text length
        attributes,
        boundingRect: boundingBox ? {
          x: boundingBox.x,
          y: boundingBox.y,
          width: boundingBox.width,
          height: boundingBox.height
        } : undefined
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Element inspection failed: ${errorMessage}`);
    }
  }

  async getPerformanceMetrics(sessionId: string): Promise<PerformanceMetrics> {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    try {
      const metrics = await session.page.evaluate(() => {
        const timing = (performance as any).timing;
        const paintEntries = performance.getEntriesByType('paint' as any);

        return {
          navigationStart: timing.navigationStart,
          loadEventEnd: timing.loadEventEnd,
          domContentLoadedEventEnd: timing.domContentLoadedEventEnd,
          firstPaint: paintEntries.find((entry: any) => entry.name === 'first-paint')?.startTime,
          firstContentfulPaint: paintEntries.find((entry: any) => entry.name === 'first-contentful-paint')?.startTime
        };
      });

      return metrics;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get performance metrics: ${errorMessage}`);
    }
  }

  async getCurrentUrl(sessionId: string): Promise<string> {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    try {
      return session.page.url();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get current URL: ${errorMessage}`);
    }
  }

  async getPageTitle(sessionId: string): Promise<string> {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    try {
      return await session.page.title();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get page title: ${errorMessage}`);
    }
  }

  async clearConsoleLogs(sessionId: string): Promise<void> {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    try {
      session.consoleLogs = [];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to clear console logs: ${errorMessage}`);
    }
  }

  async clearNetworkLogs(sessionId: string): Promise<void> {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    try {
      session.networkLogs = [];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to clear network logs: ${errorMessage}`);
    }
  }

  getAllSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  async closeAllSessions(): Promise<void> {
    const sessionIds = this.getAllSessions();
    for (const sessionId of sessionIds) {
      try {
        await this.closeSession(sessionId);
      } catch (error) {
        console.error(`Failed to close session ${sessionId}:`, error);
      }
    }
  }
}
