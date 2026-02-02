import { useState, useEffect } from 'react'

import {
  Header,
  SyncCard,
  AsyncCard,
  AsyncQueue,
  LoadTest,
  ResilienceTesting,
  ApiExplorer,
  RequestHistory,
  CallbackLogs,
} from './components'

import type {
  QueueItem,
  RequestRecord,
  LoadTestResults,
  CallbackLogsResponse,
  IdempotencyResult,
  RateLimitResults,
} from './types'

import { API_BASE, SERVER_URL, generateIdempotencyKey } from './utils'

let reportCounter = 1

function App() {
  // Sync state
  const [syncTransactions, setSyncTransactions] = useState(50)
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncResults, setSyncResults] = useState<{ reportName: string; elapsed: number; download_url?: string }[]>([])

  // Async state
  const [asyncTransactions, setAsyncTransactions] = useState(100)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [failMode, setFailMode] = useState(false)

  // Load test state
  const [loadConfig, setLoadConfig] = useState({ concurrency: 10, rowsPerReport: 50 })
  const [loadRunning, setLoadRunning] = useState(false)
  const [loadResults, setLoadResults] = useState<LoadTestResults | null>(null)

  // API Explorer state
  const [apiResult, setApiResult] = useState<{ type: string; data: unknown } | null>(null)
  const [lookupId, setLookupId] = useState('')

  // Resilience testing state
  const [idempotencyKey, setIdempotencyKey] = useState('')
  const [idempotencyResults, setIdempotencyResults] = useState<IdempotencyResult[]>([])
  const [rateLimitResults, setRateLimitResults] = useState<RateLimitResults | null>(null)
  const [rateLimitRunning, setRateLimitRunning] = useState(false)

  // Callback logs state
  const [callbackLogsRequestId, setCallbackLogsRequestId] = useState('')
  const [callbackLogs, setCallbackLogs] = useState<CallbackLogsResponse | null>(null)
  const [callbackLogsLoading, setCallbackLogsLoading] = useState(false)

  // Table view state
  const [allRequests, setAllRequests] = useState<RequestRecord[]>([])
  const [tableLoading, setTableLoading] = useState(false)

  // Fetch all requests for table view
  const fetchAllRequests = async () => {
    setTableLoading(true)
    try {
      const res = await fetch(`${API_BASE}/requests`)
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
    const interval = setInterval(fetchAllRequests, 5000)
    return () => clearInterval(interval)
  }, [])

  // Delete single request
  const deleteRequest = async (id: string) => {
    try {
      await fetch(`${API_BASE}/requests/${id}`, { method: 'DELETE' })
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
      await fetch(`${API_BASE}/requests`, { method: 'DELETE' })
      setAllRequests([])
      setQueue([])
      setApiResult({ type: 'deleted', data: { message: 'All requests deleted successfully' } })
    } catch (e) {
      console.error('Failed to delete all requests', e)
    }
  }

  // Poll queue for updates
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
          const res = await fetch(`${API_BASE}/requests/${item.id}`)
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
        } catch {
          // Ignore polling errors
        }
      }
    }, 500)

    return () => clearInterval(interval)
  }, [queue])

  // Generate sync report
  const runSync = async () => {
    setSyncLoading(true)
    const reportName = `Report_${reportCounter++}`
    const idempKey = generateIdempotencyKey('sync')
    const start = Date.now()

    const res = await fetch(`${API_BASE}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempKey,
      },
      body: JSON.stringify({ num_transactions: syncTransactions, report_name: reportName }),
    })
    const data = await res.json()
    setSyncResults(prev => [{ ...data, elapsed: Date.now() - start, reportName }, ...prev].slice(0, 10))
    setSyncLoading(false)
  }

  // Generate async report
  const runAsync = async () => {
    const reportName = `Report_${reportCounter++}`
    const idempKey = generateIdempotencyKey('async')
    const start = Date.now()

    const res = await fetch(`${API_BASE}/async`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempKey,
      },
      body: JSON.stringify({
        payload: { num_transactions: asyncTransactions, report_name: reportName },
        callback_url: `${SERVER_URL}/api/callbacks/receive`,
      }),
    })
    const data = await res.json()
    const ackTime = Date.now() - start

    setQueue(prev => [{
      id: data.request_id,
      numTransactions: asyncTransactions,
      reportName,
      status: 'queued' as const,
      ackTime,
      addedAt: Date.now()
    }, ...prev].slice(0, 20))
  }

  // Run load test
  const runLoadTest = async () => {
    setLoadRunning(true)
    setLoadResults(null)

    try {
      const res = await fetch(`${API_BASE}/benchmark/both`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concurrency: loadConfig.concurrency,
          num_transactions: loadConfig.rowsPerReport,
        }),
      })

      if (res.ok) {
        setLoadResults(await res.json())
      }
    } catch (e) {
      console.error('Load test failed', e)
    }

    setLoadRunning(false)
  }

  // Toggle fail mode
  const toggleFailMode = async () => {
    const newMode = !failMode
    await fetch(`${API_BASE}/callbacks/simulate-failures?enabled=${newMode}&failure_rate=100`, { method: 'POST' })
    setFailMode(newMode)
  }

  // Generate idempotency key
  const handleGenerateIdempotencyKey = () => {
    setIdempotencyKey(generateIdempotencyKey())
  }

  // Test idempotency
  const testIdempotency = async () => {
    const key = idempotencyKey || generateIdempotencyKey()
    setIdempotencyKey(key)
    setIdempotencyResults([])

    const start1 = Date.now()
    const res1 = await fetch(`${API_BASE}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': key,
      },
      body: JSON.stringify({ num_transactions: 10, report_name: 'Idempotency_Test' }),
    })
    const data1 = await res1.json()
    const result1 = { attempt: 1, status: res1.status, elapsed: Date.now() - start1, data: data1 }

    const start2 = Date.now()
    const res2 = await fetch(`${API_BASE}/sync`, {
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

  // Test rate limiting
  const testRateLimit = async () => {
    setRateLimitRunning(true)
    setRateLimitResults(null)

    let sent = 0
    let succeeded = 0
    let rateLimited = 0

    for (let i = 0; i < 40; i++) {
      try {
        const res = await fetch(`${API_BASE}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ num_transactions: 5, report_name: `RateLimit_${i + 1}` }),
        })
        sent++
        if (res.status === 429) {
          rateLimited++
          if (rateLimited >= 3) break
        } else if (res.ok) {
          succeeded++
        }
        setRateLimitResults({ sent, succeeded, rateLimited })
      } catch {
        sent++
      }
    }

    setRateLimitResults({ sent, succeeded, rateLimited })
    setRateLimitRunning(false)
  }

  // Fetch callback logs
  const fetchCallbackLogs = async (requestId?: string) => {
    const id = requestId || callbackLogsRequestId
    if (!id) return

    setCallbackLogsLoading(true)
    try {
      const res = await fetch(`${API_BASE}/requests/${id}/callback-logs`)
      setCallbackLogs(await res.json())
      setCallbackLogsRequestId(id)
    } catch (e) {
      console.error('Failed to fetch callback logs', e)
    }
    setCallbackLogsLoading(false)
  }

  // View callback logs from request history
  const handleViewCallbackLogs = (id: string) => {
    setCallbackLogsRequestId(id)
    fetchCallbackLogs(id)
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <Header />

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <SyncCard
              transactions={syncTransactions}
              setTransactions={setSyncTransactions}
              loading={syncLoading}
              results={syncResults}
              onGenerate={runSync}
              onClearResults={() => setSyncResults([])}
            />
            <AsyncCard
              transactions={asyncTransactions}
              setTransactions={setAsyncTransactions}
              failMode={failMode}
              onGenerate={runAsync}
              onToggleFailMode={toggleFailMode}
            />
          </div>

          <AsyncQueue queue={queue} onClear={() => setQueue([])} />
        </div>

        <LoadTest
          config={loadConfig}
          setConfig={setLoadConfig}
          running={loadRunning}
          results={loadResults}
          onRun={runLoadTest}
        />

        <ResilienceTesting
          idempotencyKey={idempotencyKey}
          setIdempotencyKey={setIdempotencyKey}
          idempotencyResults={idempotencyResults}
          rateLimitResults={rateLimitResults}
          rateLimitRunning={rateLimitRunning}
          onGenerateKey={handleGenerateIdempotencyKey}
          onTestIdempotency={testIdempotency}
          onTestRateLimit={testRateLimit}
        />

        <ApiExplorer
          result={apiResult}
          lookupId={lookupId}
          setLookupId={setLookupId}
          setResult={setApiResult}
          onDeleteAll={deleteAllRequests}
        />

        <RequestHistory
          requests={allRequests}
          loading={tableLoading}
          onRefresh={fetchAllRequests}
          onDeleteAll={deleteAllRequests}
          onDelete={deleteRequest}
          onViewCallbackLogs={handleViewCallbackLogs}
        />

        <CallbackLogs
          requestId={callbackLogsRequestId}
          setRequestId={setCallbackLogsRequestId}
          logs={callbackLogs}
          loading={callbackLogsLoading}
          recentAsyncRequests={allRequests.filter(r => r.mode === 'async' && r.callback_status)}
          onFetch={fetchCallbackLogs}
          onClear={() => { setCallbackLogs(null); setCallbackLogsRequestId(''); }}
        />
      </div>
    </div>
  )
}

export default App
