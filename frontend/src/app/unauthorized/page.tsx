'use client';

import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function UnauthorizedPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center font-sans p-6">
      <div className="max-w-md w-full p-8 rounded-2xl border border-red-500/10 bg-gradient-to-tr from-red-950/10 to-slate-950/80 backdrop-blur-md relative overflow-hidden flex flex-col items-center text-center gap-6 shadow-2xl">
        <div className="absolute top-[-30%] right-[-10%] w-[250px] h-[250px] rounded-full bg-red-500/5 blur-[70px] pointer-events-none" />

        <div className="h-16 w-16 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center border border-red-500/20 shadow-lg shadow-red-500/10">
          <ShieldAlert className="h-8 w-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black tracking-tight text-white">Access Denied</h1>
          <p className="text-slate-400 text-sm">
            You do not have the required permissions or role clearance to access this resource or path in the workspace console.
          </p>
        </div>

        <div className="w-full border-t border-slate-900 pt-4 mt-2">
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-sm font-semibold text-slate-200 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
