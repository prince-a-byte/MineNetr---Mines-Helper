import MineNetrLoader from '../branding/MineNetrLoader';

/**
 * Compact action-state indicator for buttons and local mutations.
 * Keeps the button's dimensions; pairs with an action-specific label
 * rendered by the caller (e.g. "Saving…", "Uploading…").
 */
export default function InlineLoader({
  label,
  light = false,
  className = '',
}: {
  label: string;
  light?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 ${className}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span className={light ? 'text-white' : 'text-current'}>
        <MineNetrLoader variant="compact" message={label} showBranding={false} />
      </span>
      <span>{label}</span>
    </span>
  );
}
