import type { IdempotencyResult, RateLimitResults } from '../types'

interface ResilienceTestingProps {
  idempotencyKey: string
  setIdempotencyKey: (key: string) => void
  idempotencyResults: IdempotencyResult[]
  rateLimitResults: RateLimitResults | null
  rateLimitRunning: boolean
  onGenerateKey: () => void
  onTestIdempotency: () => void
  onTestRateLimit: () => void
}

export function ResilienceTesting({
  idempotencyKey,
  setIdempotencyKey,
  idempotencyResults,
  rateLimitResults,
  rateLimitRunning,
  onGenerateKey,
  onTestIdempotency,
  onTestRateLimit,
}: ResilienceTestingProps) {
  return (
    <div className="mt-8 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-purple-50 border-b border-purple-200 px-6 py-4">
        <h2 className="text-lg font-bold text-purple-800">Resilience Testing</h2>
        <p className="text-purple-600 text-sm">Test idempotency and rate limiting features</p>
      </div>

      <div className="p-6">
        <div className="grid md:grid-cols-2 gap-6">
          <IdempotencyTest
            idempotencyKey={idempotencyKey}
            setIdempotencyKey={setIdempotencyKey}
            results={idempotencyResults}
            onGenerateKey={onGenerateKey}
            onTest={onTestIdempotency}
          />
          <RateLimitTest
            results={rateLimitResults}
            running={rateLimitRunning}
            onTest={onTestRateLimit}
          />
        </div>
      </div>
    </div>
  )
}

interface IdempotencyTestProps {
  idempotencyKey: string
  setIdempotencyKey: (key: string) => void
  results: IdempotencyResult[]
  onGenerateKey: () => void
  onTest: () => void
}

function IdempotencyTest({ idempotencyKey, setIdempotencyKey, results, onGenerateKey, onTest }: IdempotencyTestProps) {
  return (
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
          onClick={onGenerateKey}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Generate new key"
        >
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <button
        onClick={onTest}
        className="w-full bg-purple-500 text-white font-semibold py-2.5 rounded-xl hover:bg-purple-600"
      >
        Test Idempotency (Send 2x)
      </button>

      {results.length > 0 && (
        <div className="mt-4 space-y-2">
          {results.map((result, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg text-sm ${
                result.data.status === 'duplicate'
                  ? 'bg-amber-50 border border-amber-200'
                  : 'bg-green-50 border border-green-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold">Request #{result.attempt}</span>
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
  )
}

interface RateLimitTestProps {
  results: RateLimitResults | null
  running: boolean
  onTest: () => void
}

function RateLimitTest({ results, running, onTest }: RateLimitTestProps) {
  return (
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
        onClick={onTest}
        disabled={running}
        className="w-full bg-orange-500 text-white font-semibold py-2.5 rounded-xl hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {running && (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        )}
        {running ? 'Spamming requests...' : 'Test Rate Limit (40 requests)'}
      </button>

      {results && (
        <div className="mt-4">
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center p-2 bg-gray-50 rounded-lg">
              <div className="text-xl font-bold text-gray-700">{results.sent}</div>
              <div className="text-xs text-gray-500">Sent</div>
            </div>
            <div className="text-center p-2 bg-green-50 rounded-lg">
              <div className="text-xl font-bold text-green-600">{results.succeeded}</div>
              <div className="text-xs text-gray-500">Succeeded</div>
            </div>
            <div className="text-center p-2 bg-red-50 rounded-lg">
              <div className="text-xl font-bold text-red-600">{results.rateLimited}</div>
              <div className="text-xs text-gray-500">Rate Limited</div>
            </div>
          </div>
          {results.rateLimited > 0 ? (
            <div className="text-xs text-green-600 bg-green-50 p-2 rounded flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Rate limiting is working! Requests after #{results.succeeded} were blocked.
            </div>
          ) : (
            <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
              No rate limiting triggered. Try again or wait for the limit window to reset.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
