import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="not-found-page">
      <span className="eyebrow">404&nbsp; / &nbsp;OFF THE MAP</span>
      <h1>Wrong turn.<br /><span>Right game.</span></h1>
      <p>We couldn’t find the page you were looking for. The talent pool’s still wide open, though.</p>
      <div><Link to="/" className="button button-primary"><ArrowLeft size={16} /> Head back home</Link><Link to="/athletes" className="text-link">Explore athletes <ArrowUpRight size={15} /></Link></div>
    </div>
  );
}
