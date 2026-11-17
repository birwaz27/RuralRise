import { ArrowUpRight, MapPin, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiAsset, type Athlete } from '../api';

const swatches = ['avatar-green', 'avatar-blue', 'avatar-orange', 'avatar-plum'];

export default function AthleteCard({ athlete, index = 0 }: { athlete: Athlete; index?: number }) {
  return (
    <article className="athlete-card">
      <Link className="athlete-card-image" to={`/athletes/${athlete.id}`} aria-label={`View ${athlete.fullName}'s profile`}>
        {athlete.photoUrl ? (
          <img
            src={apiAsset(athlete.photoUrl)}
            alt=""
            onError={(event) => { event.currentTarget.style.display = 'none'; }}
          />
        ) : null}
        <span className={`avatar-fallback ${swatches[index % swatches.length]}`}>
          <span>{athlete.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span>
        </span>
        {athlete.verificationStatus === 'verified' && <span className="verified-chip"><ShieldCheck size={13} /> Verified</span>}
        {athlete.planTier === 'pro' && <span className="pro-chip">FEATURED</span>}
      </Link>
      <div className="athlete-card-body">
        <div className="athlete-card-heading">
          <div>
            <p className="sport-label">{athlete.sport}</p>
            <h3>{athlete.fullName}</h3>
          </div>
          <Link className="circle-arrow" to={`/athletes/${athlete.id}`} aria-label={`View ${athlete.fullName}`}>
            <ArrowUpRight size={17} />
          </Link>
        </div>
        <p className="athlete-location"><MapPin size={14} /> {athlete.district}, {athlete.region}</p>
      </div>
    </article>
  );
}
