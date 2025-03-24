const puppeteer = require('puppeteer');

// Browser pool for Puppeteer
const browserPool = {
  browser: null,
  inUse: false,
  lastUsed: 0,
  maxIdleTime: 5 * 60 * 1000, // 5 minutes idle timeout
  waitTimeout: 18000, // 18 seconds timeout for waiting on browser

  async getBrowser() {
    // Wait if browser is in use by another request
    if (this.inUse) {
      console.log('Browser is in use, waiting...');
      let waitResolved = false;

      await Promise.race([
        new Promise(resolve => {
          const checkInterval = setInterval(() => {
            if (!this.inUse) {
              clearInterval(checkInterval);
              waitResolved = true;
              resolve();
            }
          }, 500); // Check every 500ms
        }),
        new Promise((_, reject) => {
          setTimeout(() => {
            if (!waitResolved) {
              reject(new Error('Timeout waiting for browser'));
            }
          }, this.waitTimeout);
        })
      ]).catch(err => {
        console.error('Browser wait error:', err.message);
        // Force release if timeout
        this.inUse = false;
      });
    }

    // Mark as in use
    this.inUse = true;

    // Check if browser exists and is not crashed
    if (this.browser) {
      try {
        const pages = await this.browser.pages();
        if (pages.length > 0) {
          // Browser is alive, return it
          this.lastUsed = Date.now();
          // Close any extra pages to keep the browser clean
          if (pages.length > 1) {
            // Keep only the first page (about:blank)
            for (let i = 1; i < pages.length; i++) {
              await pages[i].close().catch(e => console.log('Error closing extra page:', e.message));
            }
            console.log(`Closed ${pages.length - 1} extra pages`);
          }
          return this.browser;
        }
      } catch (e) {
        console.log('Existing browser instance crashed, creating a new one');
        this.browser = null;
      }
    }

    // Create new browser
    console.log('Launching new Puppeteer browser instance');
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-setuid-sandbox',
        '--no-sandbox',
      ]
    });

    this.lastUsed = Date.now();
    return this.browser;
  },

  async releaseBrowser() {
    // Close all pages except the first one to free up resources
    try {
      if (this.browser) {
        const pages = await this.browser.pages();
        if (pages.length > 1) {
          // Keep only the first page (about:blank)
          for (let i = 1; i < pages.length; i++) {
            await pages[i].close().catch(e => console.log('Error closing page on release:', e.message));
          }
          console.log(`Closed ${pages.length - 1} pages on release`);
        }
      }
    } catch (e) {
      console.error('Error closing pages on release:', e.message);
    }

    this.inUse = false;
    this.lastUsed = Date.now();
    console.log('Browser released back to pool');
  },

  async closeBrowserIfIdle() {
    if (this.browser && !this.inUse && (Date.now() - this.lastUsed > this.maxIdleTime)) {
      console.log('Closing idle browser instance');
      await this.browser.close();
      this.browser = null;
    }
  },

  // Function to preload Puppeteer browser
  async preloadBrowser() {
    try {
      console.log('Preloading Puppeteer browser...');
      const browser = await this.getBrowser();
      console.log('Puppeteer browser preloaded successfully');

      // Create and maintain a single blank page to keep browser warm
      const pages = await browser.pages();
      if (pages.length === 0) {
        await browser.newPage();
      }

      // Release browser back to pool
      await this.releaseBrowser();
    } catch (error) {
      console.error('Failed to preload Puppeteer browser:', error.message);
    }
  },

  // Start periodic checking of browser idleness
  startIdleChecking() {
    setInterval(() => {
      this.closeBrowserIfIdle().catch(e => console.error('Error closing idle browser:', e));
    }, 60 * 1000); // Check every minute

    return this; // For chaining
  }
};

module.exports = browserPool;