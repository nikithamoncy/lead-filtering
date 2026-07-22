import { NextRequest, NextResponse } from 'next/server';
import { getRows, getWorksheetByTitle } from '@/lib/sheets';
import { fetchHtml, detectBooking } from '@/lib/enrichment';

export const maxDuration = 60;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(request: NextRequest) {
  try {
    const { tabName, batchSize = 20 } = await request.json();
    if (!tabName) return NextResponse.json({ success: false, error: 'Missing tabName' }, { status: 400 });

    const sheet = await getWorksheetByTitle(tabName);
    if (!sheet) return NextResponse.json({ success: false, error: 'Tab not found' }, { status: 404 });
    
    await sheet.loadHeaderRow();
    const rows = await getRows(tabName);
    let processedCount = 0;

    for (const row of rows) {
      if (processedCount >= batchSize) break;
      
      const website = row.get('Site Url');
      // Resumability: run if Site Url is present and Booking Platform is blank
      if (!website || row.get('Booking Platform')) {
        continue;
      }

      const html = await fetchHtml(website);
      if (html) {
        const platform = detectBooking(html);
        if (platform) {
          row.set('Booking Platform', platform);
          // Just setting the platform name. We'd have to scrape deeper for exact booking URL, but keyword is a good proxy.
          row.set('Booking Url', website); 
        } else {
          row.set('Booking Platform', 'None');
        }
      } else {
        row.set('Booking Platform', 'Error fetching');
      }
      
      row.set('Enrichment Date', new Date().toISOString());
      await row.save();
      processedCount++;
      await delay(500); // Prevent Google Sheets rate limits
    }

    return NextResponse.json({ success: true, processedCount });
  } catch (error: any) {
    console.error('Error running stage 4:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
