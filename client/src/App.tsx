import { useState, useEffect } from 'react'
import './App.css'

const API = 'http://localhost:8000/api'

interface QueueItem {
  id: string
  numTransactions: number
  reportName: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  downloadUrl?: string
  callbackStatus?: string
  ackTime: number
  addedAt: number
  completedAt?: number
}

interface RequestRecord {
  id: string
  mode: string
  status: string
  callback_status?: string
  callback_attempts?: number
  input_payload?: any
  result_payload?: any
  idempotency_key?: string
  created_at: string
  completed_at?: string
}

let reportCounter = 1

// Copy to clipboard helper
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
  } catch (e) {
    console.error('Failed to copy', e)
  }
}

function App() {
  // Sync state
  const [syncTransactions, setSyncTransactions] = useState(50)
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncResults, setSyncResults] = useState<any[]>([])

  // Async state
  const [asyncTransactions, setAsyncTransactions] = useState(100)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [failMode, setFailMode] = useState(false)

  // Load test state
  const [loadConfig, setLoadConfig] = useState({ concurrency: 10, rowsPerReport: 50 })
  const [loadRunning, setLoadRunning] = useState(false)
  const [loadResults, setLoadResults] = useState<{
    sync: {
      mode: string
      total_requests: number
      successful: number
      failed: number
      avg_latency_ms: number
      min_latency_ms: number
      max_latency_ms: number
      p50_ms: number
      p95_ms: number
      p99_ms: number
    }
    async: {
      mode: string
      total_requests: number
      successful: number
      failed: number
      avg_latency_ms: number
      min_latency_ms: number
      max_latency_ms: number
      p50_ms: number
      p95_ms: number
      p99_ms: number
      callbacks_received: number
      avg_callback_ms: number
      p50_callback_ms: number
      p95_callback_ms: number
    }
    speedup: number
    config: {
      concurrency: number
      num_transactions: number
    }
    test_duration_ms: number
  } | null>(null)

  // API Explorer state
  const [apiResult, setApiResult] = useState<{ type: string; data: any } | null>(null)
  const [lookupId, setLookupId] = useState('')

  // Resilience testing state
  const [idempotencyKey, setIdempotencyKey] = useState('')
  const [idempotencyResults, setIdempotencyResults] = useState<any[]>([])
  const [rateLimitResults, setRateLimitResults] = useState<{ sent: number; succeeded: number; rateLimited: number } | null>(null)
  const [rateLimitRunning, setRateLimitRunning] = useState(false)

  // Callback logs state
  const [callbackLogsRequestId, setCallbackLogsRequestId] = useState('')
  const [callbackLogs, setCallbackLogs] = useState<{
    request_id: string
    total_attempts: number
    logs: Array<{
      attempt_number: number
      status_code: number | null
      success: boolean
      error_message: string | null
      response_time_ms: number | null
      attempted_at: string | null
    }>
  } | null>(null)
  const [callbackLogsLoading, setCallbackLogsLoading] = useState(false)

  // Table view state
  const [allRequests, setAllRequests] = useState<RequestRecord[]>([])
  const [tableLoading, setTableLoading] = useState(false)

  // Fetch all requests for table view
  const fetchAllRequests = async () => {
    setTableLoading(true)
    try {
      const res = await fetch(`${API}/requests`)
      const data = await res.json()
      setAllRequests(data.requests || [])
    } catch (e) {
      console.error('Failed to fetch requests', e)
    }
    setTableLoading(false)
  }

  // Auto-fetch requests on mount and periodically
  useEffect(() => {
    fetchAllRequests()
    const interval = setInterval(fetchAllRequests, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [])

  // Delete single request
  const deleteRequest = async (id: string) => {
    try {
      await fetch(`${API}/requests/${id}`, { method: 'DELETE' })
      setAllRequests(prev => prev.filter(r => r.id !== id))
      setQueue(prev => prev.filter(q => q.id !== id))
    } catch (e) {
      console.error('Failed to delete request', e)
    }
  }

  // Delete all requests
  const deleteAllRequests = async () => {
    if (!confirm('Delete all requests from database?')) return
    try {
      await fetch(`${API}/requests`, { method: 'DELETE' })
      setAllRequests([])
      setQueue([])
      setApiResult({ type: 'deleted', data: { message: 'All requests deleted successfully' } })
    } catch (e) {
      console.error('Failed to delete all requests', e)
    }
  }

  // Poll queue for updates (job status AND callback status)
  useEffect(() => {
    const needsUpdate = queue.filter(q =>
      q.status === 'queued' ||
      q.status === 'processing' ||
      (q.status === 'completed' && q.callbackStatus !== 'SUCCESS' && q.callbackStatus !== 'FAILED')
    )
    if (needsUpdate.length === 0) return

    const interval = setInterval(async () => {
      for (const item of needsUpdate) {
        try {
          const res = await fetch(`${API}/requests/${item.id}`)
          const data = await res.json()
          setQueue(prev => prev.map(q => {
            if (q.id === item.id) {
              const newStatus = data.status === 'COMPLETED' ? 'completed'
                : data.status === 'FAILED' ? 'failed'
                : data.status === 'PROCESSING' ? 'processing'
                : 'queued'
              return {
                ...q,
                status: newStatus,
                downloadUrl: data.result_payload?.download_url,
                callbackStatus: data.callback_status,
                completedAt: newStatus === 'completed' || newStatus === 'failed' ? Date.now() : undefined
              }
            }
            return q
          }))
        } catch (e) {}
      }
    }, 500)

    return () => clearInterval(interval)
  }, [queue])

  // Generate sync report
  const runSync = async () => {
    setSyncLoading(true)
    const reportName = `Report_${reportCounter++}`
    const idempKey = `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const start = Date.now()

    const res = await fetch(`${API}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempKey,
      },
      body: JSON.stringify({ num_transactions: syncTransactions, report_name: reportName }),
    })
    const data = await res.json()
    // Add to list (newest first), keep max 10
    setSyncResults(prev => [{ ...data, elapsed: Date.now() - start, reportName }, ...prev].slice(0, 10))
    setSyncLoading(false)
  }

  // Generate async report
  const runAsync = async () => {
    const reportName = `Report_${reportCounter++}`
    const idempKey = `async-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const start = Date.now()

    const res = await fetch(`${API}/async`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempKey,
      },
      body: JSON.stringify({
        payload: { num_transactions: asyncTransactions, report_name: reportName },
        callback_url: 'http://localhost:8000/api/callbacks/receive',
      }),
    })
    const data = await res.json()
    const ackTime = Date.now() - start

    setQueue(prev => [{
      id: data.request_id,
      numTransactions: asyncTransactions,
      reportName,
      status: 'queued',
      ackTime,
      addedAt: Date.now()
    }, ...prev].slice(0, 20))
  }

  // Run load test via backend API
  const runLoadTest = async () => {
    setLoadRunning(true)
    setLoadResults(null)

    try {
      const res = await fetch(`${API}/benchmark/both`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concurrency: loadConfig.concurrency,
          num_transactions: loadConfig.rowsPerReport,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setLoadResults(data)
      }
    } catch (e) {
      console.error('Load test failed', e)
    }

    setLoadRunning(false)
  }

  const toggleFailMode = async () => {
    const newMode = !failMode
    await fetch(`${API}/callbacks/simulate-failures?enabled=${newMode}&failure_rate=100`, { method: 'POST' })
    setFailMode(newMode)
  }

  // Generate random idempotency key
  const generateIdempotencyKey = () => {
    const key = `idem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setIdempotencyKey(key)
    return key
  }

  // Test idempotency - send same request twice with same key
  const testIdempotency = async () => {
    const key = idempotencyKey || generateIdempotencyKey()
    setIdempotencyResults([])

    // First request
    const start1 = Date.now()
    const res1 = await fetch(`${API}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': key,
      },
      body: JSON.stringify({ num_transactions: 10, report_name: 'Idempotency_Test' }),
    })
    const data1 = await res1.json()
    const result1 = { attempt: 1, status: res1.status, elapsed: Date.now() - start1, data: data1 }

    // Second request with same key (should return cached)
    const start2 = Date.now()
    const res2 = await fetch(`${API}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': key,
      },
      body: JSON.stringify({ num_transactions: 10, report_name: 'Idempotency_Test' }),
    })
    const data2 = await res2.json()
    const result2 = { attempt: 2, status: res2.status, elapsed: Date.now() - start2, data: data2 }

    setIdempotencyResults([result1, result2])
  }

  // Test rate limiting - spam requests until rate limited
  const testRateLimit = async () => {
    setRateLimitRunning(true)
    setRateLimitResults(null)

    let sent = 0
    let succeeded = 0
    let rateLimited = 0
    const maxRequests = 40 // More than the 30/min limit

    for (let i = 0; i < maxRequests; i++) {
      try {
        const res = await fetch(`${API}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ num_transactions: 5, report_name: `RateLimit_${i + 1}` }),
        })
        sent++
        if (res.status === 429) {
          rateLimited++
          // Once we hit rate limit, we can stop
          if (rateLimited >= 3) break
        } else if (res.ok) {
          succeeded++
        }
        setRateLimitResults({ sent, succeeded, rateLimited })
      } catch (e) {
        sent++
      }
    }

    setRateLimitResults({ sent, succeeded, rateLimited })
    setRateLimitRunning(false)
  }

  // Fetch callback logs for a request
  const fetchCallbackLogs = async (requestId?: string) => {
    const id = requestId || callbackLogsRequestId
    if (!id) return

    setCallbackLogsLoading(true)
    try {
      const res = await fetch(`${API}/requests/${id}/callback-logs`)
      const data = await res.json()
      setCallbackLogs(data)
      setCallbackLogsRequestId(id)
    } catch (e) {
      console.error('Failed to fetch callback logs', e)
    }
    setCallbackLogsLoading(false)
  }

  const queueStats = {
    waiting: queue.filter(q => q.status === 'queued').length,
    processing: queue.filter(q => q.status === 'processing').length,
    completed: queue.filter(q => q.status === 'completed').length,
    failed: queue.filter(q => q.status === 'failed').length,
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-6 md:p-10">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Financial Report Generator</h1>
          <p className="text-gray-500 mt-2">
            API pattern simulator for a reporting service that generates CSV transaction reports
          </p>
          <div className="flex items-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-red-500 rounded-full"></span>
              <span className="text-sm text-gray-600"><span className="font-semibold text-red-600">Sync</span> — blocking, waits for result</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
              <span className="text-sm text-gray-600"><span className="font-semibold text-blue-600">Async</span> — non-blocking, webhook callback</span>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-2 gap-8">

          {/* LEFT: Controls */}
          <div className="space-y-6">

            {/* Sync Card */}
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
                    value={syncTransactions}
                    onChange={(e) => setSyncTransactions(Math.min(99, Math.max(1, +e.target.value || 1)))}
                    className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <span className="text-xs text-gray-400">max 99</span>
                </div>
                <button
                  onClick={runSync}
                  disabled={syncLoading}
                  className="w-full bg-red-500 text-white font-semibold py-3 rounded-xl hover:bg-red-600 disabled:opacity-50"
                >
                  {syncLoading ? 'Generating...' : 'Generate Report (Sync)'}
                </button>

                {syncLoading && (
                  <div className="mt-4 flex items-center gap-2 text-amber-600 text-sm">
                    <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                    Blocking... user must wait
                  </div>
                )}

                {/* Sync Results List */}
                {syncResults.length > 0 && !syncLoading && (
                  <div className="mt-4 space-y-2 max-h-[250px] overflow-y-auto">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-gray-500">{syncResults.length} report(s)</span>
                      <button
                        onClick={() => setSyncResults([])}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        Clear
                      </button>
                    </div>
                    {syncResults.map((result, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-red-50 rounded-lg border border-red-100">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-gray-800">{result.reportName}</span>
                          <span className="text-xs text-red-600 bg-red-100 px-2 py-0.5 rounded">
                            {(result.elapsed / 1000).toFixed(1)}s
                          </span>
                        </div>
                        {result.download_url && (
                          <a
                            href={`http://localhost:8000${result.download_url}`}
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

            {/* Async Card */}
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
                    value={asyncTransactions}
                    onChange={(e) => setAsyncTransactions(Math.min(500, Math.max(1, +e.target.value || 1)))}
                    className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <span className="text-xs text-gray-400">no limit</span>
                </div>
                <button
                  onClick={runAsync}
                  className="w-full bg-blue-500 text-white font-semibold py-3 rounded-xl hover:bg-blue-600"
                >
                  Generate Report (Async)
                </button>

                <label className="flex items-center gap-2 mt-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={failMode}
                    onChange={toggleFailMode}
                    className="w-4 h-4 accent-red-500"
                  />
                  <span className="text-sm text-gray-500">Simulate callback failures (test retry logic)</span>
                </label>
              </div>
            </div>
          </div>

          {/* RIGHT: Queue */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex justify-between items-center">
              <span className="font-bold text-gray-700">Async Queue</span>
              <button onClick={() => setQueue([])} className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
            </div>

            {/* Timing legend */}
            <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs text-gray-600">
              <span className="font-medium">Response</span> = instant acknowledgment |
              <span className="font-medium ml-1">Completed in</span> = total processing time
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-2 p-4 border-b border-gray-100">
              <div className="text-center p-2 bg-amber-50 rounded-lg">
                <div className="text-2xl font-bold text-amber-600">{queueStats.waiting}</div>
                <div className="text-xs text-gray-500">Waiting</div>
              </div>
              <div className="text-center p-2 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{queueStats.processing}</div>
                <div className="text-xs text-gray-500">Processing</div>
              </div>
              <div className="text-center p-2 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{queueStats.completed}</div>
                <div className="text-xs text-gray-500">Done</div>
              </div>
              <div className="text-center p-2 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{queueStats.failed}</div>
                <div className="text-xs text-gray-500">Failed</div>
              </div>
            </div>

            {/* Items */}
            <div className="max-h-[400px] overflow-y-auto">
              {queue.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <div className="text-4xl mb-2">📭</div>
                  <div>Queue is empty</div>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {queue.map((item) => {
                    // Determine overall status combining job + webhook
                    const isFullyDone = item.status === 'completed' && item.callbackStatus === 'SUCCESS'
                    const isProcessing = item.status === 'queued' || item.status === 'processing'
                    const isWaitingCallback = item.status === 'completed' && item.callbackStatus !== 'SUCCESS'
                    const isFailed = item.status === 'failed'

                    // Status icon and color
                    const statusConfig = isFullyDone
                      ? { icon: '✓', color: 'border-green-500 bg-green-50', text: 'Done' }
                      : isFailed
                      ? { icon: '✗', color: 'border-red-500 bg-red-50', text: 'Failed' }
                      : isWaitingCallback
                      ? { icon: '◐', color: 'border-amber-500 bg-amber-50', text: 'Sending webhook...' }
                      : item.status === 'processing'
                      ? { icon: '◉', color: 'border-blue-500 bg-blue-50', text: 'Processing...' }
                      : { icon: '○', color: 'border-gray-300 bg-white', text: 'In Queue' }

                    return (
                      <div key={item.id} className={`p-4 border-l-4 ${statusConfig.color}`}>
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            {/* Status indicator */}
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-semibold uppercase ${
                                isFullyDone ? 'text-green-600' :
                                isFailed ? 'text-red-600' :
                                isWaitingCallback ? 'text-amber-600' :
                                item.status === 'processing' ? 'text-blue-600' :
                                'text-gray-500'
                              }`}>
                                {statusConfig.icon} {statusConfig.text}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-gray-800">{item.reportName}</span>
                              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                                {item.numTransactions} rows
                              </span>
                            </div>

                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-xs text-gray-400 font-mono">{item.id.slice(0, 12)}...</span>
                              <button
                                onClick={() => copyToClipboard(item.id)}
                                className="p-0.5 hover:bg-gray-200 rounded transition-colors"
                                title="Copy ID"
                              >
                                <svg className="w-3 h-3 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </button>
                            </div>

                            {/* Timing info with explanations */}
                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                              <span title="Time for server to acknowledge request">
                                Response: <span className="font-medium text-blue-600">{item.ackTime}ms</span>
                              </span>
                              {item.completedAt && (
                                <span title="Total time from request to job completion">
                                  Completed in: <span className="font-medium text-green-600">{((item.completedAt - item.addedAt) / 1000).toFixed(1)}s</span>
                                </span>
                              )}
                            </div>

                            {item.status === 'completed' && item.downloadUrl && (
                              <a
                                href={`http://localhost:8000${item.downloadUrl}`}
                                className="mt-2 inline-block bg-blue-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-blue-700"
                                download
                              >
                                Download CSV
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Load Generator */}
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
                  value={loadConfig.concurrency}
                  onChange={(e) => setLoadConfig({ ...loadConfig, concurrency: Math.max(1, +e.target.value || 1) })}
                  className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Rows per Report</label>
                <input
                  type="number"
                  value={loadConfig.rowsPerReport}
                  onChange={(e) => setLoadConfig({ ...loadConfig, rowsPerReport: Math.max(1, +e.target.value || 1) })}
                  className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <button
                onClick={runLoadTest}
                disabled={loadRunning}
                className="bg-gray-900 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2"
              >
                {loadRunning && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {loadRunning ? 'Running Test...' : 'Run Load Test'}
              </button>
            </div>

            {loadRunning && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
                Running {loadConfig.concurrency} concurrent requests for both Sync and Async endpoints...
              </div>
            )}

            {loadResults && (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-gray-800">
                      {loadResults.sync.total_requests + loadResults.async.total_requests}
                    </div>
                    <div className="text-sm text-gray-600">Total Requests</div>
                    <div className="text-xs text-gray-400">
                      {loadResults.sync.total_requests} sync + {loadResults.async.total_requests} async
                    </div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {loadResults.sync.successful + loadResults.async.successful}
                    </div>
                    <div className="text-sm text-gray-600">Successful</div>
                    <div className="text-xs text-gray-400">
                      {loadResults.sync.successful} sync + {loadResults.async.successful} async
                    </div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {loadResults.sync.failed + loadResults.async.failed}
                    </div>
                    <div className="text-sm text-gray-600">Failed</div>
                    <div className="text-xs text-gray-400">
                      {loadResults.sync.failed} sync + {loadResults.async.failed} async
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {(loadResults.test_duration_ms / 1000).toFixed(1)}s
                    </div>
                    <div className="text-sm text-gray-600">Test Duration</div>
                    <div className="text-xs text-gray-400">{loadResults.config.num_transactions} rows each</div>
                  </div>
                </div>

                {/* Key Insight */}
                <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <div className="text-sm font-medium text-gray-700">Response Time Comparison</div>
                      <div className="text-xs text-gray-500 mt-1">How fast the user gets a response</div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-xl font-bold text-red-600">
                          {(loadResults.sync.avg_latency_ms / 1000).toFixed(2)}s
                        </div>
                        <div className="text-xs text-gray-500">Sync (blocked)</div>
                      </div>
                      <div className="text-2xl text-gray-300">vs</div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-blue-600">
                          {loadResults.async.avg_latency_ms.toFixed(0)}ms
                        </div>
                        <div className="text-xs text-gray-500">Async (instant)</div>
                      </div>
                      <div className="text-center bg-green-100 px-3 py-2 rounded-lg">
                        <div className="text-xl font-bold text-green-600">{loadResults.speedup}x</div>
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
                        <td className="px-4 py-3 text-center font-mono">{loadResults.sync.total_requests}</td>
                        <td className="px-4 py-3 text-center font-mono">{loadResults.async.total_requests}</td>
                        <td className="px-4 py-3 text-center font-mono text-gray-400">-</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-gray-600">
                          <div className="font-medium">Success / Failed</div>
                          <div className="text-xs text-gray-400">Request outcomes</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-green-600 font-mono">{loadResults.sync.successful}</span>
                          <span className="text-gray-400"> / </span>
                          <span className="text-red-600 font-mono">{loadResults.sync.failed}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-green-600 font-mono">{loadResults.async.successful}</span>
                          <span className="text-gray-400"> / </span>
                          <span className="text-red-600 font-mono">{loadResults.async.failed}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-green-600 font-mono">{loadResults.async.callbacks_received}</span>
                          <span className="text-gray-400"> received</span>
                        </td>
                      </tr>
                      <tr className="bg-gray-50">
                        <td className="px-4 py-3 text-gray-600">
                          <div className="font-medium">Average Latency</div>
                          <div className="text-xs text-gray-400">Mean response time</div>
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-semibold text-red-600">
                          {(loadResults.sync.avg_latency_ms / 1000).toFixed(2)}s
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-semibold text-blue-600">
                          {loadResults.async.avg_latency_ms.toFixed(0)}ms
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-semibold text-green-600">
                          {(loadResults.async.avg_callback_ms / 1000).toFixed(2)}s
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-gray-600">
                          <div className="font-medium">P50 (Median)</div>
                          <div className="text-xs text-gray-400">50th percentile</div>
                        </td>
                        <td className="px-4 py-3 text-center font-mono">{(loadResults.sync.p50_ms / 1000).toFixed(2)}s</td>
                        <td className="px-4 py-3 text-center font-mono">{loadResults.async.p50_ms.toFixed(0)}ms</td>
                        <td className="px-4 py-3 text-center font-mono">{(loadResults.async.p50_callback_ms / 1000).toFixed(2)}s</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-gray-600">
                          <div className="font-medium">P95</div>
                          <div className="text-xs text-gray-400">95th percentile</div>
                        </td>
                        <td className="px-4 py-3 text-center font-mono">{(loadResults.sync.p95_ms / 1000).toFixed(2)}s</td>
                        <td className="px-4 py-3 text-center font-mono">{loadResults.async.p95_ms.toFixed(0)}ms</td>
                        <td className="px-4 py-3 text-center font-mono">{(loadResults.async.p95_callback_ms / 1000).toFixed(2)}s</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-gray-600">
                          <div className="font-medium">P99</div>
                          <div className="text-xs text-gray-400">99th percentile</div>
                        </td>
                        <td className="px-4 py-3 text-center font-mono">{(loadResults.sync.p99_ms / 1000).toFixed(2)}s</td>
                        <td className="px-4 py-3 text-center font-mono">{loadResults.async.p99_ms.toFixed(0)}ms</td>
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
            )}
          </div>
        </div>

        {/* Resilience Testing */}
        <div className="mt-8 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-purple-50 border-b border-purple-200 px-6 py-4">
            <h2 className="text-lg font-bold text-purple-800">Resilience Testing</h2>
            <p className="text-purple-600 text-sm">Test idempotency and rate limiting features</p>
          </div>

          <div className="p-6">
            <div className="grid md:grid-cols-2 gap-6">

              {/* Idempotency Test */}
              <div className="border border-gray-200 rounded-xl p-4">
                <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <span className="text-lg">🔑</span> Idempotency Test
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Send the same request twice with the same key. Second request should return cached result instantly.
                </p>

                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="text"
                    placeholder="Idempotency key (auto-generated if empty)"
                    value={idempotencyKey}
                    onChange={(e) => setIdempotencyKey(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                  />
                  <button
                    onClick={generateIdempotencyKey}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Generate new key"
                  >
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>

                <button
                  onClick={testIdempotency}
                  className="w-full bg-purple-500 text-white font-semibold py-2.5 rounded-xl hover:bg-purple-600"
                >
                  Test Idempotency (Send 2x)
                </button>

                {idempotencyResults.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {idempotencyResults.map((result, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg text-sm ${
                          result.data.status === 'duplicate'
                            ? 'bg-amber-50 border border-amber-200'
                            : 'bg-green-50 border border-green-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold">
                            Request #{result.attempt}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            result.data.status === 'duplicate'
                              ? 'bg-amber-200 text-amber-800'
                              : 'bg-green-200 text-green-800'
                          }`}>
                            {result.data.status === 'duplicate' ? 'CACHED' : 'PROCESSED'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600">
                          Status: {result.status} | Time: {result.elapsed}ms
                          {result.data.request_id && (
                            <span className="ml-2 font-mono text-gray-400">
                              ID: {result.data.request_id.slice(0, 8)}...
                            </span>
                          )}
                        </div>
                        {result.data.message && (
                          <div className="text-xs mt-1 text-amber-700">{result.data.message}</div>
                        )}
                      </div>
                    ))}
                    <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                      Notice: Request #2 returns instantly with "duplicate" status and the same request_id
                    </div>
                  </div>
                )}
              </div>

              {/* Rate Limit Test */}
              <div className="border border-gray-200 rounded-xl p-4">
                <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <span className="text-lg">🚦</span> Rate Limit Test
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Spam requests to trigger rate limiting (30 req/min for sync endpoint).
                </p>

                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <div className="text-xs text-gray-600 space-y-1">
                    <div><span className="font-medium">Sync limit:</span> 30 requests/minute</div>
                    <div><span className="font-medium">Async limit:</span> 60 requests/minute</div>
                    <div className="text-gray-400">Rate limited requests return HTTP 429</div>
                  </div>
                </div>

                <button
                  onClick={testRateLimit}
                  disabled={rateLimitRunning}
                  className="w-full bg-orange-500 text-white font-semibold py-2.5 rounded-xl hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {rateLimitRunning && (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  {rateLimitRunning ? 'Spamming requests...' : 'Test Rate Limit (40 requests)'}
                </button>

                {rateLimitResults && (
                  <div className="mt-4">
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="text-center p-2 bg-gray-50 rounded-lg">
                        <div className="text-xl font-bold text-gray-700">{rateLimitResults.sent}</div>
                        <div className="text-xs text-gray-500">Sent</div>
                      </div>
                      <div className="text-center p-2 bg-green-50 rounded-lg">
                        <div className="text-xl font-bold text-green-600">{rateLimitResults.succeeded}</div>
                        <div className="text-xs text-gray-500">Succeeded</div>
                      </div>
                      <div className="text-center p-2 bg-red-50 rounded-lg">
                        <div className="text-xl font-bold text-red-600">{rateLimitResults.rateLimited}</div>
                        <div className="text-xs text-gray-500">Rate Limited</div>
                      </div>
                    </div>
                    {rateLimitResults.rateLimited > 0 ? (
                      <div className="text-xs text-green-600 bg-green-50 p-2 rounded flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Rate limiting is working! Requests after #{rateLimitResults.succeeded} were blocked.
                      </div>
                    ) : (
                      <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                        No rate limiting triggered. Try again or wait for the limit window to reset.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* API Explorer */}
        <div className="mt-8 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-bold">API Explorer</h2>
            <p className="text-gray-500 text-sm">Test the REST endpoints</p>
          </div>

          <div className="p-6">
            <div className="flex flex-wrap gap-3 mb-6">
              <button
                onClick={async () => {
                  const res = await fetch(`${API}/healthz`)
                  setApiResult({ type: 'health', data: await res.json() })
                }}
                className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg hover:bg-green-100 transition-colors"
              >
                <span className="font-mono text-xs bg-green-200 px-1.5 py-0.5 rounded">GET</span>
                <span className="text-sm font-medium">/api/healthz</span>
              </button>

              <button
                onClick={async () => {
                  const res = await fetch(`${API}/requests`)
                  const data = await res.json()
                  setApiResult({ type: 'list', data: data.requests || [] })
                }}
                className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <span className="font-mono text-xs bg-blue-200 px-1.5 py-0.5 rounded">GET</span>
                <span className="text-sm font-medium">/api/requests</span>
              </button>

              <button
                onClick={deleteAllRequests}
                className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors"
              >
                <span className="font-mono text-xs bg-red-200 px-1.5 py-0.5 rounded">DELETE</span>
                <span className="text-sm font-medium">/api/requests</span>
              </button>
            </div>

            {/* Lookup by ID */}
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
                onClick={async () => {
                  if (!lookupId) return
                  const res = await fetch(`${API}/requests/${lookupId}`)
                  setApiResult({ type: 'single', data: await res.json() })
                }}
                disabled={!lookupId}
                className="bg-gray-900 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Lookup
              </button>
              <button
                onClick={async () => {
                  if (!lookupId) return
                  const res = await fetch(`${API}/requests/${lookupId}/callback-logs`)
                  setApiResult({ type: 'callback-logs', data: await res.json() })
                }}
                disabled={!lookupId}
                className="bg-orange-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Callback Logs
              </button>
            </div>

            {apiResult && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-medium text-gray-700">Response</span>
                  <button onClick={() => setApiResult(null)} className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
                </div>
                <pre className="text-xs bg-white p-3 rounded border overflow-auto max-h-60 font-mono">
                  {JSON.stringify(apiResult.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Request History Table */}
        <div className="mt-8 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="font-bold text-gray-700">Request History</span>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${tableLoading ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`}></span>
                Auto-refreshing
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{allRequests.length} requests</span>
              <button
                onClick={fetchAllRequests}
                disabled={tableLoading}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                title="Refresh now"
              >
                <svg className={`w-4 h-4 text-gray-600 ${tableLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                onClick={deleteAllRequests}
                className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                title="Delete All"
              >
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>

          {allRequests.length === 0 ? (
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
                  {allRequests.slice(0, 50).map((req) => (
                    <tr key={req.id} className="hover:bg-gray-50">
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
                              onClick={() => { setCallbackLogsRequestId(req.id); fetchCallbackLogs(req.id); }}
                              className="p-1.5 hover:bg-orange-100 rounded transition-colors"
                              title="View Callback Logs"
                            >
                              <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={() => deleteRequest(req.id)}
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
                  ))}
                </tbody>
              </table>
              {allRequests.length > 50 && (
                <div className="px-4 py-2 text-xs text-gray-500 bg-gray-50 border-t">
                  Showing 50 of {allRequests.length} requests
                </div>
              )}
            </div>
          )}
        </div>

        {/* Callback Logs */}
        <div className="mt-8 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-orange-50 border-b border-orange-200 px-6 py-4">
            <h2 className="text-lg font-bold text-orange-800">Callback Logs</h2>
            <p className="text-orange-600 text-sm">Track webhook delivery attempts and retry history</p>
          </div>

          <div className="p-6">
            {/* Lookup field */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 max-w-md">
                <label className="block text-xs text-gray-500 mb-1">Request ID</label>
                <input
                  type="text"
                  placeholder="Paste request ID to view callback logs"
                  value={callbackLogsRequestId}
                  onChange={(e) => setCallbackLogsRequestId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                />
              </div>
              <button
                onClick={() => fetchCallbackLogs()}
                disabled={!callbackLogsRequestId || callbackLogsLoading}
                className="mt-5 bg-orange-500 text-white font-semibold px-6 py-2 rounded-xl hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2"
              >
                {callbackLogsLoading && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                Fetch Logs
              </button>
              {callbackLogs && (
                <button
                  onClick={() => { setCallbackLogs(null); setCallbackLogsRequestId(''); }}
                  className="mt-5 text-gray-500 hover:text-gray-700 px-3 py-2"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Quick select from recent async requests */}
            {allRequests.filter(r => r.mode === 'async' && r.callback_status).length > 0 && !callbackLogs && (
              <div className="mb-6">
                <div className="text-xs text-gray-500 mb-2">Quick select from recent async requests:</div>
                <div className="flex flex-wrap gap-2">
                  {allRequests
                    .filter(r => r.mode === 'async' && r.callback_status)
                    .slice(0, 5)
                    .map(r => (
                      <button
                        key={r.id}
                        onClick={() => { setCallbackLogsRequestId(r.id); fetchCallbackLogs(r.id); }}
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

            {/* Results */}
            {callbackLogs && (
              <div>
                {/* Summary */}
                <div className="flex items-center gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
                  <div>
                    <span className="text-xs text-gray-500">Request ID:</span>
                    <span className="ml-2 font-mono text-sm">{callbackLogs.request_id.slice(0, 16)}...</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Total Attempts:</span>
                    <span className={`ml-2 font-bold ${
                      callbackLogs.total_attempts > 1 ? 'text-orange-600' : 'text-green-600'
                    }`}>
                      {callbackLogs.total_attempts}
                    </span>
                  </div>
                </div>

                {callbackLogs.logs.length === 0 ? (
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
                        {callbackLogs.logs.map((log, idx) => (
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

                {/* Retry explanation */}
                {callbackLogs.total_attempts > 1 && (
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                    <span className="font-semibold">Retry Logic:</span> Failed callbacks are retried with exponential backoff (2s, 4s, 8s).
                    Max 3 attempts. Only 5xx errors trigger retries; 4xx errors are not retried.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

export default App
