import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Images } from 'lucide-react';
import { ResilientImage } from './ResilientImage';
import { BNHS_ASSETS } from '../data/bnhsData';

interface EventSlidingGalleryProps {
  images: string[];
  title: string;
  category: string;
  heightClass?: string;
  autoPlayIntervalMs?: number;
  showCaptionOverlay?: boolean;
  onManageSlides?: () => void;
}

export const EventSlidingGallery: React.FC<EventSlidingGalleryProps> = ({
  images,
  title,
  category,
  heightClass = 'h-56 sm:h-64',
  autoPlayIntervalMs = 3800,
  showCaptionOverlay = false,
  onManageSlides,
}) => {
  const slides = useMemo(() => {
    const cleaned = images.map((url) => (url || '').trim()).filter(Boolean);
    const unique = Array.from(new Set(cleaned));
    return unique.length > 0 ? unique : [BNHS_ASSETS.homecomingEvent];
  }, [images]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const safeIndex = activeIndex % slides.length;

  useEffect(() => {
    if (slides.length <= 1 || isPaused) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, autoPlayIntervalMs);
    return () => window.clearInterval(timer);
  }, [slides.length, isPaused, autoPlayIntervalMs]);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveIndex((prev) => (prev + 1) % slides.length);
  };

  return (
    <div
      className={`relative w-full overflow-hidden bg-[#450012] group ${heightClass}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Horizontal Sliding Strip */}
      <div
        className="flex h-full transition-transform duration-700 ease-out"
        style={{
          width: `${slides.length * 100}%`,
          transform: `translateX(-${(safeIndex * 100) / slides.length}%)`,
        }}
      >
        {slides.map((src, idx) => (
          <div
            key={`${idx}_${src.slice(0, 32)}`}
            className="h-full shrink-0 relative"
            style={{ width: `${100 / slides.length}%` }}
          >
            <ResilientImage
              src={src}
              alt={`${title} — Slide ${idx + 1}`}
              fallbackTitle={category}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>

      {/* Top Left Category + Slide Counter */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#450012]/90 border border-[#D4AF37]/60 text-[11px] font-bold text-[#D4AF37] shadow">
        <Images className="w-3.5 h-3.5" />
        <span>{category}</span>
        <span aria-hidden="true">·</span>
        <span className="font-mono-num text-white">
          {String(safeIndex + 1).padStart(2, '0')}/{String(slides.length).padStart(2, '0')}
        </span>
      </div>

      {/* Optional Upload / Manage Slides Shortcut */}
      {onManageSlides && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onManageSlides();
          }}
          className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded-md bg-[#450012]/90 border border-[#D4AF37]/70 text-[11px] font-bold text-[#D4AF37] hover:bg-[#650019] transition-colors cursor-pointer shadow"
        >
          + Upload Slide Photo
        </button>
      )}

      {/* Prev / Next Navigation Buttons */}
      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous slide"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/60 hover:bg-[#650019] border border-[#D4AF37]/60 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            aria-label="Next slide"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/60 hover:bg-[#650019] border border-[#D4AF37]/60 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}

      {/* Bottom Caption & Slide Dots */}
      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-4 py-3 flex items-end justify-between gap-3">
        {showCaptionOverlay ? (
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#D4AF37] uppercase tracking-wider truncate">
              {category}
            </p>
            <p className="text-sm font-display font-bold text-white truncate">{title}</p>
          </div>
        ) : (
          <div />
        )}

        {slides.length > 1 && (
          <div className="flex items-center gap-1.5 shrink-0">
            {slides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIndex(idx);
                }}
                aria-label={`Show slide ${idx + 1}`}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  idx === safeIndex
                    ? 'w-6 bg-[#D4AF37]'
                    : 'w-2 bg-white/60 hover:bg-white'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
