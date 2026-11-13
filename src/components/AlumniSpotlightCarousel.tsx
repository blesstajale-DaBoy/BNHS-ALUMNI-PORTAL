import React, { useState } from 'react';
import {
  Award,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Edit3,
  Trash2,
} from 'lucide-react';
import { SpotlightStoryRecord } from '../data/bnhsData';

interface AlumniSpotlightCarouselProps {
  stories: SpotlightStoryRecord[];
  onSelectBatchYear?: (year: number) => void;
  onOpenEditMenu: (tab: 'spotlights', itemId?: string | null) => void;
  onOpenDeleteMenu: (tab: 'spotlights', itemId?: string | null) => void;
}

export const AlumniSpotlightCarousel: React.FC<AlumniSpotlightCarouselProps> = ({
  stories,
  onSelectBatchYear,
  onOpenEditMenu,
  onOpenDeleteMenu,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const safeStories = stories.length > 0 ? stories : [];
  const safeIndex = safeStories.length > 0 ? currentIndex % safeStories.length : 0;
  const activeStory = safeStories[safeIndex];

  const handlePrev = () => {
    if (safeStories.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + safeStories.length) % safeStories.length);
  };

  const handleNext = () => {
    if (safeStories.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % safeStories.length);
  };

  const initials = activeStory
    ? (activeStory.nomineeName || 'BNHS')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('')
    : 'E';

  return (
    <div className="bg-[#450012] border border-[#D4AF37]/40 rounded-xl p-5 sm:p-8">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-white/15">
        <div>
          <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-bold">
            Barobo National High School · Eagle Excellence
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mt-1">
            BNHS Alumni Spotlight & Career Milestones
          </h2>
          <p className="text-sm text-white/80 mt-1.5 max-w-2xl leading-relaxed">
            Celebrating inspiring career milestones, community leadership, and achievements of Barobo National High School graduates across the globe.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onOpenEditMenu('spotlights', 'NEW')}
            className="px-4 py-2.5 rounded-lg bg-[#D4AF37] text-[#450012] font-bold text-xs sm:text-sm hover:bg-[#e3c14d] transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Add / Nominate Spotlight
          </button>
          {activeStory && (
            <>
              <button
                type="button"
                onClick={() => onOpenEditMenu('spotlights', activeStory.id)}
                className="px-3.5 py-2.5 rounded-lg bg-[#650019] border border-[#D4AF37]/50 text-[#D4AF37] font-bold text-xs sm:text-sm hover:bg-black/30 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Edit3 className="w-4 h-4" />
                Edit Story
              </button>
              <button
                type="button"
                onClick={() => onOpenDeleteMenu('spotlights', activeStory.id)}
                className="px-3.5 py-2.5 rounded-lg bg-red-700/90 border border-red-400/50 text-white font-bold text-xs sm:text-sm hover:bg-red-800 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main White Spotlight Carousel Card */}
      {!activeStory ? (
        <div className="mt-6 bg-white text-gray-900 rounded-xl p-8 text-center border border-gray-200">
          <p className="text-base font-bold text-gray-900">
            No spotlight stories currently displayed
          </p>
          <p className="text-xs text-gray-600 mt-1 mb-4">
            Click "Add / Nominate Spotlight" above to add an inspiring BNHS alumni career milestone.
          </p>
          <button
            type="button"
            onClick={() => onOpenEditMenu('spotlights', 'NEW')}
            className="px-4 py-2 rounded-lg bg-[#650019] text-white text-xs font-semibold hover:bg-[#450012] cursor-pointer"
          >
            Add First Spotlight Story
          </button>
        </div>
      ) : (
        <div className="mt-6 bg-white text-gray-900 rounded-xl p-5 sm:p-8 border border-gray-200">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
            {/* Left 4 Columns */}
            <div className="lg:col-span-4 flex flex-col justify-between bg-[#650019] text-white rounded-xl p-5 sm:p-6 border border-[#D4AF37]/40 h-full">
              <div>
                <div className="flex items-center justify-between gap-3 mb-5">
                  <div className="w-14 h-14 rounded-xl bg-[#450012] border-2 border-[#D4AF37] text-[#D4AF37] font-display text-xl font-bold flex items-center justify-center shrink-0">
                    {initials}
                  </div>
                  <Award className="w-7 h-7 text-[#D4AF37] shrink-0" />
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-[#D4AF37]">
                  <span className="font-mono-num">CLASS OF {activeStory.graduationYear}</span>
                  <span aria-hidden="true">·</span>
                  <span>{activeStory.strand}</span>
                </div>

                <h3 className="font-display text-xl font-bold text-white mt-1.5">
                  {activeStory.nomineeName}
                </h3>
                <p className="text-xs text-white/85 mt-1 font-medium leading-relaxed">
                  {activeStory.profession}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-white/15 flex items-center justify-between text-xs text-white/75">
                <span>Nominated by {activeStory.nominatorName}</span>
                {onSelectBatchYear && (
                  <button
                    type="button"
                    onClick={() => onSelectBatchYear(activeStory.graduationYear)}
                    className="text-[#D4AF37] font-bold hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Batch {activeStory.graduationYear} →
                  </button>
                )}
              </div>
            </div>

            {/* Right 8 Columns */}
            <div className="lg:col-span-8 flex flex-col justify-between h-full">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#650019] font-bold uppercase tracking-wider mb-2">
                  <span>Featured Career Milestone & Success Story</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono-num text-gray-500">
                      Story {String(safeIndex + 1).padStart(2, '0')} /{' '}
                      {String(safeStories.length).padStart(2, '0')}
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenEditMenu('spotlights', activeStory.id)}
                      className="px-2.5 py-1 rounded border border-[#650019]/30 text-[#650019] hover:bg-[#650019] hover:text-white transition-colors normal-case inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenDeleteMenu('spotlights', activeStory.id)}
                      className="px-2.5 py-1 rounded border border-red-200 text-red-700 hover:bg-red-600 hover:text-white transition-colors normal-case inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </div>
                </div>

                <h4 className="font-display text-xl sm:text-2xl font-bold text-gray-900 leading-snug">
                  {activeStory.milestoneTitle}
                </h4>

                <blockquote className="mt-4 text-sm sm:text-base text-gray-700 leading-relaxed italic border-y border-gray-100 py-4">
                  "{activeStory.story}"
                </blockquote>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  {safeStories.map((st, idx) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setCurrentIndex(idx)}
                      aria-label={`View spotlight story ${idx + 1}: ${st.nomineeName}`}
                      className={`h-2.5 rounded-full transition-all cursor-pointer ${
                        idx === safeIndex
                          ? 'w-8 bg-[#650019]'
                          : 'w-2.5 bg-gray-300 hover:bg-gray-400'
                      }`}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrev}
                    aria-label="Previous spotlight story"
                    className="px-3.5 py-2 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 hover:border-[#650019] hover:text-[#650019] transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    aria-label="Next spotlight story"
                    className="px-3.5 py-2 rounded-lg bg-[#650019] text-white text-xs font-semibold hover:bg-[#450012] transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Next Story
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
