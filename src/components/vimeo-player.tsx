'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useAnalytics } from '@/components/posthog-provider';

type VimeoPlayerProps = {
  videoId: string;
  title?: string;
  thumbnailUrl?: string;
  className?: string;
  aspectClassName?: string;
};

export function VimeoPlayer({
  videoId,
  title = 'Episode video',
  thumbnailUrl,
  className = '',
  aspectClassName = 'aspect-video',
}: VimeoPlayerProps) {
  const { capture } = useAnalytics();
  const [shouldLoad, setShouldLoad] = useState(false);
  const previewImage = thumbnailUrl || `https://vumbnail.com/${videoId}.jpg`;

  function handlePlayerOpen() {
    capture('episode player opened', { video_id: videoId });
    setShouldLoad(true);
  }

  return (
    <div className={`relative w-full min-w-0 overflow-hidden bg-surface-elevated ${aspectClassName} ${className}`}>
      {shouldLoad ? (
        <iframe
          src={`https://player.vimeo.com/video/${videoId}?title=0&byline=0&portrait=0&badge=0&dnt=1`}
          title={title}
          allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 h-full w-full border-0"
        />
      ) : (
        <button
          type="button"
          onClick={handlePlayerOpen}
          className="group absolute inset-0 flex h-full w-full items-center justify-center bg-surface text-background"
          aria-label={`Open ${title} player`}
        >
          <Image src={previewImage} alt="" fill sizes="(max-width: 1024px) 100vw, 720px" className="object-cover" />
          <span className="absolute inset-0 bg-black/35 transition-colors duration-200 group-hover:bg-black/25" />
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary text-background shadow-lg transition-transform duration-200 group-hover:scale-105">
            <svg aria-hidden="true" className="ml-1 h-7 w-7" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}
