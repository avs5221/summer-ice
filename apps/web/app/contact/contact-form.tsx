"use client";

// No backend exists to receive this yet — no outbox table, no email-send
// job, no route handler (docs/STATE.md: "No outbox table, no Cron
// endpoints, no notification jobs"; Postmark per ARCHITECTURE.md §9 is
// wired to the `email.send` job specifically, which doesn't exist).
// Building a form that POSTs somewhere and claims success while the
// message goes nowhere would be worse than the design's own mock — a
// silent data loss dressed up as confirmation. Composing a `mailto:` link
// instead is honest about what actually happens: it hands off to the
// user's own mail client with the message pre-filled, same destination
// ("hello@summerice.nl" — see contact/page.tsx's own note on the address
// correction) the design's static links point to, and needs no
// infrastructure this repo doesn't have.
import { useState } from "react";
import styles from "./contact.module.css";

const TOPICS = [
  "Registering for a slot",
  "My level — am I in the right slot?",
  "Playing as a goalie",
  "Payment or refund",
  "Skills training",
  "Something else",
];

const CONTACT_EMAIL = "hello@summerice.nl";

export function ContactForm() {
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "");
    const email = String(form.get("email") ?? "");
    const topic = String(form.get("topic") ?? "");
    const message = String(form.get("message") ?? "");

    const subject = `Summer Ice — ${topic}`;
    const body = `${message}\n\n— ${name}${email ? ` (${email})` : ""}`;
    const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    window.location.href = mailto;
    setSent(true);
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.formRow}>
        <div className={styles.field}>
          <label htmlFor="c-name" className={styles.label}>
            Your name
          </label>
          <input id="c-name" name="name" type="text" placeholder="Sanne van der Linden" required className={styles.input} />
        </div>
        <div className={styles.field}>
          <label htmlFor="c-mail" className={styles.label}>
            Email address
          </label>
          <input id="c-mail" name="email" type="email" placeholder="you@example.com" required className={styles.input} />
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="c-topic" className={styles.label}>
          What&rsquo;s it about?
        </label>
        <select id="c-topic" name="topic" defaultValue={TOPICS[0]} className={styles.select}>
          {TOPICS.map((topic) => (
            <option key={topic}>{topic}</option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label htmlFor="c-msg" className={styles.label}>
          Message
        </label>
        <textarea id="c-msg" name="message" rows={6} placeholder="Tell us what you need." required className={styles.textarea} />
      </div>

      {sent && (
        <p className={styles.sentNote}>
          Your email app should have opened with the message ready — send it from there to reach us.
        </p>
      )}

      <button type="submit" className={styles.submitBtn}>
        Send message →
      </button>
    </form>
  );
}
