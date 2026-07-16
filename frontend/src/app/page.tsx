import Link from 'next/link';

export default function Home() {
  return (
    <main className="relative min-h-screen flex flex-col justify-center items-center bg-slate-950 overflow-hidden text-slate-100 px-6">
      {/* Decorative Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-500/10 blur-[120px] pointer-events-none" />

      {/* Grid Pattern Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-70 pointer-events-none" />

      {/* Main Content Card */}
      <div className="z-10 text-center max-w-3xl flex flex-col items-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/20 bg-indigo-950/20 backdrop-blur-md text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-8">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          Enterprise-Ready Infrastructure
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent leading-none mb-6">
          Scale Your SaaS <br />
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Multi-Tenant Platform
          </span>
        </h1>

        <p className="text-lg md:text-xl text-slate-400 font-light max-w-2xl leading-relaxed mb-12">
          An production-ready scaffold with robust tenant isolation, secure JWT tokens in HTTP-only cookies, automated session refresh, and global state management.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center w-full max-w-md">
          <Link
            href="/register"
            className="w-full sm:w-auto px-8 py-4 rounded-xl font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 border border-indigo-400/20 hover:border-indigo-400/40 shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all duration-300 transform hover:-translate-y-0.5 text-center"
          >
            Launch Workspace
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto px-8 py-4 rounded-xl font-semibold bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 backdrop-blur-sm transition-all duration-300 text-center"
          >
            Sign In to Console
          </Link>
        </div>
      </div>

      {/* Feature Micro-Badges */}
      <div className="z-10 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl w-full mt-24 border-t border-slate-900 pt-12">
        {[
          { label: 'Dynamic Multi-Tenancy', desc: 'Logical DB Isolation' },
          { label: 'Secure JWT Auth', desc: 'HTTP-only Cookie Session' },
          { label: 'Refresh Rotation', desc: 'Database-verified Sessions' },
          { label: 'Zustand State', desc: 'Decoupled Client Store' },
        ].map((feat, i) => (
          <div key={i} className="flex flex-col gap-1 p-4 rounded-xl border border-slate-900/50 bg-slate-950/40 backdrop-blur-sm">
            <span className="text-slate-200 text-sm font-semibold">{feat.label}</span>
            <span className="text-slate-500 text-xs">{feat.desc}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
