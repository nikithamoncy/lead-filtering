import { NextRequest, NextResponse } from 'next/server';
import { getRows, getWorksheetByTitle } from '@/lib/sheets';
import { findSocialsWaterfall } from '@/lib/enrichment';

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
      
      // Resumability Guarantee: process only if Rating Filter Pass and Social Status blank
      if (row.get('Rating Status') !== 'Pass' || row.get('Social Status')) {
        continue;
      }

      // If Insta Url is already provided manually, just mark it as Pass and skip searching
      const existingInsta = row.get('Insta Url');
      if (existingInsta && existingInsta.trim() !== '') {
        row.set('Social Status', 'Pass');
        row.set('Social Source', 'Manual/Existing');
        row.set('Enrichment Date', new Date().toISOString());
        await row.save();
        processedCount++;
        await delay(500);
        continue;
      }

      const website = row.get('Site Url') || null;
      const businessName = row.get('Name') || '';
      const location = row.get('Address') || '';

      let socials: any = { url: null, platform: 'None', source: 'None' };
      try {
        socials = await findSocialsWaterfall(website, businessName, location);
      } catch (err: any) {
        if (err.message === 'APIFY_TIMEOUT') {
          break; // Stop batch gracefully, leaving this row's social status blank
        } else if (err.message === 'APIFY_CREDITS_EXPIRED') {
          return NextResponse.json({ success: false, error: 'APIFY_CREDITS_EXPIRED' }, { status: 402 });
        }
        throw err;
      }
      
      const { url, platform, source } = socials;
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
    if (error.message === 'APIFY_CREDITS_EXPIRED') {
      return NextResponse.json({ success: false, error: 'APIFY_CREDITS_EXPIRED' }, { status: 402 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
