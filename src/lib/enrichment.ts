import * as cheerio from 'cheerio';
import { searchDuckDuckGo, searchBrave } from './searchApis';

const BOOKING_KEYWORDS = [
  'fresha', 'booksy', 'vagaro', 'glossgenius', 'boulevard', 
  'squareup', 'acuity', 'schedulicity', 'book now', 'appointments'
];

export async function fetchHtml(url: string) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url.startsWith('http') ? url : `https://${url}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function checkUrlExists(url: string) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url.startsWith('http') ? url : `https://${url}`, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

export function extractSocials(html: string) {
  const $ = cheerio.load(html);
  let instagram = '';
  let facebook = '';
  
  $('a').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const lower = href.toLowerCase();
    if (!instagram && (lower.includes('instagram.com/') && !lower.includes('/p/'))) {
      instagram = href;
    }
    if (!facebook && (lower.includes('facebook.com/') && !lower.includes('/sharer'))) {
      facebook = href;
    }
  });
  
  return { instagram, facebook };
}

export function generateGuesses(businessName: string): string[] {
  const base = businessName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return [base, `${base}salon`, `${base}studio`, `${base}beauty`, `the${base}`];
}

export async function findSocialsWaterfall(websiteUrl: string | null, businessName: string, location: string) {
  let html = null;
  // 1. Website Scrape
  if (websiteUrl) {
    html = await fetchHtml(websiteUrl);
    if (html) {
      const socials = extractSocials(html);
      if (socials.instagram || socials.facebook) {
        return {
          url: socials.instagram || socials.facebook,
          platform: socials.instagram ? 'Instagram' : 'Facebook',
          source: 'Website Scrape',
          htmlCache: html // Cache for Stage 4
        };
      }
    }
  }

  // 2. URL Guess
  const guesses = generateGuesses(businessName);
  for (const guess of guesses) {
    const igUrl = `https://instagram.com/${guess}`;
    if (await checkUrlExists(igUrl)) {
      return { url: igUrl, platform: 'Instagram', source: 'URL Guess', htmlCache: html };
    }
    const fbUrl = `https://facebook.com/${guess}`;
    if (await checkUrlExists(fbUrl)) {
      return { url: fbUrl, platform: 'Facebook', source: 'URL Guess', htmlCache: html };
    }
  }

  // 3. DuckDuckGo HTML Fallback
  const ddgQuery = `"${businessName}" "${location}" instagram`;
  const ddgLinks = await searchDuckDuckGo(ddgQuery);
  const igLink = ddgLinks.find(l => l.includes('instagram.com/') && !l.includes('/p/'));
  if (igLink) return { url: igLink, platform: 'Instagram', source: 'DuckDuckGo', htmlCache: html };
  
  const fbLink = ddgLinks.find(l => l.includes('facebook.com/') && !l.includes('/events/'));
  if (fbLink) return { url: fbLink, platform: 'Facebook', source: 'DuckDuckGo', htmlCache: html };

  // 4. Search API (Brave)
  const braveLinks = await searchBrave(ddgQuery);
  const braveIgLink = braveLinks.find(l => l.includes('instagram.com/'));
  if (braveIgLink) return { url: braveIgLink, platform: 'Instagram', source: 'Search API', htmlCache: html };

  const braveFbLink = braveLinks.find(l => l.includes('facebook.com/'));
  if (braveFbLink) return { url: braveFbLink, platform: 'Facebook', source: 'Search API', htmlCache: html };

  return { url: null, platform: 'None', source: 'None', htmlCache: html };
}

export function detectBooking(html: string) {
  const lowerHtml = html.toLowerCase();
  for (const keyword of BOOKING_KEYWORDS) {
    if (lowerHtml.includes(keyword)) {
      if (['book now', 'appointments'].includes(keyword)) return 'Generic';
      // Capitalize platform
      return keyword.charAt(0).toUpperCase() + keyword.slice(1);
    }
  }
  return null;
}
