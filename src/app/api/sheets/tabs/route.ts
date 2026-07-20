import { NextResponse } from 'next/server';
import { getWorksheets } from '@/lib/sheets';

export async function GET() {
  try {
    const tabs = await getWorksheets();
    return NextResponse.json({ success: true, tabs });
  } catch (error: any) {
    console.error('Error fetching sheets tabs:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
