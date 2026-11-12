import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  UserCheck,
  Briefcase,
  GraduationCap,
  MapPin,
  X,
  SlidersHorizontal,
  ArrowUpRight,
  Edit3,
  Upload,
  Link2,
  Save,
  Calendar,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { AlumniProfileRecord, PortalSettingsRecord } from '../data/bnhsData';
import {
  ALLOWED_INDUSTRY_SECTORS,
  ALLOWED_STRANDS,
  AlumniStrand,
  fileToCompressedDataUrl,
  generateDynamicBatchRanges,
  getCurrentMaxGraduationYear,
  MentorshipRole,
  normalizeImageUrl,
  sanitizeString,
} from '../lib/firebase';
import { AlumniInsightsSection } from './AlumniInsightsSection';

interface DirectoryModuleProps {
  alumniList: AlumniProfileRecord[];
  currentUserUid?: string;
  initialYearFilter?: string;
  initialCityFilter?: string;
  portalSettings: PortalSettingsRecord;
  onSavePortalSettings: (updates: Partial<PortalSettingsRecord>) => Promise<void>;
  onSaveAlumnusProfile: (updated: AlumniProfileRecord) => Promise<void>;
  onDeleteAlumnusProfile: (uid: string, fullName: string) => Promise<void>;
  onNavigateRegister: () => void;
}

