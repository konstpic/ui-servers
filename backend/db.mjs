import Database from 'better-sqlite3'

const db = new Database('panel.db')

db.pragma('journal_mode = WAL')

db.exec(`
  create table if not exists servers (
    id text primary key,
    name text not null,
    hostname text not null,
    ip text not null,
    tier text not null,
    status text not null,
    cpu integer not null default 0,
    ram integer not null default 0,
    agents_count integer not null default 0,
    nginx_count integer not null default 0
  );

  create table if not exists nodes (
    id text primary key,
    server_id text not null,
    version text not null,
    status text not null,
    last_ping text not null
  );

  create table if not exists nginx_proxies (
    id text primary key,
    domain text not null,
    upstream text not null,
    status text not null,
    ssl_valid_to text not null,
    ssl_days_left integer not null,
    server_id text not null
  );

  create table if not exists events (
    id integer primary key autoincrement,
    timestamp text not null,
    kind text not null,
    summary text not null,
    target_label text not null,
    severity text not null
  );

  create table if not exists upstreams (
    id text primary key,
    name text not null,
    description text,
    status text not null,
    server_ids text not null
  );

  create table if not exists server_metrics (
    id integer primary key autoincrement,
    server_id text not null,
    agent_id text not null,
    timestamp text not null,
    cpu real not null,
    ram real not null,
    disk_used_percent real,
    net_rx_bytes integer,
    net_tx_bytes integer
  );

  create table if not exists nginx_flow_aggregates (
    id integer primary key autoincrement,
    proxy_id text not null,
    sni text not null,
    upstream_name text not null,
    upstream_addr text not null,
    status text not null,
    window_start text not null,
    window_end text not null,
    sessions integer not null,
    bytes_sent integer not null,
    bytes_received integer not null,
    avg_session_time real,
    max_session_time real
  );
`)

export function listServers() {
  return db.prepare('select * from servers').all()
}

export function upsertServer(server) {
  db.prepare(
    `insert into servers (id, name, hostname, ip, tier, status, cpu, ram, agents_count, nginx_count)
     values (@id, @name, @hostname, @ip, @tier, @status, @cpu, @ram, @agents_count, @nginx_count)
     on conflict(id) do update set
       name=excluded.name,
       hostname=excluded.hostname,
       ip=excluded.ip,
       tier=excluded.tier,
       status=excluded.status,
       cpu=excluded.cpu,
       ram=excluded.ram,
       agents_count=excluded.agents_count,
       nginx_count=excluded.nginx_count`,
  ).run(server)
}

export function listNodes() {
  return db.prepare('select * from nodes').all()
}

export function upsertNode(node) {
  db.prepare(
    `insert into nodes (id, server_id, version, status, last_ping)
     values (@id, @server_id, @version, @status, @last_ping)
     on conflict(id) do update set
       server_id=excluded.server_id,
       version=excluded.version,
       status=excluded.status,
       last_ping=excluded.last_ping`,
  ).run(node)
}

export function listNginx() {
  return db.prepare('select * from nginx_proxies').all()
}

export function upsertNginx(proxy) {
  db.prepare(
    `insert into nginx_proxies (id, domain, upstream, status, ssl_valid_to, ssl_days_left, server_id)
     values (@id, @domain, @upstream, @status, @ssl_valid_to, @ssl_days_left, @server_id)
     on conflict(id) do update set
       domain=excluded.domain,
       upstream=excluded.upstream,
       status=excluded.status,
       ssl_valid_to=excluded.ssl_valid_to,
       ssl_days_left=excluded.ssl_days_left,
       server_id=excluded.server_id`,
  ).run(proxy)
}

export function listEvents(limit = 20) {
  return db
    .prepare('select * from events order by timestamp desc limit ?')
    .all(limit)
}

export function addEvent(event) {
  db.prepare(
    `insert into events (timestamp, kind, summary, target_label, severity)
     values (@timestamp, @kind, @summary, @target_label, @severity)`,
  ).run(event)
}

export function upsertUpstream(upstream) {
  db.prepare(
    `insert into upstreams (id, name, description, status, server_ids)
     values (@id, @name, @description, @status, @server_ids)
     on conflict(id) do update set
       name=excluded.name,
       description=excluded.description,
       status=excluded.status,
       server_ids=excluded.server_ids`,
  ).run(upstream)
}

export function listUpstreams() {
  return db.prepare('select * from upstreams').all()
}

export function insertServerMetrics(sample) {
  db.prepare(
    `insert into server_metrics (server_id, agent_id, timestamp, cpu, ram, disk_used_percent, net_rx_bytes, net_tx_bytes)
     values (@server_id, @agent_id, @timestamp, @cpu, @ram, @disk_used_percent, @net_rx_bytes, @net_tx_bytes)`,
  ).run(sample)
}

export function listLatestServerMetrics() {
  return db
    .prepare(
      `
      select sm.*
      from server_metrics sm
      join (
        select server_id, max(timestamp) as max_ts
        from server_metrics
        group by server_id
      ) latest
      on sm.server_id = latest.server_id and sm.timestamp = latest.max_ts
    `,
    )
    .all()
}

export function insertNginxFlowBatch(rows) {
  const insert = db.prepare(
    `insert into nginx_flow_aggregates (
      proxy_id,
      sni,
      upstream_name,
      upstream_addr,
      status,
      window_start,
      window_end,
      sessions,
      bytes_sent,
      bytes_received,
      avg_session_time,
      max_session_time
    ) values (
      @proxy_id,
      @sni,
      @upstream_name,
      @upstream_addr,
      @status,
      @window_start,
      @window_end,
      @sessions,
      @bytes_sent,
      @bytes_received,
      @avg_session_time,
      @max_session_time
    )`,
  )

  const tx = db.transaction((batch) => {
    for (const row of batch) {
      insert.run(row)
    }
  })

  tx(rows)
}

export function listRecentNginxFlow({ limit = 200, sinceMinutes = 15 } = {}) {
  return db
    .prepare(
      `
      select *
      from nginx_flow_aggregates
      where window_end >= datetime('now', ?)
      order by window_end desc
      limit ?
    `,
    )
    .all(`-${sinceMinutes} minutes`, limit)
}


