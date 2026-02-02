import type { RequestRecord } from '../types'
import { copyToClipboard } from '../utils'

interface RequestHistoryProps {
  requests: RequestRecord[]
  loading: boolean
  onRefresh: () => void
  onDeleteAll: () => void
  onDelete: (id: string) => void
  onViewCallbackLogs: (id: string) => void
}

export function RequestHistory({
  requests,
  loading,
  onRefresh,
  onDeleteAll,
  onDelete,
  onViewCallbackLogs,
}: RequestHistoryProps) {
  return (
    <div className="mt-8 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className="font-bold text-gray-700">Request History</span>
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${loading ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`}></span>
            Auto-refreshing
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{requests.length} requests</span>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            title="Refresh now"
          >
            <svg className={`w-4 h-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={onDeleteAll}
            className="p-2 hover:bg-red-100 rounded-lg transition-colors"
            title="Delete All"
          >
            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="p-8 text-center text-gray-400">
          <div className="text-4xl mb-2">📋</div>
          <div>No requests yet. Generate some reports above!</div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">ID</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Report</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Mode</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Job Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Webhook</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Idempotency</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requests.slice(0, 50).map((req) => (
                <RequestRow
                  key={req.id}
                  request={req}
                  onDelete={onDelete}
                  onViewCallbackLogs={onViewCallbackLogs}
                />
              ))}
            </tbody>
          </table>
          {requests.length > 50 && (
            <div className="px-4 py-2 text-xs text-gray-500 bg-gray-50 border-t">
              Showing 50 of {requests.length} requests
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface RequestRowProps {
  request: RequestRecord
  onDelete: (id: string) => void
  onViewCallbackLogs: (id: string) => void
}

function RequestRow({ request: req, onDelete, onViewCallbackLogs }: RequestRowProps) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <span className="font-mono text-xs text-gray-500">{req.id.slice(0, 8)}...</span>
          <button
            onClick={() => copyToClipboard(req.id)}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="Copy full ID"
          >
            <svg className="w-3 h-3 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
      </td>
      <td className="px-4 py-3 text-gray-800">
        {req.input_payload?.report_name || '-'}
        <span className="text-xs text-gray-400 ml-1">
          ({req.input_payload?.num_transactions || '?'} rows)
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          req.mode === 'async' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
        }`}>
          {req.mode?.toUpperCase()}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          req.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
          req.status === 'FAILED' ? 'bg-red-100 text-red-700' :
          req.status === 'PROCESSING' ? 'bg-blue-100 text-blue-700' :
          'bg-gray-100 text-gray-600'
        }`}>
          {req.status}
        </span>
      </td>
      <td className="px-4 py-3">
        {req.callback_status ? (
          <div className="flex items-center gap-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              req.callback_status === 'SUCCESS' ? 'bg-green-100 text-green-700' :
              req.callback_status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
              'bg-red-100 text-red-700'
            }`}>
              {req.callback_status}
            </span>
            {req.callback_attempts && req.callback_attempts > 1 && (
              <span className="text-xs text-orange-600" title="Retry attempts">
                ({req.callback_attempts} tries)
              </span>
            )}
          </div>
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </td>
      <td className="px-4 py-3">
        {req.idempotency_key ? (
          <div className="flex items-center gap-1">
            <span className="text-purple-600" title="Has idempotency key">🔑</span>
            <span className="font-mono text-xs text-gray-500 max-w-[80px] truncate" title={req.idempotency_key}>
              {req.idempotency_key.slice(0, 12)}...
            </span>
            <button
              onClick={() => copyToClipboard(req.idempotency_key!)}
              className="p-0.5 hover:bg-gray-200 rounded transition-colors"
              title="Copy key"
            >
              <svg className="w-3 h-3 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        ) : (
          <span className="text-gray-300">-</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">
        {new Date(req.created_at).toLocaleTimeString()}
      </td>
      <td className="px-4 py-3 text-center">
        <div className="flex items-center justify-center gap-1">
          {req.result_payload?.download_url && (
            <a
              href={`http://localhost:8000${req.result_payload.download_url}`}
              className="p-1.5 hover:bg-blue-100 rounded transition-colors"
              title="Download CSV"
              download
            >
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </a>
          )}
          {req.mode === 'async' && req.callback_status && (
            <button
              onClick={() => onViewCallbackLogs(req.id)}
              className="p-1.5 hover:bg-orange-100 rounded transition-colors"
              title="View Callback Logs"
            >
              <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
          )}
          <button
            onClick={() => onDelete(req.id)}
            className="p-1.5 hover:bg-red-100 rounded transition-colors"
            title="Delete"
          >
            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  )
}
