import Link from "next/link"
import Image from "next/image"

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
    image: { src: "/images/wallet/locked.png", alt: "Keythings Wallet lock screen" },
  },
  {
    title: "Command the dashboard",
    description:
      "Monitor real-time token balances, price action, storage, NFTs, and recent activity from a single, responsive hub.",
    image: { src: "/images/wallet/dashboard.png", alt: "Keythings Wallet dashboard overview" },
  },
  {
    title: "Move value with confidence",
    description:
      "Simulate and sign transactions with precise fee insights, saved contacts, and frictionless token management tools.",
    image: { src: "/images/wallet/send.png", alt: "Keythings Wallet send token flow" },
  },
]

const capabilityCards = [
  {
    title: "Token supply orchestration",
    description:
      "Mint, burn, and distribute Keeta-native tokens with full transparency and audit trails for every operation.",
    image: { src: "/images/wallet/token-supply.png", alt: "Token supply management" },
  },
  {
    title: "NFT & storage ready",
    description:
      "Track collectibles and storage allocations side-by-side, complete with activity history and contextual alerts.",
    image: { src: "/images/wallet/menu.png", alt: "Wallet navigation menu" },
  },
  {
    title: "Rapid onboarding",
    description:
      "Spin up a new vault, import an existing seed, or recover in seconds. Guided flows keep new teammates secure from day one.",
    image: { src: "/images/wallet/welcome.png", alt: "Keythings Wallet onboarding" },
  },
]


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
                <Image
                  src="/images/wallet/dashboard.png"
                  width={360}
                  height={640}
                  alt="Keythings Wallet dashboard"
                  className="relative rounded-2xl border-4 border-gray-600 shadow-[0_18px_55px_rgba(7,8,12,0.65)]"
                  priority
                />
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
                  <Image
                    src={step.image.src}
                    width={320}
                    height={560}
                    alt={step.image.alt}
                    className="rounded-xl border-4 border-gray-600"
                  />
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
                      <Image
                        src={capability.image.src}
                        width={260}
                        height={420}
                        alt={capability.image.alt}
                        className="rounded-xl border-4 border-gray-600"
                      />
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
