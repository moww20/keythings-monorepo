import Link from "next/link"
import Image from "next/image"

export const metadata = {
  title: "Keythings Wallet — Chrome Extension Splash",
  description:
    "Keythings Wallet delivers Keeta Network security and performance with private control, clear workflows, and confident approvals.",
}

const featureHighlights = [
  {
    title: "You stay in control",
    description:
      "Private keys remain in your hands with layered protections that keep intruders out while you move quickly.",
  },
  {
    title: "Made for the Keeta Network",
    description:
      "Smart prompts, clear approvals, and reliable connectivity ensure every action lands on the right Keeta environment.",
  },
  {
    title: "Peace of mind at speed",
    description:
      "Simple navigation and responsive performance help you monitor balances, storage, and NFTs without breaking focus.",
  },
]

const workflow = [
  {
    title: "Launch & unlock",
    description:
      "Sign in with calm confidence and pick up exactly where you left off. Smart session controls keep the wallet ready when you are.",
    image: { src: "/images/wallet/locked.png", alt: "Keythings Wallet lock screen" },
  },
  {
    title: "Command the dashboard",
    description:
      "See balances, storage, NFTs, and activity in one organized view so you can make quick decisions without second guessing.",
    image: { src: "/images/wallet/dashboard.png", alt: "Keythings Wallet dashboard overview" },
  },
  {
    title: "Move value with confidence",
    description:
      "Review fees, confirm recipients, and send assets with prompts that highlight what matters before you sign.",
    image: { src: "/images/wallet/send.png", alt: "Keythings Wallet send token flow" },
  },
]

const capabilityCards = [
  {
    title: "Token supply orchestration",
    description:
      "Launch, adjust, and distribute Keeta-native tokens with confidence while every move stays easy to audit.",
    image: { src: "/images/wallet/token-supply.png", alt: "Token supply management" },
  },
  {
    title: "NFT & storage ready",
    description:
      "Follow collectibles and storage allowances together with timely updates that keep your team aligned.",
    image: { src: "/images/wallet/menu.png", alt: "Wallet navigation menu" },
  },
  {
    title: "Rapid onboarding",
    description:
      "Create, import, or recover wallets in a few guided steps so every teammate feels secure from day one.",
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
              The Keeta Network wallet built for peace of mind
            </h1>
            <p className="max-w-2xl text-lg text-white/70">
              Keythings Wallet keeps builders, treasuries, and communities confident on the Keeta Network. Secure your assets, understand activity at a glance, and approve every move with the performance of a native Chrome experience.
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
            <h2 className="text-3xl font-semibold text-white md:text-4xl">A secure rhythm from unlock to signature</h2>
            <p className="mx-auto max-w-3xl text-base text-white/65">
              Every touchpoint supports fast, confident action. From opening the wallet to distributing tokens, Keythings Wallet keeps your teams assured that each step is protected and ready for Keeta.
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
                Security and clarity without slowing down
              </h2>
              <p className="text-base text-white/65">
                Keys stay protected, approvals stay transparent, and teammates always know what happens next. Keythings Wallet brings the safeguards you expect with the speed Keeta projects demand.
              </p>
              <dl className="grid gap-6 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_18px_50px_rgba(5,6,9,0.45)]">
                  <dt className="text-sm font-semibold text-white">Security-first approach</dt>
                  <dd className="text-sm text-white/60">
                    Layered defenses keep access private, alert you to risks, and make every signature feel trustworthy.
                  </dd>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_18px_50px_rgba(5,6,9,0.45)]">
                  <dt className="text-sm font-semibold text-white">Built for momentum</dt>
                  <dd className="text-sm text-white/60">
                    Purpose-built Keeta workflows and intuitive automation keep your team focused on delivering outcomes.
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
                  Risk insights
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
              <h2 className="text-3xl font-semibold text-white md:text-4xl">Put the Keeta Network a click away</h2>
              <p className="mx-auto max-w-3xl text-base text-white/65">
                Give your community a wallet that protects their assets, clarifies every step, and keeps Keeta-native activity running smoothly. Install Keythings Wallet, connect your dapps, and move forward with assurance.
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
