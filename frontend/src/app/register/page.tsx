'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';

export default function RegisterPage() {
  const { register, isAuthenticated, checkAuth } = useAuthStore();
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  // Automate slug suggestions as the workspace name is typed
  const handleTenantNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTenantName(val);
    const slug = val
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');
    setTenantSlug(slug);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await register({
        name,
        email,
        password,
        tenantName,
        tenantSlug,
      });
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(typeof err === 'string' ? err : 'Registration failed');
      setSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-screen flex justify-center items-center bg-slate-950 px-6 py-12 overflow-hidden text-slate-100">
      {/* Decorative Gradients */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-indigo-500/5 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-purple-500/5 blur-[100px] pointer-events-none" />

      <div className="z-10 w-full max-w-lg bg-slate-900/40 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            Launch Your Space
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            Configure your isolated workspace and owner account
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-500/20 bg-red-950/20 text-red-400 text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400" htmlFor="name">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-800 focus:border-indigo-500 focus:outline-none text-slate-100 transition duration-200 placeholder-slate-600"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400" htmlFor="email">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-800 focus:border-indigo-500 focus:outline-none text-slate-100 transition duration-200 placeholder-slate-600"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-800 focus:border-indigo-500 focus:outline-none text-slate-100 transition duration-200 placeholder-slate-600"
            />
          </div>

          <div className="border-t border-slate-900 pt-6 space-y-6">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-indigo-400" htmlFor="workspaceName">
                Workspace / Tenant Name
              </label>
              <input
                id="workspaceName"
                type="text"
                required
                value={tenantName}
                onChange={handleTenantNameChange}
                placeholder="Acme Corporation"
                className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-850 focus:border-indigo-500 focus:outline-none text-slate-100 transition duration-200 placeholder-slate-600"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-indigo-400" htmlFor="workspaceSlug">
                Workspace Slug (Workspace URL)
              </label>
              <div className="relative flex items-center">
                <input
                  id="workspaceSlug"
                  type="text"
                  required
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                  placeholder="acme"
                  className="w-full pl-4 pr-32 py-3 rounded-xl bg-slate-950/80 border border-slate-850 focus:border-indigo-500 focus:outline-none text-slate-100 transition duration-200 placeholder-slate-600"
                />
                <span className="absolute right-4 text-xs font-semibold text-slate-500 pointer-events-none select-none">
                  .saas.local
                </span>
              </div>
              {tenantSlug && (
                <p className="text-xs text-slate-500 mt-1">
                  Your workspace url: <span className="text-indigo-400 font-medium">http://{tenantSlug}.saas.local:3000</span>
                </p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 rounded-xl font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 border border-indigo-500/20 shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 transition duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                Creating workspace...
              </>
            ) : (
              'Create Workspace'
            )}
          </button>
        </form>

        <div className="text-center mt-8 border-t border-slate-900 pt-6">
          <p className="text-sm text-slate-500">
            Already have a space?{' '}
            <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium transition duration-200">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
