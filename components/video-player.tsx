// Mux Player wrapper. Loaded only on the client to keep the player chunk out
// of the initial HTML payload for pages that may not even play a video.

'use client';

import dynamic from 'next/dynamic';

const MuxPlayer = dynamic(() => import('@mux/mux-player-react'), {
  ssr: false,
  loading: () => <div className="aspect-video w-full bg-ash" />,
});

export function VideoPlayer({
  playbackId,
  autoPlay = false,
  muted = false,
  poster,
  fullscreen = false,
  fillHeight = false,
}: {
  playbackId: string;
  autoPlay?: boolean;
  muted?: boolean;
  poster?: string;
  fullscreen?: boolean;
  /** Fill the parent's height with no forced aspect ratio — for the desktop modal. */
  fillHeight?: boolean;
}) {
  const style = (() => {
    if (fullscreen) {
      return { width: '100%', height: '100%', backgroundColor: '#000' };
    }
    if (fillHeight) {
      return {
        width: '100%',
        height: '100%',
        // Unset the player's internal 16:9 assumption so it respects the container.
        aspectRatio: 'unset' as React.CSSProperties['aspectRatio'],
        backgroundColor: '#000',
      };
    }
    return {
      aspectRatio: '16 / 9' as React.CSSProperties['aspectRatio'],
      width: '100%',
      backgroundColor: '#0a0a0b',
    };
  })();

  return (
    <MuxPlayer
      playbackId={playbackId}
      autoPlay={autoPlay}
      muted={muted}
      streamType="on-demand"
      poster={poster}
      accentColor="#ffffff"
      style={style}
    />
  );
}
