# Sync API vs Async API (Callback), under request storms

Build a Python backend that exposes two endpoints which do the same “work” in two different interaction styles:

* **Sync API:** request comes in, response is returned inline
* **Async API:** request comes in, returns quickly with an ack, and later calls a provided callback URL with the result

This assignment is intentionally described simply; focus on correctness, clarity, and a smooth demo.

## What you’re building

### Service endpoints

* **POST /sync**
    * takes an input payload
    * performs some deterministic work (you define what “work” is)
    * returns the result inline
* **POST /async**
    * takes the same input payload plus a callback_url
    * returns quickly with an acknowledgement (and some request id)
    * later sends the result to callback_url

### Load generator

Provide a way to generate a high volume of requests against both endpoints and produce a small summary:

* total requests sent, success/failure
* latency (p50/p95/p99) for sync
* time-to-callback stats for async

This can be:
* a CLI script in the repo, or
* a separate small service, or
* anything else you prefer

## Requirements

* Backend must be Python.
* The “work” logic should be shared between sync and async paths (avoid duplicating business logic).
* Persist enough state to:
    * query recent requests
    * trace an async request through callback delivery

### Suggested API surface (you can change it)

* `POST /sync`
* `POST /async`
* `GET /requests?mode=sync|async`
* `GET /requests/{id}`
* `GET /healthz`

### Please ensure your solution...

* Handles callback failures appropriately (what if the callback URL is down?)
* Maintains reasonable ordering and timing guarantees for async requests
* Scales under high request volume without degrading or crashing
* Prevents malicious or accidental abuse of the callback mechanism

## Deliverables

* A Python backend (framework of your choice). Share Github repo for the same.
* A README.md describing:
    * how to run locally
    * how to run the load generator
    * key design decisions / tradeoffs