import { Menu, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { sessionExpiredEvent, sessionRestoredEvent } from '../api';
import Logo from './Logo';

function Header() {
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const contactRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [signOutError, setSignOutError] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    const handleExpired = () => setSessionExpired(true);
    const handleRestored = () => setSessionExpired(false);
    window.addEventListener(sessionExpiredEvent, handleExpired);
    window.addEventListener(sessionRestoredEvent, handleRestored);
    return () => {
      window.removeEventListener(sessionExpiredEvent, handleExpired);
      window.removeEventListener(sessionRestoredEvent, handleRestored);
    };
  }, []);

  useEffect(() => {
    if (!contactOpen) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (event.target instanceof Node && !contactRef.current?.contains(event.target)) {
        setContactOpen(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setContactOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutsideClick);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [contactOpen]);

  function closeMenu() {
    setMenuOpen(false);
    setContactOpen(false);
  }

  function handleAboutClick(event: React.MouseEvent<HTMLAnchorElement>) {
    closeMenu();
    if (location.pathname !== '/') return;
    event.preventDefault();
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('about')?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  }

  async function handleSignOut() {
    setSignOutError('');
    try {
      await signOut();
    } catch (requestError) {
      setSignOutError(requestError instanceof Error ? requestError.message : 'Could not fully end your session.');
    } finally {
      closeMenu();
      navigate('/');
    }
  }

  return (
    <>
      <header className="site-header">
        <div className="container header-inner">
          <Logo />
          <button className="mobile-menu-toggle" aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
          <nav className={`main-nav${menuOpen ? ' is-open' : ''}`} aria-label="Main navigation">
            <NavLink to="/" end onClick={closeMenu}>Home</NavLink>
            {user && <NavLink to="/athletes" onClick={closeMenu}>Talent pool</NavLink>}
            {user && <NavLink to="/events" onClick={closeMenu}>Events</NavLink>}
            {!user && <Link to="/#about" onClick={handleAboutClick}>About</Link>}
            <div className="nav-contact" ref={contactRef}>
              <button
                type="button"
                className={`nav-contact-toggle${contactOpen ? ' active' : ''}`}
                aria-expanded={contactOpen}
                aria-controls="contact-menu"
                onClick={() => setContactOpen((open) => !open)}
              >
                Contact
              </button>
              {contactOpen && (
                <div className="contact-dropdown" id="contact-menu">
                  <span className="contact-dropdown-label">ADMIN EMAIL</span>
                  <a href="mailto:birwaz27@gmail.com" onClick={closeMenu}>birwaz27@gmail.com</a>
                </div>
              )}
            </div>
            <span className="nav-mobile-divider" />
            {user ? (
              <>
                <Link className="nav-account-link" to="/dashboard" onClick={closeMenu}>Dashboard</Link>
                {signOutError && <span className="nav-signout-error" role="status">{signOutError}</span>}
                <button className="button button-small button-outline nav-join" onClick={handleSignOut}>Sign out</button>
              </>
            ) : (
              <>
                <Link className="nav-login" to="/login" onClick={closeMenu}>Log in</Link>
                <Link className="button button-small button-primary nav-join" to="/register" onClick={closeMenu}>Join the community</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      {sessionExpired && <div className="session-expired-banner" role="status"><div className="container">Your session expired. Open <Link to="/login" target="_blank" rel="noreferrer">log in in a new tab</Link> to keep this draft, then retry.</div></div>}
    </>
  );
}

function ScrollToHash() {
  const { pathname, hash } = useLocation();

  useLayoutEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      return;
    }
    const targetId = decodeURIComponent(hash.slice(1));
    const target = document.getElementById(targetId);
    if (!target) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  }, [pathname, hash]);

  return null;
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-main">
        <div className="footer-brand">
          <Logo light />
          <p>Big dreams don’t need big-city beginnings.</p>
        </div>
        <div className="footer-links">
          <span className="eyebrow">Explore</span>
          <Link to="/">Home</Link>
          <Link to="/athletes">Talent pool</Link>
          <a href="mailto:birwaz27@gmail.com">birwaz27@gmail.com</a>
        </div>
        <div className="footer-links">
          <span className="eyebrow">Get involved</span>
          <Link to="/register">Join as an athlete</Link>
          <Link to="/register">Join as a scout</Link>
          <Link to="/login">Log in</Link>
        </div>
        <div className="footer-note">
          <span className="footer-spark">✳</span>
          <p>Made for the ones<br />who play with heart.</p>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} RuralRise. All rights reserved.</span>
        <span>Discover. Showcase. Connect.</span>
      </div>
    </footer>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  if (pathname === '/login') return <main className="login-layout"><Outlet /></main>;

  return (
    <>
      <Header />
      <ScrollToHash />
      <main><Outlet /></main>
      <Footer />
    </>
  );
}
