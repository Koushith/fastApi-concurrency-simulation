interface AsyncCardProps {
  transactions: number
  setTransactions: (n: number) => void
  failMode: boolean
  onGenerate: () => void
  onToggleFailMode: () => void
}

export function AsyncCard({
  transactions,
  setTransactions,
  failMode,
  onGenerate,
  onToggleFailMode,
}: AsyncCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-blue-50 border-b border-blue-100 px-5 py-3 flex justify-between items-center">
        <span className="text-blue-600 font-bold text-sm">ASYNC API</span>
        <code className="text-gray-400 text-xs">POST /api/async</code>
      </div>
      <div className="p-5">
        <p className="text-gray-500 text-sm mb-4">
          Returns immediately. Notifies via webhook when done.
        </p>
        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm text-gray-500">Rows:</label>
          <input
            type="number"
            value={transactions}
            onChange={(e) => setTransactions(Math.min(500, Math.max(1, +e.target.value || 1)))}
            className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <span className="text-xs text-gray-400">no limit</span>
        </div>
        <button
          onClick={onGenerate}
          className="w-full bg-blue-500 text-white font-semibold py-3 rounded-xl hover:bg-blue-600"
        >
          Generate Report (Async)
        </button>

        <label className="flex items-center gap-2 mt-4 cursor-pointer">
          <input
            type="checkbox"
            checked={failMode}
            onChange={onToggleFailMode}
            className="w-4 h-4 accent-red-500"
          />
          <span className="text-sm text-gray-500">Simulate callback failures (test retry logic)</span>
        </label>
      </div>
    </div>
  )
}
