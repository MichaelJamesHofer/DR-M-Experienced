'use client';

import { useEffect, useRef } from 'react';

type VimeoPlayerProps = {
  videoId: string;
  title?: string;
  className?: string;
};

export function VimeoPlayer({ videoId, title, className = '' }: VimeoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create the iframe
    const iframe = document.createElement('iframe');
    iframe.src = `https://player.vimeo.com/video/${videoId}?title=0&byline=0&portrait=0&badge=0&autopause=0&player_id=0&app_id=58479`;
    iframe.frameBorder = '0';
    iframe.allow = 'autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.style.position = 'absolute';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    if (title) {
      iframe.title = title;
    }

    // Clear container and add iframe (safe - we control the iframe source)
    // Using removeChild for better security than innerHTML
    while (containerRef.current.firstChild) {
      containerRef.current.removeChild(containerRef.current.firstChild);
    }
    containerRef.current.appendChild(iframe);

    // Load Vimeo player script
    const script = document.createElement('script');
    script.src = 'https://player.vimeo.com/api/player.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // Cleanup script on unmount
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [videoId, title]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        padding: '56.25% 0 0 0',
        position: 'relative',
      }}
    />
  );
}

