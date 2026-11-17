import { ArrowLeft, LoaderCircle, SearchX } from 'lucide-react';
import { Link } from 'react-router-dom';

export function LoadingState({ label = 'Finding the right page…' }: { label?: string }) {
  return <div className="state-box"><LoaderCircle className="spin" size={24} /><p>{label}</p></div>;
}

export function SkeletonAthleteCard() {
  return (
    <div className="athlete-card skeleton-card">
      <div className="athlete-card-image skeleton" />
      <div className="athlete-card-body">
        <div className="skeleton" style={{ width: '40%', height: '10px', marginBottom: '12px' }} />
        <div className="skeleton" style={{ width: '80%', height: '18px', marginBottom: '16px' }} />
        <div className="skeleton" style={{ width: '60%', height: '12px' }} />
      </div>
    </div>
  );
}

export function SkeletonProfileHero() {
  return (
    <section className="container profile-hero">
      <div className="profile-photo-wrap skeleton" />
      <div className="profile-hero-content">
        <div className="profile-badges" style={{ marginBottom: '20px' }}>
          <div className="skeleton" style={{ width: '100px', height: '23px' }} />
        </div>
        <div className="skeleton" style={{ width: '150px', height: '14px', marginBottom: '12px' }} />
        <div className="skeleton" style={{ width: '300px', height: '48px', marginBottom: '16px' }} />
        <div className="skeleton" style={{ width: '200px', height: '16px', marginBottom: '24px' }} />
        <div className="skeleton" style={{ width: '100%', height: '60px' }} />
      </div>
    </section>
  );
}

export function SkeletonDashboardStats() {
  return (
    <div className="dashboard-stats">
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ padding: '22px' }}>
          <div className="skeleton" style={{ width: '60px', height: '10px', marginBottom: '12px' }} />
          <div className="skeleton" style={{ width: '40px', height: '32px' }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonSampleRow() {
  return (
    <div className="sample-row" style={{ pointerEvents: 'none' }}>
      <div className="sample-avatar skeleton" />
      <div className="sample-info">
        <div className="skeleton" style={{ width: '100px', height: '12px', marginBottom: '8px' }} />
        <div className="skeleton" style={{ width: '140px', height: '10px' }} />
      </div>
      <div className="sample-sport" style={{ marginLeft: 'auto' }}>
        <div className="skeleton" style={{ width: '60px', height: '10px', marginBottom: '8px' }} />
        <div className="skeleton" style={{ width: '80px', height: '10px' }} />
      </div>
    </div>
  );
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="state-box empty-state">
      <span className="empty-icon"><SearchX size={22} /></span>
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state-box error-state">
      <p>{message}</p>
      {onRetry && <button className="button button-outline" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function BackLink({ to = '/athletes', children = 'Back to talent pool' }: { to?: string; children?: string }) {
  return <Link className="back-link" to={to}><ArrowLeft size={15} />{children}</Link>;
}
