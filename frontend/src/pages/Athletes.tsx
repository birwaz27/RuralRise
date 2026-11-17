import { ArrowDownUp, ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api, type Athlete } from '../api';
import AthleteCard from '../components/AthleteCard';
import { EmptyState, ErrorState, SkeletonAthleteCard } from '../components/States';

type DirectoryResponse = { items: Athlete[]; page: number; pages: number; total: number };

export default function Athletes() {
  const [search, setSearch] = useState('');
  const [sport, setSport] = useState('');
  const [region, setRegion] = useState('');
  const [district, setDistrict] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<DirectoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: '12' });
    if (search.trim()) params.set('search', search.trim());
    if (sport) params.set('sport', sport);
    if (region) params.set('region', region);
    if (district) params.set('district', district);
    return params.toString();
  }, [search, sport, region, district, page]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const data = await api<DirectoryResponse>(`/athletes?${query}`, { signal: controller.signal });
        setResult(data);
      } catch (requestError) {
        if (!controller.signal.aborted) setError(requestError instanceof Error ? requestError.message : 'Could not load athletes.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, search ? 220 : 0);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query, search, refresh]);

  function updateFilter(update: () => void) {
    update();
    setPage(1);
  }

  const activeFilters = [sport, region, district].filter(Boolean).length;
  const sports = useMemo(() => [...new Set((result?.items ?? []).map((athlete) => athlete.sport))].sort(), [result]);
  const regions = useMemo(() => [...new Set((result?.items ?? []).map((athlete) => athlete.region))].sort(), [result]);
  const districts = useMemo(() => [...new Set((result?.items ?? []).map((athlete) => athlete.district))].sort(), [result]);

  return (
    <div className="directory-page">
      <section className="directory-hero">
        <div className="container">
          <div className="directory-kicker"><span className="live-dot" /> THE TALENT POOL</div>
          <div className="directory-title-row">
            <div><h1>Meet the <span>game changers.</span></h1><p>Big potential, small-town beginnings. The next name you remember is right here.</p></div>
            <span className="directory-count">{result ? String(result.total).padStart(2, '0') : '—'} <small>ATHLETES<br />AND COUNTING</small></span>
          </div>
          <div className="directory-search">
            <Search size={19} />
            <input aria-label="Search athletes" placeholder="Search a name, sport, or anything..." value={search} onChange={(event) => updateFilter(() => setSearch(event.target.value))} />
            {search && <button className="search-clear" aria-label="Clear search" onClick={() => updateFilter(() => setSearch(''))}><X size={15} /></button>}
            <button className={`filter-toggle${filtersOpen ? ' active' : ''}`} onClick={() => setFiltersOpen(!filtersOpen)}>
              <SlidersHorizontal size={16} /> Filters{activeFilters > 0 && <span className="filter-count">{activeFilters}</span>}<ChevronDown size={14} />
            </button>
          </div>
          {filtersOpen && (
            <div className="filter-panel">
              <label>SPORT<input list="sport-options" value={sport} onChange={(event) => updateFilter(() => setSport(event.target.value))} placeholder="All sports" /><datalist id="sport-options">{sports.map((item) => <option key={item} value={item} />)}</datalist></label>
              <label>REGION<input list="region-options" value={region} onChange={(event) => updateFilter(() => setRegion(event.target.value))} placeholder="All regions" /><datalist id="region-options">{regions.map((item) => <option key={item} value={item} />)}</datalist></label>
              <label>DISTRICT<input list="district-options" value={district} onChange={(event) => updateFilter(() => setDistrict(event.target.value))} placeholder="All districts" /><datalist id="district-options">{districts.map((item) => <option key={item} value={item} />)}</datalist></label>
              {(activeFilters > 0 || search) && <button className="clear-filters" onClick={() => { setSport(''); setRegion(''); setDistrict(''); setSearch(''); setPage(1); }}>Clear all <X size={13} /></button>}
            </div>
          )}
        </div>
      </section>
      <section className="container directory-results">
        <div className="results-toolbar">
          <span>{result ? <>SHOWING <b>{result.total ? (page - 1) * 12 + 1 : 0}–{Math.min(page * 12, result.total)}</b> OF <b>{result.total}</b> PROFILES</> : 'LOADING PROFILES'}</span>
          <span className="sort-label"><ArrowDownUp size={14} /> PRIORITY PLACEMENT</span>
        </div>
        {loading ? (
          <div className="athlete-grid">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonAthleteCard key={i} />)}
          </div>
        ) : error ? <ErrorState message={error} onRetry={() => setRefresh((value) => value + 1)} /> : null}
        {!loading && !error && result?.items.length === 0 && <EmptyState title="No athletes found just yet." message="Try a different search or clear your filters. The next discovery could be one tap away." />}
        {!loading && !error && result?.items.length ? (
          <>
            <div className="athlete-grid">{result.items.map((athlete, index) => <AthleteCard athlete={athlete} index={index} key={athlete.id} />)}</div>
            {result.pages > 1 && <div className="pagination">
              <button className="button button-outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
              <span>PAGE <b>{String(page).padStart(2, '0')}</b> OF {String(result.pages).padStart(2, '0')}</span>
              <button className="button button-outline" disabled={page >= result.pages} onClick={() => setPage((current) => current + 1)}>Next <ChevronDown size={14} className="next-page-icon" /></button>
            </div>}
          </>
        ) : null}
      </section>
    </div>
  );
}
