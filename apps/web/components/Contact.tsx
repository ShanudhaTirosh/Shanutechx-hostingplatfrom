'use client';

import { useState } from 'react';
import Reveal from './motion/Reveal';

type Status = 'idle' | 'loading' | 'success' | 'error';

export default function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !message) {
      setErrorMsg('Please fill in all fields.');
      return;
    }
    setErrorMsg('');
    setStatus('loading');

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiBase}/api/cms/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });

      if (res.ok) {
        setStatus('success');
        setName(''); setEmail(''); setMessage('');
      } else {
        const data = await res.json().catch(() => ({}));
        setStatus('error');
        setErrorMsg(data.error || 'Failed to send message. Please try again.');
      }
    } catch {
      setStatus('error');
      setErrorMsg('Network error. Unable to reach server.');
    }
  }

  if (status === 'success') {
    return (
      <section id="contact" className="px-4 py-28 max-w-2xl mx-auto">
        <div className="glass rounded-2xl p-10 text-center animate-scale-in">
          <div className="inline-flex h-14 w-14 rounded-full bg-emerald-500/20 items-center justify-center mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h3 className="text-xl font-semibold mb-2">Message sent!</h3>
          <p className="text-text-muted text-sm">We&apos;ll get back to you within a few hours via email.</p>
          <button
            onClick={() => setStatus('idle')}
            className="mt-6 glass rounded-full px-5 py-2 text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            Send another message
          </button>
        </div>
      </section>
    );
  }

  return (
    <section id="contact" className="px-4 py-28 max-w-2xl mx-auto">
      <Reveal className="text-center mb-10">
        <span className="glass inline-block rounded-full px-4 py-1 text-xs text-text-muted mb-4">
          Contact
        </span>
        <h2 className="text-display">
          Get in <span className="text-gradient">touch</span>
        </h2>
        <p className="text-text-muted mt-3">
          Questions about hosting, VPS, or bot deployments? We reply fast.
        </p>
      </Reveal>

      <Reveal index={1} as="div">
      <form onSubmit={handleSubmit} className="glass rounded-2xl p-7 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-muted font-medium">Your name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Aiden Morse"
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm placeholder:text-text-faint focus:outline-none focus:border-accent-violet/50 focus:bg-white/[0.07] transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-muted font-medium">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm placeholder:text-text-faint focus:outline-none focus:border-accent-violet/50 focus:bg-white/[0.07] transition-colors"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-text-muted font-medium">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="How can we help you?"
            rows={4}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm placeholder:text-text-faint focus:outline-none focus:border-accent-violet/50 focus:bg-white/[0.07] transition-colors resize-none"
          />
        </div>

        {errorMsg && (
          <p className="text-xs text-red-400 flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-7v2h2v-2h-2zm0-8v6h2V7h-2z"/></svg>
            {errorMsg}
          </p>
        )}

        <button
          type="submit"
          disabled={status === 'loading'}
          className="btn-shimmer rounded-full px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {status === 'loading' ? (
            <>
              <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Sending...
            </>
          ) : (
            'Send message →'
          )}
        </button>
      </form>
      </Reveal>
    </section>
  );
}
