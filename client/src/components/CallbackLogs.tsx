import type { CallbackLogsResponse, RequestRecord } from '../types'

interface CallbackLogsProps {
  requestId: string
  setRequestId: (id: string) => void
  logs: CallbackLogsResponse | null
  loading: boolean
  recentAsyncRequests: RequestRecord[]
  onFetch: (id?: string) => void
  onClear: () => void
}

export function CallbackLogs({
  requestId,
  setRequestId,
  logs,
  loading,
  recentAsyncRequests,
  onFetch,
  onClear,
}: CallbackLogsProps) {
  return (
    <div className="mt-8 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-orange-50 border-b border-orange-200 px-6 py-4">
        <h2 className="text-lg font-bold text-orange-800">Callback Logs</h2>
        <p className="text-orange-600 text-sm">Track webhook delivery attempts and retry history</p>
      </div>

      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 max-w-md">
            <label className="block text-xs text-gray-500 mb-1">Request ID</label>
            <input
              type="text"
              placeholder="Paste request ID to view callback logs"
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
            />
          </div>
          <button
            onClick={() => onFetch()}
            disabled={!requestId || loading}
            className="mt-5 bg-orange-500 text-white font-semibold px-6 py-2 rounded-xl hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2"
          >
            {loading && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            Fetch Logs
          </button>
          {logs && (
            <button
              onClick={onClear}
              className="mt-5 text-gray-500 hover:text-gray-700 px-3 py-2"
            >
              Clear
            </button>
          )}
        </div>

        {recentAsyncRequests.length > 0 && !logs && (
          <div className="mb-6">
            <div className="text-xs text-gray-500 mb-2">Quick select from recent async requests:</div>
            <div className="flex flex-wrap gap-2">
              {recentAsyncRequests.slice(0, 5).map(r => (
                <button
                  key={r.id}
                  onClick={() => { setRequestId(r.id); onFetch(r.id); }}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    r.callback_status === 'SUCCESS'
                      ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                      : r.callback_status === 'FAILED'
                      ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                      : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  <span className="font-mono">{r.id.slice(0, 8)}</span>
                  <span className="ml-1">({r.callback_status})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {logs && <CallbackLogsDisplay logs={logs} />}
      </div>
    </div>
  )
}

function CallbackLogsDisplay({ logs }: { logs: CallbackLogsResponse }) {
  return (
    <div>
      <div className="flex items-center gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
        <div>
          <span className="text-xs text-gray-500">Request ID:</span>
          <span className="ml-2 font-mono text-sm">{logs.request_id.slice(0, 16)}...</span>
        </div>
        <div>
          <span className="text-xs text-gray-500">Total Attempts:</span>
          <span className={`ml-2 font-bold ${
            logs.total_attempts > 1 ? 'text-orange-600' : 'text-green-600'
          }`}>
            {logs.total_attempts}
          </span>
        </div>
      </div>

      {logs.logs.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <div className="text-3xl mb-2">📭</div>
          <div>No callback attempts recorded yet</div>
          <div className="text-xs mt-1">Callback logs appear after the job completes</div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-y border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Attempt</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">HTTP Code</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Response Time</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Error</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.logs.map((log, idx) => (
                <tr key={idx} className={log.success ? 'bg-green-50/50' : 'bg-red-50/50'}>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                      log.success ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                    }`}>
                      {log.attempt_number}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      log.success
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {log.success ? 'SUCCESS' : 'FAILED'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {log.status_code ? (
                      <span className={log.status_code < 400 ? 'text-green-600' : 'text-red-600'}>
                        {log.status_code}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {log.response_time_ms ? (
                      <span className="font-mono text-gray-700">{log.response_time_ms}ms</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {log.error_message ? (
                      <span className="text-xs text-red-600 max-w-[200px] truncate block" title={log.error_message}>
                        {log.error_message}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {log.attempted_at ? new Date(log.attempted_at).toLocaleTimeString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {logs.total_attempts > 1 && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <span className="font-semibold">Retry Logic:</span> Failed callbacks are retried with exponential backoff (2s, 4s, 8s).
          Max 3 attempts. Only 5xx errors trigger retries; 4xx errors are not retried.
        </div>
      )}
    </div>
  )
}
