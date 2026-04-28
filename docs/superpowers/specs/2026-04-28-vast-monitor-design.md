# Specification: Vast.ai Server Monitoring Extension (Vast Monitor)

**Date**: 2026-04-28
**Status**: Draft / Pending Review
**Project Root**: `/Users/crawdad/hermes-hudui`

## 1. Overview
The **Vast Monitor** is a high-reliability extension for the Hermes HUDUI designed to provide real-time visibility and deterministic control over remote Vast.ai GPU servers running `llama-server`. It bridges the gap between raw SSH tunnels and a professional monitoring dashboard, integrating automated recovery workflows directly into the UI.

### Core Goals
- **Real-time Visibility**: Monitor GPU VRAM, Temperature, System Load, and LLM Service health.
- **Traffic Analysis**: Track cumulative and real-time Token throughput (TPS) and per-request metrics.
- **Deterministic Recovery**: Provide a visual interface for the 5-step recovery sequence to eliminate "blind" server resets.
- **LAN Accessibility**: Ensure the HUDUI dashboard is accessible across the local network.

---

## 2. System Architecture

### 2.1 Component Diagram
`[Vast.ai Server (Remote Agent)]` $\xleftrightarrow{\text{HTTP/SSE}}$ `[HUDUI Backend (Collector)]` $\xleftrightarrow{\text{REST/WS}}$ `[HUDUI Frontend (React Tab)]`

### 2.2 Component Responsibilities
#### A. Remote Monitor Agent (`vast-monitor-agent`)
A lightweight Python service deployed on the Vast.ai server.
- **Metrics Collection**: Wraps `nvidia-smi`, `/proc/meminfo`, and `llama-server` internal APIs.
- **Recovery Execution**: Executes shell commands for zombie cleanup, socket resets, and server restarts.
- **Event Streaming**: Pushes recovery step updates via Server-Sent Events (SSE).

#### B. HUDUI Backend (`backend/collectors/vast.py`)
A FastAPI extension within the existing HUDUI backend.
- **Proxy & Cache**: Proxies requests to the Remote Agent with a 5s cache for hardware metrics to reduce remote overhead.
- **State Synchronization**: Manages the mapping between raw recovery steps and UI status labels.
- **LAN Binding**: Configured to bind to `0.0.0.0` to allow cross-device access.

#### C. HUDUI Frontend (`frontend/src/pages/VastMonitor.tsx`)
A new dedicated tab in the HUDUI dashboard.
- **Polling Engine**: Refreshes hardware snapshots every 5s.
- **Event Listener**: Subscribes to the recovery event stream for real-time log updates.
- **Command Dispatcher**: Sends control signals (Full Reset / Partial Step) to the backend.

---

## 3. API Specifications

### 3.1 Remote Agent $\leftrightarrow$ Backend
| Endpoint | Method | Description | Payload/Response |
| :--- | :--- | :--- | :--- |
| `/status` | `GET` | Full health check | `VastServerStatus` JSON |
| `/metrics/tokens` | `GET` | Token traffic stats | `TokenMetrics` JSON |
| `/recovery/full` | `POST` | Trigger 5-step reset | `{ "session_id": str }` $\rightarrow$ `202 Accepted` |
| `/recovery/step` | `POST` | Execute specific step | `{ "action": "cleanup" \| "tunnel" \| ... }` |
| `/events` | `GET` | Recovery event stream | SSE Stream: `data: { "step": int, "msg": str }` |

### 3.2 Backend $\leftrightarrow$ Frontend
| Endpoint | Method | Description | Note |
| :--- | :--- | :--- | :--- |
| `/api/vast/status` | `GET` | Aggregated status | Cached (5s) |
| `/api/vast/tokens` | `GET` | Token metrics | Real-time pass-through |
| `/api/vast/recovery` | `POST` | Recovery command | Triggers remote agent action |
| `/api/vast/events` | `GET` | Event relay | Relays Remote SSE $\rightarrow$ Frontend |

---

## 4. Data Models

### 4.1 `VastServerStatus`
```typescript
interface VastServerStatus {
  gpu: { vram_used: number; vram_total: number; temp: number; utilization: number };
  system: { cpu_load: number; mem_used: number; disk_free: number };
  service: { occupied_slots: number; total_slots: number; active_connections: number; is_healthy: boolean };
}
```

### 4.2 `TokenMetrics`
```typescript
interface TokenMetrics {
  cumulative: { input: number; output: number };
  realtime: { tps: number; latency_ms: number };
  recent_requests: Array<{ id: string; in: number; out: number; duration: number }>;
}
```

---

## 5. Recovery Workflow State Machine
The recovery process follows a strict linear sequence to ensure VRAM is cleared and ports are released before restarting.

| Step | Name | Action | Success Criterion |
| :--- | :--- | :--- | :--- |
| **1** | **Cleanup** | `pkill -9 llama` + loop check | No `llama` processes in `ps aux` |
| **2** | **Socket Reset** | Remove `/tmp/vast_ssh_socket` $\rightarrow$ Restart Master | Socket file exists and is responsive |
| **3** | **Hard Reset** | Execute `launch_llama.sh` with env hardening | Log contains "server is listening" |
| **4** | **Verify** | L2 (API `/v1/models`) + L3 (Port check) | HTTP 200 from LLM API |
| **5** | **Tunnel** | Restart `ssh -L` data tunnel | Local port 19000 is open |

---

## 6. UI/UX Requirements
Based on the approved Mockup, the page consists of three vertical sections:
1. **Health Snapshot**: High-visibility cards with VRAM progress bars and status indicators.
2. **Traffic Analytics**: Cumulative counters + Real-time TPS sparkline + Request detail table.
3. **Ops Command Center**: 
    - Visual Stepper (Step 1 $\rightarrow$ 5) with active state animation.
    - Control Buttons: `[Force Full Reset]` (Primary/Red), `[Rebuild Tunnel]`, `[Kill Zombies]`.
    - Log Terminal: Black background, green text, auto-scrolling real-time logs from Remote Agent.

---

## 7. Deployment Strategy
1. **Development**: Build Remote Agent and HUDUI extension locally.
2. **Testing**: Use a local dummy server or existing Vast.ai instance for API validation.
3. **Deployment**: 
    - `scp` the Remote Agent to `/root/vast-monitor-agent/`.
    - Install as a systemd service on Vast.ai for auto-start on boot.
4. **LAN Access**: Configure HUDUI Backend and Frontend to bind to `0.0.0.0`.
