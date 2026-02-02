"""
Demo webhook receiver - simulates a customer's callback endpoint.

In production, customers provide their own URL (e.g., https://customer.com/webhooks/reports)
This endpoint simulates that for demo/testing purposes.
"""

import random
from fastapi import APIRouter, Request, HTTPException

router = APIRouter()

# Store received callbacks for inspection
received_callbacks: list[dict] = []

# Simulate unreliable endpoint (for testing retry logic)
failure_simulation = {"enabled": False, "failure_rate": 100}


@router.post("/callbacks/receive")
async def receive_callback(request: Request):
    """
    Demo callback receiver - simulates customer's webhook endpoint.
    In production, this would be the customer's URL.
    """
    body = await request.json()
    received_callbacks.append(body)

    # Keep only last 100 callbacks
    if len(received_callbacks) > 100:
        received_callbacks.pop(0)

    # Simulate unreliable endpoint (for retry testing)
    if failure_simulation["enabled"]:
        if random.randint(1, 100) <= failure_simulation["failure_rate"]:
            raise HTTPException(status_code=500, detail="Simulated server error")

    return {"status": "received", "request_id": body.get("request_id")}


@router.get("/callbacks/history")
async def get_callback_history():
    """View received callbacks (for demo inspection)."""
    return {
        "total": len(received_callbacks),
        "callbacks": list(reversed(received_callbacks)),
    }


@router.delete("/callbacks/history")
async def clear_callback_history():
    """Clear callback history."""
    received_callbacks.clear()
    return {"cleared": True}


@router.post("/callbacks/simulate-failures")
async def configure_failure_simulation(enabled: bool = False, failure_rate: int = 100):
    """
    Configure failure simulation for testing retry logic.
    - enabled: turn failure simulation on/off
    - failure_rate: percentage of callbacks that fail (1-100)
    """
    failure_simulation["enabled"] = enabled
    failure_simulation["failure_rate"] = max(1, min(100, failure_rate))
    return failure_simulation


@router.get("/callbacks/simulate-failures")
async def get_failure_simulation():
    """Get current failure simulation settings."""
    return failure_simulation
