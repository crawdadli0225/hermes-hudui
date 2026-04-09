import { useState } from 'react'
import { ThemeProvider } from './hooks/useTheme'
import TopBar, { type TabId } from './components/TopBar'
import DashboardPanel from './components/DashboardPanel'
import MemoryPanel from './components/MemoryPanel'
import SkillsPanel from './components/SkillsPanel'
import SessionsPanel from './components/SessionsPanel'
import CronPanel from './components/CronPanel'
import ProjectsPanel from './components/ProjectsPanel'
import HealthPanel from './components/HealthPanel'
import ProfilesPanel from './components/ProfilesPanel'
import PatternsPanel from './components/PatternsPanel'

function TabContent({ tab }: { tab: TabId }) {
  switch (tab) {
    case 'dashboard': return <DashboardPanel />
    case 'memory': return <MemoryPanel />
    case 'skills': return <SkillsPanel />
    case 'sessions': return <SessionsPanel />
    case 'cron': return <CronPanel />
    case 'projects': return <ProjectsPanel />
    case 'health': return <HealthPanel />
    case 'profiles': return <ProfilesPanel />
    case 'patterns': return <PatternsPanel />
    default: return <DashboardPanel />
  }
}

// Grid layout configs per tab
const GRID_CLASS: Record<TabId, string> = {
  dashboard: 'grid-cols-3 grid-rows-[1fr_1fr]',
  memory: 'grid-cols-2',
  skills: 'grid-cols-3',
  sessions: 'grid-cols-3',
  cron: 'grid-cols-1',
  projects: 'grid-cols-1',
  health: 'grid-cols-2',
  profiles: 'grid-cols-1',
  patterns: 'grid-cols-3',
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')

  return (
    <ThemeProvider>
      <TopBar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className={`flex-1 grid gap-2 p-2 overflow-auto auto-rows-fr ${GRID_CLASS[activeTab]}`}
            style={{ minHeight: 0 }}>
        <TabContent tab={activeTab} />
      </main>
      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-0.5 text-[9px] border-t"
           style={{ borderColor: 'var(--hud-border)', color: 'var(--hud-text-dim)', background: 'var(--hud-bg-surface)' }}>
        <span>☤ hermes-hudui v0.1.0</span>
        <span>
          <span className="opacity-40">1-9</span> tabs
          <span className="mx-2">·</span>
          <span className="opacity-40">t</span> theme
          <span className="mx-2">·</span>
          <span className="opacity-40">r</span> refresh
        </span>
      </div>
    </ThemeProvider>
  )
}
