import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import styles from './Layout.module.css'

type LayoutProps = {
  title: string
  subtitle?: string
  children: ReactNode
}

const navItems = [
  { to: '/', label: 'Overview', meta: 'Status' },
  { to: '/servers', label: 'Servers', meta: 'Hosts' },
  { to: '/nodes', label: 'Nodes', meta: 'Agents' },
  { to: '/nginx', label: 'Nginx', meta: 'Proxies' },
  { to: '/topology', label: 'Topology', meta: 'Flow' },
  { to: '/settings', label: 'Settings', meta: 'Panel' },
]

export function Layout({ title, subtitle, children }: LayoutProps) {
  const location = useLocation()

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>
            <div className={styles.orb} />
            <div className={styles.projectName}>
              <span className={styles.title}>Server Panel</span>
              <span className={styles.subtitle}>nginx & agents topology</span>
            </div>
          </div>
        </div>

        <nav className={styles.nav} aria-label="Main navigation">
          {navItems.map((item) => {
            const active = location.pathname === item.to
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    styles.navItem,
                    (isActive || active) && styles.navItemActive,
                  ]
                    .filter(Boolean)
                    .join(' ')
                }
              >
                <span className={styles.navItemIcon}>●</span>
                <span className={styles.navItemLabel}>{item.label}</span>
                <span className={styles.navItemMeta}>{item.meta}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.sidebarFooterLeft}>
            <span className={styles.sidebarFooterTitle}>Panel backend</span>
            <span className={styles.sidebarFooterMeta}>
              Unified API for all agents
            </span>
          </div>
          <span className={styles.statusPill}>
            <span className={styles.statusDot} />
            healthy
          </span>
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.pageTitle}>
            <span className={styles.pageTitleMain}>{title}</span>
            {subtitle ? (
              <span className={styles.pageTitleSub}>{subtitle}</span>
            ) : null}
          </div>
          <div className={styles.topbarActions}>
            <div className={styles.searchField}>
              <span>Search servers, nodes, domains</span>
              <span className={styles.searchShortcut}>⌘K</span>
            </div>
            <button className={styles.ghostButton} type="button">
              Theme
            </button>
            <button className={styles.primaryButton} type="button">
              New agent
            </button>
          </div>
        </header>

        <section className={styles.content}>
          <div className={styles.contentInner}>{children}</div>
        </section>
      </main>
    </div>
  )
}

