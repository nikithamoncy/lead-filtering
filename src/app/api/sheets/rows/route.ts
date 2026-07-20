import { NextRequest, NextResponse } from 'next/server';
import { getRows } from '@/lib/sheets';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tabName = searchParams.get('tab');
    if (!tabName) {
      return NextResponse.json({ success: false, error: 'Missing tab parameter' }, { status: 400 });
    }

    const rows = await getRows(tabName);
    
    // google-spreadsheet rows contain internal state, convert to plain objects
    // Also include the rowNumber so we can update specific rows later if needed
    const plainRows = rows.map(row => ({
      ...row.toObject(),
      _rowNumber: row.rowNumber
    }));

    return NextResponse.json({ success: true, rows: plainRows });
  } catch (error: any) {
    console.error('Error fetching sheet rows:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
