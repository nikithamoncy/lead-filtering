import { NextRequest, NextResponse } from 'next/server';
import { getRows, getGoogleDoc } from '@/lib/sheets';

export const maxDuration = 60;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(request: NextRequest) {
  try {
    const { tabName, batchSize = 100 } = await request.json();
    if (!tabName) return NextResponse.json({ success: false, error: 'Missing tabName' }, { status: 400 });

    const doc = await getGoogleDoc();
    const sourceSheet = Object.values(doc.sheetsById).find(s => s.title === tabName);
    if (!sourceSheet) return NextResponse.json({ success: false, error: 'Tab not found' }, { status: 404 });
    
    await sourceSheet.loadHeaderRow();

    const rows = await getRows(tabName);
    let deletedCount = 0;
    
    // Process backwards to allow deletion without affecting indices of subsequent rows
    for (let i = rows.length - 1; i >= 0; i--) {
      if (deletedCount >= batchSize) break;
      const row = rows[i];
      
      const rowData = row.toObject();
      const socialApproveKey = Object.keys(rowData).find(k => k.toLowerCase() === 'social approve');
      const socialApprove = socialApproveKey ? rowData[socialApproveKey]?.toString().trim().toLowerCase() : undefined;
      
      if (socialApprove === 'fail') {
        await row.delete();
        deletedCount++;
        await delay(500); // Prevent Google Sheets rate limits
      }
    }

    return NextResponse.json({ success: true, archivedCount: deletedCount });
  } catch (error: any) {
    console.error('Error running delete step:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
