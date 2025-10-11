'use client';

export default function WalletLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative overflow-hidden h-screen bg-[color:var(--background)]">
      <div className="absolute inset-0 -z-10 bg-[color:var(--background)]" />
      <div className="pointer-events-none absolute inset-x-0 top-[-20%] z-0 h-[480px] bg-gradient-to-b from-[color:color-mix(in_oklab,var(--foreground)_18%,transparent)] via-transparent to-transparent blur-3xl" />
      
      <div className="relative z-10 h-full max-w-7xl mx-auto px-6 pt-[70px]">
        <div className="h-full overflow-hidden">
          {children}
        </div>
      </div>
    </main>
  );
}

