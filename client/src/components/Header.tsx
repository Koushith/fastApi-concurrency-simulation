export function Header() {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold">Financial Report Generator</h1>
      <p className="text-gray-500 mt-2">
        API pattern simulator for a reporting service that generates CSV transaction reports
      </p>
      <div className="flex items-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-red-500 rounded-full"></span>
          <span className="text-sm text-gray-600">
            <span className="font-semibold text-red-600">Sync</span> — blocking, waits for result
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
          <span className="text-sm text-gray-600">
            <span className="font-semibold text-blue-600">Async</span> — non-blocking, webhook callback
          </span>
        </div>
      </div>
    </div>
  )
}
