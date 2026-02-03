import { API_BASE } from '../utils'

interface ApiExplorerProps {
  result: { type: string; data: unknown } | null
  lookupId: string
  setLookupId: (id: string) => void
  setResult: (result: { type: string; data: unknown } | null) => void
  onDeleteAll: () => void
}

export function ApiExplorer({ result, lookupId, setLookupId, setResult, onDeleteAll }: ApiExplorerProps) {
  const fetchHealth = async () => {
    const res = await fetch(`${API_BASE}/health`)
    setResult({ type: 'health', data: await res.json() })
  }

  const fetchRequests = async () => {
    const res = await fetch(`${API_BASE}/requests`)
    const data = await res.json()
    setResult({ type: 'list', data: data.requests || [] })
  }

  const lookupRequest = async () => {
    if (!lookupId) return
    const res = await fetch(`${API_BASE}/requests/${lookupId}`)
    setResult({ type: 'single', data: await res.json() })
  }

  const lookupCallbackLogs = async () => {
    if (!lookupId) return
    const res = await fetch(`${API_BASE}/requests/${lookupId}/callback-logs`)
    setResult({ type: 'callback-logs', data: await res.json() })
  }

  return (
    <div className="mt-8 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-bold">API Explorer</h2>
        <p className="text-gray-500 text-sm">Test the REST endpoints</p>
      </div>

      <div className="p-6">
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={fetchHealth}
            className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg hover:bg-green-100 transition-colors"
          >
            <span className="font-mono text-xs bg-green-200 px-1.5 py-0.5 rounded">GET</span>
            <span className="text-sm font-medium">/api/health</span>
          </button>

          <button
            onClick={fetchRequests}
            className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <span className="font-mono text-xs bg-blue-200 px-1.5 py-0.5 rounded">GET</span>
            <span className="text-sm font-medium">/api/requests</span>
          </button>

          <button
            onClick={onDeleteAll}
            className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors"
          >
            <span className="font-mono text-xs bg-red-200 px-1.5 py-0.5 rounded">DELETE</span>
            <span className="text-sm font-medium">/api/requests</span>
          </button>
        </div>

        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <span className="font-mono text-xs bg-gray-200 px-1.5 py-0.5 rounded">GET</span>
          <span className="text-sm text-gray-600">/api/requests/</span>
          <input
            type="text"
            placeholder="paste request ID here"
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value)}
            className="flex-1 max-w-xs border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-mono"
          />
          <button
            onClick={lookupRequest}
            disabled={!lookupId}
            className="bg-gray-900 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Lookup
          </button>
          <button
            onClick={lookupCallbackLogs}
            disabled={!lookupId}
            className="bg-orange-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Callback Logs
          </button>
        </div>

        {result && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="font-medium text-gray-700">Response</span>
              <button onClick={() => setResult(null)} className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
            </div>
            <pre className="text-xs bg-white p-3 rounded border overflow-auto max-h-60 font-mono">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
