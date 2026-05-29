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
}: {
  playbackId: string;
  autoPlay?: boolean;
  muted?: boolean;
  poster?: string;
  fullscreen?: boolean;
}) {
  return (
    <MuxPlayer
      playbackId={playbackId}
      autoPlay={autoPlay}
      muted={muted}
      streamType="on-demand"
      poster={poster}
      accentColor="#ffffff"
      style={
        fullscreen
          ? {
              width: '100%',
              height: '100%',
              backgroundColor: '#000',
            }
          : {
              aspectRatio: '16 / 9',
              width: '100%',
              backgroundColor: '#0a0a0b',
            }
      }
    />
  );
}
