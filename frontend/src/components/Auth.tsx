import { ArrowRight, CheckCheck, Loader2, Zap } from 'lucide-react';
import React, { useState } from 'react';
import { api } from '../lib/api';
import type { User } from '../types';
import { Priority } from './ui';
export function Auth({ onAuth, notice }: { onAuth: (user: User) => void; notice?: string }) {
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const f = new FormData(e.currentTarget);
    try {
      const result = await api<{ user: User }>(
        '/auth/' + (register ? 'register' : 'login'),
        'POST',
        {
          email: f.get('email'),
          password: f.get('password'),
          ...(register ? { name: f.get('name') } : {}),
        },
      );
      onAuth(result.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <div className="brand">
          <span className="brand-icon">
            <Zap size={23} fill="currentColor" />
          </span>
          IssueFlow
        </div>
        <div>
          <span className="eyebrow">TEAM ISSUE TRACKING</span>
          <h1>
            Track bugs.
            <br />
            <span>Ship fixes.</span>
          </h1>
          <p>
            Keep bug reports, ownership, and discussion in one place. Create a project, add your
            teammates, and track each issue through to completion.
          </p>
          <div className="auth-board">
            <div>
              <span className="dot purple-bg" /> In progress <span>02</span>
            </div>
            <article>
              <small>
                ISS-012 <Priority value="High" />
              </small>
              <strong>Preserve filters when navigating back</strong>
              <div>
                <span className="chip">Frontend</span>
                <CheckCheck size={18} />
              </div>
            </article>
            <article className="ghost-card">
              <small>ISS-013</small>
              <strong>Handle expired sessions on save</strong>
            </article>
          </div>
        </div>
        <small>Example issues shown for illustration.</small>
      </aside>
      <main className="auth-main">
        <div className="auth-form">
          <span className="brand-icon">
            <Zap size={23} fill="currentColor" />
          </span>
          <h2>{register ? 'Create your account' : 'Welcome back.'}</h2>
          <p>
            {register
              ? 'Start a project or join one with your team.'
              : 'Sign in to your IssueFlow workspace.'}
          </p>
          {notice && (
            <p role="alert" className="error">
              {notice}
            </p>
          )}
          <form onSubmit={submit}>
            {register && (
              <label>
                Full name
                <input
                  name="name"
                  placeholder="Your name"
                  autoComplete="name"
                  minLength={2}
                  maxLength={80}
                  required
                />
              </label>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                required
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                placeholder={register ? 'At least 10 characters' : 'Enter your password'}
                minLength={register ? 10 : 1}
                maxLength={128}
                autoComplete={register ? 'new-password' : 'current-password'}
                required
              />
            </label>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button className="btn primary auth-submit" disabled={busy}>
              {busy ? (
                <Loader2 className="spin" size={17} />
              ) : register ? (
                'Create account'
              ) : (
                'Sign in'
              )}
              <ArrowRight size={17} />
            </button>
          </form>
          <p className="auth-switch">
            {register ? 'Already have an account?' : 'New to IssueFlow?'}{' '}
            <button
              className="text-btn"
              onClick={() => {
                setRegister(!register);
                setError('');
              }}
            >
              {register ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </div>
        <small className="auth-footer">Only project members can access your work.</small>
      </main>
    </div>
  );
}
