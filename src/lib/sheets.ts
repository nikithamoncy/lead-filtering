import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// Helper to get authenticated GoogleSpreadsheet document
export async function getGoogleDoc() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!email || !key || !sheetId) {
    throw new Error('Google Sheets credentials are not fully configured in environment variables.');
  }

  // Handle properly escaped newlines in the private key string from env
  const formattedKey = key.replace(/\\n/g, '\n');

  const serviceAccountAuth = new JWT({
    email,
    key: formattedKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
  await doc.loadInfo();
  return doc;
}

// Get all worksheet titles
export async function getWorksheets() {
  const doc = await getGoogleDoc();
  return Object.values(doc.sheetsById).map(sheet => ({
    id: sheet.sheetId,
    title: sheet.title,
    rowCount: sheet.rowCount,
  }));
}

// Get a specific worksheet by title
export async function getWorksheetByTitle(title: string): Promise<GoogleSpreadsheetWorksheet | null> {
  const doc = await getGoogleDoc();
  const sheet = Object.values(doc.sheetsById).find(s => s.title === title);
  return sheet || null;
}

// Get all rows from a worksheet (with basic pagination/limit if needed, though getRows defaults to all if not huge)
export async function getRows(sheetTitle: string, offset = 0, limit = 5000) {
  const sheet = await getWorksheetByTitle(sheetTitle);
  if (!sheet) throw new Error(`Sheet ${sheetTitle} not found`);
  
  const rows = await sheet.getRows({ offset, limit });
  return rows;
}
