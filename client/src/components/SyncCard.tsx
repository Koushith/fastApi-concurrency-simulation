import { SERVER_URL } from '../utils'

interface SyncResult {
  reportName: string
  elapsed: number
  download_url?: string
}

interface SyncCardProps {
  transactions: number
  setTransactions: (n: number) => void
  loading: boolean
  results: SyncResult[]
  onGenerate: () => void
  onClearResults: () => void
}

export function SyncCard({
  transactions,
  setTransactions,
  loading,
  results,
  onGenerate,
  onClearResults,
}: SyncCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-red-50 border-b border-red-100 px-5 py-3 flex justify-between items-center">
        <span className="text-red-600 font-bold text-sm">SYNC API</span>
        <code className="text-gray-400 text-xs">POST /api/sync</code>
      </div>
      <div className="p-5">
        <p className="text-gray-500 text-sm mb-4">
          User waits while report generates. Returns CSV file directly.
        </p>
        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm text-gray-500">Rows:</label>
          <input
            type="number"
            value={transactions}
            onChange={(e) => setTransactions(Math.min(99, Math.max(1, +e.target.value || 1)))}
            className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <span className="text-xs text-gray-400">max 99</span>
        </div>
        <button
          onClick={onGenerate}
          disabled={loading}
          className="w-full bg-red-500 text-white font-semibold py-3 rounded-xl hover:bg-red-600 disabled:opacity-50"
        >
          {loading ? 'Generating...' : 'Generate Report (Sync)'}
        </button>

        {loading && (
          <div className="mt-4 flex items-center gap-2 text-amber-600 text-sm">
            <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            Blocking... user must wait
          </div>
        )}

        {results.length > 0 && !loading && (
          <div className="mt-4 space-y-2 max-h-[250px] overflow-y-auto">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-gray-500">{results.length} report(s)</span>
              <button
                onClick={onClearResults}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Clear
              </button>
            </div>
            {results.map((result, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-red-50 rounded-lg border border-red-100">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-800">{result.reportName}</span>
                  <span className="text-xs text-red-600 bg-red-100 px-2 py-0.5 rounded">
                    {(result.elapsed / 1000).toFixed(1)}s
                  </span>
                </div>
                {result.download_url && (
                  <a
                    href={`${SERVER_URL}${result.download_url}`}
                    className="bg-red-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-red-700"
                    download
                  >
                    Download
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
