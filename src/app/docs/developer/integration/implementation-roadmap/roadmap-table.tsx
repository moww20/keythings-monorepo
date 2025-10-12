interface SprintMilestone {
  range: string;
  title: string;
  outcomes: string[];
  readiness: string;
}

const sprintMilestones: SprintMilestone[] = [
  {
    range: "Sprints 1-2",
    title: "Backend foundation",
    outcomes: [
      "Actix Web service skeleton with health probes, tracing, and CI packaging",
      "PostgreSQL schema migrations for users, balances, orders, and fills",
      "Docker Compose stack with Postgres and Redis tuned for deterministic local runs",
      "Baseline incident response runbook covering deploy, rollback, and config rotation",
    ],
    readiness: "Code owners sign off on service boot, persistence migrations, and observability dashboards",
  },
  {
    range: "Sprints 3-4",
    title: "Matching engine",
    outcomes: [
      "Deterministic price-time priority order book with unit and property-based tests",
      "Balance reservation pipeline feeding match attempts and rollback paths",
      "Simulation harness for throughput benchmarking and latency SLO tracking",
    ],
    readiness: "Performance gate holds at target TPS with replay traces archived for regression",
  },
  {
    range: "Sprints 5-6",
    title: "Settlement & Keeta integration",
    outcomes: [
      "StorageAccountManager wiring for scoped SEND_ON_BEHALF permissions per asset",
      "Async settlement workers reconciling ledger deltas with Keeta confirmations",
      "Self-withdraw path validated end-to-end with operator failure scenarios",
    ],
    readiness: "Keeta integration review + automated reconciliation alerts operational",
  },
  {
    range: "Sprints 7-8",
    title: "Trading UI",
    outcomes: [
      "Next.js trading workstation with depth charts, order entry, and portfolio views",
      "Design system tokens applied across glass panels, typography, and buttons",
      "Feature flag guardrails for staged rollout to internal liquidity partners",
    ],
    readiness: "Product and compliance sign off on UX copy, accessibility, and audit logging",
  },
  {
    range: "Sprints 9-10",
    title: "Wallet integration",
    outcomes: [
      "Keythings Wallet connect flow with capability scoping and risk preflight",
      "Delegated permission viewer embedded for operations monitoring",
      "Treasury tooling for hot/cold wallet thresholds and emergency shutdown",
    ],
    readiness: "Wallet QA verifies capability revocation, reconnect flows, and operator rotation",
  },
  {
    range: "Sprints 11-12",
    title: "WebSocket & real-time",
    outcomes: [
      "Clustered WebSocket gateways with fan-out to order book delta streams",
      "Redis streaming buffers with backpressure controls and replay windows",
      "Client SDK updates for subscription lifecycle and reconnection jitter",
    ],
    readiness: "Chaos drills confirm gateway failover and message ordering guarantees",
  },
  {
    range: "Sprints 13-14",
    title: "Security & testing",
    outcomes: [
      "Static analysis, dependency audit, and fuzzing integrated into CI gates",
      "Threat model updates covering operator keys, data exfiltration, and DoS surfaces",
      "Runbooks for incident response, disclosure, and user communications",
    ],
    readiness: "Security council approves findings with remediation tasks tracked to closure",
  },
  {
    range: "Sprints 15-16",
    title: "Liquidity partner features",
    outcomes: [
      "LP incentives dashboard with fee tiers, rebates, and performance analytics",
      "Bulk order entry + cancel APIs with rate limits and monitoring",
      "Auto-rebalancing scripts coordinating on-chain transfers with internal ledger",
    ],
    readiness: "Liquidity council signs SLA, volume targets, and monitoring hooks before GA",
  },
];

export default function RoadmapTable() {
  return (
    <div className="glass rounded-2xl border border-hairline shadow-[0_20px_60px_rgba(6,7,10,0.45)]">
      <div className="divide-y divide-white/5">
        {sprintMilestones.map((sprint) => (
          <section key={sprint.range} className="p-6 md:p-7">
            <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4">
              <span className="text-sm font-medium uppercase tracking-wide text-muted">{sprint.range}</span>
              <h3 className="text-lg font-semibold text-foreground">{sprint.title}</h3>
            </header>
            <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:gap-6">
              <ul className="space-y-2 text-sm text-muted-foreground">
                {sprint.outcomes.map((outcome) => (
                  <li key={outcome} className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-accent/80" aria-hidden />
                    <span>{outcome}</span>
                  </li>
                ))}
              </ul>
              <div className="rounded-lg border border-hairline/60 bg-surface/60 p-4 text-sm text-muted-foreground">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground/80 mb-2">Readiness gate</h4>
                <p>{sprint.readiness}</p>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
