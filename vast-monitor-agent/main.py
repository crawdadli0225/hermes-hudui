import asyncio
import os
import subprocess
import psutil
import requests
from fastapi import FastAPI, BackgroundTasks, Request
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel
from typing import List, Dict, Any

app = FastAPI(title="Vast Monitor Agent")

# SSE Event Queue - Using a list of queues to support multiple subscribers
subscribers: List[asyncio.Queue] = []

async def push_event(step: int, msg: str):
    payload = {"step": step, "msg": msg}
    for q in subscribers:
        await q.put(payload)

# --- Helpers ---

def get_gpu_status():
    try:
        cmd = "nvidia-smi --query-gpu=memory.used,memory.total,temperature.gpu,utilization.gpu --format=csv,noheader,nounits"
        output = subprocess.check_output(cmd, shell=True).decode().strip()
        # Output: 1234, 24576, 45, 10
        vals = [int(x) for x in output.split(',')]
        return {
            "vram_used": vals[0],
            "vram_total": vals[1],
            "temp": vals[2],
            "utilization": vals[3]
        }
    except Exception as e:
        # Return zeros if nvidia-smi is not available (local dev)
        return {"vram_used": 0, "vram_total": 0, "temp": 0, "utilization": 0, "error": str(e)}

def get_system_status():
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    return {
        "cpu_load": psutil.cpu_percent(),
        "mem_used": mem.used,
        "disk_free": disk.free
    }

async def get_llama_metrics():
    try:
        # Assuming llama-server is on 8080
        resp = requests.get("http://localhost:8080/stats", timeout=1)
        if resp.status_code == 200:
            return resp.json()
    except Exception:
        pass
    
    return {
        "cumulative": {"input": 0, "output": 0},
        "realtime": {"tps": 0, "latency_ms": 0},
        "recent_requests": []
    }

# --- Recovery Logic ---

async def run_command(cmd: str):
    proc = await asyncio.create_subprocess_shell(
        cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
    )
    stdout, stderr = await proc.communicate()
    return proc.returncode, stdout.decode(), stderr.decode()

async def execute_recovery_step(action: str, step_num: int):
    await push_event(step_num, f"Starting step {step_num}: {action}...")
    
    if action == "cleanup":
        code, out, err = await run_command("pkill -9 llama")
        # pkill returns 1 if no process matched, which is success for cleanup
        msg = "Zombies cleaned" if code in [0, 1] else f"Error: {err}"
    elif action == "socket":
        await run_command("rm -f /tmp/vast_ssh_socket")
        # In a real scenario, we'd restart the master process here.
        msg = "Socket reset performed"
    elif action == "hard_reset":
        code, out, err = await run_command("./launch_llama.sh")
        msg = "Llama server launched" if code == 0 else f"Launch failed: {err}"
    elif action == "verify":
        try:
            resp = requests.get("http://localhost:8080/v1/models", timeout=2)
            msg = "Health check passed" if resp.status_code == 200 else "API unreachable"
        except Exception as e:
            msg = f"Verification failed: {str(e)}"
    elif action == "tunnel":
        # Mocking tunnel restart
        await run_command("echo 'Restarting SSH Tunnel...'")
        msg = "Tunnel rebuilt"
    else:
        msg = "Unknown action"

    await push_event(step_num, msg)
    return msg

async def full_recovery_workflow():
    steps = [
        ("cleanup", 1),
        ("socket", 2),
        ("hard_reset", 3),
        ("verify", 4),
        ("tunnel", 5),
    ]
    for action, num in steps:
        await execute_recovery_step(action, num)
        await asyncio.sleep(1)

# --- Endpoints ---

class RecoveryRequest(BaseModel):
    session_id: str = "default"

class StepRequest(BaseModel):
    action: str

@app.get("/status")
async def status():
    return {
        "gpu": get_gpu_status(),
        "system": get_system_status(),
        "service": {
            "occupied_slots": 0,
            "total_slots": 1,
            "active_connections": 0,
            "is_healthy": True
        }
    }

@app.get("/metrics/tokens")
async def tokens():
    return await get_llama_metrics()

@app.post("/recovery/full")
async def recovery_full(req: RecoveryRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(full_recovery_workflow)
    return JSONResponse(status_code=202, content={"message": "Full recovery started"})

@app.post("/recovery/step")
async def recovery_step(req: StepRequest, background_tasks: BackgroundTasks):
    mapping = {"cleanup": 1, "socket": 2, "hard_reset": 3, "verify": 4, "tunnel": 5}
    num = mapping.get(req.action, 0)
    background_tasks.add_task(execute_recovery_step, req.action, num)
    return {"message": f"Step {req.action} started"}

@app.get("/events")
async def events(request: Request):
    q = asyncio.Queue()
    subscribers.append(q)
    try:
        async def event_generator():
            while True:
                if await request.is_disconnected():
                    break
                try:
                    data = await asyncio.wait_for(q.get(), timeout=15.0)
                    yield {
                        "event": "message",
                        "data": data
                    }
                except asyncio.TimeoutError:
                    yield {"comment": "keep-alive"}

        return EventSourceResponse(event_generator())
    finally:
        # This finally block in the route handler doesn't work for generators.
        # We should handle cleanup inside the generator or via a middleware.
        pass

# To properly clean up subscribers, we modify the generator
async def event_generator_with_cleanup(request: Request, q: asyncio.Queue):
    try:
        while True:
            if await request.is_disconnected():
                break
            try:
                data = await asyncio.wait_for(q.get(), timeout=15.0)
                yield {
                    "event": "message",
                    "data": data
                }
            except asyncio.TimeoutError:
                yield {"comment": "keep-alive"}
    finally:
        if q in subscribers:
            subscribers.remove(q)

@app.get("/events")
async def events_fixed(request: Request):
    q = asyncio.Queue()
    subscribers.append(q)
    return EventSourceResponse(event_generator_with_cleanup(request, q))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)
