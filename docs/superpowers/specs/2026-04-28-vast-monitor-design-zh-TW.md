# 技術規格書：Vast.ai 伺服器監控擴展 (Vast Monitor)

**日期**: 2026-04-28
**狀態**: 草案 / 等待審核
**專案根目錄**: `/Users/crawdad/hermes-hudui`

## 1. 概述
**Vast Monitor** 是為 Hermes HUDUI 設計的高可靠性擴展模組，旨在為運行 `llama-server` 的遠端 Vast.ai GPU 伺服器提供實時可視化監控與確定性控制。它將原始的 SSH 隧道提升為專業的監控儀表板，並將自動恢復工作流直接整合至 UI 中。

### 核心目標
- **實時可視化**: 監控 GPU VRAM、溫度、系統負載以及 LLM 服務健康狀態。
- **流量分析**: 追蹤累計與實時的 Token 吞吐量 (TPS) 及單次請求指標。
- **確定性恢復**: 為 5 步恢復序列提供可視化界面，消除「盲目」重啟伺服器的不確定性。
- **區域網路訪問**: 確保 HUDUI 儀表板可在本地區域網路 (LAN) 中跨設備訪問。

---

## 2. 系統架構

### 2.1 組件圖
`[Vast.ai 伺服器 (遠端代理)]` $\xleftrightarrow{\text{HTTP/SSE}}$ `[HUDUI 後端 (採集器)]` $\xleftrightarrow{\text{REST/WS}}$ `[HUDUI 前端 (React 分頁)]`

### 2.2 組件職責
#### A. 遠端監控代理 (`vast-monitor-agent`)
部署在 Vast.ai 伺服器上的輕量級 Python 服務。
- **數據採集**: 封裝 `nvidia-smi`、`/proc/meminfo` 以及 `llama-server` 的內部 API。
- **恢復執行**: 執行 Shell 指令以進行殭屍進程清理、Socket 重置與伺服器重啟。
- **事件推送**: 通過伺服器推送事件 (SSE) 推送恢復步驟的實時更新。

#### B. HUDUI 後端 (`backend/collectors/vast.py`)
現有 HUDUI 後端中的 FastAPI 擴展。
- **代理與緩存**: 將請求轉發至遠端代理，並對硬體指標進行 5 秒緩存以減少遠端伺服器壓力。
- **狀態同步**: 管理原始恢復步驟與 UI 狀態標籤之間的映射關係。
- **LAN 綁定**: 配置為綁定至 `0.0.0.0` 以允許跨設備訪問。

#### C. HUDUI 前端 (`frontend/src/pages/VastMonitor.tsx`)
HUDUI 儀表板中的一個全新專屬分頁。
- **輪詢引擎**: 每 5 秒刷新一次硬體快照。
- **事件監聽**: 訂閱恢復事件流，實現實時日誌更新。
- **指令發送**: 將控制信號（全量恢復 / 分段操作）發送至後端。

---

## 3. API 規格

### 3.1 遠端代理 $\leftrightarrow$ 後端
| 端點 | 方法 | 描述 | 載荷/響應 |
| :--- | :--- | :--- | :--- |
| `/status` | `GET` | 全量健康檢查 | `VastServerStatus` JSON |
| `/metrics/tokens` | `GET` | Token 流量統計 | `TokenMetrics` JSON |
| `/recovery/full` | `POST` | 觸發全量恢復 | `{ "session_id": str }` $\rightarrow$ `202 Accepted` |
| `/recovery/step` | `POST` | 執行特定步驟 | `{ "action": "cleanup" \| "tunnel" \| ... }` |
| `/events` | `GET` | 恢復事件流 | SSE 流: `data: { "step": int, "msg": str }` |

### 3.2 後端 $\leftrightarrow$ 前端
| 端點 | 方法 | 描述 | 備註 |
| :--- | :--- | :--- | :--- |
| `/api/vast/status` | `GET` | 聚合狀態獲取 | 緩存 (5s) |
| `/api/vast/tokens` | `GET` | Token 指標獲取 | 實時透傳 |
| `/api/vast/recovery` | `POST` | 恢復指令下達 | 觸發遠端代理操作 |
| `/api/vast/events` | `GET` | 事件中繼轉發 | 將遠端 SSE 流轉發至前端 |

---

## 4. 數據模型

### 4.1 `VastServerStatus` (伺服器狀態)
```typescript
interface VastServerStatus {
  gpu: { vram_used: number; vram_total: number; temp: number; utilization: number };
  system: { cpu_load: number; mem_used: number; disk_free: number };
  service: { occupied_slots: number; total_slots: number; active_connections: number; is_healthy: boolean };
}
```

### 4.2 `TokenMetrics` (Token 指標)
```typescript
interface TokenMetrics {
  cumulative: { input: number; output: number };
  realtime: { tps: number; latency_ms: number };
  recent_requests: Array<{ id: string; in: number; out: number; duration: number }>;
}
```

---

## 5. 恢復工作流狀態機
恢復過程遵循嚴格的線性序列，以確保在重啟前已清理 VRAM 並釋放端口。

| 步驟 | 名稱 | 操作 | 成功判定標準 |
| :--- | :--- | :--- | :--- |
| **1** | **清理 (Cleanup)** | `pkill -9 llama` + 循環檢查 | `ps aux` 中無任何 `llama` 進程 |
| **2** | **Socket 重置** | 刪除 `/tmp/vast_ssh_socket` $\rightarrow$ 重啟 Master | Socket 文件存在且響應正常 |
| **3** | **硬重置 (Hard Reset)** | 執行環境強化後的 `launch_llama.sh` | 日誌出現 "server is listening" |
| **4** | **驗證 (Verify)** | L2 (API `/v1/models`) + L3 (端口檢查) | LLM API 返回 HTTP 200 |
| **5** | **隧道重建 (Tunnel)** | 重啟 `ssh -L` 數據隧道 | 本地端口 19000 已開啟 |

---

## 6. UI/UX 要求
根據已通過的 Mockup，頁面分為三個垂直區域：
1. **健康快照**: 高可視化卡片，包含 VRAM 進度條與狀態指示燈。
2. **流量分析**: 累計計數器 + 實時 TPS 折線圖 + 請求明細表格。
3. **維運控制中心**: 
    - 可視化步驟導航 (Step 1 $\rightarrow$ 5)，當前步驟具有激動動畫。
    - 控制按鈕：`[強制全量恢復]` (主按鈕/紅色)、`[重建隧道]`、`[清理殭屍]`。
    - 日誌終端：黑底綠字，實時滾動顯示來自遠端代理的輸出日誌。

---

## 7. 部署策略
1. **開發階段**: 本地開發遠端代理與 HUDUI 擴展功能。
2. **測試階段**: 使用本地模擬伺服器或現有 Vast.ai 實例進行 API 驗證。
3. **部署階段**: 
    - 使用 `scp` 將遠端代理上傳至 `/root/vast-monitor-agent/`。
    - 在 Vast.ai 上安裝為 systemd 服務以實現開機自啟。
4. **LAN 訪問**: 配置 HUDUI 後端與前端綁定至 `0.0.0.0`。
