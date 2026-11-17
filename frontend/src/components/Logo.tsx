import { Link } from 'react-router-dom';

export default function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link className={`brand${light ? ' brand-light' : ''}`} to="/" aria-label="RuralRise Talent Hub home">
      <img className="brand-mark" src="/ruralrise-mark.png" alt="" />
      <span className="brand-wordmark">
        <span className="brand-name">Rural<span>Rise</span></span>
        <span className="brand-subline">TALENT HUB</span>
      </span>
    </Link>
  );
}
