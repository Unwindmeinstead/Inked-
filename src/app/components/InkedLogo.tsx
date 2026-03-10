/** Text logo for Inked+ (used in sidebar header) */

interface InkedLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = { sm: 'text-base', md: 'text-xl', lg: 'text-2xl' };

export function InkedLogo({ className = '', size = 'md' }: InkedLogoProps) {
  return (
    <div className={`flex items-baseline gap-0.5 font-semibold text-zinc-100 tracking-tight ${sizeMap[size]} ${className}`} aria-label="Inked+">
      <span>Inked</span>
      <span className="relative inline-block">
        +
        <svg viewBox="0 0 12 8" className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-2 h-1.5" aria-hidden>
          <path d="M4 2v4c0 1.5 1 2.5 2 2.5s2-1 2-2.5V2" stroke="rgb(239 68 68)" strokeWidth="0.8" strokeLinecap="round" fill="none" opacity="0.85" />
        </svg>
      </span>
    </div>
  );
}
