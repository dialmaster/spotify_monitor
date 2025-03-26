const Genius = require('genius-lyrics');
const config = require('../config');
const browserPool = require('../utils/browserPool');
const trackRepository = require('../repositories/trackRepository');

// Get lyrics from Spotify web UI using Puppeteer
const getSpotifyLyrics = async (trackUrl) => {
  try {
    console.log(`Attempting to fetch lyrics from Spotify using Puppeteer: ${trackUrl}`);

    // Check if we have Spotify web cookies configured
    if (!config.spotifyWebCookies) {
      console.log('No valid Spotify web cookies configured. To enable this feature:');
      console.log('1. Log in to open.spotify.com in your browser');
      console.log('2. Get cookies using browser developer tools (F12 > Console > type document.cookie)');
      console.log('3. Add them to your config.json file');
      console.log('Falling back to alternative lyrics sources...');
      return null;
    }

    // Get a browser from the pool
    let browser;
    try {
      browser = await browserPool.getBrowser();
    } catch (browserError) {
      console.error('Failed to get browser from pool:', browserError.message);
      return null;
    }

    try {
      // Create a new page
      const page = await browser.newPage();

      // Set performance optimizations
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        // Skip loading images, fonts, and other non-essential resources
        const resourceType = req.resourceType();
        if (resourceType === 'image' || resourceType === 'font' || resourceType === 'media') {
          req.abort();
        } else {
          req.continue();
        }
      });

      // Parse and set cookies from the configuration
      const cookieStr = config.spotifyWebCookies;
      const cookies = cookieStr.split(';').map(pair => {
        const [name, value] = pair.trim().split('=');
        return { name, value, domain: '.spotify.com', path: '/' };
      });

      await page.setCookie(...cookies);

      // Set a realistic user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');

      // Navigate to the Spotify track URL with reduced timeout
      console.log('Navigating to Spotify track page...');
      await page.goto(trackUrl, {
        waitUntil: 'domcontentloaded', // Use domcontentloaded instead of networkidle2 for faster loading
        timeout: 15000
      });

      // Log the current URL to see if we were redirected
      const currentUrl = page.url();
      console.log('Current page URL:', currentUrl);
      console.log('Waiting for lyrics container...');
      try {
        // This will wait until the selector appears or until the timeout (8000ms) is reached, whichever comes first
        await page.waitForSelector('div[data-testid="lyrics-container"]', { timeout: 8000 });
        console.log('Lyrics container found!');
      } catch (e) {
        console.log('No lyrics container found within timeout:', e.message);

        // Check if we're on a login page or if the page has other expected elements
        const pageTitle = await page.title();
        console.log('Page title:', pageTitle);

        const hasLoginForm = await page.evaluate(() => {
          return !!document.querySelector('button[data-testid="login-button"]');
        });

        if (hasLoginForm) {
          console.log('Login form detected - authentication may have failed');
        }

        // Check for other track elements to see if we're on the right page
        const hasTrackInfo = await page.evaluate(() => {
          return !!document.querySelector('[data-testid="track-info"]') ||
                 !!document.querySelector('[data-testid="now-playing-widget"]');
        });

        if (hasTrackInfo) {
          console.log('Track info found but no lyrics - song might not have lyrics available');
        }

        // If we found track info but no lyrics, the song might not have lyrics
        if (hasTrackInfo && !hasLoginForm) {
          await page.close().catch(e => console.log('Error closing page:', e.message));
          await browserPool.releaseBrowser();
          return null; // No lyrics available for this track
        }

        // If we hit the login page or found nothing familiar, auth failed
        await page.close().catch(e => console.log('Error closing page:', e.message));
        await browserPool.releaseBrowser();
        return null;
      }

      // Extract lyrics content
      console.log('Extracting lyrics...');
      const lyrics = await page.evaluate(() => {
        // Get all visible lyrics lines
        const visibleLines = Array.from(
          document.querySelectorAll('div[data-testid="lyrics-container"] p[data-testid="lyrics-line-always-visible"]')
        ).map(el => el.textContent);

        // Also try to get potentially hidden lines (in "Show more" sections)
        const hiddenLines = Array.from(
          document.querySelectorAll('div[data-testid="lyrics-container"] span[aria-hidden="true"] p')
        ).map(el => el.textContent);

        // Combine all lines
        return [...visibleLines, ...hiddenLines].join('\n');
      });

      // Log stats
      const lineCount = lyrics.split('\n').length;
      console.log(`Successfully extracted ${lineCount} lines of lyrics from Spotify`);

      // Close the page explicitly
      await page.close().catch(e => console.log('Error closing page:', e.message));

      // Release the browser back to the pool
      await browserPool.releaseBrowser();

      // Return the lyrics if we found some
      if (lyrics && lyrics.trim().length > 0) {
        // Extract the track ID from the URL
        const trackIdMatch = trackUrl.match(/track\/([a-zA-Z0-9]+)/);
        const trackId = trackIdMatch ? trackIdMatch[1] : null;

        // Save lyrics to database if we have a track ID
        if (trackId) {
          try {
            console.log(`Saving Spotify web lyrics to database for track ${trackId}`);
            await trackRepository.updateTrackLyrics(trackId, lyrics, 'spotify-web');
          } catch (dbError) {
            console.error('Error saving lyrics to database:', dbError.message);
            // Continue even if database save fails
          }
        }

        return lyrics;
      } else {
        console.log('No lyrics content found in the container');
        return null;
      }
    } catch (innerError) {
      console.error('Error during Puppeteer operation:', innerError.message);
      await browserPool.releaseBrowser();
      return null;
    }
  } catch (error) {
    console.error('Error scraping Spotify lyrics with Puppeteer:', error.message);
    return null;
  }
};

