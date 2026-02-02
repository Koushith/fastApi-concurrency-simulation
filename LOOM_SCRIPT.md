# Loom Video Script (3-4 minutes)

## Quick Reference Checklist
- [ ] Show sync request working
- [ ] Show async request with queue position
- [ ] Show callback logs / webhook delivery
- [ ] Show rate limiting in action
- [ ] Reference architecture diagram
- [ ] Mention AI tool usage
- [ ] Explain key decisions

---

## INTRO (30 seconds)

> "Hey! This application simulates a **financial report generation system** - the kind you'd see in fintech platforms where users request reports that take time to generate. It demonstrates two API patterns: **synchronous** where the user waits, and **asynchronous** where we acknowledge instantly and notify via webhook when done. I've built in production-ready features like FIFO ordering, retry logic, and rate limiting."

### Quick Background

> "Quick note - I haven't worked with Python professionally before. My background is in **Node.js and TypeScript**. But I approached this with **first principles thinking** - concepts like queues, background workers, webhooks, and API design are **language-agnostic**. The patterns are the same whether you're in Node or Python.
>
> I used **AI-assisted coding with Claude Code** to help bridge the syntax gap. Honestly, the first hour I was struggling with Python quirks - decorators, type hints, async/await differences. But once I got the hang of it, it was smooth. The architecture and design decisions? That was all me. The AI helped me write it faster, but I drove the direction."

---

## PART 1: DEMO - Show It Working (60-90 seconds)

### Sync Request
> "Let me start with the **sync endpoint**. When I click Generate, the request blocks until the report is complete. You can see it takes about X seconds - the user waits the entire time."

**[Click Generate Sync, wait for result, show download link]**

### Async Request
> "Now the **async endpoint**. Watch this - when I click Generate, I get an instant acknowledgment with a **queue position**. The UI shows #1, #2, #3 - this is my FIFO ordering guarantee."

**[Click Generate Async 3-4 times quickly, point to queue positions]**

> "Notice the response time is just a few milliseconds - the user isn't blocked. The actual work happens in the background."

### Callbacks / Webhooks
> "When the job completes, the server sends a **webhook callback**. Let me show you the callback logs..."

**[Navigate to Callback Logs section, show retry attempts if any]**

> "I implemented retry logic with exponential backoff - if a webhook fails, it retries at 2, 4, then 8 seconds. Only 5xx errors trigger retries."

### Rate Limiting (quick)
> "I also added rate limiting - 30 per minute for sync, 60 for async. If you spam requests..."

**[Show rate limit test or spam the button, show orange "Rate Limited" status]**

---

## PART 2: ARCHITECTURE (60 seconds)

**[Show architecture diagram in README or open the Mermaid preview]**

> "Here's the architecture. Let me focus on the **FIFO Queue System** - this was a key requirement."

### The Problem
> "The challenge: how do you guarantee that async requests complete in the **exact order** they were received?"

### The Solution
> "My solution has two parts:
> 1. A **Thread-Safe Queue** - Python's `queue.Queue` which is inherently FIFO
> 2. A **Single Worker Thread** that processes jobs one at a time
>
> The queue holds jobs in order. The single worker ensures no parallel processing - so job 1 always finishes before job 2 starts."

### Why Single Worker?
> "Why not multiple workers for better throughput? Here's the tradeoff:"

| Approach | FIFO Guarantee | Throughput |
|----------|---------------|------------|
| Single Worker | Strict | Lower |
| Multiple Workers | Broken | Higher |

> "I chose correctness over speed - for this use case, **order matters more than throughput**."

---

## PART 3: AI TOOL USAGE & MY CONTRIBUTIONS (45-60 seconds)

> "I used **Claude Code** throughout this project. Here's how I balanced AI assistance with my own decisions:"

### What Claude Helped With
> - Boilerplate code generation
> - Implementing the background worker pattern
> - Debugging CORS issues and database migrations
> - Writing consistent TypeScript types

### What I Decided / Contributed
> "The **key architectural decisions were mine**:
>
> 1. **FIFO Strategy** - I chose single-worker over thread pool after analyzing the tradeoffs
> 2. **Database Schema Design** - Adding `queue_position` as an integer field for tracking
> 3. **Error Handling** - How to gracefully handle rate limits in the UI without crashing
> 4. **Retry Logic** - Exponential backoff timing (2s, 4s, 8s) and only retrying 5xx errors
>
> I also did significant **debugging** - like when adding `queue_position` broke the API because the database column didn't exist. I had to run the migration manually."

---

## PART 4: TRADEOFFS & FUTURE SCOPE (30-45 seconds)

### Current Tradeoffs
> "Some intentional tradeoffs for this demo:
>
> - **Threads vs Celery**: I used Python threads instead of Celery/Redis - simpler for demo, but not horizontally scalable
> - **Filesystem vs S3**: Reports are stored on disk - fine for demo, but production should use S3
> - **In-memory queue**: If the server restarts, queued jobs are lost - production needs persistent queue"

### Future Improvements
> "If I had more time, I'd add:
> - **Redis/Celery** for distributed job processing
> - **S3** for file storage
> - **WebSocket** for real-time status updates instead of polling
> - **HMAC signatures** for webhook verification
> - **Priority queues** for high/low priority jobs"

---

## OUTRO (10 seconds)

> "That's the system! Clean separation between sync and async patterns, strict FIFO ordering, production-ready features like idempotency and rate limiting. Thanks for watching!"

---

## Key Points to Hit

1. **FIFO is guaranteed** by single worker + FIFO queue
2. **Trade-off**: Chose correctness over throughput
3. **AI helped with code**, but **I made the architecture decisions**
4. **Production-ready features**: Rate limiting, idempotency, retry logic, SSRF protection
5. **Known limitations**: Not horizontally scalable (intentional for demo)

---

## Timestamps Guide

| Time | Section |
|------|---------|
| 0:00-0:30 | Intro + Background (Node.js dev, first principles) |
| 0:30-1:45 | Demo (sync, async, callbacks) |
| 1:45-2:45 | Architecture & FIFO explanation |
| 2:45-3:30 | AI usage & my contributions |
| 3:30-4:00 | Tradeoffs & future scope + Outro |
