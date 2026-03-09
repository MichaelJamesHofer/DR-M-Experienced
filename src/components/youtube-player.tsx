'use client';

type YouTubePlayerProps = {
  videoId: string;
  title?: string;
  className?: string;
};

export function YouTubePlayer({ videoId, title = '', className = '' }: YouTubePlayerProps) {
  const embedUrl = `https://www.youtube.com/embed/${videoId}?rel=0`;
  return (
    <div
      className={className}
      style={{
        padding: '56.25% 0 0 0',
        position: 'relative',
      }}
    >
      <iframe
        src={embedUrl}
        title={title || 'YouTube video'}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="absolute top-0 left-0 w-full h-full"
        style={{ border: 0 }}
      />
    </div>
  );
}
