import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Server,
  Globe2,
  Network,
  Settings2,
} from 'lucide-react'

type LayoutProps = {
  title: string
  subtitle?: string
  children: ReactNode
}

const navItems = [
  { to: '/', label: 'Overview', meta: 'Status', icon: LayoutDashboard },
  { to: '/servers', label: 'Servers', meta: 'Hosts', icon: Server },
  { to: '/nginx', label: 'Nginx', meta: 'Proxies', icon: Globe2 },
  { to: '/topology', label: 'Topology', meta: 'Flow', icon: Network },
  { to: '/settings', label: 'Settings', meta: 'Panel', icon: Settings2 },
]

export function Layout({ title, subtitle, children }: LayoutProps) {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-7xl gap-6 px-4 py-6 lg:px-6">
        <aside className="flex w-64 flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
          <header className="flex items-center gap-3 px-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 ring-1 ring-slate-700">
              <span className="text-sm font-semibold text-sky-300">SP</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Server Panel
              </span>
              <span className="text-xs text-slate-500">
                nginx &amp; agents topology
              </span>
            </div>
          </header>

          <nav
            className="mt-2 flex flex-1 flex-col gap-1 text-sm"
            aria-label="Main navigation"
          >
          {navItems.map((item) => {
            const active = location.pathname === item.to
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-2 rounded-xl px-2.5 py-2 text-slate-300 transition-colors',
                    'hover:bg-slate-900/80',
                    (isActive || active) &&
                      'bg-slate-900 text-slate-50 ring-1 ring-slate-700',
                  ]
                    .filter(Boolean)
                    .join(' ')
                }
              >
                <Icon
                  size={18}
                  className="shrink-0 text-slate-500"
                  aria-hidden="true"
                />
                <span className="flex flex-1 flex-col">
                  <span className="font-medium">{item.label}</span>
                  <span className="text-xs text-slate-500">{item.meta}</span>
                </span>
              </NavLink>
            )
          })}
        </nav>

          <footer className="mt-auto flex items-center justify-between gap-3 border-t border-slate-800 pt-3 text-xs">
            <div className="flex flex-col">
              <span className="font-medium text-slate-300">Panel backend</span>
              <span className="text-slate-500">
                Unified API for all agents
              </span>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(16,185,129,0.4)]" />
              healthy
            </span>
          </footer>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-slate-50">
                {title}
              </span>
              {subtitle ? (
                <span className="text-xs text-slate-500">{subtitle}</span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1.5 text-xs text-slate-400 sm:inline-flex">
                <span>Search servers, nodes, domains</span>
                <span className="rounded-full border border-slate-700 px-1.5 py-0.5 text-[10px]">
                  ⌘K
                </span>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-900"
              >
                Theme
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full bg-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-sm hover:bg-sky-400"
              >
                New agent
              </button>
            </div>
          </header>

          <section className="flex-1 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="space-y-4">{children}</div>
          </section>
        </main>
      </div>
    </div>
  )
}

