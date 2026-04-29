"""API routes for Vast Monitor."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
import httpx

from ..collectors import vast as vast_collector

router = APIRouter(prefix="/vast", tags=["Vast Monitor"])

@router.get("/status")
async def get_status():
    """Get cached server status."""
    return await vast_collector.fetch_vast_status()

@router.get("/tokens")
async def get_tokens():
    """Get real-time token metrics."""
    return await vast_collector.fetch_token_metrics()

@router.post("/recovery")
async def trigger_recovery(request: Request):
    """Trigger recovery action on remote agent."""
    data = await request.json()
    action = data.get("action", "full")
    session_id = data.get("session_id")
    
    result = await vast_collector.send_recovery_command(action, session_id)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@router.get("/events")
async def stream_events():
    """Relay SSE event stream from remote agent."""
    async def event_generator():
        try:
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream("GET", vast_collector.get_remote_url("events")) as response:
                    if response.status_code != 200:
                        yield f"data: {{\"error\": \"Remote agent returned {response.status_code}\"}}\n\n"
                        return

                    async for line in response.aiter_lines():
                        if line:
                            yield f"{line}\n"
        except Exception as e:
            yield f"data: {{\"error\": \"Connection lost: {str(e)}\"}}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
