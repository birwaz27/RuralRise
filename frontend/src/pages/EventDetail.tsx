import { ArrowLeft, ArrowRight, CalendarDays, Check, MapPin, Search, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type EventApplicant, type ScoutEvent } from '../api';
import { useAuth } from '../auth';
import CertificatePreview from '../components/CertificatePreview';
import { ErrorState, LoadingState } from '../components/States';

export default function EventDetail() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const [event, setEvent] = useState<ScoutEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, Partial<EventApplicant>>>({});
  const [openCertificate, setOpenCertificate] = useState('');

  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    api<ScoutEvent>(`/events/${id}`, { signal: controller.signal }).then(setEvent)
      .catch((requestError: unknown) => { if (!controller.signal.aborted) setError(requestError instanceof Error ? requestError.message : 'Could not load this event.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id]);

  const isOwner = Boolean(user?.role === 'host' && event?.createdBy === user.id);
  const applicants = useMemo(() => (event?.applicants ?? []).filter((item) => {
    const term = search.trim().toLowerCase();
    return !term || [item.player?.fullName, item.player?.sport, item.player?.district, item.status].some((value) => value?.toLowerCase().includes(term));
  }), [event?.applicants, search]);

  async function apply(eventObject: React.FormEvent<HTMLFormElement>) {
    eventObject.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      await api(`/events/${id}/apply`, { method: 'POST', body: JSON.stringify({ message: note }) });
      setEvent((current) => current ? { ...current, myApplication: { status: 'interested' }, applicantCount: current.applicantCount + 1 } : current);
      setNotice('Your interest was sent to the Scout.'); setNote('');
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Could not apply to this event.'); }
    finally { setSaving(false); }
  }

  async function saveApplicant(playerId: string, current: EventApplicant) {
    const draft = reviewDrafts[playerId] ?? {};
    setSaving(true); setError(''); setNotice('');
    try {
      const updated = await api<{ status: EventApplicant['status']; registrationConfirmed: boolean; sponsorshipStatus: EventApplicant['sponsorshipStatus']; sponsorshipNote: string }>(`/events/${id}/applicants/${playerId}`, {
        method: 'PATCH', body: JSON.stringify({ status: draft.status ?? current.status, registrationConfirmed: draft.registrationConfirmed ?? current.registrationConfirmed, sponsorshipStatus: draft.sponsorshipStatus ?? current.sponsorshipStatus, sponsorshipNote: draft.sponsorshipNote ?? current.sponsorshipNote }),
      });
      setEvent((value) => value ? { ...value, applicants: value.applicants?.map((item) => item.player?.id === playerId ? { ...item, ...updated } : item) } : value);
      setReviewDrafts((value) => { const next = { ...value }; delete next[playerId]; return next; });
      setNotice('Applicant review saved.');
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Could not update this application.'); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="container events-page"><LoadingState label="Loading event details…" /></div>;
  if (error && !event) return <div className="container events-page"><ErrorState message={error} /><Link className="text-link" to="/events"><ArrowLeft size={15} /> All events</Link></div>;
  if (!event) return null;
  return <div className="container events-page event-detail-page">
    <Link className="text-link" to="/events"><ArrowLeft size={15} /> All events</Link>
    {error && <div className="form-error" role="alert">{error}</div>}{notice && <div className="form-success" role="status"><Check size={15} />{notice}</div>}
    <article className="event-detail-card"><span className="eyebrow">{event.sport} · OPEN EVENT</span><h1>{event.title}</h1><div className="event-meta"><span><CalendarDays size={15} />{new Date(event.eventDate).toLocaleString()}</span><span><MapPin size={15} />{event.location}</span></div><p>{event.description}</p>{event.sponsorshipDetails && <div className="event-sponsorship"><b>Fees & expenses</b><span>{event.sponsorshipDetails}</span></div>}<p className="event-deadline">Apply by {new Date(event.registrationDeadline).toLocaleString()}</p>
      {user?.role === 'talent' && <div className="event-apply">{event.myApplication ? <div className="status-chip">{event.myApplication.status === 'selected' && event.myApplication.sponsorshipStatus === 'confirmed' ? 'Selected for Sponsored Event' : `Application status: ${event.myApplication.status}`}</div> : <form onSubmit={apply}><label className="field-label">NOTE TO THE SCOUT <span className="field-hint">Optional, up to 500 characters.</span><textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Share a little about your interest…" /></label><button className="button button-primary" disabled={saving}>{saving ? 'Sending…' : 'I’m Interested'} <ArrowRight size={15} /></button></form>}</div>}
    </article>
    {isOwner && <section className="event-applicants"><div className="dashboard-section-heading"><div><span className="eyebrow">SCOUT REVIEW</span><h2>Interested athletes.</h2></div><span className="filter-count">{event.applicantCount}</span></div><label className="event-search"><Search size={15} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter by name, sport, district, or status" /></label>
      {applicants.length ? applicants.map((applicant) => {
        const player = applicant.player; if (!player) return null;
        const draft = reviewDrafts[player.id] ?? {};
        const setDraft = (update: Partial<EventApplicant>) => setReviewDrafts((value) => ({ ...value, [player.id]: { ...value[player.id], ...update } }));
        return <article className="applicant-card" key={player.id}><div className="applicant-heading"><div><span className="eyebrow">{player.sport} · {player.district}</span><h3>{player.fullName}</h3><p>{player.age} years · {player.region}</p></div><span className="verified-chip"><ShieldCheck size={13} /> {player.verificationStatus}</span></div>{applicant.message && <blockquote>{applicant.message}</blockquote>}
          <div className="applicant-certificates"><h4>PE verified certificates</h4>{player.certificates.length ? player.certificates.map((certificate) => <div key={certificate.id} className="certificate-item"><button type="button" className="text-link" onClick={() => setOpenCertificate(openCertificate === certificate.id ? '' : certificate.id)}>{certificate.title}</button><span className="verified-chip"><ShieldCheck size={13} /> Verified</span>{openCertificate === certificate.id && <CertificatePreview url={certificate.certificateUrl} title={certificate.title} />}</div>) : <p>No verified certificates attached.</p>}</div>
          <div className="applicant-review-controls"><label className="field-label">APPLICATION STATUS<select value={draft.status ?? applicant.status} onChange={(e) => setDraft({ status: e.target.value as EventApplicant['status'] })}><option value="interested">Interested</option><option value="shortlisted">Shortlisted</option><option value="selected">Selected</option><option value="rejected">Rejected</option></select></label><label className="field-label">FEE SPONSORSHIP<select value={draft.sponsorshipStatus ?? applicant.sponsorshipStatus} onChange={(e) => setDraft({ sponsorshipStatus: e.target.value as EventApplicant['sponsorshipStatus'] })}><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="not_applicable">Not applicable</option></select></label><label className="field-label">SPONSORSHIP NOTE<input value={draft.sponsorshipNote ?? applicant.sponsorshipNote} maxLength={300} onChange={(e) => setDraft({ sponsorshipNote: e.target.value })} placeholder="Fee or expense settlement note" /></label><label className="registration-check"><input type="checkbox" checked={draft.registrationConfirmed ?? applicant.registrationConfirmed} onChange={(e) => setDraft({ registrationConfirmed: e.target.checked })} /> Next-event registration confirmed</label><button className="button button-primary" disabled={saving} onClick={() => saveApplicant(player.id, applicant)}>{saving ? 'Saving…' : 'Save review'} <Check size={15} /></button></div>
        </article>;
      }) : <div className="dashboard-note">No applicants match this filter.</div>}
    </section>}
  </div>;
}
