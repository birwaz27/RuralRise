import {
  ArrowDown, ArrowRight, ArrowUpRight, BadgeCheck, CalendarDays, MapPin,
  Search, ShieldCheck, Sparkles, Trophy, Users, Volleyball,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, apiAsset, type AchievementPost, type AchievementPostPage } from '../api';
import { useAuth } from '../auth';
import AchievementEndorsement from '../components/AchievementEndorsement';

function AchievementCards({ achievements }: { achievements: AchievementPost[] }) {
  return (
    <div className="home-achievements-grid">
      {achievements.map((achievement) => (
        <article className="home-achievement-card" key={achievement.id}>
          {achievement.videoUrl ? (
            <video className="home-achievement-photo" src={apiAsset(achievement.videoUrl)} controls preload="metadata" aria-label={`${achievement.title} by ${achievement.athlete.fullName}`} />
          ) : achievement.photoUrl ? (
            <img className="home-achievement-photo" src={apiAsset(achievement.photoUrl)} alt={`${achievement.title} by ${achievement.athlete.fullName}`} />
          ) : (
            <div className="home-achievement-photo home-achievement-photo-empty"><Trophy size={25} /></div>
          )}
          <div className="home-achievement-content">
            <Link to={`/athletes/${achievement.athlete.id}`} className="home-achievement-athlete">
              {achievement.athlete.fullName} <span>· {achievement.athlete.sport}</span>
            </Link>
            <h3><Link to={`/achievements/${achievement.id}`}>{achievement.title}</Link></h3>
            <p>{achievement.description}</p>
            <Link className="home-achievement-detail-link" to={`/achievements/${achievement.id}`}>Read full achievement <ArrowRight size={13} /></Link>
            <AchievementEndorsement status={achievement.endorsementStatus} />
            <span className="home-achievement-date"><CalendarDays size={13} /> {achievement.eventDate ? new Date(`${achievement.eventDate.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recently shared'}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const [achievements, setAchievements] = useState<AchievementPost[]>([]);
  const [achievementError, setAchievementError] = useState('');
  const [achievementsLoading, setAchievementsLoading] = useState(true);
  const [achievementRefresh, setAchievementRefresh] = useState(0);

  useEffect(() => {
    if (!user) {
      setAchievements([]);
      setAchievementError('');
      setAchievementsLoading(false);
      return;
    }

    const controller = new AbortController();
    setAchievementError('');
    setAchievementsLoading(true);
    api<AchievementPostPage>('/posts?page=1&limit=3', { signal: controller.signal })
      .then(({ items }) => setAchievements(items))
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setAchievementError(requestError instanceof Error ? requestError.message : 'Achievements could not be loaded.');
        }
      })
      .finally(() => { if (!controller.signal.aborted) setAchievementsLoading(false); });
    return () => controller.abort();
  }, [achievementRefresh, user]);

  if (user) {
    return (
      <div className="player-home-page">
        <section className="container player-home-feed" id="achievements">
          <div className="home-achievements-heading">
            <div><span className="eyebrow">FROM THE FIELD</span><h2>Achievements worth seeing.</h2></div>
            <span className="player-home-feed-note">REAL ATHLETES · REAL PROGRESS</span>
          </div>
          {achievementsLoading ? (
            <div className="home-achievements-message" role="status">Loading athlete achievements…</div>
          ) : achievementError ? (
            <div className="home-achievements-message" role="status"><span>{achievementError}</span><button className="text-link" onClick={() => setAchievementRefresh((value) => value + 1)}>Try again <ArrowRight size={14} /></button></div>
          ) : achievements.length ? (
            <AchievementCards achievements={achievements} />
          ) : (
            <div className="home-achievements-message" role="status"><span>No achievements have been shared yet. Check back soon.</span><Link className="text-link" to="/dashboard">Share yours <ArrowRight size={14} /></Link></div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="home-page">
      <section className="hero-section">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="hero-kicker"><span className="live-dot" /> THE NEXT GENERATION PLAYS HERE</span>
            <h1>Talent has<br />no <span className="hero-highlight">postcode.</span></h1>
            <p className="hero-description">The grassroots athletes changing the game are already out there. We’re here to make sure the right people find them.</p>
            <div className="hero-actions">
              <Link className="button button-primary button-large" to={user ? '/athletes' : '/login'}>{user ? 'Meet the athletes' : 'Log in to meet athletes'} <ArrowUpRight size={17} /></Link>
              <Link className="button button-quiet button-large" to={user ? '/dashboard' : '/register'}>I’m an athlete <ArrowRight size={16} /></Link>
            </div>
            <div className="hero-social-proof">
              <div className="mini-avatars"><span>R</span><span>A</span><span>P</span><span>+</span></div>
              <p><strong>Every champion starts somewhere.</strong><br />Find the next one in your backyard.</p>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="hero-location-tag"><MapPin size={13} /> EVERY DISTRICT. EVERY DREAM.</div>
            <span className="hero-sticker"><Sparkles size={16} /> THE NEXT BIG THING<br /><b>IS ALREADY HERE.</b></span>
          </div>
        </div>
        <div className="hero-bottom container">
          <span>CONNECTING THE UNSEEN TO THE UNSTOPPABLE</span>
          <a href="#about" aria-label="Scroll to learn more"><ArrowDown size={16} /></a>
          <span>BUILT ON LOCAL PRIDE&nbsp; · &nbsp;OPEN TO ALL</span>
        </div>
      </section>

      <section className="ticker" aria-label="Our mission">
        <div className="ticker-track">
          {Array.from({ length: 4 }).map((_, index) => (
            <span key={index}>BUILT FROM THE GROUND UP <i>✳</i> THE FUTURE OF SPORT IS EVERYWHERE <i>✳</i></span>
          ))}
        </div>
      </section>

      <section className="section-featured container" id="about">
        <div className="section-heading">
          <div><span className="eyebrow">A BETTER WAY TO GET SEEN</span><h2>All heart.<br /><span className="text-muted">No gatekeeping.</span></h2></div>
          <p>Talent lives everywhere. Access doesn’t. RuralRise brings athletes and the people looking for them onto the same field.</p>
        </div>
        <div className="feature-grid">
          <article className="feature-card feature-card-dark">
            <span className="feature-icon"><ShieldCheck size={21} /></span>
            <span className="feature-number">01 / TRUST</span>
            <h3>Proof over<br />promises.</h3>
            <p>Real profiles, real stats, and a clear verification process. Scouts know who they’re looking at.</p>
            <BadgeCheck className="feature-watermark" size={112} strokeWidth={1} />
          </article>
          <article className="feature-card feature-card-green">
            <span className="feature-icon"><Search size={21} /></span>
            <span className="feature-number">02 / DISCOVERY</span>
            <h3>Find your<br />kind of game.</h3>
            <p>Search by sport and region to uncover players who would otherwise be missed.</p>
            <Trophy className="feature-watermark" size={112} strokeWidth={1} />
          </article>
          <article className="feature-card feature-card-light">
            <span className="feature-icon"><Users size={21} /></span>
            <span className="feature-number">03 / CONNECTION</span>
            <h3>Local roots.<br />Bigger stages.</h3>
            <p>When a scout spots potential, they can reach out and start a real conversation.</p>
            <Volleyball className="feature-watermark" size={112} strokeWidth={1} />
          </article>
        </div>
      </section>

      <section className="discover-section">
        <div className="container discover-grid">
          <div className="discover-copy">
            <span className="eyebrow eyebrow-green">THE TALENT IS ALREADY THERE</span>
            <h2>Meet the<br />ones to watch.</h2>
            <p>Explore emerging talent across regions and sports. Every profile tells a story that stats alone can’t.</p>
            {user && <Link className="text-link" to="/athletes">Explore the talent pool <ArrowUpRight size={16} /></Link>}
            <div className="discover-index">01 — 03 <span /><b>SCOUT’S VIEW</b></div>
          </div>
          <div className="sample-list sample-list-gate">
            <span className="eyebrow eyebrow-green">ATHLETE DIRECTORY</span>
            <h3>Talent is waiting to be discovered.</h3>
            <p>Sign in or create an account to browse athlete profiles and achievements.</p>
            <Link className="button button-lime" to="/login">Log in to explore <ArrowRight size={15} /></Link>
          </div>
        </div>
      </section>

      <section className="steps-section container">
        <div className="steps-title"><span className="eyebrow">NO SHORTCUTS. NO SECRET HANDSHAKES.</span><h2>Just a good place<br />to <span className="text-muted">start.</span></h2></div>
        <div className="steps-list">
          <article className="step-item"><span className="step-number">01</span><div><h3>Show up as you are.</h3><p>Create your profile and tell us what you play, where you’re from, and what drives you.</p></div><span className="step-mark">+</span></article>
          <article className="step-item"><span className="step-number">02</span><div><h3>Put your game on the map.</h3><p>Add your stats and achievements. Our team reviews profiles so scouts can browse with confidence.</p></div><span className="step-mark">+</span></article>
          <article className="step-item"><span className="step-number">03</span><div><h3>Let the right people find you.</h3><p>Scouts can discover your profile, see what you’re made of, and reach out directly.</p></div><span className="step-mark">↗</span></article>
        </div>
      </section>

      <section className="join-banner">
        <div className="container join-banner-inner">
          <span className="join-spark">✳</span>
          <span className="eyebrow eyebrow-green">YOUR MOVE</span>
          <h2>Big things start<br />in small places.</h2>
          <p>Your story deserves to be seen. Let’s get it out there.</p>
          <Link to={user ? '/dashboard' : '/register'} className="button button-lime button-large">Make your first move <ArrowUpRight size={17} /></Link>
          <span className="join-outline-text">YOUR GAME<br />YOUR GROUND</span>
        </div>
      </section>
    </div>
  );
}
