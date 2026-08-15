"use client";

import { FormEvent, useState } from "react";

interface AuthScreenProps {
  onSignIn: (email: string, password: string) => Promise<void>;
  loading: boolean;
  error?: string | null;
}

export function AuthScreen({
  onSignIn,
  loading,
  error
}: AuthScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim() || password.trim().length < 6) {
      return;
    }

    await onSignIn(email.trim(), password);
  }

  return (
    <main className="app-shell app-shell--auth">
      <section className="panel auth-panel">
        <div className="auth-brand">
          <div className="brand brand--auth">
            <img src="/logo/rl-mark-dark.svg" alt="Renan Luz" className="brand__mark brand__mark--light" />
            <div className="brand__copy">
              <strong>Renan Luz</strong>
              <span>Hours · Invoice</span>
            </div>
          </div>
        </div>

        <div className="auth-copy">
          <p className="eyebrow">Cloud Sync</p>
          <h1>Sign in to your hours app</h1>
        </div>

        <form className="entry-form" onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label>
            Password
            <input
              type="password"
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? "Please wait..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
