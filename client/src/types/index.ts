export interface QueueItem {
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

export interface RequestRecord {
  id: string
  mode: string
  status: string
  callback_status?: string
  callback_attempts?: number
  input_payload?: {
    report_name?: string
    num_transactions?: number
  }
  result_payload?: {
    download_url?: string
  }
  idempotency_key?: string
  created_at: string
  completed_at?: string
}

export interface LoadTestResults {
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
}

export interface CallbackLog {
  attempt_number: number
  status_code: number | null
  success: boolean
  error_message: string | null
  response_time_ms: number | null
  attempted_at: string | null
}

export interface CallbackLogsResponse {
  request_id: string
  total_attempts: number
  logs: CallbackLog[]
}

export interface IdempotencyResult {
  attempt: number
  status: number
  elapsed: number
  data: {
    status?: string
    request_id?: string
    message?: string
  }
}

export interface RateLimitResults {
  sent: number
  succeeded: number
  rateLimited: number
}
