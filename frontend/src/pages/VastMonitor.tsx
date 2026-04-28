import React, { useState, useEffect } from 'react';
import Panel, { CapacityBar, Sparkline } from '../components/Panel';
import { useVastApi } from '../hooks/useVastApi';

const RECOVERY_STEPS = [
  { step: 1, name: 'Cleanup', action: 'cleanup' },
  { step: 2, name: 'Socket Reset', action: 'socket' },
  { step: 3, name: 'Hard Reset', action: 'reset' },
  { step: 4, name: 'Verify', action: 'verify' },
  { step: 5, name: 'Tunnel', action: 'tunnel' },
];

export default function VastMonitor() {
  const { status, tokens, logs, triggerRecovery } = useVastApi();
  const [tpsHistory, setTpsHistory] = useState<number[]>([]);
  const [activeStep, setActiveStep] = useState<number | null>(null);

  // Track TPS history for the sparkline
  useEffect(() => {
    if (tokens?.realtime.tps !== undefined) {
      setTpsHistory(prev => [...prev, tokens.realtime.tps].slice(-20));
    }
  }, [tokens]);

  // Derive active step from logs if possible, or just keep track of last triggered
  useEffect(() => {
    const lastLog = logs[logs.length - 1];
    if (lastLog) {
      const match = lastLog.match(/Step (\d):/);
      if (match) setActiveStep(parseInt(match[1]));
    }
  }, [logs]);

  if (!status && !tokens) {
    return <div className="p-8 text-center opacity-50">Connecting to Vast Monitor...</div>;
  }

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto">
      {/* 1. Health Snapshot */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Panel title="GPU Health">
          <div className="flex flex-col gap-2">
            <CapacityBar 
              label="VRAM" 
              value={status?.gpu.vram_used || 0} 
              max={status?.gpu.vram_total || 1} 
            />
            <div className="flex justify-between text-[13px]">
              <span style={{ color: 'var(--hud-text-dim)' }}>Temp</span>
              <span>{status?.gpu.temp}°C</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span style={{ color: 'var(--hud-text-dim)' }}>Utilization</span>
              <span>{status?.gpu.utilization}%</span>
            </div>
          </div>
        </Panel>

        <Panel title="System Health">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-[13px]">
              <span style={{ color: 'var(--hud-text-dim)' }}>CPU Load</span>
              <span>{status?.system.cpu_load}%</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span style={{ color: 'var(--hud-text-dim)' }}>Mem Used</span>
              <span>{status?.system.mem_used} GB</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span style={{ color: 'var(--hud-text-dim)' }}>Disk Free</span>
              <span>{status?.system.disk_free} GB</span>
            </div>
          </div>
        </Panel>

        <Panel title="Service Health">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-3 h-3 rounded-full ${status?.service.is_healthy ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`} />
              <span className="text-sm font-medium">{status?.service.is_healthy ? 'Healthy' : 'Degraded'}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span style={{ color: 'var(--hud-text-dim)' }}>Slots</span>
              <span>{status?.service.occupied_slots}/{status?.service.total_slots}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span style={{ color: 'var(--hud-text-dim)' }}>Connections</span>
              <span>{status?.service.active_connections}</span>
            </div>
          </div>
        </Panel>
      </div>

      {/* 2. Token Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="Traffic Counters" className="lg:col-span-1">
          <div className="flex flex-col gap-6 py-2">
            <div className="text-center">
              <div className="text-[12px] uppercase tracking-wider opacity-50 mb-1">Cumulative Input</div>
              <div className="text-4xl font-mono font-bold" style={{ color: 'var(--hud-primary)' }}>
                {tokens?.cumulative.input.toLocaleString() || '0'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[12px] uppercase tracking-wider opacity-50 mb-1">Cumulative Output</div>
              <div className="text-4xl font-mono font-bold" style={{ color: 'var(--hud-primary)' }}>
                {tokens?.cumulative.output.toLocaleString() || '0'}
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Real-time Performance" className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-[12px] uppercase opacity-50 mr-2">Current TPS</span>
              <span className="text-2xl font-mono font-bold">{tokens?.realtime.tps || 0}</span>
            </div>
            <div className="flex items-end gap-1 h-10">
              <Sparkline values={tpsHistory} width={120} height={40} />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] font-mono">
              <thead>
                <tr className="border-b border-white/10 opacity-50">
                  <th className="pb-2">ID</th>
                  <th className="pb-2">In</th>
                  <th className="pb-2">Out</th>
                  <th className="pb-2">Latency</th>
                </tr>
              </thead>
              <tbody>
                {tokens?.recent_requests.map(req => (
                  <tr key={req.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-2 opacity-70">{req.id.slice(0, 8)}...</td>
                    <td className="py-2">{req.in}</td>
                    <td className="py-2">{req.out}</td>
                    <td className="py-2">{req.duration}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* 3. Recovery Control Center */}
      <Panel title="Recovery Control Center" className="flex-1 flex flex-col">
        <div className="flex flex-col gap-6 h-full">
          {/* Visual Stepper */}
          <div className="relative flex justify-between items-center px-4 py-8">
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/10 -translate-y-1/2 z-0" />
            {RECOVERY_STEPS.map((s) => (
              <div key={s.step} className="relative z-10 flex flex-col items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${
                  activeStep === s.step 
                    ? 'bg-blue-500 text-white scale-125 shadow-[0_0_15px_#3b82f6]' 
                    : activeStep && activeStep > s.step 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gray-700 text-gray-400'
                }`}>
                  {activeStep && activeStep > s.step ? '✓' : s.step}
                </div>
                <span className={`text-[11px] uppercase font-medium ${activeStep === s.step ? 'text-blue-400' : 'opacity-50'}`}>
                  {s.name}
                </span>
              </div>
            ))}
          </div>

          {/* Control Buttons */}
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={() => triggerRecovery('full')}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded font-bold transition-colors shadow-[0_0_10px_rgba(220,38,38,0.3)]"
            >
              Force Full Reset
            </button>
            <button 
              onClick={() => triggerRecovery('step', 'tunnel')}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded transition-colors border border-white/10"
            >
              Rebuild Tunnel
            </button>
            <button 
              onClick={() => triggerRecovery('step', 'cleanup')}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded transition-colors border border-white/10"
            >
              Kill Zombies
            </button>
          </div>

          {/* Log Terminal */}
          <div className="flex-1 min-h-[200px] bg-black rounded p-4 font-mono text-xs text-green-500 overflow-y-auto border border-white/10 shadow-inner">
            {logs.length === 0 && <div className="opacity-30 italic">Waiting for recovery events...</div>}
            {logs.map((log, i) => (
              <div key={i} className="mb-1 leading-relaxed">
                <span className="opacity-50 mr-2">{'>'}</span> {log}
              </div>
            ))}
            <div className="animate-pulse inline-block w-2 h-4 bg-green-500 ml-1" />
          </div>
        </div>
      </Panel>
    </div>
  );
}
