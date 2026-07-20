import Link from 'next/link';
import { getWorksheets } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

export default async function Home() {
  let tabs = [];
  try {
    tabs = await getWorksheets();
  } catch (err: any) {
    return (
      <div className="p-8 text-red-500">
        <h1 className="text-2xl mb-4">Error loading tabs</h1>
        <p>{err.message}</p>
        <p className="text-sm mt-4 text-gray-400">Make sure your Google Sheets credentials are in .env.local</p>
      </div>
    );
  }

  return (
    <main className="p-8 max-w-5xl mx-auto font-sans bg-gray-50 min-h-screen text-gray-900">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Lead Filtering & Qualification</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {tabs.map(tab => (
          <Link href={`/tab/${encodeURIComponent(tab.title)}`} key={tab.id} className="block group">
            <div className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition bg-white h-full">
              <h2 className="text-xl font-semibold mb-2 group-hover:text-blue-600 transition">{tab.title}</h2>
              <p className="text-gray-500 text-sm">{Math.max(0, tab.rowCount - 1)} total rows</p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