export const DirectoryModule: React.FC<DirectoryModuleProps> = ({
  alumniList,
  currentUserUid,
  initialYearFilter,
  initialCityFilter,
  portalSettings,
  onSavePortalSettings,
  onSaveAlumnusProfile,
  onDeleteAlumnusProfile,
  onNavigateRegister,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStrand, setSelectedStrand] = useState<string>('ALL');
  const [selectedYear, setSelectedYear] = useState<string>(initialYearFilter || 'ALL');
  const [selectedCity, setSelectedCity] = useState<string>(initialCityFilter || 'ALL');
  const [selectedBatchRangeId, setSelectedBatchRangeId] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'density'>('grid');
  const [selectedAlumnus, setSelectedAlumnus] = useState<AlumniProfileRecord | null>(null);

  // Automatic batch range state (supports 2020-2026 and auto-creating 2027-2032)
  const hasFutureAlumni = useMemo(
    () => alumniList.some((a) => a.graduationYear >= 2027),
    [alumniList]
  );
  const [previewNewYearCycle, setPreviewNewYearCycle] = useState<boolean>(false);

  const effectiveMaxYear = useMemo(() => {
    const baseMax = getCurrentMaxGraduationYear();
    const highestInRegistry = alumniList.reduce(
      (max, a) => Math.max(max, a.graduationYear),
      baseMax
    );
    if (previewNewYearCycle || hasFutureAlumni) {
      return Math.max(highestInRegistry, 2032);
    }
    return highestInRegistry;
  }, [alumniList, previewNewYearCycle, hasFutureAlumni]);

  const dynamicBatchRanges = useMemo(
    () => generateDynamicBatchRanges(effectiveMaxYear),
    [effectiveMaxYear]
  );

  // Edit Directory Header Modal State
  const [showEditHeaderModal, setShowEditHeaderModal] = useState(false);
  const [editKicker, setEditKicker] = useState(portalSettings.directoryKicker || '');
  const [editTitle, setEditTitle] = useState(portalSettings.directoryTitle || '');
  const [editDescription, setEditDescription] = useState(portalSettings.directoryDescription || '');
  const [savingHeader, setSavingHeader] = useState(false);
  const [directoryFeedback, setDirectoryFeedback] = useState<string | null>(null);

  // Edit Individual Alumnus Modal State
  const [editingAlumnus, setEditingAlumnus] = useState<AlumniProfileRecord | null>(null);
  const [alumFullName, setAlumFullName] = useState('');
  const [alumGradYear, setAlumGradYear] = useState<number>(2026);
  const [alumStrand, setAlumStrand] = useState<AlumniStrand>('STEM');
  const [alumSection, setAlumSection] = useState('');
  const [alumCourse, setAlumCourse] = useState('');
  const [alumProfession, setAlumProfession] = useState('');
  const [alumEmployment, setAlumEmployment] = useState('');
  const [alumCity, setAlumCity] = useState('');
  const [alumBio, setAlumBio] = useState('');
  const [alumMentorship, setAlumMentorship] = useState<MentorshipRole>('mentor');
  const [alumIndustry, setAlumIndustry] = useState('Engineering & Architecture');
  const [alumPhotoUrl, setAlumPhotoUrl] = useState('');
  const [alumPhotoMode, setAlumPhotoMode] = useState<'local' | 'link'>('local');
  const [alumPhotoLink, setAlumPhotoLink] = useState('');
  const [savingAlumnus, setSavingAlumnus] = useState(false);
  const alumFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setEditKicker(portalSettings.directoryKicker || '');
    setEditTitle(portalSettings.directoryTitle || '');
    setEditDescription(portalSettings.directoryDescription || '');
  }, [portalSettings]);

  useEffect(() => {
    if (initialYearFilter) {
      setSelectedYear(initialYearFilter);
      setViewMode('grid');
    }
  }, [initialYearFilter]);

  useEffect(() => {
    if (initialCityFilter) {
      setSelectedCity(initialCityFilter);
      setViewMode('grid');
    }
  }, [initialCityFilter]);

  const graduationYears = useMemo(() => {
    const yearsSet = new Set<number>(alumniList.map((a) => a.graduationYear));
    if (previewNewYearCycle) {
      for (let yr = 2027; yr <= 2032; yr++) {
        yearsSet.add(yr);
      }
    }
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [alumniList, previewNewYearCycle]);

  const distinctCities = useMemo(() => {
    const citiesSet = new Set<string>(alumniList.map((a) => a.locationCity.trim()).filter(Boolean));
    return Array.from(citiesSet).sort((a, b) => a.localeCompare(b));
  }, [alumniList]);

  const filteredAlumni = useMemo(() => {
    return alumniList.filter((alumnus) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        alumnus.fullName.toLowerCase().includes(q) ||
        alumnus.profession.toLowerCase().includes(q) ||
        alumnus.course.toLowerCase().includes(q) ||
        alumnus.currentEmployment.toLowerCase().includes(q) ||
        alumnus.formerSection.toLowerCase().includes(q) ||
        alumnus.strand.toLowerCase().includes(q) ||
        alumnus.locationCity.toLowerCase().includes(q) ||
        String(alumnus.graduationYear).includes(q);

      const matchesStrand = selectedStrand === 'ALL' || alumnus.strand === selectedStrand;
      const matchesYear = selectedYear === 'ALL' || String(alumnus.graduationYear) === selectedYear;
      const matchesCity = selectedCity === 'ALL' || alumnus.locationCity.trim() === selectedCity;

      let matchesBatchRange = true;
      if (selectedBatchRangeId !== 'ALL') {
        const rangeObj = dynamicBatchRanges.find((r) => r.id === selectedBatchRangeId);
        if (rangeObj) {
          matchesBatchRange =
            alumnus.graduationYear >= rangeObj.minYear &&
            alumnus.graduationYear <= rangeObj.maxYear;
        }
      }

      return matchesQuery && matchesStrand && matchesYear && matchesCity && matchesBatchRange;
    });
  }, [
    alumniList,
    searchQuery,
    selectedStrand,
    selectedYear,
    selectedCity,
    selectedBatchRangeId,
    dynamicBatchRanges,
  ]);

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedStrand('ALL');
    setSelectedYear('ALL');
    setSelectedCity('ALL');
    setSelectedBatchRangeId('ALL');
  };

  const handleSaveDirectoryHeader = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingHeader(true);
    try {
      await onSavePortalSettings({
        directoryKicker: sanitizeString(editKicker, 120),
        directoryTitle: sanitizeString(editTitle, 140),
        directoryDescription: sanitizeString(editDescription, 500),
      });
      setShowEditHeaderModal(false);
      setDirectoryFeedback('Directory section header and description updated!');
    } finally {
      setSavingHeader(false);
    }
  };

  const openEditAlumnusModal = (alumnus: AlumniProfileRecord) => {
    setEditingAlumnus(alumnus);
    setAlumFullName(alumnus.fullName || '');
    setAlumGradYear(alumnus.graduationYear || 2026);
    setAlumStrand(alumnus.strand || 'STEM');
    setAlumSection(alumnus.formerSection || '');
    setAlumCourse(alumnus.course || '');
    setAlumProfession(alumnus.profession || '');
    setAlumEmployment(alumnus.currentEmployment || '');
    setAlumCity(alumnus.locationCity || '');
    setAlumBio(alumnus.bio || '');
    setAlumMentorship(alumnus.mentorshipRole || 'mentor');
    setAlumIndustry(alumnus.industrySector || 'Engineering & Architecture');
    setAlumPhotoUrl(alumnus.photoUrl || '');
    setAlumPhotoLink(alumnus.photoUrl?.startsWith('http') ? alumnus.photoUrl : '');
  };

  const handleDeleteAlumnus = async (alumnus: AlumniProfileRecord) => {
    await onDeleteAlumnusProfile(alumnus.uid, alumnus.fullName);
    if (selectedAlumnus?.uid === alumnus.uid) {
      setSelectedAlumnus(null);
    }
    if (editingAlumnus?.uid === alumnus.uid) {
      setEditingAlumnus(null);
    }
    setDirectoryFeedback(`Removed "${alumnus.fullName}" from the BNHS Alumni Directory.`);
  };

  const handleAlumPhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToCompressedDataUrl(file, 360, 0.82);
      setAlumPhotoUrl(dataUrl);
    } catch (err) {
      console.error('Failed to process photo:', err);
    } finally {
      if (alumFileInputRef.current) {
        alumFileInputRef.current.value = '';
      }
    }
  };

  const handleSaveAlumnusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAlumnus) return;

    setSavingAlumnus(true);
    try {
      const finalPhoto =
        alumPhotoMode === 'link' && alumPhotoLink.trim()
          ? normalizeImageUrl(alumPhotoLink)
          : alumPhotoUrl;

      const updatedRecord: AlumniProfileRecord = {
        ...editingAlumnus,
        fullName: sanitizeString(alumFullName, 100),
        graduationYear: Number(alumGradYear),
        strand: alumStrand,
        formerSection: sanitizeString(alumSection, 60),
        course: sanitizeString(alumCourse, 120),
        profession: sanitizeString(alumProfession, 100),
        currentEmployment: sanitizeString(alumEmployment, 120),
        locationCity: sanitizeString(alumCity, 100),
        bio: sanitizeString(alumBio, 600),
        mentorshipRole: alumMentorship,
        industrySector: sanitizeString(alumIndustry, 80),
        photoUrl: sanitizeString(finalPhoto, 150000),
        visibility: 'public',
      };

      await onSaveAlumnusProfile(updatedRecord);
      setEditingAlumnus(null);
      if (selectedAlumnus?.uid === updatedRecord.uid) {
        setSelectedAlumnus(updatedRecord);
      }
      setDirectoryFeedback(`Updated alumni directory record for ${updatedRecord.fullName}.`);
    } finally {
      setSavingAlumnus(false);
    }
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {directoryFeedback && (
        <div className="mb-6 p-4 rounded-xl bg-[#450012] border border-[#D4AF37] text-white text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#D4AF37] shrink-0" />
            {directoryFeedback}
          </span>
          <button
            type="button"
            onClick={() => setDirectoryFeedback(null)}
            className="text-[#D4AF37] hover:underline text-xs ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header Banner with Edit Menu */}
      <div className="bg-[#450012] border border-[#D4AF37]/30 rounded-xl p-6 sm:p-8 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold">
                {portalSettings.directoryKicker}
              </p>
              <button
                type="button"
                onClick={() => setShowEditHeaderModal(true)}
                className="px-2.5 py-1 rounded-md bg-[#650019] border border-[#D4AF37]/40 text-[11px] font-bold text-[#D4AF37] hover:bg-black/30 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3 h-3" />
                Edit Directory Section Text
              </button>
            </div>
            <h1 className="font-display text-2xl sm:text-4xl font-bold text-white tracking-tight">
              {portalSettings.directoryTitle}
            </h1>
            <p className="text-white/80 text-sm sm:text-base mt-2 max-w-2xl leading-relaxed">
              {portalSettings.directoryDescription}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="flex items-center gap-1 bg-[#650019] p-1 rounded-lg border border-white/10">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-[#D4AF37] text-[#450012]'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                Alumni Profiles ({filteredAlumni.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('density')}
                className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === 'density'
                    ? 'bg-[#D4AF37] text-[#450012]'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                City & Batch Analytics
              </button>
            </div>
            <button
              type="button"
              onClick={onNavigateRegister}
              className="px-5 py-3 rounded-lg bg-[#D4AF37] text-[#450012] font-semibold text-sm hover:bg-[#e3c14d] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {currentUserUid ? 'Update My Directory Profile' : 'Register in Directory'}
            </button>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="mt-8 pt-6 border-t border-white/15 grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery ?? ''}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, section, strand, course, profession, or city..."
              aria-label="Search alumni directory"
              className="w-full pl-10 pr-9 py-2.5 bg-white text-gray-900 rounded-lg text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search query"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="md:col-span-2">
            <select
              value={selectedYear ?? 'ALL'}
              onChange={(e) => setSelectedYear(e.target.value)}
              aria-label="Filter by graduation year"
              className="w-full px-3 py-2.5 bg-white text-gray-900 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
            >
              <option value="ALL">All Years</option>
              {graduationYears.map((yr) => (
                <option key={yr} value={String(yr)}>
                  Batch {yr}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={selectedStrand ?? 'ALL'}
              onChange={(e) => setSelectedStrand(e.target.value)}
              aria-label="Filter by strand or curriculum"
              className="w-full px-3 py-2.5 bg-white text-gray-900 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
            >
              <option value="ALL">All Strands</option>
              {ALLOWED_STRANDS.map((strand) => (
                <option key={strand} value={strand}>
                  {strand}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              value={selectedCity ?? 'ALL'}
              onChange={(e) => setSelectedCity(e.target.value)}
              aria-label="Filter by city"
              className="w-full px-3 py-2.5 bg-white text-gray-900 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
            >
              <option value="ALL">All Cities ({distinctCities.length})</option>
              {distinctCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dynamic Auto-Generated Batch Era Filter Controls (e.g. 2020-2026 and 2027-2032) */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-1.5 bg-[#650019] p-1 rounded-lg border border-white/10">
              <button
                type="button"
                onClick={() => setSelectedBatchRangeId('ALL')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedBatchRangeId === 'ALL'
                    ? 'bg-[#D4AF37] text-[#450012]'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                All Batches
              </button>
              {dynamicBatchRanges.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedBatchRangeId(tab.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-mono-num font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedBatchRangeId === tab.id
                      ? 'bg-[#D4AF37] text-[#450012]'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {!hasFutureAlumni && (
              <button
                type="button"
                onClick={() => {
                  const next = !previewNewYearCycle;
                  setPreviewNewYearCycle(next);
                  if (!next && selectedBatchRangeId === '2027_2032') {
                    setSelectedBatchRangeId('ALL');
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-[#650019] border border-[#D4AF37]/40 text-xs font-semibold text-[#D4AF37] hover:bg-black/25 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5" />
                {previewNewYearCycle
                  ? '2027–2032 Auto-Batch Active'
                  : '+ Auto-Create New Year Batch (2027–2032)'}
              </button>
            )}
          </div>

          {(searchQuery ||
            selectedStrand !== 'ALL' ||
            selectedYear !== 'ALL' ||
            selectedCity !== 'ALL' ||
            selectedBatchRangeId !== 'ALL') && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-[#D4AF37] hover:underline font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Reset Active Filters ({filteredAlumni.length} shown)
            </button>
          )}
        </div>
      </div>

      {viewMode === 'density' ? (
        <AlumniInsightsSection
          alumniList={alumniList}
          onFilterByBatchYear={(yr) => {
            setSelectedYear(String(yr));
            setSelectedCity('ALL');
            setViewMode('grid');
          }}
          onFilterByCity={(city) => {
            setSelectedCity(city);
            setSelectedYear('ALL');
            setViewMode('grid');
          }}
          onNavigateRegister={onNavigateRegister}
        />
      ) : filteredAlumni.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
          <p className="text-lg font-bold text-gray-900 mb-1">
            No matching BNHS alumni records found
          </p>
          <p className="text-sm text-gray-600 max-w-md mx-auto mb-6">
            Try clearing your search terms or selecting a different graduation batch or strand filter.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="px-4 py-2 bg-[#650019] text-white text-xs font-semibold rounded-lg hover:bg-[#450012] transition-colors cursor-pointer"
          >
            Show All Registered Alumni
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAlumni.map((alumnus) => {
            const isCurrentUser = currentUserUid && alumnus.uid === currentUserUid;
            const initials = alumnus.fullName
              .split(' ')
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0]?.toUpperCase())
              .join('');

            return (
              <article
                key={alumnus.uid}
                onClick={() => setSelectedAlumnus(alumnus)}
                className="bg-white text-gray-900 rounded-xl p-6 border border-gray-200 hover:border-[#D4AF37] transition-all flex flex-col justify-between cursor-pointer group"
              >
                <div>
                  {/* Clean unboxed metadata kicker per Zero-Pill Discipline */}
                  <div className="flex items-center justify-between gap-2 text-xs text-gray-500 mb-3">
                    <div className="flex items-center gap-1.5 font-medium text-[#650019]">
                      <span className="font-mono-num font-bold">Batch {alumnus.graduationYear}</span>
                      <span aria-hidden="true">·</span>
                      <span>{alumnus.strand}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate max-w-[130px]">{alumnus.formerSection}</span>
                    </div>
                    {isCurrentUser && (
                      <span className="text-xs font-semibold text-[#650019] underline">
                        Your Profile
                      </span>
                    )}
                  </div>

                  {/* Alumnus Avatar (Photo or Initials) & Primary Name */}
                  <div className="flex items-start gap-3.5 mb-4">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#650019] text-[#D4AF37] font-display font-bold text-base flex items-center justify-center shrink-0 border border-[#D4AF37]/40">
                      {alumnus.photoUrl ? (
                        <img
                          src={alumnus.photoUrl}
                          alt={alumnus.fullName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{initials}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base font-bold text-gray-900 group-hover:text-[#650019] transition-colors leading-snug">
                        {alumnus.fullName}
                      </h2>
                      <p className="text-xs font-semibold text-gray-700 mt-0.5">
                        {alumnus.profession}
                      </p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {alumnus.currentEmployment}
                      </p>
                    </div>
                  </div>

                  {/* Academic & Location Details */}
                  <div className="pt-3 border-t border-gray-100 space-y-1.5 text-xs text-gray-600">
                    <p className="truncate">
                      <span className="font-semibold text-gray-800">Degree/Course:</span>{' '}
                      {alumnus.course}
                    </p>
                    <p className="truncate">
                      <span className="font-semibold text-gray-800">Location:</span>{' '}
                      {alumnus.locationCity}
                    </p>
                  </div>

                  <p className="mt-3 text-xs text-gray-600 line-clamp-2 italic leading-relaxed">
                    "{alumnus.bio}"
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between gap-2 text-xs font-semibold text-[#650019]">
                  <span className="inline-flex items-center gap-1">
                    View Details
                    <ArrowUpRight className="w-3.5 h-3.5 text-[#650019] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </span>
                  <div
                    className="flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => openEditAlumnusModal(alumnus)}
                      className="px-2.5 py-1 rounded-md border border-[#650019]/30 text-[#650019] hover:bg-[#650019] hover:text-white transition-colors inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAlumnus(alumnus)}
                      className="px-2.5 py-1 rounded-md border border-red-200 text-red-700 hover:bg-red-600 hover:text-white transition-colors inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Detailed Alumni Profile Modal */}
      {selectedAlumnus && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setSelectedAlumnus(null)}
        >
          <div
            className="bg-white text-gray-900 rounded-xl max-w-2xl w-full overflow-hidden border border-[#D4AF37]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Maroon Modal Header */}
            <div className="bg-[#450012] text-white p-6 sm:p-8 border-b border-[#D4AF37]/40 flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#650019] border-2 border-[#D4AF37] text-[#D4AF37] font-display text-xl font-bold flex items-center justify-center shrink-0">
                  {selectedAlumnus.photoUrl ? (
                    <img
                      src={selectedAlumnus.photoUrl}
                      alt={selectedAlumnus.fullName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>
                      {selectedAlumnus.fullName
                        .split(' ')
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((n) => n[0]?.toUpperCase())
                        .join('')}
                    </span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 text-xs text-[#D4AF37] font-semibold">
                    <span className="font-mono-num">CLASS OF {selectedAlumnus.graduationYear}</span>
                    <span aria-hidden="true">·</span>
                    <span>{selectedAlumnus.strand}</span>
                    <span aria-hidden="true">·</span>
                    <span>{selectedAlumnus.formerSection}</span>
                  </div>
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-white mt-1">
                    {selectedAlumnus.fullName}
                  </h2>
                  <p className="text-sm text-white/85 mt-0.5">
                    {selectedAlumnus.profession}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAlumnus(null)}
                aria-label="Close alumni profile modal"
                className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* White Card Profile Body */}
            <div className="p-6 sm:p-8 space-y-6">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-5 rounded-lg border border-gray-200">
                <div>
                  <dt className="text-xs uppercase tracking-wider text-gray-500 font-semibold flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-[#650019]" />
                    Graduation Year & Section
                  </dt>
                  <dd className="text-sm font-bold text-gray-900 mt-1 font-mono-num">
                    Batch {selectedAlumnus.graduationYear} · {selectedAlumnus.formerSection}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                    Curriculum / SHS Strand
                  </dt>
                  <dd className="text-sm font-bold text-gray-900 mt-1">
                    {selectedAlumnus.strand}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                    Tertiary Degree / Course
                  </dt>
                  <dd className="text-sm font-semibold text-gray-900 mt-1">
                    {selectedAlumnus.course}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs uppercase tracking-wider text-gray-500 font-semibold flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-[#650019]" />
                    Current Employment
                  </dt>
                  <dd className="text-sm font-semibold text-gray-900 mt-1">
                    {selectedAlumnus.currentEmployment}
                  </dd>
                </div>

                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase tracking-wider text-gray-500 font-semibold flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#650019]" />
                    Current Residence / Chapter Location
                  </dt>
                  <dd className="text-sm font-semibold text-gray-900 mt-1">
                    {selectedAlumnus.locationCity}
                  </dd>
                </div>
              </dl>

              <div>
                <h3 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">
                  Alumni Message & BNHS Legacy Note
                </h3>
                <p className="text-sm text-gray-800 leading-relaxed bg-white p-4 rounded-lg border border-gray-200 italic">
                  "{selectedAlumnus.bio}"
                </p>
              </div>

              <div className="pt-4 border-t border-gray-200 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <UserCheck className="w-4 h-4 text-[#650019]" />
                  <span>
                    Personal contact information is protected under BNHS Alumni Privacy Rules.
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => openEditAlumnusModal(selectedAlumnus)}
                    className="px-4 py-2.5 bg-[#D4AF37] text-[#450012] text-xs font-bold rounded-lg hover:bg-[#e3c14d] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit Record & Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteAlumnus(selectedAlumnus)}
                    className="px-4 py-2.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Record
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedAlumnus(null)}
                    className="px-5 py-2.5 bg-[#650019] text-white text-xs font-semibold rounded-lg hover:bg-[#450012] transition-colors cursor-pointer"
                  >
                    Close Profile
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 1: Edit Directory Section Text (Heading & Description) */}
      {showEditHeaderModal && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowEditHeaderModal(false)}
        >
          <div
            className="bg-white text-gray-900 rounded-xl max-w-lg w-full overflow-hidden border border-[#D4AF37]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#450012] text-white p-6 flex items-center justify-between border-b border-[#D4AF37]/30">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold">
                  Directory Administration
                </p>
                <h2 className="font-display text-xl font-bold mt-0.5">
                  Edit Alumni Directory Header
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowEditHeaderModal(false)}
                className="text-white/70 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDirectoryHeader} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Registry Kicker Text *
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={120}
                  value={editKicker ?? ''}
                  onChange={(e) => setEditKicker(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Directory Title *
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={140}
                  value={editTitle ?? ''}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Directory Description *
                </label>
                <textarea
                  rows={4}
                  required
                  minLength={10}
                  maxLength={500}
                  value={editDescription ?? ''}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                />
              </div>

              <div className="pt-3 border-t border-gray-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditHeaderModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingHeader}
                  className="px-5 py-2 rounded-lg bg-[#650019] text-white text-xs font-semibold hover:bg-[#450012] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5 text-[#D4AF37]" />
                  {savingHeader ? 'Saving...' : 'Save Directory Header'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Edit Alumnus Directory Record & Photo */}
      {editingAlumnus && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setEditingAlumnus(null)}
        >
          <div
            className="bg-white text-gray-900 rounded-xl max-w-2xl w-full overflow-hidden border border-[#D4AF37] my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#450012] text-white p-6 flex items-center justify-between border-b border-[#D4AF37]/30">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold">
                  BNHS Directory Record Editor
                </p>
                <h2 className="font-display text-xl font-bold mt-0.5">
                  Edit Profile: {editingAlumnus.fullName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditingAlumnus(null)}
                className="text-white/70 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveAlumnusSubmit}
              className="p-6 space-y-4 max-h-[80vh] overflow-y-auto"
            >
              {/* Photo Upload or Google Link */}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#650019]">
                    Alumni Profile Photo (Local Upload or Google Link)
                  </span>
                  <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-300">
                    <button
                      type="button"
                      onClick={() => setAlumPhotoMode('local')}
                      className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                        alumPhotoMode === 'local'
                          ? 'bg-[#650019] text-white'
                          : 'text-gray-700'
                      }`}
                    >
                      Local File
                    </button>
                    <button
                      type="button"
                      onClick={() => setAlumPhotoMode('link')}
                      className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                        alumPhotoMode === 'link'
                          ? 'bg-[#650019] text-white'
                          : 'text-gray-700'
                      }`}
                    >
                      Google Link
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#650019] border border-[#D4AF37] text-[#D4AF37] font-display font-bold text-lg flex items-center justify-center shrink-0">
                    {alumPhotoUrl ? (
                      <img
                        src={alumPhotoUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{alumFullName[0]?.toUpperCase() || 'E'}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    {alumPhotoMode === 'local' ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          ref={alumFileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleAlumPhotoFileChange}
                          className="hidden"
                          id="dir-edit-photo-file"
                        />
                        <label
                          htmlFor="dir-edit-photo-file"
                          className="px-3.5 py-2 rounded-lg bg-[#650019] text-white text-xs font-bold hover:bg-[#450012] inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5 text-[#D4AF37]" />
                          Upload Local Photo
                        </label>
                        {alumPhotoUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              setAlumPhotoUrl('');
                              setAlumPhotoLink('');
                            }}
                            className="px-3 py-2 rounded-lg border border-red-200 text-red-700 text-xs font-semibold cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={alumPhotoLink ?? ''}
                          onChange={(e) => {
                            setAlumPhotoLink(e.target.value);
                            setAlumPhotoUrl(normalizeImageUrl(e.target.value));
                          }}
                          placeholder="Paste Google Drive or web image link..."
                          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => setAlumPhotoUrl(normalizeImageUrl(alumPhotoLink))}
                          className="px-3 py-2 rounded-lg bg-[#650019] text-white text-xs font-bold cursor-pointer"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={alumFullName ?? ''}
                    onChange={(e) => setAlumFullName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Graduation Year (1982–2032) *
                  </label>
                  <input
                    type="number"
                    min={1982}
                    max={2035}
                    required
                    value={alumGradYear ?? 2026}
                    onChange={(e) => setAlumGradYear(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm font-mono-num"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Strand / Curriculum *
                  </label>
                  <select
                    value={alumStrand ?? 'STEM'}
                    onChange={(e) => setAlumStrand(e.target.value as AlumniStrand)}
                    className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                  >
                    {ALLOWED_STRANDS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Former Section *
                  </label>
                  <input
                    type="text"
                    required
                    value={alumSection ?? ''}
                    onChange={(e) => setAlumSection(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Tertiary Degree / Course *
                  </label>
                  <input
                    type="text"
                    required
                    value={alumCourse ?? ''}
                    onChange={(e) => setAlumCourse(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Profession *
                  </label>
                  <input
                    type="text"
                    required
                    value={alumProfession ?? ''}
                    onChange={(e) => setAlumProfession(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Current Employment *
                  </label>
                  <input
                    type="text"
                    required
                    value={alumEmployment ?? ''}
                    onChange={(e) => setAlumEmployment(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Current City & Province *
                  </label>
                  <input
                    type="text"
                    required
                    value={alumCity ?? ''}
                    onChange={(e) => setAlumCity(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Industry Sector *
                  </label>
                  <select
                    value={alumIndustry ?? 'Engineering & Architecture'}
                    onChange={(e) => setAlumIndustry(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                  >
                    {ALLOWED_INDUSTRY_SECTORS.map((sec) => (
                      <option key={sec} value={sec}>
                        {sec}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Bio / BNHS Legacy Message *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={alumBio ?? ''}
                    onChange={(e) => setAlumBio(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => handleDeleteAlumnus(editingAlumnus)}
                  className="px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-bold hover:bg-red-600 hover:text-white transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Profile
                </button>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingAlumnus(null)}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingAlumnus}
                    className="px-5 py-2 rounded-lg bg-[#650019] text-white text-xs font-semibold hover:bg-[#450012] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5 text-[#D4AF37]" />
                    {savingAlumnus ? 'Saving...' : 'Save Alumni Profile'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
