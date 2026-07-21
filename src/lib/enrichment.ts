import * as cheerio from 'cheerio';
import { searchDuckDuckGo, searchBrave, searchApifyGoogle } from './searchApis';

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





  // 2. Apify Google Search (Replicating n8n exactly)
  const apifyQuery = `${businessName} ${location} instagram`.trim();
  const apifyLinks = await searchApifyGoogle(apifyQuery);
  const apifyIgLink = apifyLinks.find(l => l.includes('instagram.com'));
  if (apifyIgLink) {
    return { url: apifyIgLink.split('?')[0].replace(/\/$/, ''), platform: 'Instagram', source: 'Apify API', htmlCache: html };
  }

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