// Get podcast transcript from Spotify web UI using Puppeteer
const getSpotifyPodcastTranscript = async (episodeUrl) => {
  try {
    console.log(`Attempting to fetch podcast transcript from Spotify using Puppeteer: ${episodeUrl}`);

    // Check if we have Spotify web cookies configured
    if (!config.spotifyWebCookies) {
      console.log('No valid Spotify web cookies configured. To enable podcast transcripts:');
      console.log('1. Log in to open.spotify.com in your browser');
      console.log('2. Get cookies using browser developer tools (F12 > Console > type document.cookie)');
      console.log('3. Add them to your config.json file');
      return null;
    }

    // Get a browser from the pool
    let browser;
    try {
      browser = await browserPool.getBrowser();
    } catch (browserError) {
      console.error('Failed to get browser from pool:', browserError.message);
      return null;
    }

    try {
      // Create a new page
      const page = await browser.newPage();

      // Set performance optimizations
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        // Skip loading images, fonts, and other non-essential resources
        const resourceType = req.resourceType();
        if (resourceType === 'image' || resourceType === 'font' || resourceType === 'media') {
          req.abort();
        } else {
          req.continue();
        }
      });

      // Parse and set cookies from the configuration
      const cookieStr = config.spotifyWebCookies;
      const cookies = cookieStr.split(';').map(pair => {
        const [name, value] = pair.trim().split('=');
        return { name, value, domain: '.spotify.com', path: '/' };
      });

      await page.setCookie(...cookies);

      // Set a realistic user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');

      // Navigate to the Spotify episode URL
      console.log('Navigating to Spotify episode page...');
      await page.goto(episodeUrl, {
        waitUntil: 'networkidle2', // Need to use networkidle2 for podcast transcript pages
        timeout: 30000
      });

      // Log the current URL to see if we were redirected
      const currentUrl = page.url();
      console.log('Current page URL:', currentUrl);

      // Check if we're on a login page
      const hasLoginForm = await page.evaluate(() => {
        return !!document.querySelector('button[data-testid="login-button"]');
      });

      if (hasLoginForm) {
        console.log('Login form detected - authentication may have failed');
        await page.close().catch(e => console.log('Error closing page:', e.message));
        await browserPool.releaseBrowser();
        return null;
      }

      // Check for the Transcript navigation link - try multiple selectors to find it
      const hasTranscriptLink = await page.evaluate(() => {
        // Try different selectors that might contain the transcript link
        const selectors = [
          'a.e-9640-nav-bar-list-item', // Original selector
          'button[role="tab"]', // Generic tab buttons
          'li[role="presentation"] button', // List items with buttons
          'div[role="tablist"] button', // Buttons in a tablist
          'a[href*="transcript"]', // Links with transcript in the URL
          'button:contains("Transcript")', // Buttons containing the text Transcript
        ];

        // Helper function to check if element contains 'Transcript' text
        const hasTranscriptText = (el) => {
          return el.textContent.trim().toLowerCase() === 'transcript';
        };

        // Try each selector
        for (const selector of selectors) {
          try {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              // Check each element in the collection
              for (const el of elements) {
                if (hasTranscriptText(el)) {
                  console.log(`Found transcript link with selector: ${selector}`);
                  return { found: true, selector };
                }
              }
            }
          } catch (e) {
            // Ignore errors from invalid selectors
          }
        }

        // Try a more general approach - find any clickable element with "Transcript" text
        const allElements = document.querySelectorAll('a, button, div[role="button"]');
        for (const el of allElements) {
          if (hasTranscriptText(el)) {
            return { found: true, general: true };
          }
        }

        return { found: false };
      });

      console.log('Transcript link detection result:', hasTranscriptLink);

      if (!hasTranscriptLink.found) {
        // Try to check the page content directly for transcript content
        const hasTranscriptContent = await page.evaluate(() => {
          // Look for elements that might contain transcript text
          const transcript = document.body.innerText;

          // Check if the page already has significant text content that might be a transcript
          // (at least 20 lines with reasonable length)
          const lines = transcript.split('\n').filter(line => line.trim().length > 10);
          return lines.length > 20;
        });

        if (hasTranscriptContent) {
          console.log('No transcript tab found, but page appears to contain transcript content directly');
          // Continue to extract content
        } else {
          console.log('No transcript link or content found - this podcast may not have a transcript');
          await page.close().catch(e => console.log('Error closing page:', e.message));
          await browserPool.releaseBrowser();
          return null;
        }
      } else {
        // If we found a transcript link/tab, click it
        console.log('Clicking on Transcript tab...');
        await page.evaluate(() => {
          // Helper function to find transcript element
          function findTranscriptElement() {
            const selectors = [
              'a.e-9640-nav-bar-list-item',
              'button[role="tab"]',
              'li[role="presentation"] button',
              'div[role="tablist"] button',
              'a[href*="transcript"]'
            ];

            // Try each selector
            for (const selector of selectors) {
              const elements = document.querySelectorAll(selector);
              for (const el of elements) {
                if (el.textContent.trim().toLowerCase() === 'transcript') {
                  return el;
                }
              }
            }

            // Try general approach
            const allElements = document.querySelectorAll('a, button, div[role="button"]');
            for (const el of allElements) {
              if (el.textContent.trim().toLowerCase() === 'transcript') {
                return el;
              }
            }

            return null;
          }

          const transcriptEl = findTranscriptElement();
          if (transcriptEl) {
            transcriptEl.click();
            return true;
          }
          return false;
        });

        // Wait for transcript to load
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Try to find transcript content - check multiple potential containers
      console.log('Looking for transcript content...');
      const transcript = await page.evaluate(() => {
        // Try various selectors that might contain transcript content
        const possibleContainers = [
          // Original selector
          'div[class^="NavBar__NavBarPage"]',

          // Generic content containers
          'div[class*="transcript"]',
          'div[class*="Transcript"]',
          'div[data-testid*="transcript"]',

          // Try parent containers of text spans
          'div.Narrative__Container',
          'div[class*="narrative"]',

          // Most generic - any large text container
          'main',
          'article',
          'section'
        ];

        // Try each container selector
        for (const selector of possibleContainers) {
          try {
            const containers = document.querySelectorAll(selector);
            if (containers.length > 0) {
              // For each potential container
              for (const container of containers) {
                // Try different text element selectors
                const textSelectors = [
                  'span[data-encore-id="text"][dir="auto"]',
                  'p',
                  'span.Type__TypeElement',
                  'div[class*="text"]',
                  'span',
                  'div'
                ];

                for (const textSelector of textSelectors) {
                  const textElements = container.querySelectorAll(textSelector);
                  if (textElements.length > 10) { // Need a reasonable number of text elements
                    const text = Array.from(textElements)
                      .map(el => el.textContent.trim())
                      .filter(text => text.length > 0) // Filter out empty strings
                      .join('\n');

                    // Check if we have enough text
                    if (text.length > 200) {
                      return text;
                    }
                  }
                }
              }
            }
          } catch (e) {
            // Ignore errors from invalid selectors
          }
        }

        // If all selectors failed, try a more aggressive approach - get all text from the page
        try {
          // Get all paragraphs and spans with substantial text
          const allTextElements = document.querySelectorAll('p, span.Type__TypeElement, div[class*="text"] > span');
          const text = Array.from(allTextElements)
            .map(el => el.textContent.trim())
            .filter(text => text.length > 5) // Only include non-trivial text
            .join('\n');

          if (text.length > 200) {
            return text;
          }
        } catch (e) {
          // Ignore errors
        }

        return null;
      });

      // Log stats and limit to 10000 characters
      if (transcript) {
        const lineCount = transcript.split('\n').length;
        console.log(`Successfully extracted transcript (${lineCount} lines, ${transcript.length} chars)`);

        // Extract the episode ID from the URL
        const episodeIdMatch = episodeUrl.match(/episode\/([a-zA-Z0-9]+)/);
        const episodeId = episodeIdMatch ? episodeIdMatch[1] : null;

        // Save transcript to database if we have an episode ID
        if (episodeId) {
          try {
            console.log(`Saving podcast transcript to database for episode ${episodeId}`);
            await trackRepository.updateTrackLyrics(episodeId, transcript, 'spotify-transcript');
          } catch (dbError) {
            console.error('Error saving transcript to database:', dbError.message);
            // Continue even if database save fails
          }
        }

        await page.close().catch(e => console.log('Error closing page:', e.message));
        await browserPool.releaseBrowser();
        return transcript;
      } else {
        console.log('No transcript content found');
        await page.close().catch(e => console.log('Error closing page:', e.message));
        await browserPool.releaseBrowser();
        return null;
      }
    } catch (innerError) {
      console.error('Error during Puppeteer operation:', innerError.message);
      await browserPool.releaseBrowser();
      return null;
    }
  } catch (error) {
    console.error('Error scraping podcast transcript with Puppeteer:', error.message);
    return null;
  }
};

