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
            <Link href="/contact" className="hover:text-white">Contact</Link>
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/dmca" className="hover:text-white">DMCA</Link>
          </nav>
        </div>
        <p className="mt-6 text-xs text-gray-600">
          © {new Date().getFullYear()} c·roll. Fan-uploaded content is owned by its creators.
        </p>
      </div>
    </footer>
  );
}
