import React, { useState } from 'react';
import { Award } from 'lucide-react';

interface ResilientImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export const ResilientImage: React.FC<ResilientImageProps> = ({
  src,
  alt,
  className = '',
  fallbackTitle,
}) => {
  const [hasError, setHasError] = useState(false);

  if (hasError || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#650019] via-[#450012] to-[#2b000b] text-[#D4AF37] p-6 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <Award className="w-10 h-10 mb-2 text-[#D4AF37] opacity-90" />
        <span className="font-display text-xs tracking-widest uppercase text-white/90">
          {fallbackTitle || 'Barobo National High School'}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={className}
    />
  );
};
