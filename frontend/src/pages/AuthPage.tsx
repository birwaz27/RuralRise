import { ArrowLeft, ArrowRight, Eye, EyeOff, ShieldCheck, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../api';
import { useAuth } from '../auth';
import Logo from '../components/Logo';

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const isRegister = mode === 'register';
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'talent' | 'host' | 'pe_teacher'>('talent');
  const [institutionName, setInstitutionName] = useState('');
  const [district, setDistrict] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        await signUp({
          username,
          email,
          password,
          role,
          ...(role === 'pe_teacher' ? { institutionName, district } : {}),
        });
      } else {
        await signIn({ email, password });
      }
      navigate('/');
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`auth-page${isRegister ? '' : ' auth-page-login'}`}>
      <section className="auth-story">
        <Logo light />
        <div className="auth-story-content">
          <span className="eyebrow eyebrow-green"><Sparkles size={14} /> MADE FOR THE NEXT UP</span>
          <h1>{isRegister ? <>Your game.<br />Your <span>moment.</span></> : <>Good to<br />have you <span>back.</span></>}</h1>
          <p>{isRegister ? 'Every big story starts with someone willing to be seen. This is your place to start.' : 'Your next big discovery is just around the corner. Let’s get back to it.'}</p>
          <div className="auth-story-note"><ShieldCheck size={18} /><span>Real athletes. Verified profiles.<br /><b>All roots, no shortcuts.</b></span></div>
        </div>
        <span className="auth-story-foot">RURALRISE&nbsp; / &nbsp;DISCOVER. SHOWCASE. CONNECT.</span>
        <span className="auth-decoration">R</span>
      </section>
      <section className="auth-form-side">
        <Link className="auth-back" to="/"><ArrowLeft size={15} /> Back to home</Link>
        <div className="auth-form-wrap">
          {isRegister && <span className="eyebrow">JOIN THE COMMUNITY</span>}
          <h2>{isRegister ? 'Let’s get you in the game.' : 'Sign in'}</h2>
          <p className="auth-form-subtitle">{isRegister ? 'A profile is your first step toward being discovered.' : 'Welcome back! Please enter your details.'}</p>
          <form onSubmit={submit} className="auth-form">
            {isRegister && <label className="field-label">USERNAME<input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="How should we call you?" minLength={3} maxLength={40} required /></label>}
            <label className="field-label">{isRegister ? 'EMAIL ADDRESS' : 'EMAIL ADDRESS'}<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={isRegister ? role === 'pe_teacher' ? 'Institutional email' : 'you@example.com' : 'you@gmail.com'} maxLength={254} required /></label>
            <label className="field-label">PASSWORD<span className="password-field"><input type={showPassword ? 'text' : 'password'} autoComplete={isRegister ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isRegister ? 'At least 8 characters' : 'Enter your password'} minLength={8} maxLength={72} required /><button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span>{isRegister && <span className="field-hint">Use at least 8 characters to keep your account secure.</span>}</label>
            {isRegister && <fieldset className="role-selector"><legend>I’M HERE AS A…</legend><label className={`role-option${role === 'talent' ? ' selected' : ''}`}><input type="radio" name="role" value="talent" checked={role === 'talent'} onChange={() => setRole('talent')} /><span className="role-mark">01</span><span><b>Athlete</b><small>Showcase your talent</small></span><span className="role-radio" /></label><label className={`role-option${role === 'host' ? ' selected' : ''}`}><input type="radio" name="role" value="host" checked={role === 'host'} onChange={() => setRole('host')} /><span className="role-mark">02</span><span><b>Scout / host</b><small>Find the next big thing</small></span><span className="role-radio" /></label><label className={`role-option${role === 'pe_teacher' ? ' selected' : ''}`}><input type="radio" name="role" value="pe_teacher" checked={role === 'pe_teacher'} onChange={() => setRole('pe_teacher')} /><span className="role-mark">03</span><span><b>PE Teacher</b><small>Endorse local athletes</small></span><span className="role-radio" /></label></fieldset>}
            {isRegister && role === 'pe_teacher' && (
              <>
                <label className="field-label">INSTITUTIONAL NAME<input value={institutionName} onChange={(event) => setInstitutionName(event.target.value)} placeholder="e.g. Government Higher Secondary School" maxLength={100} required /></label>
                <label className="field-label">DISTRICT<input value={district} onChange={(event) => setDistrict(event.target.value)} placeholder="e.g. Wayanad" maxLength={100} required /></label>
                <span className="field-hint">Institutional email addresses ending in .edu.in, .ac.in, .gov.in, or .nic.in are automatically verified. Other accounts can be reviewed.</span>
              </>
            )}
            {!isRegister && <div className="forgot-row"><Link to="/forgot-password">Forgot password?</Link></div>}
            {error && <div className="form-error" role="alert">{error}</div>}
            <button type="submit" className="button button-primary button-full button-large" disabled={loading}>{loading ? 'One moment…' : isRegister ? 'Create my account' : 'Sign in'} {!loading && isRegister && <ArrowRight size={17} />}</button>
          </form>
          <p className="auth-switch">{isRegister ? 'Already part of the team?' : 'New around here?'} <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Log in' : 'Create an account'}</Link></p>
          <div className="auth-privacy"><ShieldCheck size={14} /> Your details stay yours. Always.</div>
        </div>
      </section>
    </div>
  );
}
