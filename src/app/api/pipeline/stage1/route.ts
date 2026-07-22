import { NextRequest, NextResponse } from 'next/server';
import { getRows, getWorksheetByTitle } from '@/lib/sheets';

export const maxDuration = 60;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(request: NextRequest) {
  try {
    const { tabName, batchSize = 100 } = await request.json();
    if (!tabName) {
      return NextResponse.json({ success: false, error: 'Missing tabName parameter' }, { status: 400 });
    }

    const sheet = await getWorksheetByTitle(tabName);
    if (!sheet) {
      return NextResponse.json({ success: false, error: 'Tab not found' }, { status: 404 });
    }
    
    // Ensure the header exists
    await sheet.loadHeaderRow();
    
    const rows = await getRows(tabName);
    let processedCount = 0;

    for (const row of rows) {
      if (processedCount >= batchSize) break;
      
      // Resumability Guarantee: Only process if 'Rating Status' is blank
      if (row.get('Rating Status')) {
        continue;
      }

      const rating = parseFloat(row.get('Review Star'));
      const reviewCount = parseInt(row.get('Review'), 10);
      
      let pass = false;
      if (!isNaN(rating) && !isNaN(reviewCount)) {
        if (reviewCount >= 200 && rating >= 4.0) {
          pass = true;
        } else if (reviewCount >= 150 && rating >= 4.1) {
          pass = true;
        } else if (reviewCount >= 100 && rating >= 4.3) {
          pass = true;
        } else if (reviewCount >= 50 && rating >= 4.5) {
          pass = true;
        }
      }

      row.set('Rating Status', pass ? 'Pass' : 'Fail');
      row.set('Enrichment Date', new Date().toISOString());
      
      await row.save();
      processedCount++;
      await delay(500); // Prevent Google Sheets rate limits
    }

    return NextResponse.json({ success: true, processedCount });
  } catch (error: any) {
    console.error('Error running stage 1:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
