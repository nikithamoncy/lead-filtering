import { NextRequest, NextResponse } from 'next/server';
import { getRows, getWorksheetByTitle } from '@/lib/sheets';
import { searchDuckDuckGo } from '@/lib/searchApis';

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
      
      // Resumability: run if Social Status is Pass and Site Url is blank
      if (row.get('Social Status') !== 'Pass' || row.get('Site Url')) {
        continue;
      }

      const businessName = row.get('Name') || '';
      const location = row.get('Address') || '';
      const ddgLinks = await searchDuckDuckGo(`"${businessName}" "${location}" website`);
      const possibleWeb = ddgLinks.find(l => !l.includes('instagram.com') && !l.includes('facebook.com') && !l.includes('yelp.com'));
      
      if (possibleWeb) {
        row.set('Site Url', possibleWeb);
        row.set('Website Source', 'Fallback Search');
      } else {
        row.set('Website Source', 'None');
      }
      
      row.set('Enrichment Date', new Date().toISOString());
      await row.save();
      processedCount++;
      await delay(500); // Prevent Google Sheets rate limits
    }

    return NextResponse.json({ success: true, processedCount });
  } catch (error: any) {
    console.error('Error running stage 3:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
