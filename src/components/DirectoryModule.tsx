import React, { useEffect, useMemo, useState } from 'react';
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
  Calendar,
  Trash2,
} from 'lucide-react';
import { AlumniProfileRecord, PortalSettingsRecord } from '../data/bnhsData';
import {
  ALLOWED_STRANDS,
  generateDynamicBatchRanges,
  getCurrentMaxGraduationYear,
} from '../lib/firebase';
import { AlumniInsightsSection } from './AlumniInsightsSection';

interface DirectoryModuleProps {
  alumniList: AlumniProfileRecord[];
  currentUserUid?: string;
  initialYearFilter?: string;
  initialCityFilter?: string;
  portalSettings: PortalSettingsRecord;
  onNavigateRegister: () => void;
  onOpenEditMenu: (tab: 'directory' | 'branding', itemId?: string | null) => void;
  onOpenDeleteMenu: (tab: 'directory', itemId?: string | null) => void;
}

export const DirectoryModule: React.FC<DirectoryModuleProps> = ({
  alumniList,
  currentUserUid,
  initialYearFilter,
  initialCityFilter,
  portalSettings,
  onNavigateRegister,
  onOpenEditMenu,
  onOpenDeleteMenu,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStrand, setSelectedStrand] = useState<string>('ALL');
  const [selectedYear, setSelectedYear] = useState<string>(initialYearFilter || 'ALL');
  const [selectedCity, setSelectedCity] = useState<string>(initialCityFilter || 'ALL');
  const [selectedBatchRangeId, setSelectedBatchRangeId] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'density'>('grid');
  const [selectedAlumnus, setSelectedAlumnus] = useState<AlumniProfileRecord | null>(null);

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

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header Banner */}
      <div className="bg-[#450012] border border-[#D4AF37]/30 rounded-xl p-6 sm:p-8 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold mb-2">
              {portalSettings.directoryKicker}
            </p>
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

        {/* Dynamic Auto-Generated Batch Era Filter Controls */}
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
                      onClick={() => onOpenEditMenu('directory', alumnus.uid)}
                      className="px-2.5 py-1 rounded-md border border-[#650019]/30 text-[#650019] hover:bg-[#650019] hover:text-white transition-colors inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenDeleteMenu('directory', alumnus.uid)}
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
                    onClick={() => {
                      const uid = selectedAlumnus.uid;
                      setSelectedAlumnus(null);
                      onOpenEditMenu('directory', uid);
                    }}
                    className="px-4 py-2.5 bg-[#D4AF37] text-[#450012] text-xs font-bold rounded-lg hover:bg-[#e3c14d] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit in Edit Menu
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const uid = selectedAlumnus.uid;
                      setSelectedAlumnus(null);
                      onOpenDeleteMenu('directory', uid);
                    }}
                    className="px-4 py-2.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete in Delete Menu
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
    </section>
  );
};
