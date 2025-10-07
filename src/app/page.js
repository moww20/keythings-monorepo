import Link from "next/link"

export const metadata = {
  title: "Keythings Wallet — Chrome Extension Splash",
  description:
    "Experience the Keythings Wallet for the Keeta Network. Non-custodial security, glassmorphism design, and an intuitive dashboard built for power users.",
}

const featureHighlights = [
  {
    title: "Non-custodial by design",
    description:
      "Private keys never leave your browser. AES-GCM encryption, Argon2id hardening, and origin isolation keep attackers out while you stay in control.",
  },
  {
    title: "Purpose-built for Keeta",
    description:
      "Native Keeta SDK integration, instant testnet switching, and network-aware prompts so you're always signing the right transaction on the right chain.",
  },
  {
    title: "Intuitive, glass UI",
    description:
      "A polished glassmorphism interface surfaces balances, NFTs, and storage with zero noise. Every control is tuned for speed and clarity.",
  },
]

const workflow = [
  {
    title: "Launch & unlock",
    description:
      "Enter with biometric-grade password flows and smart account switching. Session health, lock timers, and key guardianship all begin here.",
    mockup: "locked",
  },
  {
    title: "Command the dashboard",
    description:
      "Monitor real-time token balances, price action, storage, NFTs, and recent activity from a single, responsive hub.",
    mockup: "dashboard",
  },
  {
    title: "Move value with confidence",
    description:
      "Simulate and sign transactions with precise fee insights, saved contacts, and frictionless token management tools.",
    mockup: "send",
  },
]

const capabilityCards = [
  {
    title: "Token supply orchestration",
    description:
      "Mint, burn, and distribute Keeta-native tokens with full transparency and audit trails for every operation.",
    mockup: "token-supply",
  },
  {
    title: "NFT & storage ready",
    description:
      "Track collectibles and storage allocations side-by-side, complete with activity history and contextual alerts.",
    mockup: "menu",
  },
  {
    title: "Rapid onboarding",
    description:
      "Spin up a new vault, import an existing seed, or recover in seconds. Guided flows keep new teammates secure from day one.",
    mockup: "welcome",
  },
]

