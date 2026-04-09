import { useApi } from '../hooks/useApi'
import Panel from './Panel'

export default function CronPanel() {
  const { data, isLoading } = useApi('/cron', 30000)

  if (isLoading || !data) {
    return <Panel title="Cron Jobs" className="col-span-full"><div className="glow text-[11px] animate-pulse">Loading...</div></Panel>
  }

  const jobs = data.jobs || data || []
  if (!Array.isArray(jobs)) {
    return <Panel title="Cron Jobs" className="col-span-full"><div className="text-[10px]" style={{ color: 'var(--hud-text-dim)' }}>No cron data</div></Panel>
  }

  return (
    <Panel title="Cron Jobs" className="col-span-full">
      <div className="text-[10px]">
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-4 gap-y-1">
          <div className="uppercase tracking-wider font-bold" style={{ color: 'var(--hud-text-dim)' }}>Status</div>
          <div className="uppercase tracking-wider font-bold" style={{ color: 'var(--hud-text-dim)' }}>Name / Prompt</div>
          <div className="uppercase tracking-wider font-bold" style={{ color: 'var(--hud-text-dim)' }}>Schedule</div>
          <div className="uppercase tracking-wider font-bold" style={{ color: 'var(--hud-text-dim)' }}>Last Run</div>
          <div className="uppercase tracking-wider font-bold" style={{ color: 'var(--hud-text-dim)' }}>Deliver</div>
          {jobs.map((job: any, i: number) => (
            <div key={i} className="contents">
              <div>
                <span className="inline-block w-2 h-2 rounded-full"
                  style={{ background: job.paused ? 'var(--hud-text-dim)' : 'var(--hud-success)' }} />
              </div>
              <div className="truncate">{job.name || job.prompt?.slice(0, 60) || job.id}</div>
              <div style={{ color: 'var(--hud-primary)' }}>{job.schedule || '-'}</div>
              <div style={{ color: 'var(--hud-text-dim)' }}>{job.last_run ? new Date(job.last_run).toLocaleString() : 'never'}</div>
              <div style={{ color: 'var(--hud-text-dim)' }}>{job.deliver || '-'}</div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  )
}
