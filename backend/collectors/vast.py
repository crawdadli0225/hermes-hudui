"""Collector for Vast.ai remote monitor agent."""

from __future__ import annotations

import os
import time
import httpx
from typing import Optional
from .models import (
    VastServerStatus, 
    VastGPUStatus, 
    VastSystemStatus, 
    VastServiceStatus, 
    TokenMetrics, 
    TokenCumulative, 
    TokenRealtime, 
    TokenRequest
)

# Configuration
REMOTE_IP = os.getenv("VAST_REMOTE_IP", "127.0.0.1")
REMOTE_PORT = os.getenv("VAST_REMOTE_PORT", "8005")
BASE_URL = f"http://{REMOTE_IP}:{REMOTE_PORT}"
CACHE_TTL = 5

# Simple in-memory cache for /status
_status_cache: dict[str, tuple[VastServerStatus, float]] = {}

def get_remote_url(endpoint: str) -> str:
    """Construct the full URL for the remote agent."""
    return f"{BASE_URL}/{endpoint.lstrip('/')}"

async def fetch_vast_status() -> VastServerStatus:
    """Fetch server status from remote agent with caching."""
    now = time.time()
    cache_key = "server_status"
    
    if cache_key in _status_cache:
        val, ts = _status_cache[cache_key]
        if now - ts < CACHE_TTL:
            return val

    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.get(get_remote_url("status"))
            response.raise_for_status()
            data = response.json()
            
            status = VastServerStatus(
                gpu=VastGPUStatus(**data.get("gpu", {})),
                system=VastSystemStatus(**data.get("system", {})),
                service=VastServiceStatus(**data.get("service", {})),
            )
            _status_cache[cache_key] = (status, now)
            return status
    except Exception as e:
        # Log error and return default state
        print(f"Error fetching Vast status from {BASE_URL}: {e}")
        return VastServerStatus()

async def fetch_token_metrics() -> TokenMetrics:
    """Fetch real-time token metrics (no cache)."""
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.get(get_remote_url("metrics/tokens"))
            response.raise_for_status()
            data = response.json()
            
            return TokenMetrics(
                cumulative=TokenCumulative(**data.get("cumulative", {})),
                realtime=TokenRealtime(**data.get("realtime", {})),
                recent_requests=[TokenRequest(
                    id=r.get("id", ""),
                    input_tokens=r.get("in", 0),
                    output_tokens=r.get("out", 0),
                    duration=r.get("duration", 0.0)
                ) for r in data.get("recent_requests", [])],
            )
    except Exception as e:
        print(f"Error fetching Vast token metrics: {e}")
        return TokenMetrics()

async def send_recovery_command(action: str, session_id: Optional[str] = None) -> dict:
    """Proxy recovery command to remote agent."""
    endpoint = "recovery/full" if action == "full" else "recovery/step"
    payload = {"session_id": session_id} if action == "full" else {"action": action}
    
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(get_remote_url(endpoint), json=payload)
            return response.json()
    except Exception as e:
        return {"error": str(e)}
