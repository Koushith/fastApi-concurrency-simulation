import type { QueueItem } from '../types'
import { copyToClipboard, SERVER_URL } from '../utils'

/** Format time consistently: <1000ms shows as "XXms", >=1000ms shows as "X.Xs" */
function formatTime(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`
  }
  return `${(ms / 1000).toFixed(1)}s`
}

interface AsyncQueueProps {
  queue: QueueItem[]
  onClear: () => void
}

export function AsyncQueue({ queue, onClear }: AsyncQueueProps) {
  const stats = {
    waiting: queue.filter(q => q.status === 'queued').length,
    processing: queue.filter(q => q.status === 'processing').length,
    completed: queue.filter(q => q.status === 'completed').length,
    failed: queue.filter(q => q.status === 'failed').length,
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex justify-between items-center">
        <span className="font-bold text-gray-700">Async Queue</span>
        <button onClick={onClear} className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
      </div>

      <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs text-gray-600">
        <span className="font-medium">FIFO Queue</span> — Jobs processed in order |
        <span className="font-medium ml-1">#</span> = queue position
      </div>

      <div className="grid grid-cols-4 gap-2 p-4 border-b border-gray-100">
        <div className="text-center p-2 bg-amber-50 rounded-lg">
          <div className="text-2xl font-bold text-amber-600">{stats.waiting}</div>
          <div className="text-xs text-gray-500">Waiting</div>
        </div>
        <div className="text-center p-2 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{stats.processing}</div>
          <div className="text-xs text-gray-500">Processing</div>
        </div>
        <div className="text-center p-2 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          <div className="text-xs text-gray-500">Done</div>
        </div>
        <div className="text-center p-2 bg-red-50 rounded-lg">
          <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
          <div className="text-xs text-gray-500">Failed</div>
        </div>
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {queue.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <div className="text-4xl mb-2">📭</div>
            <div>Queue is empty</div>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {queue.map((item) => (
              <QueueItemRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function QueueItemRow({ item }: { item: QueueItem }) {
  const isRateLimited = item.id?.startsWith('rate-limited-temp-')
  const isFullyDone = item.status === 'completed' && item.callbackStatus === 'SUCCESS'
  const isWaitingCallback = item.status === 'completed' && item.callbackStatus !== 'SUCCESS'
  const isFailed = item.status === 'failed' && !isRateLimited

  const statusConfig = isRateLimited
    ? { icon: '🚫', color: 'border-orange-500 bg-orange-50', text: 'Rate Limited' }
    : isFullyDone
    ? { icon: '✓', color: 'border-green-500 bg-green-50', text: 'Done' }
    : isFailed
    ? { icon: '✗', color: 'border-red-500 bg-red-50', text: 'Failed' }
    : isWaitingCallback
    ? { icon: '◐', color: 'border-amber-500 bg-amber-50', text: 'Sending webhook...' }
    : item.status === 'processing'
    ? { icon: '◉', color: 'border-blue-500 bg-blue-50', text: 'Processing...' }
    : { icon: '○', color: 'border-gray-300 bg-white', text: 'In Queue' }

  const statusColorClass = isRateLimited ? 'text-orange-600' :
    isFullyDone ? 'text-green-600' :
    isFailed ? 'text-red-600' :
    isWaitingCallback ? 'text-amber-600' :
    item.status === 'processing' ? 'text-blue-600' :
    'text-gray-500'

  return (
    <div className={`p-4 border-l-4 ${statusConfig.color}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-semibold uppercase ${statusColorClass}`}>
              {statusConfig.icon} {statusConfig.text}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-800">{item.reportName}</span>
            <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
              {item.numTransactions} rows
            </span>
          </div>

          {isRateLimited ? (
            <div className="text-xs text-orange-600 mt-1">
              Too many requests. Try again after a minute.
            </div>
          ) : item.id ? (
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
          ) : null}

          <div className="mt-2 text-xs text-gray-600">
            {item.queuePosition && <span className="font-semibold text-purple-600">#{item.queuePosition}</span>}
            {item.queuePosition && ' · '}
            {item.status === 'queued' || item.status === 'processing' ? (
              <span>Ack: {formatTime(item.ackTime)} — Processing, please wait...</span>
            ) : item.completedAt ? (
              <span>Ack: {formatTime(item.ackTime)} | Processed: {formatTime(item.completedAt - item.addedAt)}</span>
            ) : (
              <span>Ack: {formatTime(item.ackTime)}</span>
            )}
          </div>

          {item.status === 'completed' && item.downloadUrl && (
            <a
              href={`${SERVER_URL}${item.downloadUrl}`}
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
}
