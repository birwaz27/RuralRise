import { ArrowRight, BadgeCheck, Check, ChevronRight, CircleUserRound, ClipboardCheck, Heart, ImagePlus, MapPin, Pencil, RefreshCw, ShieldCheck, Trash2, Trophy, UserRound, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api, apiAsset, ApiError, type AchievementPost, type AchievementPostPage, type Athlete, type Connection, type User } from '../api';
import { useAuth } from '../auth';
import AchievementEndorsement from '../components/AchievementEndorsement';
import AthleteCard from '../components/AthleteCard';
import { ErrorState, LoadingState, SkeletonDashboardStats } from '../components/States';
import CertificatePreview from '../components/CertificatePreview';

type DirectoryPage = { items: Athlete[]; pages: number };
type ProfileForm = {
  fullName: string;
  age: string;
  sport: string;
  district: string;
  region: string;
  bio: string;
  background: string;
  tournaments: string;
};
const blankForm = (name = '', district = ''): ProfileForm => ({
  fullName: name,
  age: '',
  sport: '',
  district,
  region: district,
  bio: '',
  background: '',
  tournaments: '',
});

function achievementMediaError(file: File): string {
  const isImage = ['image/png', 'image/jpeg'].includes(file.type);
  const isVideo = ['video/mp4', 'video/webm'].includes(file.type);
  if (!isImage && !isVideo) return 'Choose a PNG or JPG image, or an MP4 or WebM video.';
  if (isImage && file.size > 2 * 1024 * 1024) return 'Your image must be no larger than 2 MB.';
  if (isVideo && file.size > 25 * 1024 * 1024) return 'Your video must be no larger than 25 MB.';
  return '';
}

function profileForm(profile: Athlete): ProfileForm {
  return {
    fullName: profile.fullName,
    age: String(profile.age),
    sport: profile.sport,
    district: profile.district,
    region: profile.region,
    bio: profile.bio,
    background: profile.background,
    tournaments: profile.tournaments.join('\n'),
  };
}

const profileDraftKey = (userId: string) => `rural-rise-athlete-profile-draft:${userId}`;

function isProfileForm(value: unknown): value is ProfileForm {
  if (typeof value !== 'object' || value === null) return false;
  const fields = value as Record<string, unknown>;
  return ['fullName', 'age', 'sport', 'district', 'region', 'bio', 'background', 'tournaments']
    .every((field) => typeof fields[field] === 'string');
}

function getProfileDraft(userId: string): ProfileForm | null {
  try {
    const saved = localStorage.getItem(profileDraftKey(userId));
    if (!saved) return null;
    const draft: unknown = JSON.parse(saved);
    return isProfileForm(draft) ? draft : null;
  } catch {
    return null;
  }
}

