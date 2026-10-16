import styles from './MineNetrLoader.module.css';

export type LoaderVariant = 'fullscreen' | 'inline' | 'compact';
export type LoaderMessage =
  | 'Initializing MineNetr'
  | 'Preparing your workspace'
  | 'Loading mine data'
  | 'Verifying access'
  | 'Workspace ready';

interface MineNetrLoaderProps {
  variant?: LoaderVariant;
  message?: LoaderMessage | string;
  showBranding?: boolean;
  className?: string;
}

/**
 * "Deep Signal" — MineNetr's signature loading experience.
 * Pure CSS/SVG animation (no timers, no browser APIs at render → SSR-safe).
 * Indeterminate by design: it never invents progress percentages.
 */
export default function MineNetrLoader({
  variant = 'fullscreen',
  message = 'Preparing your workspace',
  showBranding = true,
  className = '',
}: MineNetrLoaderProps) {
  if (variant !== 'fullscreen') {
    return (
      <span
        role="status"
        aria-live="polite"
        aria-label={message}
        className={`${styles.inlineWrap} ${variant === 'compact' ? styles.compact : ''} ${className}`}
      >
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
        {variant === 'inline' && message ? <span className={styles.inlineMsg}>{message}</span> : null}
      </span>
    );
  }

  return (
    <div className={`${styles.stage} ${className}`} role="status" aria-live="polite" aria-label={`MineNetr loading: ${message}`}>
      {/* Layered geological contours / tunnel silhouette */}
      <svg className={styles.tunnel} viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="mnr-rock" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0B3154" stopOpacity="0" />
            <stop offset="1" stopColor="#12325e" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id="mnr-beam" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#E8A02B" stopOpacity="0" />
            <stop offset="0.5" stopColor="#E8A02B" stopOpacity="0.85" />
            <stop offset="1" stopColor="#E8A02B" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="mnr-signal" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#1463D9" stopOpacity="0" />
            <stop offset="0.55" stopColor="#5ea0ff" />
            <stop offset="1" stopColor="#1463D9" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* rock contours */}
        <g fill="none" stroke="#1d3a63" strokeWidth="1.5" className={styles.contours}>
          <path d="M-20 380 Q 200 300 420 340 T 840 300" />
          <path d="M-20 420 Q 220 340 440 380 T 840 340" opacity="0.7" />
          <path d="M-20 460 Q 240 385 460 420 T 840 385" opacity="0.45" />
          <path d="M-20 120 Q 200 170 420 130 T 840 165" opacity="0.5" />
          <path d="M-20 80 Q 220 130 440 95 T 840 125" opacity="0.3" />
        </g>
        <rect x="0" y="300" width="800" height="200" fill="url(#mnr-rock)" />

        {/* tunnel arch */}
        <path
          d="M 250 460 L 250 260 Q 250 150 400 150 Q 550 150 550 260 L 550 460"
          fill="none" stroke="#2a4a7a" strokeWidth="2" className={styles.arch}
        />
        <path
          d="M 295 460 L 295 275 Q 295 190 400 190 Q 505 190 505 275 L 505 460"
          fill="none" stroke="#22406e" strokeWidth="1.25" opacity="0.7" className={styles.arch}
        />

        {/* headlamp sweep */}
        <rect x="120" y="238" width="560" height="26" fill="url(#mnr-beam)" className={styles.sweep} rx="13" />

        {/* sensor signal path across stations */}
        <path
          id="mnr-signal-path"
          d="M 120 330 Q 260 250 400 300 T 680 270"
          fill="none" stroke="#16345f" strokeWidth="2"
        />
        <path
          d="M 120 330 Q 260 250 400 300 T 680 270"
          fill="none" stroke="url(#mnr-signal)" strokeWidth="2.5" strokeLinecap="round"
          className={styles.pulse}
        />
        <g fill="#0B3154" stroke="#3d6db3" strokeWidth="1.5">
          <circle cx="120" cy="330" r="6" className={styles.node} style={{ animationDelay: '0.9s' }} />
          <circle cx="262" cy="283" r="6" className={styles.node} style={{ animationDelay: '1.25s' }} />
          <circle cx="400" cy="300" r="6" className={styles.node} style={{ animationDelay: '1.6s' }} />
          <circle cx="540" cy="287" r="6" className={styles.node} style={{ animationDelay: '1.95s' }} />
          <circle cx="680" cy="270" r="6" className={styles.node} style={{ animationDelay: '2.3s' }} />
        </g>
        <g fill="#5ea0ff" className={styles.nodeGlow}>
          <circle cx="120" cy="330" r="2.4" style={{ animationDelay: '0.9s' }} />
          <circle cx="262" cy="283" r="2.4" style={{ animationDelay: '1.25s' }} />
          <circle cx="400" cy="300" r="2.4" style={{ animationDelay: '1.6s' }} />
          <circle cx="540" cy="287" r="2.4" style={{ animationDelay: '1.95s' }} />
          <circle cx="680" cy="270" r="2.4" style={{ animationDelay: '2.3s' }} />
        </g>
      </svg>

      {/* Brand block */}
      <div className={styles.brand}>
        {showBranding ? (
          <div className={styles.wordmark} aria-hidden="true">
            <span className={styles.mark}>M</span>
            <span className={styles.name}>
              Mine<span className={styles.nameAccent}>Netr</span>
            </span>
          </div>
        ) : null}
        {showBranding ? <p className={styles.tagline}>Safer Mines. Smarter Governance.</p> : null}
        <div className={styles.statusRow}>
          <span className={styles.statusDot} aria-hidden="true" />
          <p className={styles.status}>{message}</p>
        </div>
        <div className={styles.track} aria-hidden="true">
          <div className={styles.bar} />
        </div>
      </div>
    </div>
  );
}
