import styles from './skeletons.module.css';

/** Shimmering placeholder block that matches final-content dimensions (no layout shift). */
export function Skel({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden="true" className={`${styles.skel} ${className}`} style={style} />;
}
