/** Monopiston wordmark with a compact piston symbol. */
export function BrandLogo() {
  return (
    <span className="inline-flex items-center gap-2 text-[#1a1a1a]">
      <svg
        aria-hidden="true"
        className="text-primary size-8 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 32 32"
      >
        <path d="M8 4h16v12H8zM8 8h16M8 12h16M13 16v7m6-7v7" />
        <circle cx="16" cy="26" r="4" />
      </svg>
      <span className="font-display text-base font-black tracking-tight sm:text-lg">
        Monopiston
      </span>
    </span>
  );
}
