import { ArrowRight, CalendarDays, MapPin, Plus, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, type ScoutEvent } from '../api';
import { useAuth } from '../auth';
import { ErrorState, LoadingState } from '../components/States';

type EventForm = { title: string; sport: string; description: string; location: string; eventDate: string; registrationDeadline: string; sponsorshipDetails: string };
const emptyForm: EventForm = { title: '', sport: '', description: '', location: '', eventDate: '', registrationDeadline: '', sponsorshipDetails: '' };

export default function Events() {
  const { user } = useAuth();
  const [events, setEvents] = useState<ScoutEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const canCreate = user?.role === 'host' && (user.isVerified || user.hostVerificationStatus === 'verified');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api<ScoutEvent[]>('/events', { signal: controller.signal })
      .then(setEvents).catch((requestError: unknown) => { if (!controller.signal.aborted) setError(requestError instanceof Error ? requestError.message : 'Could not load events.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);

  async function createEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      const created = await api<ScoutEvent>('/events', { method: 'POST', body: JSON.stringify({ ...form, eventDate: new Date(form.eventDate).toISOString(), registrationDeadline: new Date(form.registrationDeadline).toISOString() }) });
      setEvents((current) => [...current, created].sort((a, b) => Date.parse(a.eventDate) - Date.parse(b.eventDate)));
      setForm(emptyForm); setNotice('Your event is live.');
    } catch (requestError) { setError(requestError instanceof ApiError ? requestError.message : requestError instanceof Error ? requestError.message : 'Could not create this event.'); }
    finally { setSaving(false); }
  }

  return <div className="container events-page">
    <div className="events-heading"><div><span className="eyebrow">SCOUTING CALENDAR</span><h1>Find your next<br />big opportunity.</h1><p>Local trials and events posted by verified Scouts.</p></div><button className="button button-outline" onClick={() => setRefresh((value) => value + 1)} disabled={loading}>Refresh events</button></div>
    {error && <div className="form-error" role="alert">{error}</div>}{notice && <div className="form-success" role="status">{notice}</div>}
    {user?.role === 'host' && !canCreate && <div className="verification-notice"><ShieldCheck size={20} /><p>Your Scout account must be verified before you can publish events.</p></div>}
    {canCreate && <details className="event-create-panel"><summary><Plus size={17} /> Post a new event</summary><form className="event-form" onSubmit={createEvent}>
      <label className="field-label">EVENT TITLE<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={120} required /></label>
      <div className="form-row"><label className="field-label">SPORT<input value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })} maxLength={80} required /></label><label className="field-label">LOCATION<input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} maxLength={180} required /></label></div>
      <label className="field-label">ABOUT THE EVENT<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={3000} required /></label>
      <div className="form-row"><label className="field-label">EVENT DATE & TIME<input type="datetime-local" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} required /></label><label className="field-label">REGISTRATION DEADLINE<input type="datetime-local" value={form.registrationDeadline} onChange={(e) => setForm({ ...form, registrationDeadline: e.target.value })} required /></label></div>
      <label className="field-label">SPONSORSHIP & EXPENSE COVERAGE <span className="field-hint">Explain registration fees, travel, equipment, or other support.</span><textarea value={form.sponsorshipDetails} onChange={(e) => setForm({ ...form, sponsorshipDetails: e.target.value })} maxLength={1000} /></label>
      <button className="button button-primary" disabled={saving}>{saving ? 'Publishing…' : 'Publish event'} <ArrowRight size={15} /></button>
    </form></details>}
    <div className="dashboard-section-heading"><div><span className="eyebrow">UPCOMING</span><h2>Open events.</h2></div><span className="filter-count">{events.length}</span></div>
    {loading ? <LoadingState label="Loading upcoming events…" /> : error && !events.length ? <ErrorState message={error} onRetry={() => setRefresh((value) => value + 1)} /> : events.length ? <div className="event-grid">{events.map((event) => <article className="event-card" key={event.id}><span className="eyebrow">{event.sport}</span><h3>{event.title}</h3><p>{event.description}</p><div className="event-meta"><span><CalendarDays size={14} />{new Date(event.eventDate).toLocaleString()}</span><span><MapPin size={14} />{event.location}</span></div>{event.sponsorshipDetails && <div className="event-sponsorship"><b>Support</b><span>{event.sponsorshipDetails}</span></div>}<div className="event-card-footer"><span>{event.applicantCount} interested</span>{event.myApplication && <span className="status-chip">{event.myApplication.status === 'selected' && event.myApplication.sponsorshipStatus === 'confirmed' ? 'Selected for sponsored event' : event.myApplication.status}</span>}<Link to={`/events/${event.id}`}>Event details <ArrowRight size={14} /></Link></div></article>)}</div> : <div className="dashboard-note">No upcoming events yet. Check back soon.</div>}
  </div>;
}