function saveProfileDraft(userId: string, draft: ProfileForm): boolean {
  try {
    localStorage.setItem(profileDraftKey(userId), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

function clearProfileDraft(userId: string): boolean {
  try {
    localStorage.removeItem(profileDraftKey(userId));
    return true;
  } catch {
    return false;
  }
}

function HostDashboard({ user }: { user: User }) {
  const [shortlist, setShortlist] = useState<Athlete[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([
      api<Athlete[]>('/athletes/shortlist'),
      api<Connection[]>('/connections'),
    ]).then(([saved, requests]) => {
      if (!active) return;
      setShortlist(saved);
      setConnections(requests);
    }).catch((requestError: unknown) => {
      if (active) setError(requestError instanceof Error ? requestError.message : 'Could not load your scouting dashboard.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh]);

  return (
    <div className="container dashboard-page">
      <div className="dashboard-welcome"><div><span className="eyebrow">YOUR SCOUT DESK</span><h1>Keep your eye<br />on what’s next.</h1></div><div className="dashboard-user"><CircleUserRound size={17} /> {user.username}<button className="button button-outline button-small" type="button" aria-label="Refresh scout dashboard" onClick={() => setRefresh((value) => value + 1)} disabled={loading}><RefreshCw size={14} /> Refresh</button></div></div>
      {loading ? <SkeletonDashboardStats /> : (
        <div className="dashboard-stats scout-dashboard-stats"><div><span>ON YOUR RADAR</span><strong>{String(shortlist.length).padStart(2, '0')}</strong></div><div><span>INTRODUCTIONS SENT</span><strong>{String(connections.length).padStart(2, '0')}</strong></div></div>
      )}
      <div className="dashboard-section-heading"><div><span className="eyebrow">THE ONES TO WATCH</span><h2>Your shortlist.</h2></div><div className="dashboard-heading-actions"><Link className="button button-outline" to="/events">Scout events</Link><Link className="text-link" to="/athletes">Find more talent <ArrowRight size={15} /></Link></div></div>
      {loading ? <LoadingState label="Loading your scouting desk…" /> : error ? <ErrorState message={error} onRetry={() => setRefresh((value) => value + 1)} /> : shortlist.length ? <div className="athlete-grid">{shortlist.map((athlete, index) => <AthleteCard key={athlete.id} athlete={athlete} index={index} />)}</div> : <div className="dashboard-empty"><span className="empty-icon"><Heart size={20} /></span><div><h3>Your shortlist is a blank canvas.</h3><p>Save profiles that catch your eye to keep your scouting organized.</p></div><Link className="button button-primary" to="/athletes">Find your first prospect <ArrowRight size={15} /></Link></div>}
      <div className="dashboard-section-heading dashboard-lower-heading"><div><span className="eyebrow">OUTREACH, AT A GLANCE</span><h2>Introductions.</h2></div></div>
      {connections.length ? <div className="request-list">{connections.map((connection) => <div className="request-row" key={connection.id}><span className="request-avatar">{connection.athlete?.fullName?.slice(0, 1) || 'R'}</span><div><strong>{connection.athlete?.fullName || 'Athlete profile'}</strong><span>{connection.athlete?.sport || 'Talent'} · {connection.athlete?.district || 'Location unavailable'}</span></div><p>{connection.message}</p><span className={`request-status status-${connection.status}`}>{connection.status}</span></div>)}</div> : <div className="dashboard-note">No introductions yet. When you reach out to an athlete, you’ll find it here.</div>}
    </div>
  );
}

function AthleteReviewQueue() {
  const [profiles, setProfiles] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [activeId, setActiveId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');

    async function loadPendingProfiles() {
      try {
        const firstPage = await api<DirectoryPage>('/athletes?status=pending&page=1&limit=100', { signal: controller.signal });
        const allProfiles = [...firstPage.items];
        for (let page = 2; page <= firstPage.pages; page += 1) {
          const nextPage = await api<DirectoryPage>(`/athletes?status=pending&page=${page}&limit=100`, { signal: controller.signal });
          allProfiles.push(...nextPage.items);
        }
        if (!controller.signal.aborted) setProfiles(allProfiles);
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(requestError instanceof Error ? requestError.message : 'Could not load athlete profiles for review.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadPendingProfiles();
    return () => controller.abort();
  }, [refresh]);

  async function reviewProfile(profile: Athlete, status: 'verified' | 'rejected') {
    setActiveId(profile.id);
    setError('');
    setNotice('');
    try {
      await api<Athlete>(`/athletes/${profile.id}/verification`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      setProfiles((current) => current.filter((item) => item.id !== profile.id));
      setNotice(`${profile.fullName}’s profile was ${status}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not update this athlete’s verification status.');
    } finally {
      setActiveId('');
    }
  }

  return (
    <section className="review-section">
      <div className="dashboard-section-heading">
        <div><span className="eyebrow">ATHLETE PROFILES</span><h2>Verification queue.</h2></div>
        <button className="button button-outline review-refresh" onClick={() => setRefresh((value) => value + 1)} disabled={loading}>Refresh</button>
      </div>
      <p className="review-intro">Review an athlete’s profile before verifying it. Verification makes the profile eligible for scout connections.</p>
      {error && <div className="form-error review-feedback" role="alert">{error}</div>}
      {notice && <div className="form-success review-feedback" role="status"><Check size={15} />{notice}</div>}
      {loading ? <LoadingState label="Loading profiles awaiting review…" /> : profiles.length ? (
        <div className="review-list">
          {profiles.map((profile) => (
            <article className="review-row" key={profile.id}>
              <span className="request-avatar"><ClipboardCheck size={16} /></span>
              <div className="review-profile">
                <strong>{profile.fullName}</strong>
                <span>{profile.sport} · {profile.age} years · {profile.district}, {profile.region}</span>
                <small>Submitted {new Date(profile.createdAt).toLocaleDateString()}</small>
              </div>
              <Link className="review-view-link" to={`/athletes/${profile.id}`} target="_blank" rel="noreferrer">Review profile <ArrowRight size={14} /></Link>
              <div className="review-actions">
                <button className="button button-outline" disabled={activeId === profile.id} onClick={() => reviewProfile(profile, 'rejected')}>Reject</button>
                <button className="button button-primary" disabled={activeId === profile.id} onClick={() => reviewProfile(profile, 'verified')}>{activeId === profile.id ? 'Saving…' : 'Verify'}</button>
              </div>
            </article>
          ))}
        </div>
      ) : <div className="dashboard-note">No athlete profiles are waiting for verification.</div>}
    </section>
  );
}

function AdminDashboard() {
  const { user } = useAuth();

  return (
    <div className="container dashboard-page">
      <div className="dashboard-welcome">
        <div><span className="eyebrow">ADMIN DESK</span><h1>Help great talent<br />get discovered.</h1></div>
        <div className="dashboard-user"><CircleUserRound size={17} /> {user?.username}</div>
      </div>
      <AthleteReviewQueue />
    </div>
  );
}

type PendingCertificate = {
  id: string; title: string; description: string; eventDate: string | null; createdAt: string;
  certificateUrl: string; verificationStatus: 'pending';
  athlete: { id: string; fullName: string; sport: string; district: string; region: string } | null;
};

function CertificateVerificationQueue() {
  const [items, setItems] = useState<PendingCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [activeId, setActiveId] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [expanded, setExpanded] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    api<PendingCertificate[]>('/pe-teacher/pending-verifications', { signal: controller.signal, cache: 'no-store' })
      .then(setItems).catch((requestError: unknown) => { if (!controller.signal.aborted) setError(requestError instanceof Error ? requestError.message : 'Could not load certificate queue.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);
  async function review(item: PendingCertificate, status: 'verified' | 'rejected') {
    setActiveId(item.id); setError(''); setNotice('');
    try {
      await api(`/pe-teacher/verify/${item.id}`, { method: 'PATCH', body: JSON.stringify({ status, notes: notes[item.id] ?? '' }) });
      setItems((current) => current.filter((candidate) => candidate.id !== item.id));
      setNotice(`${item.title} was ${status}.`);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Could not review this certificate.'); }
    finally { setActiveId(''); }
  }
  return <section className="review-section certificate-queue">
    <div className="dashboard-section-heading"><div><span className="eyebrow">DOCUMENT REVIEW</span><h2>Certificate verification queue.</h2></div><div className="queue-heading-actions"><span className="filter-count">{items.length}</span><button className="button button-outline" onClick={() => setRefresh((value) => value + 1)} disabled={loading}>Refresh</button></div></div>
    <p className="review-intro">Inspect achievement certificates from athletes in your district. Your decision and notes are attached to the achievement.</p>
    {error && <div className="form-error review-feedback" role="alert">{error}</div>}{notice && <div className="form-success review-feedback" role="status"><Check size={15} />{notice}</div>}
    {loading ? <LoadingState label="Loading certificates awaiting review…" /> : items.length ? <div className="review-list">{items.map((item) => <article className="review-row certificate-review-row" key={item.id}>
      <div className="review-profile"><strong>{item.title}</strong><span>{item.athlete?.fullName ?? 'Athlete'} · {item.athlete?.sport ?? ''} · {item.athlete?.district ?? ''}</span><p>{item.description}</p><small>Submitted {new Date(item.createdAt).toLocaleDateString()}</small>
        <button className="button button-outline" type="button" onClick={() => setExpanded(expanded === item.id ? '' : item.id)}>{expanded === item.id ? 'Hide certificate' : 'Inspect certificate'}</button>
        {expanded === item.id && <CertificatePreview url={item.certificateUrl} title={item.title} />}
        <label className="field-label certificate-note">REVIEW NOTES<textarea rows={2} maxLength={500} value={notes[item.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Add context for the athlete or reviewer" /></label>
      </div><div className="review-actions"><button className="button button-outline" disabled={activeId === item.id} onClick={() => review(item, 'rejected')}>Reject</button><button className="button button-primary" disabled={activeId === item.id} onClick={() => review(item, 'verified')}>{activeId === item.id ? 'Saving…' : 'Verify'}</button></div>
    </article>)}</div> : <div className="dashboard-note">No certificates are waiting for verification.</div>}
  </section>;
}

function PeTeacherDashboard({ user }: { user: User }) {
  const [data, setData] = useState<{ athletes: Athlete[] }>({ athletes: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeId, setActiveId] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const pendingAthletes = data.athletes.filter((athlete) => athlete.verificationStatus === 'pending');
  const verifiedAthletes = data.athletes.filter((athlete) => athlete.verificationStatus === 'verified');

  useEffect(() => {
    if (!user.isVerified) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api<{ athletes: Athlete[] }>('/pe-teacher/athletes', { signal: controller.signal, cache: 'no-store' })
      .then(setData)
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Could not load local athletes.');
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [user.id, user.isVerified, refresh]);

  async function verifyAthlete(profile: Athlete) {
    setActiveId(profile.id);
    setError('');
    setNotice('');
    try {
      await api(`/pe-teacher/athletes/${profile.id}/verification`, { method: 'PUT' });
      setData((current) => ({
        ...current,
        athletes: current.athletes.map((athlete) => athlete.id === profile.id
          ? { ...athlete, verificationStatus: 'verified' }
          : athlete),
      }));
      setNotice(`${profile.fullName}’s athlete profile has been verified.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not verify this athlete profile.');
    } finally {
      setActiveId('');
    }
  }

  if (!user.isVerified) {
    return (
      <div className="container dashboard-page">
        <div className="dashboard-welcome"><div><span className="eyebrow">PE TEACHER DESK</span><h1>Verification pending.</h1></div><div className="dashboard-user"><CircleUserRound size={17} /> {user.username}</div></div>
        <div className="verification-notice"><span className="verification-icon"><ShieldCheck size={22} /></span><div><h2>Your account is awaiting verification.</h2><p>Accounts registered with an institutional email ending in .edu.in, .ac.in, .gov.in, or .nic.in are verified automatically. Other accounts can be reviewed by our team.</p></div><span className="status-chip"><span /> PENDING VERIFICATION</span></div>
      </div>
    );
  }

  return (
    <div className="container dashboard-page">
      <div className="dashboard-welcome">
        <div><span className="eyebrow">PE TEACHER DESK</span><h1>Support your<br />local talent.</h1></div>
        <div className="dashboard-user">
          <CircleUserRound size={17} /> {user.username}
          <span className="verified-chip"><BadgeCheck size={13} /> VERIFIED TEACHER</span>
          <span className="district-chip"><MapPin size={13} /> {user.district || 'Local District'}</span>
        </div>
      </div>

      <div className="dashboard-stats">
        <div><span>LOCAL ATHLETES</span><strong>{String(data.athletes.length).padStart(2, '0')}</strong></div>
        <div><span>PENDING ATHLETE PROFILES</span><strong>{String(pendingAthletes.length).padStart(2, '0')}</strong></div>
        <div><span>INSTITUTION</span><strong className="stat-status">{user.institutionName || 'N/A'}</strong></div>
      </div>

      <CertificateVerificationQueue />

      {error && <div className="form-error review-feedback" role="alert">{error}</div>}
      {notice && <div className="form-success review-feedback" role="status"><Check size={15} />{notice}</div>}

      <section className="review-section">
        <div className="dashboard-section-heading">
          <div><span className="eyebrow">ATHLETE ACCOUNTS</span><h2>Profiles awaiting review.</h2></div>
          <button className="button button-outline review-refresh" onClick={() => setRefresh((value) => value + 1)} disabled={loading}>Refresh</button>
        </div>
        <p className="review-intro">Check each athlete’s profile details before verifying. Only profiles from your district appear here.</p>
        {loading ? <LoadingState label="Loading athlete profiles…" /> : pendingAthletes.length ? (
          <div className="review-list">
            {pendingAthletes.map((profile) => (
              <article className="review-row" key={profile.id}>
                <span className="request-avatar"><ClipboardCheck size={16} /></span>
                <div className="review-profile">
                  <strong>{profile.fullName}</strong>
                  <span>{profile.sport} · {profile.age} years · {profile.district}, {profile.region}</span>
                  <small>Created {new Date(profile.createdAt).toLocaleDateString()}</small>
                </div>
                <Link className="review-view-link" to={`/athletes/${profile.id}`}>Check details <ArrowRight size={14} /></Link>
                <div className="review-actions">
                  <button className="button button-primary" disabled={activeId === profile.id} onClick={() => verifyAthlete(profile)}>
                    {activeId === profile.id ? 'Saving…' : 'Mark verified'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : <div className="dashboard-note">No athlete profiles are waiting for verification in your district.</div>}
      </section>

      {verifiedAthletes.length > 0 && (
        <section className="review-section">
          <div className="dashboard-section-heading">
            <div><span className="eyebrow">VERIFIED ATHLETES</span><h2>Profiles you’ve confirmed.</h2></div>
          </div>
          <div className="review-list">
            {verifiedAthletes.map((profile) => (
              <article className="review-row" key={profile.id}>
                <span className="request-avatar"><BadgeCheck size={16} /></span>
                <div className="review-profile">
                  <strong>{profile.fullName}</strong>
                  <span>{profile.sport} · {profile.age} years · {profile.district}, {profile.region}</span>
                </div>
                <Link className="review-view-link" to={`/athletes/${profile.id}`}>Check details <ArrowRight size={14} /></Link>
                <div className="review-actions"><span className="verified-chip"><BadgeCheck size={13} /> VERIFIED</span></div>
              </article>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}

function AchievementSection({ profile }: { profile: Athlete | null }) {
  const [posts, setPosts] = useState<AchievementPost[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [media, setMedia] = useState<File | null>(null);
  const [certificate, setCertificate] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState('');
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(Boolean(profile));
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState('');
  const [editingPostId, setEditingPostId] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editEventDate, setEditEventDate] = useState('');
  const [editMedia, setEditMedia] = useState<File | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [certificateBusyId, setCertificateBusyId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!media) {
      setMediaPreview('');
      return;
    }
    const previewUrl = URL.createObjectURL(media);
    setMediaPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [media]);

  useEffect(() => {
    if (!profile) {
      setPosts([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api<AchievementPostPage>('/posts/mine?limit=5', { signal: controller.signal })
      .then((result) => setPosts(result.items))
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setError(requestError instanceof Error ? requestError.message : 'Could not load your achievements.');
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [profile?.id]);

  async function publish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!media) {
      setError('Choose an image or video for your achievement.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const body = new FormData();
      body.append('title', title);
      body.append('description', description);
      if (eventDate) body.append('eventDate', eventDate);
      body.append('photo', media);
      const post = await api<AchievementPost>('/posts', {
        method: 'POST',
        body,
      });
      if (certificate) {
        const certificateBody = new FormData();
        certificateBody.append('certificate', certificate);
        await api(`/posts/${post.id}/certificate`, { method: 'POST', body: certificateBody });
      }
      setPosts((current) => [{ ...post, hasCertificate: Boolean(certificate), verificationStatus: certificate ? 'pending' : post.verificationStatus }, ...current].slice(0, 5));
      setTitle('');
      setDescription('');
      setEventDate('');
      setMedia(null);
      setCertificate(null);
      if (mediaInputRef.current) mediaInputRef.current.value = '';
      setSuccess('Your achievement is now visible in the achievements feed.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not share your achievement.');
    } finally {
      setSaving(false);
    }
  }

  async function removePost(post: AchievementPost) {
    setRemovingId(post.id);
    setError('');
    setSuccess('');
    try {
      await api(`/posts/${post.id}`, { method: 'DELETE' });
      setPosts((current) => current.filter((item) => item.id !== post.id));
      setSuccess('Achievement removed.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not remove this achievement.');
    } finally {
      setRemovingId('');
    }
  }

  async function uploadCertificate(post: AchievementPost, file: File | undefined) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024 || !['application/pdf', 'image/png', 'image/jpeg'].includes(file.type)) {
      setError('Choose a PDF, PNG, or JPG certificate no larger than 10 MB.');
      return;
    }
    setCertificateBusyId(post.id); setError(''); setSuccess('');
    try {
      const body = new FormData(); body.append('certificate', file);
      await api(`/posts/${post.id}/certificate`, { method: 'POST', body });
      setPosts((current) => current.map((item) => item.id === post.id ? { ...item, hasCertificate: true, verificationStatus: 'pending', verificationNotes: null } : item));
      setSuccess('Certificate uploaded and added to your PE Teacher’s review queue.');
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Could not upload this certificate.'); }
    finally { setCertificateBusyId(''); }
  }

  function startEditingPost(post: AchievementPost) {
    setEditingPostId(post.id);
    setEditTitle(post.title);
    setEditDescription(post.description);
    setEditEventDate(post.eventDate?.slice(0, 10) ?? '');
    setEditMedia(null);
    setError('');
    setSuccess('');
  }

  function cancelEditingPost() {
    setEditingPostId('');
    setEditMedia(null);
    setError('');
  }

  async function savePost(event: React.FormEvent<HTMLFormElement>, post: AchievementPost) {
    event.preventDefault();
    setEditSaving(true);
    setError('');
    setSuccess('');
    try {
      const body = new FormData();
      body.append('title', editTitle);
      body.append('description', editDescription);
      body.append('eventDate', editEventDate);
      if (editMedia) body.append('photo', editMedia);
      const updatedPost = await api<AchievementPost>(`/posts/${post.id}`, {
        method: 'PATCH',
        body,
      });
      setPosts((current) => current.map((item) => item.id === updatedPost.id ? updatedPost : item));
      setEditingPostId('');
      setEditMedia(null);
      setSuccess('Achievement updated.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not update this achievement.');
    } finally {
      setEditSaving(false);
    }
  }

  if (!profile) {
    return (
      <section className="achievement-section">
        <div className="dashboard-section-heading"><div><span className="eyebrow">YOUR ACHIEVEMENTS</span><h2>Share your achievements.</h2></div></div>
        <div className="achievement-prompt"><Trophy size={20} /><p>Create your athlete profile first. You can upload achievements even while your profile is awaiting verification.</p></div>
      </section>
    );
  }

  return (
    <section className="achievement-section">
      <div className="dashboard-section-heading">
        <div><span className="eyebrow">YOUR ACHIEVEMENTS</span><h2>Put the work on record.</h2></div>
        <Link className="text-link" to="/#achievements">See latest on Home <ArrowRight size={15} /></Link>
      </div>
      <p className="dashboard-intro">All athlete accounts can share achievements, even while their profile is awaiting verification. Add a personal best, tournament result, or proud moment with an image or video.</p>
      {error && <div className="form-error" role="alert">{error}</div>}
      {success && <div className="form-success" role="status"><Check size={15} />{success}</div>}
      <div className="achievement-layout">
        <form className="achievement-compose-form" onSubmit={publish}>
          <label className="field-label">TITLE<input value={title} onChange={(event) => setTitle(event.target.value)} minLength={3} maxLength={120} placeholder="e.g. District Athletics Championship" required /></label>
          <label className="field-label">YOUR STORY<textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1500} placeholder="Share your result or a detail scouts should know." required /></label>
          <label className="field-label achievement-photo-picker">IMAGE OR VIDEO<span className="field-hint">PNG/JPG up to 2 MB, or MP4/WebM up to 25 MB.</span><input ref={mediaInputRef} type="file" accept="image/png,image/jpeg,video/mp4,video/webm" onChange={(event) => {
            const file = event.target.files?.[0];
            setError('');
            if (!file) {
              setMedia(null);
            } else {
              const mediaError = achievementMediaError(file);
              setMedia(mediaError ? null : file);
              if (mediaError) setError(mediaError);
            }
          }} required /></label>
          <label className="field-label achievement-photo-picker">CERTIFICATE DOCUMENT <span className="field-hint">Optional. PDF, PNG, or JPG up to 10 MB; a PE Teacher in your district will review it.</span><input type="file" accept="application/pdf,image/png,image/jpeg" onChange={(event) => { const file = event.target.files?.[0] ?? null; setCertificate(file && file.size <= 10 * 1024 * 1024 ? file : null); setError(file && file.size > 10 * 1024 * 1024 ? 'Certificate files must be 10 MB or smaller.' : ''); }} /></label>
          {certificate && <span className="selected-file">{certificate.name} · awaiting PE Teacher review</span>}
          {mediaPreview && <div className="achievement-photo-preview">{media?.type.startsWith('video/') ? <video src={mediaPreview} controls muted playsInline /> : <img src={mediaPreview} alt="Achievement preview" />}<span><ImagePlus size={14} /> Ready to upload</span></div>}
          <div className="achievement-compose-footer">
            <label className="field-label">DATE <span className="field-hint">Optional</span><input type="date" className="tabular-nums" value={eventDate} onChange={(event) => setEventDate(event.target.value)} max={new Date().toISOString().slice(0, 10)} /></label>
            <button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Sharing…' : 'Share achievement'} <ArrowRight size={15} /></button>
          </div>
        </form>
        <div className="achievement-own-list">
          <div className="achievement-own-heading"><span>YOUR POSTS</span><span>{String(posts.length).padStart(2, '0')}</span></div>
          {loading ? <LoadingState label="Loading your posts…" /> : posts.length ? posts.map((post) => (
            <article className="achievement-own-post" key={post.id}>
              {post.videoUrl ? (
                <video className="achievement-own-photo" src={apiAsset(post.videoUrl)} controls preload="metadata" aria-label={`${post.title} video`} />
              ) : post.photoUrl ? <img className="achievement-own-photo" src={apiAsset(post.photoUrl)} alt="" /> : null}
              {post.hasCertificate && <div className="certificate-status-line"><ShieldCheck size={14} /> Certificate {post.verificationStatus ?? 'pending'}{post.verificationNotes ? ` · ${post.verificationNotes}` : ''}</div>}
              <label className="certificate-upload-inline">{certificateBusyId === post.id ? 'Uploading certificate…' : post.hasCertificate ? 'Replace certificate' : 'Add certificate'}<input type="file" accept="application/pdf,image/png,image/jpeg" disabled={certificateBusyId === post.id} onChange={(event) => { void uploadCertificate(post, event.target.files?.[0]); event.target.value = ''; }} /></label>
              {editingPostId === post.id ? (
                <form className="achievement-own-edit-form" onSubmit={(event) => savePost(event, post)}>
                  <label className="field-label">TITLE<input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} minLength={3} maxLength={120} required /></label>
                  <label className="field-label">YOUR STORY<textarea rows={3} value={editDescription} onChange={(event) => setEditDescription(event.target.value)} maxLength={1500} required /></label>
                  <label className="field-label">DATE <span className="field-hint">Optional</span><input type="date" className="tabular-nums" value={editEventDate} onChange={(event) => setEditEventDate(event.target.value)} max={new Date().toISOString().slice(0, 10)} /></label>
                  <label className="field-label achievement-photo-picker">REPLACE MEDIA <span className="field-hint">Optional; leave empty to keep the current media.</span><input type="file" accept="image/png,image/jpeg,video/mp4,video/webm" onChange={(event) => {
                    const file = event.target.files?.[0];
                    setError('');
                    if (!file) {
                      setEditMedia(null);
                      return;
                    }
                    const mediaError = achievementMediaError(file);
                    if (mediaError) {
                      setEditMedia(null);
                      setError(mediaError);
                    } else {
                      setEditMedia(file);
                    }
                  }} /></label>
                  <div className="achievement-own-edit-actions">
                    <button type="button" className="button button-outline" onClick={cancelEditingPost} disabled={editSaving}>Cancel</button>
                    <button type="submit" className="button button-primary" disabled={editSaving}>{editSaving ? 'Saving…' : 'Save changes'} <Check size={14} /></button>
                  </div>
                </form>
              ) : (
                <>
                  <div>
                    <strong>{post.title}</strong>
                    <p>{post.description}</p>
                    <AchievementEndorsement status={post.endorsementStatus} />
                    {post.endorsementStatus === 'correction_requested' && post.endorsementNote && <p className="achievement-correction-note">{post.endorsementNote}</p>}
                    <span>{post.eventDate ? `Event ${new Date(`${post.eventDate.slice(0, 10)}T12:00:00`).toLocaleDateString()}` : `Shared ${new Date(post.createdAt).toLocaleDateString()}`}</span>
                  </div>
                  <div className="achievement-own-actions">
                    <button type="button" className="achievement-edit" aria-label={`Edit ${post.title}`} disabled={removingId === post.id} onClick={() => startEditingPost(post)}><Pencil size={14} /></button>
                    <button type="button" className="achievement-delete" aria-label={`Delete ${post.title}`} disabled={removingId === post.id} onClick={() => removePost(post)}><Trash2 size={15} /></button>
                  </div>
                </>
              )}
            </article>
          )) : <p className="achievement-own-empty">Your achievements will appear here after you share your first post.</p>}
        </div>
      </div>
    </section>
  );
}
function CompactProfileCard({ profile, onEdit }: { profile: Athlete; onEdit: () => void }) {
  const initials = profile.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return (
    <div className="compact-profile-card">
      <div className="compact-profile-head">
        <div className="compact-profile-avatar">
          {profile.photoUrl ? <img src={apiAsset(profile.photoUrl)} alt="" /> : initials}
        </div>
        <div className="compact-profile-info">
          <span className="compact-profile-eyebrow">{profile.sport}</span>
          <h3 className="compact-profile-name">{profile.fullName}</h3>
          <p className="compact-profile-location"><MapPin size={14} /> {profile.district}, {profile.region}</p>
        </div>
        <button type="button" className="compact-profile-edit" aria-label="Edit profile" onClick={onEdit} title="Edit profile">
          <Pencil size={17} />
        </button>
      </div>
      {profile.verificationStatus === 'verified' && <span className="verified-chip compact-profile-verified"><BadgeCheck size={13} /> VERIFIED ATHLETE</span>}
      {profile.bio && <p className="compact-profile-bio">{profile.bio}</p>}
      {profile.tournaments.length > 0 && (
        <div className="compact-profile-achievements">
          <span className="compact-profile-achievements-label"><Trophy size={13} /> Recent achievements</span>
          <ul className="compact-profile-achievements-list">
            {profile.tournaments.slice(0, 3).map((item, index) => (
              <li key={item || `${index}`}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TalentDashboard({ user }: { user: User }) {
  const [profile, setProfile] = useState<Athlete | null>(null);
  const [form, setForm] = useState<ProfileForm>(() => getProfileDraft(user.id) ?? blankForm(user.username, user.district));
  const [connections, setConnections] = useState<Connection[]>([]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loadKey, setLoadKey] = useState(0);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.allSettled([
      api<Athlete | null>('/athletes/me'),
      api<Connection[]>('/connections'),
    ]).then(([profileResult, connectionsResult]) => {
      if (!active) return;
      const errors: string[] = [];
      if (profileResult.status === 'fulfilled') {
        const ownProfile = profileResult.value;
        const draft = getProfileDraft(user.id);
        setProfile(ownProfile);
        setForm(draft ?? (ownProfile ? profileForm(ownProfile) : blankForm(user.username, user.district)));
        setIsEditing(!ownProfile || Boolean(draft));
      } else {
        errors.push(profileResult.reason instanceof Error ? profileResult.reason.message : 'Could not load your profile.');
      }
      if (connectionsResult.status === 'fulfilled') {
        setConnections(connectionsResult.value);
      } else {
        errors.push(connectionsResult.reason instanceof Error ? connectionsResult.reason.message : 'Could not load your introductions.');
      }
      if (errors.length) setError(errors.join(' '));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user.id, user.username, loadKey]);

  function updateField(key: keyof ProfileForm, value: string) {
    const updated = { ...form, [key]: value };
    setForm(updated);
    setError(saveProfileDraft(user.id, updated)
      ? ''
      : 'Your changes could not be saved in this browser. Save your profile before refreshing.');
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        ...form,
        age: Number(form.age),
        tournaments: form.tournaments.split('\n').map((item) => item.trim()).filter(Boolean),
      };
      const saved = await api<Athlete>(profile ? `/athletes/${profile.id}` : '/athletes', {
        method: profile ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      setProfile(saved);
      setForm(profileForm(saved));
      clearProfileDraft(user.id);
      if (photo) {
        const body = new FormData();
        body.append('photo', photo);
        await api(`/athletes/${saved.id}/photo`, { method: 'POST', body });
        setPhoto(null);
      }
      setSuccess('Your profile is saved. Any edits are sent for verification.');
      setLoadKey((value) => value + 1);
      setIsEditing(false);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : requestError instanceof Error ? requestError.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    clearProfileDraft(user.id);
    setForm(profile ? profileForm(profile) : blankForm(user.username));
    setPhoto(null);
    setError('');
    setSuccess('');
    setIsEditing(false);
  }

  async function respond(connectionId: string, status: 'accepted' | 'rejected') {
    setError('');
    try {
      await api(`/connections/${connectionId}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setConnections((current) => current.map((item) => item.id === connectionId ? { ...item, status } : item));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not update this introduction.');
    }
  }

  const pendingRequests = connections.filter((connection) => connection.status === 'pending');

  if (loading) return <div className="container dashboard-page"><LoadingState label="Setting up your athlete dashboard…" /></div>;

  return (
    <div className="container dashboard-page">
      <div className="dashboard-welcome"><div><span className="eyebrow">YOUR ATHLETE DESK</span><h1>Make your game<br />impossible to miss.</h1></div><div className="dashboard-user"><CircleUserRound size={17} /> {profile?.fullName ?? user.username}</div></div>
      <div className="dashboard-talent-layout">
        <section className="dashboard-form-section">
          {profile && !isEditing ? (
            <CompactProfileCard profile={profile} onEdit={() => { setForm(profileForm(profile)); setPhoto(null); setError(''); setSuccess(''); setIsEditing(true); }} />
          ) : (
            <>
              <div className="dashboard-section-heading"><div><span className="eyebrow">{profile ? 'YOUR PROFILE' : 'START HERE'}</span><h2>{profile ? 'Keep your story current.' : 'Your story starts here.'}</h2></div></div>
              <p className="dashboard-intro">{profile ? 'Update your details, achievements, and the story you want scouts to hear.' : 'A profile puts you on the map. Add your details and our team will review them.'}</p>
              {error && <div className="form-error" role="alert">{error}</div>}
              {success && <div className="form-success"><Check size={15} />{success}</div>}
              <form className="profile-edit-form" onSubmit={saveProfile}>
                <label className="field-label">FULL NAME<input value={form.fullName} onChange={(event) => updateField('fullName', event.target.value)} maxLength={100} required /></label>
                <div className="form-row">
                  <label className="field-label">AGE<input type="number" value={form.age} onChange={(event) => updateField('age', event.target.value)} min={5} max={100} required /></label>
                  <label className="field-label">SPORT<input value={form.sport} onChange={(event) => updateField('sport', event.target.value)} maxLength={80} placeholder="e.g. Athletics" required /></label>
                </div>
                <div className="form-row">
                  <label className="field-label">DISTRICT<input value={form.district} onChange={(event) => updateField('district', event.target.value)} maxLength={100} required /></label>
                  <label className="field-label">REGION / STATE<input value={form.region} onChange={(event) => updateField('region', event.target.value)} maxLength={100} required /></label>
                </div>
                <label className="field-label">YOUR BIO<textarea rows={3} maxLength={2000} value={form.bio} onChange={(event) => updateField('bio', event.target.value)} placeholder="What should a scout know about you?" /></label>
                <label className="field-label">TOURNAMENTS & ACHIEVEMENTS<span className="field-hint">Add one item per line.</span><textarea rows={3} value={form.tournaments} onChange={(event) => updateField('tournaments', event.target.value)} placeholder={'District athletics meet — 100m finalist\nState junior championship — 2025'} /></label>
                <label className="field-label">PROFILE PHOTO<span className="field-hint">PNG or JPG, up to 2 MB.</span><input type="file" accept="image/png,image/jpeg" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} /></label>
                {photo && <span className="selected-file">{photo.name} <button type="button" aria-label="Remove selected photo" onClick={() => setPhoto(null)}><X size={14} /></button></span>}
                <div className="profile-form-actions">
                  {profile && <button type="button" className="button button-outline" disabled={saving} onClick={cancelEdit}>Cancel</button>}
                  <button type="submit" className="button button-primary button-large" disabled={saving}>{saving ? 'Saving your profile…' : profile ? 'Save profile changes' : 'Create my profile'} <ArrowRight size={16} /></button>
                </div>
              </form>
            </>
          )}
        </section>
        <aside className="dashboard-aside">
          <div className="profile-checklist"><span className="eyebrow">THE NEXT STEPS</span><h3>One step at a time.</h3><div className="checklist-item"><span className={`checklist-icon${profile ? ' done' : ''}`}>{profile ? <Check size={14} /> : <UserRound size={14} />}</span><span><b>Build your profile</b><small>{profile ? 'You’re on the board.' : 'Share your sport and story.'}</small></span></div><div className="checklist-item"><span className={`checklist-icon${connections.some((item) => item.status === 'accepted') ? ' done' : ''}`}><Heart size={14} /></span><span><b>Make a connection</b><small>Get discovered by verified scouts.</small></span></div><div className="checklist-footer"><MapPin size={14} /> YOUR PLACE IN THE GAME STARTS HERE</div></div>
          {!profile && <div className="dashboard-tip"><span className="eyebrow">A LITTLE HEAD START</span><p>Profiles with a good photo, a clear bio, and a few achievements are easier for scouts to remember.</p><ChevronRight size={17} /></div>}
        </aside>
      </div>
      <AchievementSection profile={profile} />
      {pendingRequests.length > 0 && <section className="inbox-section"><div className="dashboard-section-heading"><div><span className="eyebrow">A SCOUT WANTS TO TALK</span><h2>Your introductions.</h2></div><span className="filter-count">{pendingRequests.length}</span></div><div className="request-list">{pendingRequests.map((connection) => <div className="request-row talent-request" key={connection.id}><span className="request-avatar"><ShieldCheck size={16} /></span><div><strong>New introduction</strong><span>Received {new Date(connection.createdAt).toLocaleDateString()}</span></div><p>{connection.message}</p><div className="request-actions"><button title="Accept introduction" aria-label="Accept introduction" onClick={() => respond(connection.id, 'accepted')}><Check size={16} /></button><button title="Decline introduction" aria-label="Decline introduction" onClick={() => respond(connection.id, 'rejected')}><X size={16} /></button></div></div>)}</div></section>}
    </div>
  );
}
export default function Dashboard() {
  const { user, isInitializing } = useAuth();
  if (isInitializing) {
    return (
      <div className="container dashboard-page">
        <LoadingState label="Loading your dashboard…" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'host') return <HostDashboard user={user} />;
  if (user.role === 'admin') return <AdminDashboard />;
  if (user.role === 'pe_teacher') return <PeTeacherDashboard user={user} />;
  return <TalentDashboard user={user} />;
}
