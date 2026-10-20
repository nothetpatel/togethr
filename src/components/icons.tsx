// Small line icons. Drawn as SVG because characters like ⏭ and ⚙ turn into
// full-colour emoji on iPhone and look out of place.

const common = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const ResetIcon = () => (
  <svg {...common}>
    <path d="M4 12a8 8 0 1 0 2.4-5.7" />
    <path d="M4 4v4.5h4.5" />
  </svg>
);

export const SkipIcon = () => (
  <svg {...common}>
    <path d="M5 5l9 7-9 7z" fill="currentColor" />
    <path d="M18 5v14" />
  </svg>
);

export const SettingsIcon = () => (
  <svg {...common}>
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="8" cy="17" r="2" />
  </svg>
);

export const BellIcon = ({ off }: { off?: boolean }) => (
  <svg {...common}>
    <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
    <path d="M10 21h4" />
    {off && <path d="M4 4l16 16" />}
  </svg>
);
