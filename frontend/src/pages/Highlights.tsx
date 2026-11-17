import { ArrowRight, CalendarDays, MapPin, ShieldCheck, Sparkles, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, apiAsset, type AchievementPost, type AchievementPostPage } from '../api';
import { useAuth } from '../auth';
import AchievementEndorsement from '../components/AchievementEndorsement';
import { ErrorState, LoadingState } from '../components/States';

function formatDate(value: string): string {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Highlights() {
  const { user } = useAuth();
  const [result, setResult] = useState<AchievementPostPage | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api<AchievementPostPage>(`/posts?page=${page}&limit=12`, { signal: controller.signal })
      .then(setResult)
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setError(requestError instanceof Error ? requestError.message : 'Could not load athlete achievements.');
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, refresh]);

  return (
    <div className="highlights-page">
      <section className="highlights-hero">
        <div className="container">
          <span className="directory-kicker"><span className="live-dot" /> THE ACHIEVEMENT FEED</span>
          <div className="highlights-title-row">
            <div>
              <h1>Hard work<br />worth <span>seeing.</span></h1>
              <p>Milestones, match days, and moments that show what athletes can do. Follow their progress and find your next prospect.</p>
            </div>
            <Link className="button button-lime button-large" to={user?.role === 'talent' ? '/dashboard' : '/register'}>
              Share your achievement <ArrowRight size={16} />
            </Link>
          </div>
          <div className="highlights-hero-foot"><span><Sparkles size={14} /> REAL ATHLETES. REAL PROGRESS.</span><span>{result ? `${result.total} ACHIEVEMENTS SHARED` : 'PLAYER STORIES, IN THEIR OWN WORDS'}</span></div>
        </div>
      </section>

      <section className="container highlights-content">
        <div className="highlights-feed-heading">
          <div><span className="eyebrow">FROM THE FIELD</span><h2>Latest achievements.</h2></div>
          <Link className="text-link" to="/athletes">Explore all athletes <ArrowRight size={15} /></Link>
        </div>
        {loading ? <LoadingState label="Loading athlete achievements…" /> : error ? (
          <ErrorState message={error} onRetry={() => setRefresh((value) => value + 1)} />
        ) : result?.items.length ? (
          <>
            <div className="highlights-grid">
              {result.items.map((post) => <HighlightCard post={post} key={post.id} />)}
            </div>
            {result.pages > 1 && <div className="pagination">
              <button className="button button-outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
              <span>PAGE <b>{String(page).padStart(2, '0')}</b> OF {String(result.pages).padStart(2, '0')}</span>
              <button className="button button-outline" disabled={page >= result.pages} onClick={() => setPage((current) => current + 1)}>Next <ArrowRight size={14} /></button>
            </div>}
          </>
        ) : (
          <div className="highlights-empty">
            <span className="highlights-empty-icon"><Trophy size={22} /></span>
            <span className="eyebrow">YOUR FIRST ACHIEVEMENT</span>
            <h3>Every great run starts somewhere.</h3>
            <p>Athletes can share a result, a breakthrough, or a moment they’re proud of. Scouts can browse every story here.</p>
            <Link className="button button-primary" to={user?.role === 'talent' ? '/dashboard' : '/register'}>Add your achievement <ArrowRight size={15} /></Link>
          </div>
        )}
      </section>
    </div>
  );
}

function HighlightCard({ post }: { post: AchievementPost }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const initials = post.athlete.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

  return (
    <article className="highlight-card">
      <div className="highlight-card-top">
        <Link className="highlight-athlete" to={`/athletes/${post.athlete.id}`}>
          <span className="highlight-avatar">
            {!photoFailed && <img src={apiAsset(post.athlete.photoUrl)} alt="" onError={() => setPhotoFailed(true)} />}
            {photoFailed && <span>{initials}</span>}
          </span>
          <span className="highlight-athlete-details">
            <strong>{post.athlete.fullName}</strong>
            <span>{post.athlete.sport} · {post.athlete.district}, {post.athlete.region}</span>
          </span>
        </Link>
        {post.athlete.verificationStatus === 'verified' && <span className="highlight-verified"><ShieldCheck size={13} /> VERIFIED</span>}
      </div>
      {post.videoUrl && !imageFailed ? (
        <div className="highlight-post-photo"><video src={apiAsset(post.videoUrl)} controls preload="metadata" aria-label={`${post.title} by ${post.athlete.fullName}`} onError={() => setImageFailed(true)} /></div>
      ) : post.photoUrl && !imageFailed ? (
        <div className="highlight-post-photo"><img src={apiAsset(post.photoUrl)} alt={`${post.title} by ${post.athlete.fullName}`} onError={() => setImageFailed(true)} /></div>
      ) : (
        <div className="highlight-post-photo highlight-post-photo-empty"><Trophy size={30} /><span>PLAYER ACHIEVEMENT</span></div>
      )}
      <div className="highlight-card-content">
        <span className="highlight-category"><Trophy size={14} /> PLAYER ACHIEVEMENT</span>
        <h3>{post.title}</h3>
        <p>{post.description}</p>
        <AchievementEndorsement status={post.endorsementStatus} />
      </div>
      <div className="highlight-card-footer">
        <span><CalendarDays size={14} /> {post.eventDate ? formatDate(post.eventDate) : `Shared ${formatDate(post.createdAt)}`}</span>
        <Link to={`/athletes/${post.athlete.id}`}>View player <ArrowRight size={14} /></Link>
      </div>
      <span className="highlight-card-location"><MapPin size={13} /> {post.athlete.district}, {post.athlete.region}</span>
    </article>
  );
}
