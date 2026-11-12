import React, { useState } from 'react';
import { User } from 'firebase/auth';
import {
  Award,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  X,
  CheckCircle2,
  Edit3,
  Trash2,
  Save,
} from 'lucide-react';
import {
  ALLOWED_STRANDS,
  AlumniStrand,
  getCurrentMaxGraduationYear,
  sanitizeId,
  sanitizeString,
} from '../lib/firebase';
import { AlumniProfileRecord, SpotlightStoryRecord } from '../data/bnhsData';

interface AlumniSpotlightCarouselProps {
  stories: SpotlightStoryRecord[];
  currentUser: User | null;
  userProfile: AlumniProfileRecord | null;
  onSignIn: () => Promise<void>;
  onSaveSpotlight: (storyData: SpotlightStoryRecord, isNew: boolean) => Promise<void>;
  onDeleteSpotlight: (storyId: string, nomineeName: string) => Promise<void>;
  onSelectBatchYear?: (year: number) => void;
}

export const AlumniSpotlightCarousel: React.FC<AlumniSpotlightCarouselProps> = ({
  stories,
  currentUser,
  userProfile,
  onSaveSpotlight,
  onDeleteSpotlight,
  onSelectBatchYear,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showNominateModal, setShowNominateModal] = useState(false);
  const [editingStoryId, setEditingStoryId] = useState<string | null>(null);

  // Nomination / Edit Form State
  const maxYear = getCurrentMaxGraduationYear();
  const [nomineeName, setNomineeName] = useState('');
  const [graduationYear, setGraduationYear] = useState<number>(maxYear - 5);
  const [strand, setStrand] = useState<AlumniStrand>('STEM');
  const [profession, setProfession] = useState('');
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [story, setStory] = useState('');
  const [nominatorName, setNominatorName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [nominationSuccess, setNominationSuccess] = useState<string | null>(null);

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

  const yearsList = Array.from({ length: maxYear - 1982 + 1 }, (_, i) => maxYear - i);

  const openAddSpotlightModal = () => {
    setNominationSuccess(null);
    setEditingStoryId(null);
    setNomineeName('');
    setGraduationYear(maxYear - 5);
    setStrand('STEM');
    setProfession('');
    setMilestoneTitle('');
    setStory('');
    setNominatorName(
      userProfile?.fullName || currentUser?.displayName || 'BNHS Alumni Federation'
    );
    setShowNominateModal(true);
  };

  const openEditSpotlightModal = (st: SpotlightStoryRecord) => {
    setNominationSuccess(null);
    setEditingStoryId(st.id);
    setNomineeName(st.nomineeName || '');
    setGraduationYear(st.graduationYear || maxYear - 5);
    setStrand(st.strand || 'STEM');
    setProfession(st.profession || '');
    setMilestoneTitle(st.milestoneTitle || '');
    setStory(st.story || '');
    setNominatorName(st.nominatorName || 'BNHS Alumni Federation');
    setShowNominateModal(true);
  };

  const handleDeleteSpotlightClick = async (st: SpotlightStoryRecord) => {
    await onDeleteSpotlight(st.id, st.nomineeName);
    if (editingStoryId === st.id) {
      setShowNominateModal(false);
      setEditingStoryId(null);
    }
    setCurrentIndex(0);
    setNominationSuccess(
      `Deleted spotlight milestone for ${st.nomineeName} (Batch ${st.graduationYear}).`
    );
  };

  const handleSubmitNomination = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanNominee = sanitizeString(nomineeName, 100);
    const cleanProfession = sanitizeString(profession, 100);
    const cleanMilestone = sanitizeString(milestoneTitle, 140);
    const cleanStory = sanitizeString(story, 800);
    const cleanNominator = sanitizeString(
      nominatorName ||
        userProfile?.fullName ||
        currentUser?.displayName ||
        'BNHS Alumni Federation',
      100
    );

    if (
      cleanNominee.length < 2 ||
      cleanProfession.length < 2 ||
      cleanMilestone.length < 5 ||
      cleanStory.length < 15
    ) {
      return;
    }

    setSubmitting(true);
    const isNew = !editingStoryId;
    const nomId = editingStoryId || sanitizeId(`spot_${Date.now()}`);
    const storyRecord: SpotlightStoryRecord = {
      id: nomId,
      nominatorUid: currentUser?.uid || 'system_bnhs_admin',
      nominatorName: cleanNominator,
      nomineeName: cleanNominee,
      graduationYear: Number(graduationYear),
      strand,
      profession: cleanProfession,
      milestoneTitle: cleanMilestone,
      story: cleanStory,
      visibility: 'public',
    };

    try {
      await onSaveSpotlight(storyRecord, isNew);
      setShowNominateModal(false);
      setEditingStoryId(null);
      setNomineeName('');
      setProfession('');
      setMilestoneTitle('');
      setStory('');
      if (isNew) {
        setCurrentIndex(0);
      }
      setNominationSuccess(
        isNew
          ? `Added! Your Alumni Spotlight feature for ${cleanNominee} (Batch ${graduationYear}) is now live in the carousel.`
          : `Updated Alumni Spotlight milestone for ${cleanNominee} (Batch ${graduationYear}).`
      );
    } finally {
      setSubmitting(false);
    }
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
            onClick={openAddSpotlightModal}
            className="px-4 py-2.5 rounded-lg bg-[#D4AF37] text-[#450012] font-bold text-xs sm:text-sm hover:bg-[#e3c14d] transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Add / Nominate Spotlight
          </button>
          {activeStory && (
            <>
              <button
                type="button"
                onClick={() => openEditSpotlightModal(activeStory)}
                className="px-3.5 py-2.5 rounded-lg bg-[#650019] border border-[#D4AF37]/50 text-[#D4AF37] font-bold text-xs sm:text-sm hover:bg-black/30 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Edit3 className="w-4 h-4" />
                Edit Story
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSpotlightClick(activeStory)}
                className="px-3.5 py-2.5 rounded-lg bg-red-700/90 border border-red-400/50 text-white font-bold text-xs sm:text-sm hover:bg-red-800 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {nominationSuccess && (
        <div className="mt-5 p-4 rounded-lg bg-[#650019] border border-[#D4AF37] text-white text-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#D4AF37] shrink-0" />
            <span>{nominationSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setNominationSuccess(null)}
            className="text-xs text-[#D4AF37] hover:underline shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

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
            onClick={openAddSpotlightModal}
            className="px-4 py-2 rounded-lg bg-[#650019] text-white text-xs font-semibold hover:bg-[#450012] cursor-pointer"
          >
            Add First Spotlight Story
          </button>
        </div>
      ) : (
        <div className="mt-6 bg-white text-gray-900 rounded-xl p-5 sm:p-8 border border-gray-200">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
            {/* Left 4 Columns: Alumnus Crest Avatar & Batch Details */}
            <div className="lg:col-span-4 flex flex-col justify-between bg-[#650019] text-white rounded-xl p-5 sm:p-6 border border-[#D4AF37]/40 h-full">
              <div>
                <div className="flex items-center justify-between gap-3 mb-5">
                  <div className="w-14 h-14 rounded-xl bg-[#450012] border-2 border-[#D4AF37] text-[#D4AF37] font-display text-xl font-bold flex items-center justify-center shrink-0">
                    {initials}
                  </div>
                  <Award className="w-7 h-7 text-[#D4AF37] shrink-0" />
                </div>

                {/* Clean unboxed metadata per Zero-Pill Discipline */}
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

            {/* Right 8 Columns: Milestone Headline, Story Narrative & Carousel Controls */}
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
                      onClick={() => openEditSpotlightModal(activeStory)}
                      className="px-2.5 py-1 rounded border border-[#650019]/30 text-[#650019] hover:bg-[#650019] hover:text-white transition-colors normal-case inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSpotlightClick(activeStory)}
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

              {/* Carousel Controls */}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                {/* Slide Selector Buttons */}
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

      {/* Add / Edit Spotlight Modal */}
      {showNominateModal && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowNominateModal(false)}
        >
          <div
            className="bg-white text-gray-900 rounded-xl max-w-lg w-full overflow-hidden border border-[#D4AF37]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#450012] text-white p-6 flex items-center justify-between border-b border-[#D4AF37]/30">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold">
                  BNHS Alumni Honor Roll
                </p>
                <h3 className="font-display text-xl font-bold mt-0.5">
                  {editingStoryId
                    ? 'Edit Alumni Spotlight & Milestone'
                    : 'Add / Nominate an Alumnus for Spotlight'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNominateModal(false)}
                aria-label="Close nomination modal"
                className="text-white/70 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitNomination} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Nominee Full Name (2–100 chars) *
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={100}
                  value={nomineeName ?? ''}
                  onChange={(e) => setNomineeName(e.target.value)}
                  placeholder="e.g., Engr. Maria Clara D. Santos"
                  className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Graduation Year (1982–{maxYear}) *
                  </label>
                  <select
                    value={graduationYear ?? maxYear - 5}
                    onChange={(e) => setGraduationYear(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm font-mono-num"
                  >
                    {yearsList.map((yr) => (
                      <option key={yr} value={yr}>
                        Batch {yr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Strand / Curriculum *
                  </label>
                  <select
                    value={strand ?? 'STEM'}
                    onChange={(e) => setStrand(e.target.value as AlumniStrand)}
                    className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                  >
                    {ALLOWED_STRANDS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Current Profession & Organization *
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={100}
                    value={profession ?? ''}
                    onChange={(e) => setProfession(e.target.value)}
                    placeholder="e.g., Chief Agricultural Scientist · PhilRice"
                    className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Nominated By (Chapter / Name) *
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={100}
                    value={nominatorName ?? ''}
                    onChange={(e) => setNominatorName(e.target.value)}
                    placeholder="e.g., BNHS Alumni Federation"
                    className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Career Milestone Headline (5–140 chars) *
                </label>
                <input
                  type="text"
                  required
                  minLength={5}
                  maxLength={140}
                  value={milestoneTitle ?? ''}
                  onChange={(e) => setMilestoneTitle(e.target.value)}
                  placeholder="e.g., Developed Drought-Tolerant Rice Varieties for Caraga Farmers"
                  className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Success Story / Impact Summary (15–800 chars) *
                </label>
                <textarea
                  rows={4}
                  required
                  minLength={15}
                  maxLength={800}
                  value={story ?? ''}
                  onChange={(e) => setStory(e.target.value)}
                  placeholder="Share how this BNHS alumnus achieved this milestone and how their work uplifts their profession or community..."
                  className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                />
              </div>

              <div className="pt-3 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
                {editingStoryId ? (
                  <button
                    type="button"
                    onClick={() => {
                      const target = safeStories.find((s) => s.id === editingStoryId);
                      if (target) handleDeleteSpotlightClick(target);
                    }}
                    className="px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-bold hover:bg-red-600 hover:text-white transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Story
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowNominateModal(false)}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-lg bg-[#650019] text-white text-xs font-semibold hover:bg-[#450012] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5 text-[#D4AF37]" />
                    {submitting
                      ? 'Saving...'
                      : editingStoryId
                      ? 'Save Spotlight Changes'
                      : 'Submit Spotlight Feature'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

