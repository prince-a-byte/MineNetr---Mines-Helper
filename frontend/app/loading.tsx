import MineNetrLoader from '../components/branding/MineNetrLoader';

/** Initial application loading — cinematic brand moment, then routes resolve. */
export default function RootLoading() {
  return <MineNetrLoader variant="fullscreen" message="Preparing your workspace" />;
}
