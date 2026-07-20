import { NextRequest, NextResponse } from 'next/server';
import { getRows, getWorksheetByTitle } from '@/lib/sheets';
import { findSocialsWaterfall } from '@/lib/enrichment';

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
      
      // Resumability Guarantee: process only if Rating Filter Pass and Social Status blank
      if (row.get('Rating Status') !== 'Pass' || row.get('Social Status')) {
        continue;
      }

      const website = row.get('Site Url') || null;
      const businessName = row.get('Name') || '';
      const location = row.get('Address') || '';

      const { url, platform, source } = await findSocialsWaterfall(website, businessName, location);
      
      if (url) {
        row.set('Insta Url', url);
        row.set('Social Source', source);
        row.set('Social Status', 'Pass');
      } else {
        row.set('Social Source', source);
        row.set('Social Status', 'Fail');
      }
      
      row.set('Enrichment Date', new Date().toISOString());
      await row.save();
      
      processedCount++;
      // Delay to avoid rate limits
      await delay(500);
    }

    return NextResponse.json({ success: true, processedCount });
  } catch (error: any) {
    console.error('Error running stage 2:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
