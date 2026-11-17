import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, Mail } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api';

export default function ForgotPassword() {
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get('token') || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [complete, setComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (resetToken) {
        await api('/password/reset', { method: 'POST', body: JSON.stringify({ token: resetToken, password }) });
        setComplete(true);
      } else {
        await api('/password/forgot', { method: 'POST', body: JSON.stringify({ email }) });
        setSent(true);
      }
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="recovery-page">
      <div className="recovery-card">
        <Link className="back-link" to="/login"><ArrowLeft size={15} /> Back to login</Link>
        <span className="recovery-icon">{complete ? <CheckCircle2 size={22} /> : resetToken ? <KeyRound size={21} /> : <Mail size={21} />}</span>
        <span className="eyebrow">{complete ? 'ALL SET' : resetToken ? 'ONE LAST STEP' : 'ACCOUNT RECOVERY'}</span>
        <h1>{complete ? 'You’re back in the game.' : resetToken ? 'Choose a new password.' : sent ? 'Check your inbox.' : 'Let’s get you back in.'}</h1>
        <p>{complete ? 'Your password has been updated. You can now log in with your new password.' : resetToken ? 'Choose a new password for your RuralRise account.' : sent ? 'If an account exists for that email, reset instructions have been sent. Follow the link in your inbox to choose a new password.' : 'Enter the email address linked to your account and we’ll send you a reset link.'}</p>
        {!sent && !complete && <form className="auth-form" onSubmit={submit}>
          {resetToken ? <label className="field-label">NEW PASSWORD<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={72} placeholder="At least 8 characters" required /></label> : <label className="field-label">EMAIL ADDRESS<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></label>}
          {error && <div className="form-error" role="alert">{error}</div>}
          <button type="submit" className="button button-primary button-full button-large" disabled={loading}>{loading ? 'One moment…' : resetToken ? 'Update password' : 'Send reset link'} <ArrowRight size={16} /></button>
        </form>}
        {(complete || sent) && <Link className="button button-primary button-full button-large" to="/login">Back to login <ArrowRight size={16} /></Link>}
      </div>
    </div>
  );
}
