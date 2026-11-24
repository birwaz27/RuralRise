import { ArrowRight, BadgeCheck, CalendarDays, Search, ShieldCheck, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, apiAsset, type AchievementPost, type AchievementPostPage, type ScoutEvent } from '../api';
import { useAuth } from '../auth';

type PlatformStats = { verifiedAthletes: number | null; openTrials: number | null; verifiedCertificates: number | null };

function AchievementShowcase({ items }: { items: AchievementPost[] }) {
  if (!items.length) return <div className="champ-empty">Athlete highlights will appear here as the community shares its progress.</div>;
  return <div className="champ-achievement-grid">{items.map((post) => (
    <article className="champ-achievement-card" key={post.id}>
      <div className="champ-achievement-media">
        {post.videoUrl ? <video src={apiAsset(post.videoUrl)} controls preload="metadata" aria-label={`${post.title} video`} /> : post.photoUrl ? <img src={apiAsset(post.photoUrl)} alt={`${post.title} achievement`} /> : <div className="champ-media-placeholder"><Trophy size={28} /></div>}
        <span className={`champ-category-pill${post.hasCertificate ? ' certificate' : ''}`}>{post.hasCertificate ? 'Certificate attached' : 'Achievement'}</span>
      </div>
      <div className="champ-achievement-content">
        <div className="champ-achievement-meta"><Link to={`/athletes/${post.athlete.id}`}>{post.athlete.fullName}</Link><span>{post.athlete.sport}</span></div>
        <h3><Link to={`/achievements/${post.id}`}>{post.title}</Link></h3>
        <p>{post.description}</p>
        <div className="champ-achievement-footer">
          <span><CalendarDays size={13} />{post.eventDate ? new Date(`${post.eventDate.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recently shared'}</span>
          {post.hasCertificate && post.verificationStatus === 'verified' && <span className="champ-verified-pill"><BadgeCheck size={13} /> PE verified</span>}
        </div>
      </div>
    </article>
  ))}</div>;
}

export default function Home() {
  const { user } = useAuth();
  const [achievements, setAchievements] = useState<AchievementPost[]>([]);
  const [stats, setStats] = useState<PlatformStats>({ verifiedAthletes: null, openTrials: null, verifiedCertificates: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    async function loadHome() {
      try {
        const [verifiedResult, firstPosts] = await Promise.all([
          api<{ total: number }>('/athletes?status=verified&page=1&limit=1', { signal: controller.signal }),
          api<AchievementPostPage>('/posts?page=1&limit=50', { signal: controller.signal }),
        ]);
        const allPosts = [...firstPosts.items];
        for (let page = 2; page <= firstPosts.pages; page += 1) {
          const next = await api<AchievementPostPage>(`/posts?page=${page}&limit=50`, { signal: controller.signal });
          allPosts.push(...next.items);
        }
        let openTrials: number | null = null;
        if (user) {
          const events = await api<ScoutEvent[]>('/events', { signal: controller.signal });
          openTrials = events.length;
        }
        if (!controller.signal.aborted) {
          setStats({
            verifiedAthletes: verifiedResult.total,
            openTrials,
            verifiedCertificates: allPosts.filter((post) => post.hasCertificate && post.verificationStatus === 'verified').length,
          });
          setAchievements(firstPosts.items.slice(0, 3));
        }
      } catch (requestError) {
        if (!controller.signal.aborted) setError(requestError instanceof Error ? requestError.message : 'The scouting overview could not be loaded.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void loadHome();
    return () => controller.abort();
  }, [user?.id]);

  return <div className="champ-home">
    <section className="champ-hero">
      <div className="container champ-hero-inner">
        <div className="champ-hero-copy"><span className="champ-eyebrow"><span className="champ-live-dot" /> GRASSROOTS SPORT. NATIONAL POTENTIAL.</span>
          <h1>Discover verified<br />rural athletic talent<br /><em>across India.</em></h1>
          <p>Real athletes. Real achievements. A clearer path from local grounds to the next opportunity.</p>
          <div className="champ-hero-actions"><Link to={user ? '/athletes' : '/login'} className="champ-button champ-button-green">Explore talent pool <ArrowRight size={17} /></Link><Link to={user ? '/events' : '/register'} className="champ-button champ-button-ghost">Browse open trials <ArrowRight size={17} /></Link></div>
        </div>
        <div className="champ-hero-side"><div className="champ-field-mark"><span>RR</span><b>THE NEXT<br />GENERATION<br />IS ALREADY<br /><i>IN PLAY.</i></b><small>SCOUTING · VERIFIED · LOCAL</small></div><div className="champ-hero-orbit" /></div>
      </div>
      <div className="container champ-stats-bar"><div><span>VERIFIED ATHLETES</span><strong>{loading ? '—' : stats.verifiedAthletes?.toLocaleString() ?? '0'}</strong></div><div><span>OPEN SCOUT TRIALS</span><strong>{loading ? '—' : stats.openTrials === null ? 'Sign in' : stats.openTrials.toLocaleString()}</strong></div><div><span>PE-VERIFIED CERTIFICATES</span><strong>{loading ? '—' : stats.verifiedCertificates?.toLocaleString() ?? '0'}</strong></div></div>
    </section>

    <section className="container champ-journey-section">
      <div className="champ-section-heading"><div><span className="champ-section-kicker">A BETTER SCOUTING NETWORK</span><h2>Every role moves<br />the game forward.</h2></div><p>RuralRise brings athletes, educators, and scouts into one trusted loop, built around real performance and local knowledge.</p></div>
      <div className="champ-journey-grid">
        <article className="champ-journey-card"><span className="champ-journey-number">01 / PLAYER</span><span className="champ-journey-icon"><Trophy size={20} /></span><h3>Show the work.</h3><p>Build your profile, share highlights, and attach certificates that help tell the full story.</p><Link to={user ? '/dashboard' : '/register'}>Create a player profile <ArrowRight size={15} /></Link></article>
        <article className="champ-journey-card navy"><span className="champ-journey-number">02 / PE TEACHER</span><span className="champ-journey-icon"><ShieldCheck size={20} /></span><h3>Stand behind the proof.</h3><p>Local educators add context and credibility to the achievements happening in their district.</p><Link to={user ? '/dashboard' : '/register'}>Join as a PE Teacher <ArrowRight size={15} /></Link></article>
        <article className="champ-journey-card"><span className="champ-journey-number">03 / SCOUT</span><span className="champ-journey-icon amber"><Search size={20} /></span><h3>Find the next name.</h3><p>Discover emerging players, post open trials, review applicants, and support the right opportunity.</p><Link to={user ? '/events' : '/register'}>Explore Scout trials <ArrowRight size={15} /></Link></article>
      </div>
    </section>

    <section className="champ-achievements-section" id="achievements"><div className="container"><div className="champ-section-heading"><div><span className="champ-section-kicker">FROM THE FIELD</span><h2>Performance in<br />their own words.</h2></div><Link to={user ? '/athletes' : '/login'} className="champ-inline-link">Explore the talent pool <ArrowRight size={15} /></Link></div>
      {error && <p className="champ-error" role="status">{error}</p>}{loading ? <div className="champ-empty">Loading athlete achievements…</div> : <AchievementShowcase items={achievements} />}
    </div></section>
    <section className="champ-final-cta"><div className="container"><span className="champ-section-kicker">THE NEXT OPPORTUNITY STARTS HERE</span><h2>Make your next<br />move count.</h2><p>Put talent, trust, and opportunity on the same field.</p><Link to={user ? '/dashboard' : '/register'} className="champ-button champ-button-green">Get started <ArrowRight size={17} /></Link></div></section>
  </div>;
}
