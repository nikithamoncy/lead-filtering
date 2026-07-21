import * as cheerio from 'cheerio';

export async function searchDuckDuckGo(query: string): Promise<string[]> {
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)'
      }
    });
    if (!res.ok) return [];
    
    const html = await res.text();
    const $ = cheerio.load(html);
    const links: string[] = [];
    
    $('a').each((_, el) => {
      const href = $(el).attr('href');
      if (href && href.includes('uddg=')) {
        const urlMatch = href.match(/uddg=([^&]+)/);
        if (urlMatch) {
          links.push(decodeURIComponent(urlMatch[1]));
        }
      } else if (href && href.startsWith('http')) {
        links.push(href);
      }
    });
    return links;
  } catch (err) {
    console.error('DDG error:', err);
    return [];
  }
}

export async function searchBrave(query: string): Promise<string[]> {
  const key = process.env.BRAVE_API_KEY;
  if (!key) return [];
  
  try {
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`, {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': key
      }
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (data.web && data.web.results) {
      return data.web.results.map((r: any) => r.url);
    }
    return [];
  } catch (err) {
    console.error('Brave API error:', err);
    return [];
  }
}

export async function searchApifyGoogle(query: string): Promise<string[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) return [];

  try {
    const res = await fetch(`https://api.apify.com/v2/acts/apify~google-search-scraper/run-sync-get-dataset-items?token=${token}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        "focusOnPaidAds": false,
        "forceExactMatch": false,
        "includeIcons": false,
        "includeUnfilteredResults": false,
        "maxPagesPerQuery": 1,
        "maximumLeadsEnrichmentRecords": 0,
        "mobileResults": false,
        "queries": query,
        "resultsPerPage": 20,
        "saveHtml": false,
        "saveHtmlToKeyValueStore": false
      })
    });

    if (!res.ok) {
      console.error('Apify API error:', await res.text());
      return [];
    }
    
    const items = await res.json();
    if (!items || items.length === 0) return [];
    
    // Apify dataset items have an array of organicResults for each query
    const results = items[0]?.organicResults || [];
    return results.map((r: any) => r.url).filter(Boolean);
  } catch (err) {
    console.error('Apify fetch error:', err);
    return [];
  }
}
