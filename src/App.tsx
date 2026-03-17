import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout/Layout'
import { OverviewPage } from './modules/overview/OverviewPage'
import { ServersPage } from './modules/servers/ServersPage'
import { NodesPage } from './modules/nodes/NodesPage'
import { NginxPage } from './modules/nginx/NginxPage'
import { TopologyPage } from './modules/topology/TopologyPage'
import { SettingsPage } from './modules/settings/SettingsPage'

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <Layout
            title="Overview"
            subtitle="High‑level status of servers, agents and nginx proxies"
          >
            <OverviewPage />
          </Layout>
        }
      />
      <Route
        path="/servers"
        element={
          <Layout
            title="Servers"
            subtitle="Hosts, load and attached agents / proxies"
          >
            <ServersPage />
          </Layout>
        }
      />
      <Route
        path="/nodes"
        element={
          <Layout
            title="Nodes / agents"
            subtitle="Agents installed on servers and their connectivity"
          >
            <NodesPage />
          </Layout>
        }
      />
      <Route
        path="/nginx"
        element={
          <Layout
            title="Nginx proxies"
            subtitle="Domains, upstreams and SSL state"
          >
            <NginxPage />
          </Layout>
        }
      />
      <Route
        path="/topology"
        element={
          <Layout
            title="Topology"
            subtitle="Traffic flow between nginx, servers and agents"
          >
            <TopologyPage />
          </Layout>
        }
      />
      <Route
        path="/settings"
        element={
          <Layout
            title="Settings"
            subtitle="Panel configuration and agent registration"
          >
            <SettingsPage />
          </Layout>
        }
      />
    </Routes>
  )
}

export default App
