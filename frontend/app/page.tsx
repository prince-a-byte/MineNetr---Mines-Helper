import { redirect } from 'next/navigation';

export default async function Home() {
  // Keep the signature Deep Signal loader on screen for a beat on cold start.
  await new Promise((resolve) => setTimeout(resolve, 1000));
  redirect('/login');
}
