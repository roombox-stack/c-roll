import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-ash bg-smoke/40 py-10 text-sm text-gray-500">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <Link href="/" className="font-heading text-lg font-black tracking-tight text-white hover:text-gray-300">
              c<span className="mx-[1px] text-croll">-</span>roll
            </Link>
            <p className="mt-1 text-xs">The show, from everyone who was there.</p>
          </div>

          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
            <Link href="/about" className="hover:text-white">About</Link>
            <Link href="/why" className="hover:text-white">Why upload</Link>
            <Link href="/contact" className="hover:text-white">Contact</Link>
            <Link href="/request" className="hover:text-white">Request an event</Link>
            <Link href="/claim" className="hover:text-white">For Artists</Link>
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/dmca" className="hover:text-white">DMCA</Link>
          </nav>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs text-gray-600">
            © {new Date().getFullYear()} c·roll. Fan-uploaded content is owned by its creators.
          </p>
          <a
            href="https://www.instagram.com/croll.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white"
            aria-label="C-Roll on Instagram"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
            Instagram
          </a>
        </div>
      </div>
    </footer>
  );
}
