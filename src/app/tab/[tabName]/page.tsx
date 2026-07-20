'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';

export default function TabDashboard({ params }: { params: Promise<{ tabName: string }> }) {
  const { tabName } = use(params);
  const decodedTabName = decodeURIComponent(tabName);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [batchSize, setBatchSize] = useState(20);
  const [stage1BatchSize, setStage1BatchSize] = useState(100);
  const [page, setPage] = useState(1);
  const rowsPerPage = 100;
  const fetchRows = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sheets/rows?tab=${encodeURIComponent(decodedTabName)}`);
      const data = await res.json();
      if (data.success) {
        setRows(data.rows);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRows();
  }, [decodedTabName]);

  const runStage = async (stage: string) => {
    setActionInProgress(stage);
    const size = stage === 'stage1' ? stage1BatchSize : batchSize;
    try {
      const res = await fetch(`/api/pipeline/${stage}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tabName: decodedTabName, batchSize: size })
      });
      await res.json();
      await fetchRows();
    } catch (e) {
      console.error(e);
    }
    setActionInProgress(null);
  };

  // Summaries
  const stage1Pending = rows.filter(r => !r['Rating Status']).length;
  const stage2Pending = rows.filter(r => r['Rating Status'] === 'Pass' && !r['Social Status']).length;
  const stage3Pending = rows.filter(r => r['Social Status'] === 'Pass' && !r['Site Url']).length;
  const stage4Pending = rows.filter(r => !!r['Site Url'] && !r['Booking Platform']).length;
  
  const toArchive = rows.filter(r => r['Rating Status'] === 'Fail' || r['Social Status'] === 'Fail').length;

  const summary = {
    total: rows.length,
    stage1Pass: rows.filter(r => r['Rating Status'] === 'Pass').length,
    stage1Fail: rows.filter(r => r['Rating Status'] === 'Fail').length,
    stage2Pass: rows.filter(r => r['Social Status'] === 'Pass').length,
    stage2Fail: rows.filter(r => r['Social Status'] === 'Fail').length,
  };

  return (
    <main className="p-8 max-w-7xl mx-auto font-sans bg-gray-50 min-h-screen text-gray-900">
      <div className="mb-6">
        <Link href="/" className="text-blue-600 hover:underline mb-4 inline-block">&larr; Back to Tabs</Link>
        <h1 className="text-3xl font-bold">{decodedTabName} Pipeline</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8 bg-white p-4 rounded-xl border border-gray-200">
        <div><div className="text-sm text-gray-500">Total Rows</div><div className="text-2xl">{summary.total}</div></div>
        <div><div className="text-sm text-gray-500">Stage 1 Pass</div><div className="text-2xl text-green-600">{summary.stage1Pass}</div></div>
        <div><div className="text-sm text-gray-500">Stage 1 Fail</div><div className="text-2xl text-red-600">{summary.stage1Fail}</div></div>
        <div><div className="text-sm text-gray-500">Stage 2 Pass</div><div className="text-2xl text-green-600">{summary.stage2Pass}</div></div>
        <div><div className="text-sm text-gray-500">Stage 2 Fail</div><div className="text-2xl text-red-600">{summary.stage2Fail}</div></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-xl border border-gray-200 flex flex-col justify-between">
          <div>
            <h3 className="font-semibold mb-2">1. Rating Filter</h3>
            <p className="text-sm text-gray-500 mb-4">{stage1Pending} pending</p>
            <div className="mb-4">
              <label className="text-xs text-gray-500 block mb-1">Batch Size</label>
              <select value={stage1BatchSize} onChange={e => setStage1BatchSize(Number(e.target.value))} className="w-full border rounded p-1 text-sm">
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value={500}>500</option>
                <option value={1000}>1000</option>
              </select>
            </div>
          </div>
          <button 
            disabled={!!actionInProgress || stage1Pending === 0}
            onClick={() => runStage('stage1')}
            className="bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {actionInProgress === 'stage1' ? 'Running...' : 'Run Filter'}
          </button>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 flex flex-col justify-between">
          <div>
            <h3 className="font-semibold mb-2">2. Social Discovery</h3>
            <p className="text-sm text-gray-500 mb-4">{stage2Pending} pending</p>
            <div className="mb-4">
              <label className="text-xs text-gray-500 block mb-1">Batch Size</label>
              <select value={batchSize} onChange={e => setBatchSize(Number(e.target.value))} className="w-full border rounded p-1 text-sm">
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
          <button 
            disabled={!!actionInProgress || stage2Pending === 0}
            onClick={() => runStage('stage2')}
            className="bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {actionInProgress === 'stage2' ? 'Running...' : 'Run Discovery'}
          </button>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 flex flex-col justify-between">
          <div>
            <h3 className="font-semibold mb-2">3. Website Discovery</h3>
            <p className="text-sm text-gray-500 mb-4">{stage3Pending} pending</p>
          </div>
          <button 
            disabled={!!actionInProgress || stage3Pending === 0}
            onClick={() => runStage('stage3')}
            className="bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {actionInProgress === 'stage3' ? 'Running...' : 'Run Websites'}
          </button>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 flex flex-col justify-between">
          <div>
            <h3 className="font-semibold mb-2">4. Booking Detection</h3>
            <p className="text-sm text-gray-500 mb-4">{stage4Pending} pending</p>
          </div>
          <button 
            disabled={!!actionInProgress || stage4Pending === 0}
            onClick={() => runStage('stage4')}
            className="bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {actionInProgress === 'stage4' ? 'Running...' : 'Run Booking'}
          </button>
        </div>
      </div>

      <div className="mb-8 bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h2 className="font-semibold">Rows Preview</h2>
          <button 
            disabled={!!actionInProgress || toArchive === 0}
            onClick={() => {
              if (confirm(`Archive ${toArchive} failed rows?`)) {
                runStage('archive');
              }
            }}
            className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
          >
            Archive Failed Rows ({toArchive})
          </button>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading rows...</div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 bg-gray-50">
                <tr>
                  <th className="px-4 py-3">Business</th>
                  <th className="px-4 py-3">Rating</th>
                  <th className="px-4 py-3">Reviews</th>
                  <th className="px-4 py-3">Stage 1</th>
                  <th className="px-4 py-3">Stage 2 (Social)</th>
                  <th className="px-4 py-3">Website</th>
                  <th className="px-4 py-3">Booking</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice((page - 1) * rowsPerPage, page * rowsPerPage).map((row, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-4 py-3 font-medium text-gray-900 truncate max-w-[200px]">{row['Name']}</td>
                    <td className="px-4 py-3">{row['Review Star']}</td>
                    <td className="px-4 py-3">{row['Review']}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${row['Rating Status'] === 'Pass' ? 'bg-green-100 text-green-800' : row['Rating Status'] === 'Fail' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                        {row['Rating Status'] || 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${row['Social Status'] === 'Pass' ? 'bg-green-100 text-green-800' : row['Social Status'] === 'Fail' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                        {row['Social Status'] || 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3 truncate max-w-[150px]">{row['Site Url']}</td>
                    <td className="px-4 py-3">{row['Booking Platform']}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!loading && rows.length > rowsPerPage && (
            <div className="p-4 flex justify-between items-center border-t text-sm text-gray-600 bg-gray-50">
              <div>
                Showing {(page - 1) * rowsPerPage + 1} to {Math.min(page * rowsPerPage, rows.length)} of {rows.length} rows
              </div>
              <div className="space-x-2">
                <button 
                  disabled={page === 1} 
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1 bg-white border rounded disabled:opacity-50 hover:bg-gray-100"
                >
                  Previous
                </button>
                <button 
                  disabled={page * rowsPerPage >= rows.length} 
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1 bg-white border rounded disabled:opacity-50 hover:bg-gray-100"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
