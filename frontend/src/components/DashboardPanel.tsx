import { useApi } from '../hooks/useApi'
import Panel, { Stat, CapacityBar, Sparkline } from './Panel'

export default function DashboardPanel() {
  const { data, isLoading } = useApi('/state', 30000)

  if (isLoading || !data) {
    return (
      <Panel title="Overview" className="col-span-full">
        <div className="glow text-[11px] animate-pulse">Collecting state...</div>
      </Panel>
    )
  }

  const { config, memory, user, skills, sessions } = data
  const dailyMessages = sessions?.daily_stats?.map((d: any) => d.messages) || []

  return (
    <>
      {/* Overview stats */}
      <Panel title="Overview" className="row-span-2">
        <div className="mb-4">
          <div className="text-[10px] mb-2" style={{ color: 'var(--hud-text-dim)' }}>
            {config?.provider}/{config?.model}
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Stat value={sessions?.total_sessions || 0} label="Sessions" />
            <Stat value={sessions?.total_messages?.toLocaleString() || '0'} label="Messages" />
            <Stat value={sessions?.total_tool_calls?.toLocaleString() || '0'} label="Tool Calls" />
            <Stat value={skills?.total || 0} label="Skills" />
          </div>
        </div>

        <CapacityBar
          value={memory?.total_chars || 0}
          max={memory?.max_chars || 2200}
          label="MEMORY"
        />
        <CapacityBar
          value={user?.total_chars || 0}
          max={user?.max_chars || 1375}
          label="USER"
        />

        {sessions?.date_range?.[0] && (
          <div className="text-[10px] mt-3" style={{ color: 'var(--hud-text-dim)' }}>
            {new Date(sessions.date_range[0]).toLocaleDateString()} → {new Date(sessions.date_range[1]).toLocaleDateString()}
          </div>
        )}
      </Panel>

      {/* Activity sparkline */}
      <Panel title="Activity">
        <div className="text-[10px] mb-2" style={{ color: 'var(--hud-text-dim)' }}>
          Daily messages · last {dailyMessages.length}d
        </div>
        <Sparkline values={dailyMessages} width={280} height={40} />
        <div className="mt-3 text-[10px]">
          {sessions?.daily_stats?.slice(-5).map((d: any) => (
            <div key={d.date} className="flex justify-between py-0.5" style={{ borderBottom: '1px solid var(--hud-border)' }}>
              <span style={{ color: 'var(--hud-text-dim)' }}>{d.date}</span>
              <span>
                <span style={{ color: 'var(--hud-primary)' }}>{d.sessions}</span>
                <span style={{ color: 'var(--hud-text-dim)' }}> sess · </span>
                <span>{d.messages}</span>
                <span style={{ color: 'var(--hud-text-dim)' }}> msgs</span>
              </span>
            </div>
          ))}
        </div>
      </Panel>

      {/* Top tools */}
      <Panel title="Top Tools">
        <div className="text-[10px] space-y-1">
          {sessions?.tool_usage && Object.entries(sessions.tool_usage)
            .sort((a: any, b: any) => b[1] - a[1])
            .slice(0, 10)
            .map(([tool, count]: any) => {
              const maxCount = Math.max(...Object.values(sessions.tool_usage as Record<string, number>))
              const pct = (count / maxCount) * 100
              return (
                <div key={tool} className="flex items-center gap-2">
                  <span className="w-[130px] truncate" style={{ color: 'var(--hud-text)' }}>
                    {tool.replace('mcp_', '')}
                  </span>
                  <div className="flex-1 h-[3px]" style={{ background: 'var(--hud-bg-hover)' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'var(--hud-primary)' }} />
                  </div>
                  <span className="tabular-nums w-8 text-right" style={{ color: 'var(--hud-text-dim)' }}>
                    {count}
                  </span>
                </div>
              )
            })}
        </div>
      </Panel>
    </>
  )
}
