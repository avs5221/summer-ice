"use client";

import { useActionState } from "react";
import { login, type LoginActionState } from "./actions";
import styles from "./login.module.css";

const initialState: LoginActionState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.field}>
        <label htmlFor="email" className={styles.label}>
          Email address
        </label>
        <input id="email" name="email" type="email" placeholder="you@example.com" required className={styles.input} />
      </div>

      <div className={styles.field}>
        <div className={styles.fieldHead}>
          <label htmlFor="password" className={styles.label}>
            Password
          </label>
          {/* No password-reset flow exists yet — kept as a plain,
              unwired link rather than omitted, same treatment as the
              landing page's Contact/Privacy placeholders. */}
          <a href="#" className={styles.forgotLink}>
            Forgot?
          </a>
        </div>
        <input id="password" name="password" type="password" placeholder="••••••••" required className={styles.input} />
      </div>

      {state.error && <p className={styles.error}>{state.error}</p>}

      <button type="submit" disabled={pending} className={styles.submitBtn}>
        {pending ? "Signing in…" : "Sign in →"}
      </button>
    </form>
  );
}