// Get track lyrics using Genius API
const getGeniusLyrics = async (title, artist) => {
  // Initialize Genius client with API key
  const geniusClient = new Genius.Client(config.geniusApiKey);

  try {
    // Search for the song using the API
    const searches = await geniusClient.songs.search(`${title} ${artist}`);

    // If no results found
    if (!searches || searches.length === 0) {
      console.log('No lyrics found in Genius');
      return null;
    }

    // Get the first search result
    const song = searches[0];
    console.log(`Found song: ${song.title} by ${song.artist.name}`);

    // Fetch the lyrics
    const lyrics = await song.lyrics();

    console.log('Successfully fetched lyrics from Genius');

    // Create response with lyrics data
    const lyricsData = {
      lyrics,
      title: song.title,
      artist: song.artist.name,
      source: 'genius',
      url: song.url,
      sourceDetail: 'Lyrics from Genius (third-party lyrics database)'
    };

    // Try to save to database - we need to extract a track ID from somewhere
    // This might come from a previous call or be passed as a parameter
    if (title && artist) {
      try {
        // Try to find the track in the database by title and artist
        const tracks = await trackRepository.findTracksByTitle(title);
        if (tracks && tracks.length > 0) {
          // Find the best match by artist
          const matchingTrack = tracks.find(track =>
            track.artist && track.artist.toLowerCase().includes(artist.toLowerCase()));

          if (matchingTrack) {
            console.log(`Saving Genius lyrics to database for track ${matchingTrack.trackId}`);
            await trackRepository.updateTrackLyrics(matchingTrack.trackId, lyrics, 'genius');
          }
        }
      } catch (dbError) {
        console.error('Error saving Genius lyrics to database:', dbError.message);
        // Continue even if database save fails
      }
    }

    return lyricsData;
  } catch (error) {
    console.error('Genius search/lyrics error:', error.message);
    return null;
  }
};

module.exports = {
  getSpotifyLyrics,
  getSpotifyPodcastTranscript,
  getGeniusLyrics
};