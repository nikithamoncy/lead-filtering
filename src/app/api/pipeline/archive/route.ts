import { NextRequest, NextResponse } from 'next/server';
import { getRows, getWorksheetByTitle, getGoogleDoc } from '@/lib/sheets';

export async function POST(request: NextRequest) {
  try {
    const { tabName, batchSize = 100 } = await request.json();
    if (!tabName) return NextResponse.json({ success: false, error: 'Missing tabName' }, { status: 400 });

    const doc = await getGoogleDoc();
    const sourceSheet = Object.values(doc.sheetsById).find(s => s.title === tabName);
    if (!sourceSheet) return NextResponse.json({ success: false, error: 'Tab not found' }, { status: 404 });
    
    const archiveTabName = `${tabName}_Archive`;
    let archiveSheet = Object.values(doc.sheetsById).find(s => s.title === archiveTabName);
    
    await sourceSheet.loadHeaderRow();
    
    if (!archiveSheet) {
      // Create archive sheet with same headers + Fail Stage/Reason/Archived Date
      const headers = [...sourceSheet.headerValues, 'Fail Stage', 'Fail Reason', 'Archived Date'];
      archiveSheet = await doc.addSheet({ title: archiveTabName, headerValues: headers });
    } else {
      await archiveSheet.loadHeaderRow();
    }

    const rows = await getRows(tabName);
    let archivedCount = 0;
    
    // Process backwards to allow deletion without affecting indices of subsequent rows
    // google-spreadsheet v4 rows can be deleted using row.delete()
    for (let i = rows.length - 1; i >= 0; i--) {
      if (archivedCount >= batchSize) break;
      const row = rows[i];
      const ratingStatus = row.get('Rating Status');
      const socialStatus = row.get('Social Status');
      
      let failStage = '';
      let failReason = '';
      
      if (ratingStatus === 'Fail') {
        failStage = 'Rating Filter';
        failReason = `Rating: ${row.get('Review Star')}, Count: ${row.get('Review')}`;
      } else if (socialStatus === 'Fail') {
        failStage = 'Social Discovery';
        failReason = 'No IG/FB found after all fallbacks';
      }
      
      if (failStage) {
        const rowData = row.toObject();
        rowData['Fail Stage'] = failStage;
        rowData['Fail Reason'] = failReason;
        rowData['Archived Date'] = new Date().toISOString();
        
        await archiveSheet.addRow(rowData);
        await row.delete();
        archivedCount++;
      }
    }

    return NextResponse.json({ success: true, archivedCount });
  } catch (error: any) {
    console.error('Error running archive step:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
