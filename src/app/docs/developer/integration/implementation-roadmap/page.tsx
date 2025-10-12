import RoadmapTable from "./roadmap-table";

export const metadata = {
  title: "Implementation Roadmap — Keythings Wallet Docs",
  description: "Phase 6 execution timeline covering the 16-week roadmap for the Keeta hybrid DEX integration.",
  alternates: { canonical: "/docs/developer/integration/implementation-roadmap" },
};

export default function ImplementationRoadmapPage() {
  return (
    <div className="rounded-2xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight mb-3">Phase 6 — Implementation Roadmap</h1>
      <div className="docs-prose">
        <p>
          <em>
            Phase 6 translates the hybrid DEX architecture into an actionable 16-week build sequence. Each sprint delivers a
            production-ready slice that compounds toward a fully compliant, non-custodial exchange experience on Keeta.
          </em>
        </p>

        <h2>16-week delivery plan</h2>
        <p>
          The roadmap pairs engineering milestones with operational checklists so backend, frontend, and compliance teams ship in
          lockstep. Treat each sprint as a hardening pass—features graduate only when they meet observability, documentation, and
          failover readiness criteria.
        </p>
      </div>

      <div className="mt-6">
        <RoadmapTable />
      </div>

      <div className="docs-prose mt-6">
        <h2>Execution guardrails</h2>
        <ul>
          <li>
            <strong>Progressive hardening:</strong> Every sprint includes regression suites, runbooks, and rollback playbooks so new
            surfaces never ship without recovery paths.
          </li>
          <li>
            <strong>Keeta alignment:</strong> Settlement flows remain non-custodial—operators only receive scoped
            <code>SEND_ON_BEHALF</code> permissions per asset, and users can self-withdraw at any time.
          </li>
          <li>
            <strong>Operational readiness:</strong> Compliance, support, and treasury receive sprint demos and updated SOPs before a
            feature is considered complete.
          </li>
        </ul>

        <h2>Cross-team sign-off checklist</h2>
        <ul>
          <li>Ledger reconciliation across on-chain balances, Postgres, and Redis snapshots.</li>
          <li>Disaster recovery drills validating cold-start procedures for matching, settlement, and WebSocket clusters.</li>
          <li>Security reviews covering dependency posture, permission scopes, and incident response updates.</li>
        </ul>
      </div>
    </div>
  );
}
