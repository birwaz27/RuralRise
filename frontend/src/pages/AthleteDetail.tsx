import { ArrowUpRight, BadgeCheck, Check, Heart, MapPin, Send, ShieldCheck, Sparkles, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, apiAsset, type AchievementPost, type AchievementPostPage, type Athlete } from '../api';
import { useAuth } from '../auth';
import AchievementEndorsement from '../components/AchievementEndorsement';
import AthleteCard from '../components/AthleteCard';
import { BackLink, EmptyState, ErrorState, SkeletonProfileHero } from '../components/States';

export default function AthleteDetail() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [related, setRelated] = useState<Athlete[]>([]);
  const [relatedError, setRelatedError] = useState('');
  const [shortlisted, setShortlisted] = useState(false);
  const [posts, setPosts] = useState<AchievementPost[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const canScout = user?.role === 'host';
  const canShortlist = user?.role === 'admin' || canScout;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api<Athlete>(`/athletes/${id}`, { signal: controller.signal })
      .then(setAthlete)
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(requestError instanceof Error ? requestError.message : 'Could not load this profile.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    if (!athlete) return;
    const controller = new AbortController();
    setRelatedError('');
    api<{ items: Athlete[] }>(`/athletes?sport=${encodeURIComponent(athlete.sport)}&limit=5`, { signal: controller.signal })
      .then((data) => setRelated(data.items.filter((item) => item.id !== athlete.id).slice(0, 3)))
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setRelated([]);
          setRelatedError(requestError instanceof Error ? requestError.message : 'Could not load related athletes.');
        }
      });
    return () => controller.abort();
  }, [athlete]);

  useEffect(() => {
    if (!canShortlist || !athlete) return;
    const controller = new AbortController();
    api<Athlete[]>('/athletes/shortlist', { signal: controller.signal })
      .then((items) => setShortlisted(items.some((item) => item.id === athlete.id)))
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setActionError(requestError instanceof Error ? requestError.message : 'Could not load your shortlist.');
      });
    return () => controller.abort();
  }, [athlete, canShortlist]);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    api<AchievementPostPage>(`/posts?athleteId=${id}&limit=20`, { signal: controller.signal })
      .then((data) => setPosts(data.items))
      .catch(() => setPosts([]));
    return () => controller.abort();
  }, [id]);

  async function toggleShortlist() {
    if (!athlete) return;
    setBusy(true);
    setActionError('');
    setNotice('');
    try {
      const result = shortlisted
        ? await api<{ shortlisted: boolean }>(`/athletes/shortlist/${athlete.id}`, { method: 'DELETE' })
        : await api<{ shortlisted: boolean }>('/athletes/shortlist', {
          method: 'POST',
          body: JSON.stringify({ athleteId: athlete.id }),
        });
      setShortlisted(result.shortlisted);
      setNotice(result.shortlisted ? 'Added to your shortlist.' : 'Removed from your shortlist.');
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Could not update your shortlist.');
    } finally {
      setBusy(false);
    }
  }

  async function connect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!athlete) return;
    setBusy(true);
    setActionError('');
    setNotice('');
    try {
      await api(`/connections/${athlete.id}`, { method: 'POST', body: JSON.stringify({ message }) });
      setNotice(`Your introduction to ${athlete.fullName} has been sent.`);
      setMessage('');
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Could not send your introduction.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return (
    <div className="profile-page">
      <div className="container profile-topbar"><BackLink to={user?.role === 'pe_teacher' ? '/dashboard' : '/athletes'} /></div>
      <SkeletonProfileHero />
    </div>
  );
  if (error || !athlete) return <div className="container page-state"><BackLink to={user?.role === 'pe_teacher' ? '/dashboard' : '/athletes'} /><ErrorState message={error || 'Athlete profile was not found.'} /></div>;

  const hasPhoto = Boolean(athlete.photoUrl);
  return (
    <div className="profile-page">
      <div className="container profile-topbar"><BackLink to={user?.role === 'pe_teacher' ? '/dashboard' : '/athletes'} /><span className="profile-top-note"><Sparkles size={14} /> EVERY GREAT STORY STARTS SOMEWHERE</span></div>
      <section className="container profile-hero">
        <div className="profile-photo-wrap">
          {hasPhoto ? <img src={apiAsset(athlete.photoUrl)} alt={athlete.fullName} onError={(event) => { event.currentTarget.style.display = 'none'; }} /> : null}
          <div className="profile-photo-fallback"><span>{athlete.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span></div>
          <span className="profile-photo-label">PLAYER PROFILE&nbsp; / &nbsp;{String(athlete.id.slice(-4)).toUpperCase()}</span>
        </div>
        <div className="profile-hero-content">
          <div className="profile-badges">
            {athlete.verificationStatus === 'verified' ? <span className="verified-chip"><ShieldCheck size={14} /> VERIFIED TALENT</span> : <span className="status-chip"><span /> {athlete.verificationStatus.toUpperCase()} REVIEW</span>}
            {athlete.planTier === 'pro' && <span className="pro-chip">PRO PLAYER</span>}
          </div>
          <span className="profile-sport-label">{athlete.sport} <span>·</span> {athlete.age} YEARS OLD</span>
          <h1>{athlete.fullName}<span className="profile-period">.</span></h1>
          <p className="profile-location"><MapPin size={16} /> {athlete.district}, {athlete.region}</p>
          <div className="profile-bio-block">
            <span className="eyebrow">ATHLETE BIO</span>
            <p className="profile-bio">{athlete.bio || 'This athlete has not added a bio yet.'}</p>
          </div>
          <div className="profile-hero-actions">
            {canShortlist && <button type="button" className={`button ${shortlisted ? 'button-primary' : 'button-outline'} button-large`} onClick={toggleShortlist} disabled={busy}><Heart size={16} fill={shortlisted ? 'currentColor' : 'none'} />{busy ? 'Saving…' : shortlisted ? 'On your shortlist' : 'Add to shortlist'}</button>}
          </div>
          {actionError && <p className="form-error action-feedback">{actionError}</p>}
          {notice && <p className="form-success action-feedback"><Check size={15} />{notice}</p>}
        </div>
        <span className="profile-index">PROFILE&nbsp; / &nbsp;01</span>
      </section>

      <section className="container profile-content-grid">
        <div className="profile-main-column">
          <div className="profile-section-heading"><span className="eyebrow">THE PERSON BEHIND THE PERFORMANCE</span><h2>More than<br />a stat line.</h2></div>
          <div className="profile-story">
            <span className="story-mark">“</span>
            <p>{athlete.background || athlete.bio || 'The best stories are still being written. This athlete is ready to make their next move.'}</p>
          </div>
          <div className="achievements-block">
            <div className="block-heading"><div><span className="eyebrow">PUTTING IN THE WORK</span><h3>On the record.</h3></div><Trophy size={22} /></div>
            {athlete.tournaments.length > 0 && (
              <div className="achievement-list">{athlete.tournaments.map((tournament, index) => <div className="achievement-item" key={`${tournament}-${index}`}><span className="achievement-index">{String(index + 1).padStart(2, '0')}</span><span>{tournament}</span><BadgeCheck size={16} /></div>)}</div>
            )}
            {posts.length > 0 && (
              <div className="profile-posts-list" style={{ marginTop: athlete.tournaments.length ? '20px' : '0' }}>
                {posts.map((post) => (
                  <div className="profile-achievement-card" key={post.id} style={{ border: '1px solid #dfe5e8', background: '#fff', padding: '16px', marginBottom: '12px' }}>
                    {(post.videoUrl || post.photoUrl) && (
                      <div className="profile-achievement-photo" style={{ marginBottom: '12px', overflow: 'hidden', background: '#e6eef1', maxHeight: '300px' }}>
                        {post.videoUrl ? (
                          <video src={apiAsset(post.videoUrl)} controls preload="metadata" aria-label={post.title} style={{ display: 'block', width: '100%', maxHeight: '300px' }} />
                        ) : post.photoUrl ? (
                          <img src={apiAsset(post.photoUrl)} alt={post.title} style={{ display: 'block', width: '100%', maxHeight: '300px', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                        ) : null}
                      </div>
                    )}
                    <h4 style={{ margin: '0 0 6px', fontSize: '15px', color: '#2f3d43', fontFamily: 'var(--serif)' }}>{post.title}</h4>
                    <p style={{ margin: '0 0 10px', fontSize: '11px', color: '#778173', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{post.description}</p>
                    <AchievementEndorsement status={post.endorsementStatus} />
                    <span style={{ fontSize: '9px', color: '#929a8f' }}>{post.eventDate ? `Event date: ${new Date(`${post.eventDate.slice(0, 10)}T12:00:00`).toLocaleDateString()}` : `Shared ${new Date(post.createdAt).toLocaleDateString()}`}</span>
                  </div>
                ))}
              </div>
            )}
            {athlete.tournaments.length === 0 && posts.length === 0 && <EmptyState title="Their story is just getting started." message="Tournament results and achievements will show up here." />}
          </div>
        </div>
        <aside className="profile-aside">
          <div className="quick-facts">
            <span className="eyebrow">THE QUICK READ</span>
            <div className="fact-row"><span>SPORT</span><strong>{athlete.sport}</strong></div>
            <div className="fact-row"><span>AGE</span><strong>{athlete.age} years</strong></div>
            <div className="fact-row"><span>HOME TURF</span><strong>{athlete.district}, {athlete.region}</strong></div>
            <div className="fact-row"><span>PROFILE STATUS</span><strong className={athlete.verificationStatus === 'verified' ? 'fact-verified' : ''}>{athlete.verificationStatus === 'verified' && <ShieldCheck size={14} />}{athlete.verificationStatus}</strong></div>
            <div className="fact-row"><span>ON RURALRISE SINCE</span><strong>{new Date(athlete.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</strong></div>
          </div>
          <div className="connect-card">
            <span className="connect-card-icon"><Send size={18} /></span>
            <span className="eyebrow">SCOUTS & HOSTS</span>
            <h3>See something<br />in them?</h3>
            {canScout && athlete.verificationStatus === 'verified' ? (
              <form onSubmit={connect}>
                <label className="visually-hidden" htmlFor="intro-message">Write a short introduction</label>
                <textarea id="intro-message" rows={3} maxLength={1000} placeholder="Write a short introduction…" value={message} onChange={(event) => setMessage(event.target.value)} required />
                <button className="button button-lime button-full" disabled={busy || !message.trim()}>{busy ? 'Sending…' : 'Start a conversation'} <ArrowUpRight size={16} /></button>
              </form>
            ) : user?.role === 'host' ? (
              <p>Only verified athlete profiles can receive introductions.</p>
            ) : (
              <>
                <p>Make the first move. Connect with this athlete and start a conversation.</p>
                <Link className="button button-lime button-full" to={user ? '/dashboard' : '/login'}>{user ? 'Scout accounts only' : 'Log in to connect'} <ArrowUpRight size={16} /></Link>
              </>
            )}
          </div>
        </aside>
      </section>

      {(related.length > 0 || relatedError) && <section className="container related-section">
        <div className="related-heading"><div><span className="eyebrow">MORE FROM THE REGION</span><h2>Same sport.<br /><span className="text-muted">New stories.</span></h2></div><Link className="text-link" to="/athletes">See all athletes <ArrowUpRight size={15} /></Link></div>
        {relatedError ? <p className="related-error" role="status">{relatedError}</p> : <div className="athlete-grid">{related.map((item, index) => <AthleteCard athlete={item} index={index} key={item.id} />)}</div>}
      </section>}
    </div>
  );
}
