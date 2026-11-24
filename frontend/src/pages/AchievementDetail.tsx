import { CalendarDays, MapPin, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, apiAsset, type AchievementPost } from '../api';
import AchievementEndorsement from '../components/AchievementEndorsement';
import { BackLink, ErrorState, LoadingState } from '../components/States';

function formatDate(value: string): string {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function AchievementDetail() {
  const { id = '' } = useParams();
  const [achievement, setAchievement] = useState<AchievementPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setAchievement(null);
    setLoading(true);
    setError('');
    api<AchievementPost>(`/posts/${id}`, { signal: controller.signal })
      .then(setAchievement)
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setError(requestError instanceof Error ? requestError.message : 'Could not load this achievement.');
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id]);

  return (
    <div className="achievement-detail-page">
      <div className="container achievement-detail-topbar">
        <BackLink to="/#achievements" />
      </div>
      <main className="container achievement-detail-main">
        {loading ? <LoadingState label="Loading achievement details…" /> : error || !achievement ? (
          <ErrorState message={error || 'Achievement not found.'} />
        ) : (
          <article className="achievement-detail-card">
            <span className="achievement-detail-category"><Trophy size={15} /> PLAYER ACHIEVEMENT</span>
            <h1>{achievement.title}</h1>
            <div className="achievement-detail-athlete">
              <Link to={`/athletes/${achievement.athlete.id}`}>{achievement.athlete.fullName}</Link>
              <span>{achievement.athlete.sport}</span>
              <span><MapPin size={14} /> {achievement.athlete.district}, {achievement.athlete.region}</span>
            </div>
            {achievement.videoUrl ? (
              <video className="achievement-detail-media" src={apiAsset(achievement.videoUrl)} controls preload="metadata" aria-label={`${achievement.title} by ${achievement.athlete.fullName}`} />
            ) : achievement.photoUrl ? (
              <img className="achievement-detail-media" src={apiAsset(achievement.photoUrl)} alt={`${achievement.title} by ${achievement.athlete.fullName}`} />
            ) : (
              <div className="achievement-detail-media achievement-detail-media-empty"><Trophy size={34} /></div>
            )}
            <div className="achievement-detail-meta">
              <span><CalendarDays size={14} /> {achievement.eventDate ? `Event date: ${formatDate(achievement.eventDate)}` : `Shared ${formatDate(achievement.createdAt)}`}</span>
              <AchievementEndorsement status={achievement.endorsementStatus} />
            </div>
            {achievement.endorsementNote && <p className="achievement-detail-note">{achievement.endorsementNote}</p>}
            <div className="achievement-detail-description">
              <span className="eyebrow">THE FULL STORY</span>
              <p>{achievement.description}</p>
            </div>
          </article>
        )}
      </main>
    </div>
  );
}
