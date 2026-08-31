import { useState, useEffect, useRef, useCallback } from 'react';

interface SearchResult {
  id: string;
  name: string;
  slug: string;
  price: number;
  comparePrice?: number;
  image: string;
  shortDesc?: string;
}

const SEARCH_OPEN_EVENT = 'firstcrop:search-open';

export default function SearchDrawer() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  openRef.current = open;

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setResults([]);
  }, []);

  useEffect(() => {
    const intent = (window as any).__firstcropIntent as { open?: { search?: boolean } } | undefined;
    const onOpen = () => {
      if (intent?.open) intent.open.search = false;
      setOpen(true);
    };
    window.addEventListener(SEARCH_OPEN_EVENT, onOpen);
    // Consume a click captured before this island hydrated (see
    // StorefrontLayout's `__firstcropIntent` buffer).
    if (intent?.open?.search) {
      intent.open.search = false;
      setOpen(true);
    }
    return () => window.removeEventListener(SEARCH_OPEN_EVENT, onOpen);
  }, []);

  // Focus the search field once the drawer has actually mounted (a rAF fired
  // in the open handler would run before React commits the <input>).
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Escape is registered once on mount and guarded by a ref so the drawer can
  // always be dismissed — attaching it in a `[open]` effect after the drawer
  // commits leaves a window where Escape is missed.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openRef.current) close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        setResults(data.results || []);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, open]);

  if (!open) return null;

  return (
    <div className="search-overlay" onClick={close} role="presentation">
      <div
        ref={dialogRef}
        className="search-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Search products"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="search-bar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products…"
            aria-label="Search products"
            autoComplete="off"
          />
          <button onClick={close} aria-label="Close search" className="search-close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="search-results" aria-live="polite">
          {query.trim().length >= 2 && loading ? (
            <p className="search-status">Searching…</p>
          ) : query.trim().length >= 2 && results.length === 0 ? (
            <p className="search-status">No products found for “{query.trim()}”</p>
          ) : results.length > 0 ? (
            <ul className="search-list">
              {results.map((r) => (
                <li key={r.id}>
                  <a href={`/products/${r.slug}`} className="search-item" onClick={close}>
                    {r.image ? (
                      <img src={r.image} alt="" width="48" height="48" loading="lazy" className="search-item-image" />
                    ) : (
                      <span className="search-item-image search-item-placeholder" aria-hidden="true" />
                    )}
                    <span className="search-item-info">
                      <span className="search-item-name">{r.name}</span>
                      {r.shortDesc && <span className="search-item-desc">{r.shortDesc}</span>}
                    </span>
                    <span className="search-item-price numeric">₹{r.price.toFixed(0)}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="search-status">Type at least 2 characters to search.</p>
          )}
        </div>
      </div>
      <style>{`
        .search-overlay {
          position: fixed;
          inset: 0;
          z-index: 250;
          background: rgba(10, 10, 10, 0.4);
          backdrop-filter: blur(4px);
          animation: search-fade 200ms ease-out;
        }
        .search-drawer {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          max-height: min(70vh, 560px);
          background: var(--c-white, #fff);
          border-bottom: 1px solid var(--c-gray-100, #f1f5f9);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
          display: flex;
          flex-direction: column;
          animation: search-slide 300ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        @media (min-width: 768px) {
          .search-drawer {
            margin: 0 auto;
            border-radius: 0 0 14px 14px;
          }
        }
        .search-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
          color: var(--c-gray-400, #9ca3af);
          border-bottom: 1px solid var(--c-gray-100, #f1f5f9);
        }
        .search-bar input {
          flex: 1;
          border: none;
          outline: none;
          font-size: 1.0625rem;
          color: var(--c-gray-900, #111827);
          background: transparent;
          min-height: 44px;
        }
        .search-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 8px;
          color: var(--c-gray-500, #6b7280);
          transition: background 150ms ease-out, color 150ms ease-out;
        }
        .search-close:hover {
          background: var(--c-gray-100, #f1f5f9);
          color: var(--c-gray-900, #111827);
        }
        .search-results {
          overflow-y: auto;
          padding: 8px 8px 16px;
        }
        .search-status {
          padding: 16px 12px;
          font-size: 0.9375rem;
          color: var(--c-gray-500, #6b7280);
        }
        .search-list {
          list-style: none;
        }
        .search-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 10px;
          transition: background 150ms ease-out;
        }
        .search-item:hover,
        .search-item:focus-visible {
          background: var(--c-green-50, #f0fdf4);
        }
        .search-item-image {
          width: 48px;
          height: 48px;
          border-radius: 8px;
          object-fit: cover;
          flex-shrink: 0;
          background: var(--c-gray-100, #f1f5f9);
        }
        .search-item-info {
          flex: 1;
          min-width: 0;
        }
        .search-item-name {
          display: block;
          font-size: 0.9375rem;
          font-weight: 500;
          color: var(--c-gray-900, #111827);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .search-item-desc {
          display: block;
          font-size: 0.8125rem;
          color: var(--c-gray-500, #6b7280);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .search-item-price {
          font-size: 0.9375rem;
          font-weight: 600;
          color: var(--c-green-700, #15803d);
          flex-shrink: 0;
        }
        @keyframes search-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes search-slide {
          from { opacity: 0; transform: translateY(-12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .search-overlay, .search-drawer { animation: none; }
        }
      `}</style>
    </div>
  );
}
