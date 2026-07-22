import { NextRequest, NextResponse } from 'next/server';
import { getRows, getWorksheetByTitle } from '@/lib/sheets';

export const maxDuration = 60;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(request: NextRequest) {
  try {
    const { tabName } = await request.json();
    if (!tabName) return NextResponse.json({ success: false, error: 'Missing tabName' }, { status: 400 });

    const sheet = await getWorksheetByTitle(tabName);
    if (!sheet) return NextResponse.json({ success: false, error: 'Tab not found' }, { status: 404 });
    
    await sheet.loadHeaderRow();
    const rows = await getRows(tabName);
    
    const seenNames = new Set<string>();
    const duplicates = [];

    // Find duplicates (keeping the first occurrence)
    for (const row of rows) {
      const name = (row.get('Name') || '').toString().trim().toLowerCase();
      if (!name) continue;
      
      if (seenNames.has(name)) {
        duplicates.push(row);
      } else {
        seenNames.add(name);
      }
    }

    let deletedCount = 0;
    // Delete from bottom to top to avoid shifting row numbers for subsequent deletions
    for (let i = duplicates.length - 1; i >= 0; i--) {
      await duplicates[i].delete();
      deletedCount++;
      await delay(300); // Prevent rate limits
    }

    return NextResponse.json({ success: true, deletedCount });
  } catch (error: any) {
    console.error('Error removing duplicates:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
