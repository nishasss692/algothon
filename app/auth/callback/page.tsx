'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { EmailOtpType } from '@supabase/supabase-js';

export default function AuthCallbackPage() {
  const router = useRouter();

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resendStatus, setResendStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [resendMessage, setResendMessage] = useState('');

  useEffect(() => {
    let isCancelled = false;

    async function handleAuthCallback() {
      // 1. Check for errors in the hash fragment (#error=access_denied&error_code=otp_expired...)
      const hashParams = new URLSearchParams(
        window.location.hash.startsWith('#')
          ? window.location.hash.substring(1)
          : window.location.hash
      );

      // 2. Check for search query params (?code=... or ?error=...)
      const searchParams = new URLSearchParams(window.location.search);

      const error = hashParams.get('error') || searchParams.get('error');
      const errorCode = hashParams.get('error_code') || searchParams.get('error_code');
      const errorDescription =
        hashParams.get('error_description') || searchParams.get('error_description');

      if (error || errorCode) {
        if (isCancelled) return;
        setStatus('error');
        if (errorCode === 'otp_expired' || errorDescription?.toLowerCase().includes('expired')) {
          setErrorMessage(
            'Your confirmation link has expired or has already been used. Please request a new confirmation email below.'
          );
        } else {
          setErrorMessage(
            errorDescription
              ? decodeURIComponent(errorDescription.replace(/\+/g, ' '))
              : 'Authentication failed. Please try signing in or requesting a new confirmation link.'
          );
        }
        return;
      }

      // 3. Handle PKCE code exchange (?code=...)
      const code = searchParams.get('code');
      if (code) {
        try {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            if (isCancelled) return;
            setStatus('error');
            setErrorMessage(
              exchangeError.message.includes('expired') || exchangeError.message.includes('code verifier')
                ? 'Your confirmation link has expired or is invalid for this browser. Please request a new confirmation email.'
                : exchangeError.message
            );
            return;
          }

          if (isCancelled) return;
          setStatus('success');
          router.replace('/dashboard');
          return;
        } catch {
          if (isCancelled) return;
          setStatus('error');
          setErrorMessage('Failed to verify authorization code. Please try again.');
          return;
        }
      }

      // 4. Handle token_hash verification (?token_hash=...&type=signup)
      const tokenHash = searchParams.get('token_hash');
      const otpType = (searchParams.get('type') as EmailOtpType) || 'signup';
      if (tokenHash) {
        try {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType,
          });

          if (verifyError) {
            if (isCancelled) return;
            setStatus('error');
            setErrorMessage(
              verifyError.message.includes('expired')
                ? 'Your confirmation link has expired or has already been used. Please request a new one.'
                : verifyError.message
            );
            return;
          }

          if (isCancelled) return;
          setStatus('success');
          router.replace('/dashboard');
          return;
        } catch {
          if (isCancelled) return;
          setStatus('error');
          setErrorMessage('Failed to verify token. Please try again.');
          return;
        }
      }

      // 5. Listen for auth change in case Supabase detects tokens in the URL hash
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, newSession) => {
        if (newSession && !isCancelled) {
          setStatus('success');
          router.replace('/dashboard');
        }
      });

      // 6. Check if an active session already exists
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        if (isCancelled) return;
        setStatus('success');
        router.replace('/dashboard');
        return;
      }

      // 7. If no codes, hashes, or session found after brief delay, redirect to login
      const timeout = setTimeout(() => {
        if (!isCancelled) {
          router.replace('/login');
        }
      }, 2500);

      return () => {
        subscription.unsubscribe();
        clearTimeout(timeout);
      };
    }

    const cleanupPromise = handleAuthCallback();

    return () => {
      isCancelled = true;
      cleanupPromise.then((cleanup) => cleanup && cleanup());
    };
  }, [router]);

  async function handleResend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resendEmail.trim()) return;

    setResendStatus('loading');
    setResendMessage('');

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: resendEmail.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setResendStatus('error');
        setResendMessage(error.message);
        return;
      }

      setResendStatus('sent');
      setResendMessage('A fresh confirmation link has been sent to your email.');
    } catch {
      setResendStatus('error');
      setResendMessage('Failed to resend confirmation email. Please try again.');
    }
  }

  if (status === 'verifying') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
          <h1 className="text-xl font-semibold text-gray-900">Verifying confirmation link...</h1>
          <p className="mt-2 text-sm text-gray-500">Please wait while we confirm your email address.</p>
        </div>
      </main>
    );
  }

  if (status === 'success') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Email Confirmed!</h1>
          <p className="mt-2 text-sm text-gray-500">Redirecting to your workspace...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Confirmation Link Issue</h1>
          <p className="mt-2 text-sm text-red-600">{errorMessage}</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
          <h2 className="text-sm font-semibold text-gray-900">Resend Confirmation Email</h2>
          <p className="mt-1 text-xs text-gray-500">
            Enter your email to receive a fresh verification link.
          </p>

          <form onSubmit={handleResend} className="mt-4 space-y-3">
            <input
              type="email"
              required
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
            />

            {resendMessage && (
              <p
                role="status"
                className={`text-xs ${
                  resendStatus === 'sent' ? 'text-green-700' : 'text-red-600'
                }`}
              >
                {resendMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={resendStatus === 'loading'}
              className="w-full rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800 disabled:opacity-60"
            >
              {resendStatus === 'loading' ? 'Sending link...' : 'Resend link'}
            </button>
          </form>
        </div>

        <div className="mt-6 flex items-center justify-between text-sm">
          <Link href="/login" className="font-medium text-green-700 hover:text-green-800">
            ← Back to sign in
          </Link>
          <Link href="/signup" className="font-medium text-gray-600 hover:text-gray-900">
            Create another account
          </Link>
        </div>
      </div>
    </main>
  );
}
