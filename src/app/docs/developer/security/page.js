export const metadata = {
  title: "Security for Developers — Keythings Wallet Docs",
  description: "Security considerations and best practices for dApp developers integrating with Keythings Wallet.",
  alternates: { canonical: "/docs/developer/security" },
}

export default function DevSecurityPage() {
  return (
    <div className="rounded-2xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight mb-3">Security for Developers</h1>
      <div className="docs-prose">
        <p><em>Build safer dApps by validating inputs, minimizing permissions, and handling errors carefully.</em></p>

        <h2>Input Validation</h2>
        <ul>
          <li>Validate addresses, amounts, and message sizes before sending to the wallet.</li>
          <li>Sanitize user inputs to prevent injection attacks in your UI.</li>
        </ul>

        <h2>Permission Scope</h2>
        <ul>
          <li>Request only required capabilities (read, sign, transact).</li>
          <li>Explain clearly why you need each permission.</li>
        </ul>

        <h2>Error Handling</h2>
        <ul>
          <li>Handle common wallet errors (4001, 4100, 4200, 4900, 4901).</li>
          <li>Do not leak sensitive details in error messages or logs.</li>
        </ul>

        <h2>Rate Limiting</h2>
        <ul>
          <li>Throttle high-frequency requests (polling, balance checks).</li>
          <li>Debounce user-triggered actions where appropriate.</li>
        </ul>
      </div>
    </div>
  )
}