function WalletMockup({ variant, className = "" }) {
  const baseClasses =
    "relative flex w-full flex-col gap-5 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.14] via-white/[0.04] to-[#05070a]/90 p-6 text-white shadow-[0_22px_60px_rgba(5,6,11,0.55)]"

  if (variant === "locked") {
    return (
      <div className={`${baseClasses} min-h-[260px] ${className}`}>
        <div className="absolute inset-x-6 top-0 h-28 rounded-full bg-emerald-400/20 blur-2xl" />
        <div className="relative flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10">
            <div className="h-9 w-7 rounded-md border-2 border-emerald-300/70">
              <div className="mx-auto mt-1 h-2 w-5 rounded-full border-2 border-emerald-300/70" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.35em] text-white/55">Vault locked</p>
            <p className="text-2xl font-semibold text-white">Keythings Wallet</p>
            <p className="text-xs text-white/55">Session secure · Origin isolated</p>
          </div>
          <div className="flex w-full flex-col gap-3">
            <div className="flex h-12 items-center justify-center rounded-full border border-white/10 bg-black/50 text-lg tracking-[0.6em] text-white/45">
              ••••••
            </div>
            <div className="flex h-11 items-center justify-center rounded-full bg-emerald-400 text-sm font-semibold text-black shadow-[0_12px_30px_rgba(16,185,129,0.35)]">
              Unlock vault
            </div>
          </div>
        </div>
        <div className="relative flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/55">
          <span>Timer 00:45</span>
          <span>Guardian sync enabled</span>
        </div>
      </div>
    )
  }

  if (variant === "dashboard") {
    return (
      <div className={`${baseClasses} min-h-[320px] ${className}`}>
        <div className="absolute inset-x-4 top-0 h-32 rounded-full bg-white/15 blur-2xl" />
        <div className="relative flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.35em] text-white/55">Portfolio</p>
              <p className="text-3xl font-semibold text-white">512,940 KTA</p>
              <p className="text-xs text-white/45">≈ $184,120.08</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-400/80 via-emerald-400/40 to-transparent" />
              <div className="space-y-1 text-right">
                <p className="text-xs text-white/55">24h change</p>
                <p className="text-sm font-semibold text-emerald-300">+12.4%</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex items-center justify-between text-xs text-white/45">
              <span>Asset</span>
              <span>Value</span>
            </div>
            <div className="space-y-2 text-sm">
              {[
                { label: "Keeta", value: "312,450", accent: "from-emerald-300/70 to-emerald-500/60" },
                { label: "Stable reserves", value: "142,620", accent: "from-cyan-300/60 to-cyan-500/50" },
                { label: "Storage", value: "57,870", accent: "from-violet-300/60 to-violet-500/50" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between rounded-lg bg-black/30 p-3">
                  <div className="flex items-center gap-3">
                    <span className={`h-8 w-8 rounded-xl bg-gradient-to-br ${row.accent}`} />
                    <span className="text-white/85">{row.label}</span>
                  </div>
                  <span className="font-semibold text-white/75">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs text-white/60">
            <div className="rounded-xl border border-white/10 bg-black/40 p-3">
              <p className="mb-2 text-[0.65rem] uppercase tracking-[0.3em] text-white/45">Activity</p>
              <div className="space-y-2 text-sm text-white/70">
                <div className="flex items-center justify-between">
                  <span>Receive</span>
                  <span className="text-emerald-300">+420</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Stake</span>
                  <span className="text-violet-300">-1,200</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Storage</span>
                  <span className="text-cyan-300">+80</span>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/40 p-3">
              <p className="mb-2 text-[0.65rem] uppercase tracking-[0.3em] text-white/45">Network</p>
              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-lg bg-white/5 p-2 text-sm text-white/80">
                  <span className="h-6 w-6 rounded-full bg-emerald-400/70" />
                  <div>
                    <p>Mainnet</p>
                    <p className="text-xs text-white/45">Healthy</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-white/10 p-2 text-xs text-white/60">
                  <span className="h-6 w-6 rounded-full bg-cyan-400/50" />
                  <span>Testnet · Ready</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (variant === "send") {
    return (
      <div className={`${baseClasses} min-h-[280px] ${className}`}>
        <div className="absolute inset-x-6 top-0 h-24 rounded-full bg-cyan-400/20 blur-2xl" />
        <div className="relative space-y-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.35em] text-white/55">Send assets</p>
            <p className="text-lg font-semibold text-white">Distribute tokens</p>
          </div>
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.35em] text-white/45">Recipient</label>
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/70">
                <span>treasury.multisig.keeta</span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-[0.65rem] uppercase tracking-[0.25em]">Saved</span>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.35em] text-white/45">Amount</label>
                <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white/80">4,200 KTA</div>
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.35em] text-white/45">Network fee</label>
                <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-emerald-300">0.0021 KTA</div>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-white/60">
            <p className="mb-2 text-[0.65rem] uppercase tracking-[0.35em] text-white/45">Simulation</p>
            <div className="space-y-1 text-sm text-white/70">
              <div className="flex items-center justify-between">
                <span>Arrival</span>
                <span className="text-emerald-300">12s</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Risk</span>
                <span className="text-white/50">None detected</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/50">3 approvals required</span>
            <div className="flex h-11 w-32 items-center justify-center rounded-full bg-cyan-400 text-sm font-semibold text-black shadow-[0_12px_30px_rgba(34,211,238,0.35)]">
              Sign & send
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (variant === "token-supply") {
    return (
      <div className={`${baseClasses} min-h-[260px] ${className}`}>
        <div className="absolute inset-x-6 top-0 h-24 rounded-full bg-violet-500/20 blur-2xl" />
        <div className="relative space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-white/55">Token supply</p>
            <p className="text-lg font-semibold text-white">Orchestrate movements</p>
          </div>
          <div className="grid gap-4">
            <div className="space-y-2">
              {["Treasury", "Community", "Liquidity"].map((label, index) => (
                <div key={label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-white/55">
                    <span>{label}</span>
                    <span>{index === 0 ? "Live" : "Scheduled"}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10">
                    <div
                      className={`h-2 rounded-full bg-gradient-to-r ${
                        index === 0
                          ? "from-violet-400 via-fuchsia-400 to-emerald-400"
                          : index === 1
                            ? "from-cyan-400 via-emerald-400 to-lime-400"
                            : "from-amber-400 via-orange-400 to-rose-400"
                      }`}
                      style={{ width: `${60 + index * 20}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs text-white/60">
              <div className="rounded-xl border border-white/10 bg-black/35 p-3">
                <p className="text-[0.65rem] uppercase tracking-[0.3em] text-white/45">Mint authority</p>
                <p className="mt-2 text-sm text-white/80">Multisig · Threshold 3</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/35 p-3">
                <p className="text-[0.65rem] uppercase tracking-[0.3em] text-white/45">Audit log</p>
                <p className="mt-2 text-sm text-white/80">9 entries this week</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (variant === "menu") {
    return (
      <div className={`${baseClasses} min-h-[260px] ${className}`}>
        <div className="absolute inset-x-6 top-0 h-24 rounded-full bg-white/15 blur-2xl" />
        <div className="relative space-y-4">
          <p className="text-xs uppercase tracking-[0.35em] text-white/55">Navigation</p>
          <div className="space-y-2">
            {[
              { label: "Dashboard", active: true },
              { label: "NFT Vault", accent: "emerald" },
              { label: "Storage", accent: "cyan" },
              { label: "Governance", accent: "violet" },
              { label: "Activity", accent: "white" },
            ].map((item) => (
              <div
                key={item.label}
                className={`flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3 text-sm ${
                  item.active ? "bg-white/15 text-white" : "bg-black/40 text-white/70"
                }`}
              >
                <span>{item.label}</span>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    item.accent === "emerald"
                      ? "bg-emerald-400"
                      : item.accent === "cyan"
                        ? "bg-cyan-400"
                        : item.accent === "violet"
                          ? "bg-violet-400"
                          : "bg-white/60"
                  }`}
                />
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/60">
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-white/45">Context</p>
            <p className="mt-2 text-sm text-white/75">Switch spaces in one click and pin your favorites for faster approvals.</p>
          </div>
        </div>
      </div>
    )
  }

  if (variant === "welcome") {
    return (
      <div className={`${baseClasses} min-h-[260px] ${className}`}>
        <div className="absolute inset-x-6 top-0 h-24 rounded-full bg-emerald-400/20 blur-2xl" />
        <div className="relative space-y-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.35em] text-white/55">Welcome</p>
            <p className="text-lg font-semibold text-white">Set up in minutes</p>
          </div>
          <div className="space-y-3">
            {[
              { step: "Create vault", detail: "Generate a new Keeta seed" },
              { step: "Add guardians", detail: "Invite trusted recovery partners" },
              { step: "Import keys", detail: "Bring an existing mnemonic" },
            ].map((item, index) => (
              <div key={item.step} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/35 px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white/70">
                  {index + 1}
                </div>
                <div>
                  <p className="text-sm text-white">{item.step}</p>
                  <p className="text-xs text-white/55">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/65">
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-white/45">Security defaults</p>
            <p className="mt-2 text-sm text-white/80">Biometric unlock and 2FA prompts auto-enable for new workspaces.</p>
          </div>
        </div>
      </div>
    )
  }

  return <div className={`${baseClasses} min-h-[240px] ${className}`} />
}

export default function Home() {
  return (
    <main className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[#070709]" />
      <div className="pointer-events-none absolute inset-x-0 top-[-20%] z-0 h-[480px] bg-gradient-to-b from-white/10 via-transparent to-transparent blur-3xl" />

      <section className="relative z-10 pt-28 pb-24">
        <div className="mx-auto flex max-w-7xl flex-col gap-16 px-6 lg:flex-row lg:items-center">
          <div className="flex-1 space-y-8">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs uppercase tracking-[0.2em] text-white/70">
              Chrome Extension
              <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
              Keeta Optimized
            </span>
            <h1 className="text-balance text-4xl font-semibold leading-tight text-white md:text-5xl lg:text-6xl">
              The glassmorphism wallet built for the Keeta Network
            </h1>
            <p className="max-w-2xl text-lg text-white/70">
              Keythings Wallet gives builders, treasuries, and communities a frictionless way to secure, visualize, and mobilize digital value on Keeta. Designed for Chrome with uncompromising privacy and performance.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <a
                href="https://chromewebstore.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow-[0_20px_50px_rgba(15,15,20,0.35)] transition hover:bg-white/90"
              >
                Install on Chrome
              </a>
              <Link
                href="/docs"
                className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Explore the docs
              </Link>
            </div>
            <div className="grid max-w-xl gap-6 sm:grid-cols-3">
              {featureHighlights.map((feature) => (
                <div key={feature.title} className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/70 shadow-[0_16px_40px_rgba(8,10,14,0.35)]">
                  <h3 className="mb-2 text-sm font-semibold text-white">{feature.title}</h3>
                  <p className="text-xs leading-relaxed text-white/60">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-1 justify-center lg:justify-end">
            <div className="relative w-full max-w-[420px]">
              <div className="absolute -inset-6 rounded-[36px] bg-gradient-to-br from-white/10 via-white/0 to-white/5 blur-2xl" />
              <div className="glass relative overflow-hidden rounded-[30px] border border-white/10 p-6 shadow-[0_35px_85px_rgba(0,0,0,0.55)]">
                <div className="absolute inset-x-12 top-8 h-48 rounded-full bg-gradient-to-b from-white/20 via-transparent to-transparent blur-2xl" />
                <div className="relative">
                  <WalletMockup variant="dashboard" className="min-h-[520px]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 pb-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 flex flex-col gap-3 text-center">
            <span className="text-xs uppercase tracking-[0.35em] text-white/50">Workflow</span>
            <h2 className="text-3xl font-semibold text-white md:text-4xl">A launch-to-signing experience that just flows</h2>
            <p className="mx-auto max-w-3xl text-base text-white/65">
              Every touchpoint is engineered for velocity. From unlocking the vault to distributing tokens, Keythings Wallet keeps your teams in motion with auditability and trust built in.
            </p>
          </div>
          <div className="grid gap-8 lg:grid-cols-3">
            {workflow.map((step) => (
              <div key={step.title} className="group relative flex flex-col gap-5 rounded-3xl border border-white/8 bg-white/[0.035] p-6 shadow-[0_20px_60px_rgba(6,7,10,0.45)] transition hover:border-white/15 hover:bg-white/[0.06]">
                <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-white/0 to-transparent p-4">
                  <WalletMockup variant={step.mockup} className="min-h-[280px]" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-white/65">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 pb-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-6">
              <span className="text-xs uppercase tracking-[0.35em] text-white/50">Why teams choose Keythings</span>
              <h2 className="text-3xl font-semibold text-white md:text-4xl">
                Enterprise-grade security without compromising on simplicity
              </h2>
              <p className="text-base text-white/65">
                Seeds stay locked in volatile memory. Capability-based permissions, progressive lockouts, and transaction simulation guard every signature. Pair it with a design system your stakeholders will actually love using.
              </p>
              <dl className="grid gap-6 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_18px_50px_rgba(5,6,9,0.45)]">
                  <dt className="text-sm font-semibold text-white">Security-first architecture</dt>
                  <dd className="text-sm text-white/60">
                    AES-GCM encryption, Argon2id key derivation, manifest v3 hardening, and origin isolation across every surface.
                  </dd>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_18px_50px_rgba(5,6,9,0.45)]">
                  <dt className="text-sm font-semibold text-white">Developer-grade tooling</dt>
                  <dd className="text-sm text-white/60">
                    TypeScript, Redux Toolkit, and the Keeta SDK power modular flows, automation hooks, and custom dapp permissions.
                  </dd>
                </div>
              </dl>
              <div className="flex flex-wrap gap-4">
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.25em] text-white/60">
                  Multi-network ready
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.25em] text-white/60">
                  Transaction simulation
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.25em] text-white/60">
                  Risk intelligence
                </div>
              </div>
            </div>
            <div className="grid gap-6">
              {capabilityCards.map((capability) => (
                <div key={capability.title} className="glass relative overflow-hidden rounded-3xl border border-white/8 p-6 shadow-[0_30px_70px_rgba(5,6,11,0.55)]">
                  <div className="absolute inset-x-8 top-6 h-32 rounded-full bg-white/10 blur-2xl" />
                  <div className="relative grid gap-4 lg:grid-cols-[1fr_1.2fr] lg:items-center">
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-white">{capability.title}</h3>
                      <p className="text-sm leading-relaxed text-white/65">{capability.description}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <WalletMockup variant={capability.mockup} className="min-h-[260px]" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 pb-32">
        <div className="mx-auto max-w-5xl px-6">
          <div className="glass relative overflow-hidden rounded-3xl border border-white/8 p-10 text-center shadow-[0_30px_80px_rgba(5,6,11,0.55)]">
            <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/15 via-transparent to-transparent" />
            <div className="relative space-y-6">
              <span className="text-xs uppercase tracking-[0.35em] text-white/50">Ready to deploy</span>
              <h2 className="text-3xl font-semibold text-white md:text-4xl">Bring the Keeta Network to every browser tab</h2>
              <p className="mx-auto max-w-3xl text-base text-white/65">
                Empower your community with a self-sovereign wallet experience that feels instantly familiar. Install Keythings Wallet, connect your dapps, and unlock the next era of Keeta-native finance.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <a
                  href="https://chromewebstore.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow-[0_20px_50px_rgba(15,15,20,0.35)] transition hover:bg-white/90"
                >
                  Install on Chrome
                </a>
                <Link
                  href="/docs/getting-started"
                  className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Start building
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
