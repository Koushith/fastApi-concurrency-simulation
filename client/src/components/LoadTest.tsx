import type { LoadTestResults } from '../types'

/**
 * Format milliseconds consistently:
 * - < 1000ms: show as "XXXms"
 * - >= 1000ms: show as "X.XXs"
 */
function formatTime(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`
  }
  return `${(ms / 1000).toFixed(2)}s`
}

interface LoadTestProps {
  config: { concurrency: number; rowsPerReport: number }
  setConfig: (config: { concurrency: number; rowsPerReport: number }) => void
  running: boolean
  results: LoadTestResults | null
  onRun: () => void
}

export function LoadTest({ config, setConfig, running, results, onRun }: LoadTestProps) {
  return (
    <div className="mt-8 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-bold">Load Test</h2>
        <p className="text-gray-500 text-sm">Compare Sync vs Async performance under concurrent load</p>
      </div>

      <div className="p-6">
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Concurrent Requests</label>
            <input
              type="number"
              value={config.concurrency}
              onChange={(e) => setConfig({ ...config, concurrency: Math.max(1, +e.target.value || 1) })}
              className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Rows per Report</label>
            <input
              type="number"
              value={config.rowsPerReport}
              onChange={(e) => setConfig({ ...config, rowsPerReport: Math.max(1, +e.target.value || 1) })}
              className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={onRun}
            disabled={running}
            className="bg-gray-900 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2"
          >
            {running && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {running ? 'Running Test...' : 'Run Load Test'}
          </button>
        </div>

        {running && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
            Running {config.concurrency} concurrent requests for both Sync and Async endpoints...
          </div>
        )}

        {results && <LoadTestResultsDisplay results={results} />}
      </div>
    </div>
  )
}

function LoadTestResultsDisplay({ results }: { results: LoadTestResults }) {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-gray-800">
            {results.sync.total_requests + results.async.total_requests}
          </div>
          <div className="text-sm text-gray-600">Total Requests</div>
          <div className="text-xs text-gray-400">
            {results.sync.total_requests} sync + {results.async.total_requests} async
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-600">
            {results.sync.successful + results.async.successful}
          </div>
          <div className="text-sm text-gray-600">Successful</div>
          <div className="text-xs text-gray-400">
            {results.sync.successful} sync + {results.async.successful} async
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-red-600">
            {results.sync.failed + results.async.failed}
          </div>
          <div className="text-sm text-gray-600">Failed</div>
          <div className="text-xs text-gray-400">
            {results.sync.failed} sync + {results.async.failed} async
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">
            {formatTime(results.test_duration_ms)}
          </div>
          <div className="text-sm text-gray-600">Test Duration</div>
          <div className="text-xs text-gray-400">{results.config.num_transactions} rows each</div>
        </div>
      </div>

      {/* Key Insight */}
      <div className="bg-linear-to-r from-blue-50 to-green-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-sm font-medium text-gray-700">Response Time Comparison</div>
            <div className="text-xs text-gray-500 mt-1">How fast the user gets a response</div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-xl font-bold text-red-600">
                {formatTime(results.sync.avg_latency_ms)}
              </div>
              <div className="text-xs text-gray-500">Sync (blocked)</div>
            </div>
            <div className="text-2xl text-gray-300">vs</div>
            <div className="text-center">
              <div className="text-xl font-bold text-blue-600">
                {formatTime(results.async.avg_latency_ms)}
              </div>
              <div className="text-xs text-gray-500">Async (instant)</div>
            </div>
            <div className="text-center bg-green-100 px-3 py-2 rounded-lg">
              <div className="text-xl font-bold text-green-600">{results.speedup}x</div>
              <div className="text-xs text-green-700">faster</div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Stats Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-y border-gray-200">
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Metric</th>
              <th className="text-center px-4 py-3 font-semibold text-red-600">Sync</th>
              <th className="text-center px-4 py-3 font-semibold text-blue-600">Async (ACK)</th>
              <th className="text-center px-4 py-3 font-semibold text-green-600">Async (Callback)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr>
              <td className="px-4 py-3 text-gray-600">
                <div className="font-medium">Total Requests</div>
                <div className="text-xs text-gray-400">Number of requests sent</div>
              </td>
              <td className="px-4 py-3 text-center font-mono">{results.sync.total_requests}</td>
              <td className="px-4 py-3 text-center font-mono">{results.async.total_requests}</td>
              <td className="px-4 py-3 text-center font-mono text-gray-400">-</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-gray-600">
                <div className="font-medium">Success / Failed</div>
                <div className="text-xs text-gray-400">Request outcomes</div>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="text-green-600 font-mono">{results.sync.successful}</span>
                <span className="text-gray-400"> / </span>
                <span className="text-red-600 font-mono">{results.sync.failed}</span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="text-green-600 font-mono">{results.async.successful}</span>
                <span className="text-gray-400"> / </span>
                <span className="text-red-600 font-mono">{results.async.failed}</span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="text-green-600 font-mono">{results.async.callbacks_received}</span>
                <span className="text-gray-400"> received</span>
              </td>
            </tr>
            <tr className="bg-gray-50">
              <td className="px-4 py-3 text-gray-600">
                <div className="font-medium">Average Latency</div>
                <div className="text-xs text-gray-400">Mean response time</div>
              </td>
              <td className="px-4 py-3 text-center font-mono font-semibold text-red-600">
                {formatTime(results.sync.avg_latency_ms)}
              </td>
              <td className="px-4 py-3 text-center font-mono font-semibold text-blue-600">
                {formatTime(results.async.avg_latency_ms)}
              </td>
              <td className="px-4 py-3 text-center font-mono font-semibold text-green-600">
                {formatTime(results.async.avg_callback_ms)}
              </td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-gray-600">
                <div className="font-medium">P50 (Median)</div>
                <div className="text-xs text-gray-400">50th percentile</div>
              </td>
              <td className="px-4 py-3 text-center font-mono">{formatTime(results.sync.p50_ms)}</td>
              <td className="px-4 py-3 text-center font-mono">{formatTime(results.async.p50_ms)}</td>
              <td className="px-4 py-3 text-center font-mono">{formatTime(results.async.p50_callback_ms)}</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-gray-600">
                <div className="font-medium">P95</div>
                <div className="text-xs text-gray-400">95th percentile</div>
              </td>
              <td className="px-4 py-3 text-center font-mono">{formatTime(results.sync.p95_ms)}</td>
              <td className="px-4 py-3 text-center font-mono">{formatTime(results.async.p95_ms)}</td>
              <td className="px-4 py-3 text-center font-mono">{formatTime(results.async.p95_callback_ms)}</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-gray-600">
                <div className="font-medium">P99</div>
                <div className="text-xs text-gray-400">99th percentile</div>
              </td>
              <td className="px-4 py-3 text-center font-mono">{formatTime(results.sync.p99_ms)}</td>
              <td className="px-4 py-3 text-center font-mono">{formatTime(results.async.p99_ms)}</td>
              <td className="px-4 py-3 text-center font-mono text-gray-400">-</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-600">
        <div className="font-medium mb-2">What these metrics mean:</div>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <span className="font-semibold text-red-600">Sync:</span> Time user waits for complete response (blocking)
          </div>
          <div>
            <span className="font-semibold text-blue-600">Async ACK:</span> Time to receive acknowledgment (non-blocking)
          </div>
          <div>
            <span className="font-semibold text-green-600">Async Callback:</span> Time until webhook notification received
          </div>
        </div>
      </div>
    </div>
  )
}
