# Hermes HUD WebUI — Code Review
## Bugs, Edge Cases, Optimizations, Mobile

Reviewed: 2026-04-08

---

## CRITICAL BUGS

1. **TopBar `r` key calls both onRefresh AND window.location.reload()**
   reload() makes onRefresh dead code. Use onRefresh OR reload, not both.

2. **CronPanel: timeAgo(null) crashes**
   `new Date(null)` returns epoch 1970. The `!iso` check only catches
   empty string/undefined but NOT the API returning null for last_run_at.

3. **BootScreen ASCII art overflows on mobile**
   Fixed `w-[400px]` on boot text + wide ASCII blocks clip on screens < 480px.

## PERFORMANCE

4. **DashboardPanel: Object.values() inside .map() recomputes max N times**
   `Math.max(...Object.values(tool_usage))` runs per iteration of .map().
   Should be computed once before the map.

5. **No data memoization across re-renders**
   Every render sorts arrays, maps daily stats, computes sparkline points.
   With SWR polling every 30s, this is wasteful.

6. **Panel hover box-shadow causes full repaint on every panel**
   GPU-accelerated transitions but still expensive on 6-panel grid.

## EDGE CASES

7. **MemoryPanel: label prop passed to MemoryEntries but unused**
8. **PatternsPanel: text-[8px] for hour labels — nearly invisible**
9. **Memory category label inline fontSize: '9px' — hardcoded, not Tailwind**
10. **All panels show generic "Loading..." during SWR revalidation**
    SWR revalidates in background on interval, but also shows "Loading..."
    on the first load. Should distinguish initial load vs refresh.

## CODE QUALITY

11. **Duplicate timeAgo functions** — CronPanel, ProfilesPanel, SkillsPanel
    all have their own version. Should be one shared util.
12. **Duplicate relativeTime functions** — same issue.
13. **No shared types** — every panel uses `any` for API data.

## MOBILE

14. **No responsive breakpoints** — grids are fixed grid-cols-3, etc.
15. **Tab bar overflows** — 10 tabs don't fit on narrow screens.
16. **Touch targets too small** — tabs are 24px tall, need 44px for touch.
17. **Status bar clips** — shortcut hints overflow on small screens.
18. **No viewport scaling consideration** — 14px base font too small on phones.

## ACCESSIBILITY

19. **No ARIA labels** on interactive elements.
20. **No keyboard focus indicators** — custom styling removes default outlines.
21. **Color contrast issues** — text-dim colors may fail WCAG AA on dark bg.
