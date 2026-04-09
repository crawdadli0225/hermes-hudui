import { useApi } from '../hooks/useApi'
import Panel from './Panel'

export default function ProjectsPanel() {
  const { data, isLoading } = useApi('/projects', 60000)

  if (isLoading || !data) {
    return <Panel title="Projects" className="col-span-full"><div className="glow text-[11px] animate-pulse">Loading...</div></Panel>
  }

  const projects = data.projects || data || []
  if (!Array.isArray(projects)) {
    return <Panel title="Projects" className="col-span-full"><div className="text-[10px]" style={{ color: 'var(--hud-text-dim)' }}>No project data</div></Panel>
  }

  return (
    <Panel title="Projects" className="col-span-full">
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 gap-y-1 text-[10px]">
        <div className="uppercase tracking-wider font-bold" style={{ color: 'var(--hud-text-dim)' }}>Name</div>
        <div className="uppercase tracking-wider font-bold" style={{ color: 'var(--hud-text-dim)' }}>Language</div>
        <div className="uppercase tracking-wider font-bold" style={{ color: 'var(--hud-text-dim)' }}>Branch</div>
        <div className="uppercase tracking-wider font-bold" style={{ color: 'var(--hud-text-dim)' }}>Status</div>
        {projects.map((p: any, i: number) => (
          <div key={i} className="contents">
            <div style={{ color: 'var(--hud-primary)' }}>{p.name}</div>
            <div>{p.language || '-'}</div>
            <div style={{ color: 'var(--hud-text-dim)' }}>{p.branch || '-'}</div>
            <div>
              {p.uncommitted_changes ? (
                <span style={{ color: 'var(--hud-warning)' }}>modified</span>
              ) : (
                <span style={{ color: 'var(--hud-success)' }}>clean</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}
