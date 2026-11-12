import React, { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import {
  Award,
  Briefcase,
  Calendar,
  CheckCircle2,
  Edit3,
  Handshake,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import {
  ALLOWED_INDUSTRY_SECTORS,
  auth,
  db,
  handleFirestoreError,
  IndustrySector,
  MentorshipRole,
  OperationType,
  sanitizeString,
} from '../lib/firebase';
import {
  AlumniEventRecord,
  AlumniPrivateRecord,
  AlumniProfileRecord,
  BNHS_ASSETS,
  EventRsvpRecord,
} from '../data/bnhsData';
import { ResilientImage } from './ResilientImage';

interface AlumniDashboardProps {
  currentUser: User | null;
  userProfile: AlumniProfileRecord | null;
  userPrivate: AlumniPrivateRecord | null;
  userRsvps: Record<string, EventRsvpRecord>;
  allAlumni: AlumniProfileRecord[];
  events: AlumniEventRecord[];
  logoUrl?: string;
  logoAnimated?: boolean;
  authError?: string | null;
  onSignIn: () => Promise<void>;
  onDirectSignIn?: (fullName: string, email: string, graduationYear: number) => void;
  onSaveAlumnusProfile?: (updated: AlumniProfileRecord) => Promise<void>;
  onSignOut: () => Promise<void>;
  onNavigate: (tab: 'home' | 'directory' | 'register' | 'events' | 'announcements' | 'dashboard') => void;
}

interface MentorshipMatchItem {
  alumnus: AlumniProfileRecord;
  targetRoleLabel: string;
  compatibilityScore: number;
  matchReasons: string[];
}

export const AlumniDashboardModule: React.FC<AlumniDashboardProps> = ({
  currentUser,
  userProfile,
  userPrivate,
  userRsvps,
  allAlumni,
  events,
  logoUrl = BNHS_ASSETS.eagleCrest,
  logoAnimated = true,
  authError,
  onSignIn,
  onDirectSignIn,
  onSaveAlumnusProfile,
  onSignOut,
  onNavigate,
}) => {
  const [selectedRole, setSelectedRole] = useState<MentorshipRole>(
    userProfile?.mentorshipRole && userProfile.mentorshipRole !== 'none'
      ? userProfile.mentorshipRole
      : 'mentee'
  );
  const [selectedSector, setSelectedSector] = useState<string>(
    userProfile?.industrySector || 'Engineering & Architecture'
  );
  const [savingMentorship, setSavingMentorship] = useState(false);
  const [mentorshipSavedMsg, setMentorshipSavedMsg] = useState<string | null>(null);
  const [connectedUids, setConnectedUids] = useState<Record<string, boolean>>({});

  // Direct Portal Login Form State (works reliably on published domains without popup closing)
  const [loginName, setLoginName] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginBatchYear, setLoginBatchYear] = useState<number>(2020);
  const [localLoginError, setLocalLoginError] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile) {
      setSelectedRole(userProfile.mentorshipRole || 'mentee');
      setSelectedSector(userProfile.industrySector || 'Engineering & Architecture');
    }
  }, [userProfile]);

  const handleDirectLoginForm = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalLoginError(null);
    const cleanName = sanitizeString(loginName, 100);
    const cleanMail = sanitizeString(loginEmail, 120);
    if (cleanName.length < 2) {
      setLocalLoginError('Please enter your full name (at least 2 characters).');
      return;
    }
    if (cleanMail.length < 5 || !cleanMail.includes('@')) {
      setLocalLoginError('Please enter a valid email address.');
      return;
    }
    if (onDirectSignIn) {
      onDirectSignIn(cleanName, cleanMail, Number(loginBatchYear) || 2020);
    }
  };

  // Compute potential Mentor / Mentee matches based on profession, industrySector, and strand
  const potentialMatches = useMemo<MentorshipMatchItem[]>(() => {
    if (selectedRole === 'none') return [];

    const userProfLower = (userProfile?.profession || '').toLowerCase();
    const userStrand = userProfile?.strand || 'STEM';
    const userCity = userProfile?.locationCity || 'Barobo, Surigao del Sur';

    const candidates = allAlumni.filter((candidate) => {
      if (currentUser && candidate.uid === currentUser.uid) return false;
      if (!candidate.mentorshipRole || candidate.mentorshipRole === 'none') return false;

      if (selectedRole === 'mentee') {
        return candidate.mentorshipRole === 'mentor' || candidate.mentorshipRole === 'both';
      }
      if (selectedRole === 'mentor') {
        return candidate.mentorshipRole === 'mentee' || candidate.mentorshipRole === 'both';
      }
      // If 'both', match anyone who is mentor, mentee, or both
      return true;
    });

    const scored: MentorshipMatchItem[] = candidates.map((candidate) => {
      let score = 45;
      const reasons: string[] = [];

      if (candidate.industrySector === selectedSector) {
        score += 35;
        reasons.push(`Matched Industry: ${selectedSector}`);
      }

      if (candidate.strand === userStrand) {
        score += 10;
        reasons.push(`Shared ${userStrand} Track`);
      }

      if (
        userProfLower &&
        (candidate.profession.toLowerCase().includes(userProfLower.split(' ')[0]) ||
          candidate.course.toLowerCase().includes(userProfLower.split(' ')[0]))
      ) {
        score += 8;
        reasons.push('Aligned Career Field');
      }

      if (candidate.locationCity === userCity) {
        score += 6;
        reasons.push(`Same City Hub (${userCity.split(',')[0]})`);
      }

      if (reasons.length === 0) {
        reasons.push(`Cross-Disciplinary ${candidate.industrySector} Connection`);
      }

      const targetRoleLabel =
        selectedRole === 'mentee'
          ? 'Available Mentor'
          : selectedRole === 'mentor'
          ? 'Seeking Mentorship (Mentee)'
          : candidate.mentorshipRole === 'mentor'
          ? 'Available Mentor'
          : 'Peer / Mentee';

      return {
        alumnus: candidate,
        targetRoleLabel,
        compatibilityScore: Math.min(99, score),
        matchReasons: reasons,
      };
    });

    return scored.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
  }, [allAlumni, currentUser, selectedRole, selectedSector, userProfile]);

  const handleSaveMentorshipPreference = async (
    newRole: MentorshipRole,
    newSector: string
  ) => {
    setSelectedRole(newRole);
    setSelectedSector(newSector);
    setMentorshipSavedMsg(null);

    if (!currentUser || !userProfile) {
      setMentorshipSavedMsg(
        'Mentorship preview updated! Sign in and complete registration to persist your Mentor/Mentee status.'
      );
      return;
    }

    const cleanSector = sanitizeString(newSector, 80);
    const updatedProfile: AlumniProfileRecord = {
      ...userProfile,
      mentorshipRole: newRole,
      industrySector: cleanSector,
    };

    setSavingMentorship(true);
    try {
      if (onSaveAlumnusProfile) {
        await onSaveAlumnusProfile(updatedProfile);
      } else if (auth.currentUser && auth.currentUser.uid === currentUser.uid) {
        const profileRef = doc(db, 'alumni_profiles', currentUser.uid);
        const snap = await getDoc(profileRef);
        if (snap.exists()) {
          await updateDoc(profileRef, {
            mentorshipRole: newRole,
            industrySector: cleanSector,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(profileRef, {
            uid: currentUser.uid,
            fullName: sanitizeString(updatedProfile.fullName, 100),
            graduationYear: Number(updatedProfile.graduationYear) || 2020,
            formerSection: sanitizeString(updatedProfile.formerSection || 'Section A', 60),
            strand: updatedProfile.strand || 'STEM',
            course: sanitizeString(updatedProfile.course || 'BS Education', 120),
            profession: sanitizeString(updatedProfile.profession || 'Professional', 100),
            currentEmployment: sanitizeString(updatedProfile.currentEmployment || 'BNHS Chapter', 120),
            locationCity: sanitizeString(updatedProfile.locationCity || 'Barobo, Surigao del Sur', 100),
            bio: sanitizeString(updatedProfile.bio || 'Once a Student, Always an Eagle!', 600),
            mentorshipRole: newRole,
            industrySector: cleanSector,
            photoUrl: sanitizeString(updatedProfile.photoUrl || '', 150000),
            visibility: updatedProfile.visibility || 'public',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }
      setMentorshipSavedMsg(
        `Saved! You are now opted in as "${newRole.toUpperCase()}" under ${cleanSector}.`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `alumni_profiles/${currentUser.uid}`);
    } finally {
      setSavingMentorship(false);
    }
  };

  const activeRsvpList = Object.values(userRsvps).filter((r) => r.status !== 'cancelled');

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Top Authentication / Welcome Section */}
      {!currentUser ? (
        <div className="bg-[#450012] border border-[#D4AF37]/40 rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          {/* Left Institutional Heritage Column */}
          <div className="lg:col-span-6 p-8 sm:p-10 flex flex-col justify-between bg-gradient-to-br from-[#650019] to-[#450012] border-b lg:border-b-0 lg:border-r border-[#D4AF37]/30">
            <div>
              <div className="flex items-center gap-4 mb-6">
                <div
                  className={`w-16 h-16 rounded-xl overflow-hidden border-2 border-[#D4AF37] shrink-0 bg-white ${
                    logoAnimated ? 'animate-bnhs-seal' : ''
                  }`}
                >
                  <ResilientImage
                    src={logoUrl}
                    alt="Barobo National High School Official Crest"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold">
                    Est. 1978 · Batch 1982–Present
                  </p>
                  <h1 className="font-display text-xl sm:text-2xl font-bold text-white">
                    Barobo National High School
                  </h1>
                </div>
              </div>

              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#D4AF37] leading-snug">
                Once a Student, Always an Eagle!
              </h2>
              <p className="text-sm text-white/85 mt-3 leading-relaxed">
                Sign in to your official BNHS Alumni Portal account to manage your directory profile, opt-in as a Mentor or Mentee, view potential career matches below, and access your Digital Eagle Alumni ID card.
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-white/15 space-y-2 text-xs text-white/80">
              <p className="font-semibold text-[#D4AF37]">
                Official Portal Capabilities:
              </p>
              <p>· Verified Alumni Directory & Auto-Updating Batch Registry (1982–2026+)</p>
              <p>· Eagle Career Mentorship Matchmaking (Mentor & Mentee Opt-In)</p>
              <p>· Cloud Sync & Persistent Alumni Session Support</p>
            </div>
          </div>

          {/* Right White Login Card (Supports Direct Portal Sign-In + Google OAuth) */}
          <div className="lg:col-span-6 bg-white text-gray-900 p-6 sm:p-10 flex flex-col justify-center">
            <p className="text-xs uppercase tracking-widest text-[#650019] font-bold mb-1">
              Official Alumni Authentication
            </p>
            <h2 className="font-display text-2xl font-bold text-gray-900">
              Alumni Portal Login
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 mt-1.5 leading-relaxed">
              Sign in directly with your BNHS Alumni credentials below (works on all published links and mobile browsers) or continue with Google.
            </p>

            {(localLoginError || authError) && (
              <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs">
                {localLoginError || authError}
              </div>
            )}

            <form onSubmit={handleDirectLoginForm} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={loginName ?? ''}
                  onChange={(e) => setLoginName(e.target.value)}
                  placeholder="e.g., Engr. Juan M. Dela Cruz"
                  className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#650019]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={loginEmail ?? ''}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="alumni@example.com"
                    className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#650019]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Batch Year *
                  </label>
                  <input
                    type="number"
                    min={1982}
                    max={2035}
                    required
                    value={loginBatchYear ?? 2020}
                    onChange={(e) => setLoginBatchYear(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 font-mono-num focus:outline-none focus:ring-2 focus:ring-[#650019]"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 px-5 rounded-lg bg-[#650019] text-white font-bold text-sm hover:bg-[#450012] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <LogIn className="w-4 h-4 text-[#D4AF37]" />
                Sign In to BNHS Alumni Portal
              </button>
            </form>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px bg-gray-200 flex-1" />
              <span className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
                Or Google Cloud Auth
              </span>
              <div className="h-px bg-gray-200 flex-1" />
            </div>

            <button
              type="button"
              onClick={onSignIn}
              className="w-full py-2.5 px-5 rounded-lg border-2 border-[#650019] text-[#650019] font-bold text-xs sm:text-sm hover:bg-[#650019] hover:text-white transition-colors flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              Continue with Verified Google Account
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-[#450012] border border-[#D4AF37]/30 rounded-xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#650019] border-2 border-[#D4AF37] text-[#D4AF37] font-display text-2xl font-bold flex items-center justify-center shrink-0">
              {userProfile?.photoUrl ? (
                <img
                  src={userProfile.photoUrl}
                  alt={userProfile.fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>
                  {(userProfile?.fullName || currentUser.displayName || 'E')[0]?.toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#D4AF37] font-semibold">
                <span>BAROBO NATIONAL HIGH SCHOOL</span>
                <span aria-hidden="true">·</span>
                <span>ALUMNI DASHBOARD</span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-white mt-1">
                Welcome, {userProfile?.fullName || currentUser.displayName || 'Fellow Eagle'}!
              </h1>
              <p className="text-xs sm:text-sm text-white/80 mt-0.5">
                Signed in as {currentUser.email}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('register')}
              className="px-4 py-2.5 rounded-lg bg-[#D4AF37] text-[#450012] font-bold text-xs hover:bg-[#e3c14d] transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {userProfile ? (
                <>
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit My Profile
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  Complete Alumni Registration
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onSignOut}
              className="px-4 py-2.5 rounded-lg bg-[#650019] border border-white/20 text-white font-semibold text-xs hover:bg-black/30 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* EAGLE CAREER MENTORSHIP MODULE (OPT-IN & POTENTIAL MATCHES IN DASHBOARD) */}
      <div className="bg-[#450012] border border-[#D4AF37]/40 rounded-xl p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-white/15">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-bold flex items-center gap-2">
              <Handshake className="w-4 h-4" />
              <span>Eagle Career Mentorship Network · Dashboard Matchmaker</span>
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mt-1">
              Mentor & Mentee Opt-In and Potential Matches
            </h2>
            <p className="text-sm text-white/80 mt-1.5 max-w-2xl leading-relaxed">
              Opt-in as a <strong>Mentor</strong> or <strong>Mentee</strong> based on your profession and industry sector to discover compatible Barobo National High School alumni for career guidance and industry networking.
            </p>
          </div>

          <div className="bg-[#650019] border border-[#D4AF37]/30 rounded-lg px-4 py-2.5 text-right shrink-0">
            <span className="block text-xs text-white/70">Compatible Matches Found</span>
            <span className="font-mono-num text-xl font-bold text-[#D4AF37]">
              {potentialMatches.length} {potentialMatches.length === 1 ? 'Eagle' : 'Eagles'}
            </span>
          </div>
        </div>

        {/* Interactive Opt-In Controls Bar */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          <div className="lg:col-span-6">
            <label className="block text-xs uppercase tracking-wider text-[#D4AF37] font-bold mb-2">
              1. Select Your Mentorship Opt-In Role
            </label>
            <div className="flex flex-wrap items-center gap-1.5 bg-[#650019] p-1.5 rounded-lg border border-white/15">
              {[
                { id: 'mentee', label: 'I am a Mentee (Find Mentors)' },
                { id: 'mentor', label: 'I am a Mentor (Find Mentees)' },
                { id: 'both', label: 'Both Mentor & Mentee' },
                { id: 'none', label: 'Opt Out' },
              ].map((roleOption) => (
                <button
                  key={roleOption.id}
                  type="button"
                  disabled={savingMentorship}
                  onClick={() =>
                    handleSaveMentorshipPreference(
                      roleOption.id as MentorshipRole,
                      selectedSector
                    )
                  }
                  className={`px-3 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedRole === roleOption.id
                      ? 'bg-[#D4AF37] text-[#450012]'
                      : 'text-white/85 hover:text-white'
                  }`}
                >
                  {roleOption.label}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-6">
            <label className="block text-xs uppercase tracking-wider text-[#D4AF37] font-bold mb-2">
              2. Select Your Industry & Profession Sector
            </label>
            <select
              value={selectedSector ?? 'Engineering & Architecture'}
              disabled={savingMentorship}
              onChange={(e) =>
                handleSaveMentorshipPreference(
                  selectedRole,
                  e.target.value as IndustrySector
                )
              }
              aria-label="Select industry sector for mentorship matching"
              className="w-full px-4 py-2.5 bg-white text-gray-900 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
            >
              {ALLOWED_INDUSTRY_SECTORS.map((sector) => (
                <option key={sector} value={sector}>
                  {sector}
                </option>
              ))}
            </select>
          </div>
        </div>

        {mentorshipSavedMsg && (
          <div className="mt-4 p-3.5 rounded-lg bg-[#650019] border border-[#D4AF37] text-white text-xs flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#D4AF37] shrink-0" />
              {mentorshipSavedMsg}
            </span>
            <button
              type="button"
              onClick={() => setMentorshipSavedMsg(null)}
              className="text-[#D4AF37] hover:underline ml-4 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Potential Matches Grid */}
        <div className="mt-6">
          {selectedRole === 'none' ? (
            <div className="bg-white text-gray-900 rounded-xl p-8 text-center border border-gray-200">
              <p className="text-base font-bold text-gray-900">
                You are currently opted out of the Eagle Career Mentorship Program
              </p>
              <p className="text-xs text-gray-600 mt-1 mb-4">
                Select "I am a Mentee" or "I am a Mentor" above to view potential matches based on your profession and industry.
              </p>
              <button
                type="button"
                onClick={() => handleSaveMentorshipPreference('mentee', selectedSector)}
                className="px-4 py-2 rounded-lg bg-[#650019] text-white text-xs font-semibold hover:bg-[#450012] cursor-pointer"
              >
                Opt-In to View Matches
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {potentialMatches.slice(0, 6).map((match) => {
                const { alumnus, targetRoleLabel, compatibilityScore, matchReasons } = match;
                const isConnected = Boolean(connectedUids[alumnus.uid]);
                const initials = alumnus.fullName
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((p) => p[0]?.toUpperCase())
                  .join('');

                return (
                  <article
                    key={alumnus.uid}
                    className="bg-white text-gray-900 rounded-xl p-5 border border-gray-200 hover:border-[#D4AF37] transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Clean unboxed metadata header per Zero-Pill Discipline */}
                      <div className="flex items-center justify-between gap-2 text-xs mb-3">
                        <span className="font-bold text-[#650019]">
                          {targetRoleLabel} · Batch {alumnus.graduationYear}
                        </span>
                        <span className="font-mono-num font-bold text-gray-900">
                          {compatibilityScore}% Match
                        </span>
                      </div>

                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-11 h-11 rounded-lg bg-[#650019] text-[#D4AF37] font-display font-bold text-sm flex items-center justify-center shrink-0 border border-[#D4AF37]/40">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base font-bold text-gray-900 leading-snug">
                            {alumnus.fullName}
                          </h3>
                          <p className="text-xs font-semibold text-gray-700 mt-0.5 flex items-center gap-1">
                            <Briefcase className="w-3.5 h-3.5 text-[#650019] shrink-0" />
                            <span className="truncate">{alumnus.profession}</span>
                          </p>
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            {alumnus.currentEmployment}
                          </p>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-gray-100 space-y-1 text-xs text-gray-600">
                        <p>
                          <span className="font-semibold text-gray-800">Industry:</span>{' '}
                          {alumnus.industrySector}
                        </p>
                        <p>
                          <span className="font-semibold text-gray-800">Track & Course:</span>{' '}
                          {alumnus.strand} · {alumnus.course}
                        </p>
                        <p className="text-[#650019] font-medium pt-1">
                          Why matched: {matchReasons.join(' · ')}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-500 truncate">
                        {alumnus.locationCity.split(',')[0]}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setConnectedUids((prev) => ({
                            ...prev,
                            [alumnus.uid]: !prev[alumnus.uid],
                          }))
                        }
                        className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          isConnected
                            ? 'bg-[#D4AF37] text-[#450012]'
                            : 'bg-[#650019] text-white hover:bg-[#450012]'
                        }`}
                      >
                        {isConnected ? 'Mentorship Requested ✓' : 'Connect for Mentorship'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Authenticated User Profile & RSVP Cards */}
      {currentUser && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Digital Alumni ID & Directory Status */}
          <div className="lg:col-span-5 space-y-6">
            {/* Official Digital BNHS Alumni Eagle ID Card */}
            <div className="bg-gradient-to-br from-[#450012] via-[#650019] to-[#33000d] border-2 border-[#D4AF37] rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#D4AF37]/30">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-lg overflow-hidden border border-[#D4AF37] shrink-0 bg-white ${
                      logoAnimated ? 'animate-bnhs-seal' : ''
                    }`}
                  >
                    <ResilientImage
                      src={logoUrl}
                      alt="BNHS Crest"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <p className="font-display text-xs font-bold tracking-wider text-[#D4AF37]">
                      BAROBO NATIONAL HIGH SCHOOL
                    </p>
                    <p className="text-[11px] text-white/80">
                      OFFICIAL ALUMNI IDENTIFICATION
                    </p>
                  </div>
                </div>
                <Award className="w-6 h-6 text-[#D4AF37] shrink-0" />
              </div>

              {userProfile ? (
                <div className="mt-5 space-y-4">
                  <div className="flex items-center gap-4">
                    {userProfile.photoUrl && (
                      <div className="w-14 h-14 rounded-xl overflow-hidden border-2 border-[#D4AF37] shrink-0 bg-[#450012]">
                        <img
                          src={userProfile.photoUrl}
                          alt={userProfile.fullName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-white/70">
                        Alumnus / Alumna Name
                      </p>
                      <p className="font-display text-xl font-bold text-white mt-0.5">
                        {userProfile.fullName}
                      </p>
                      <p className="text-xs text-[#D4AF37] font-semibold mt-0.5">
                        {userProfile.profession} · {userProfile.industrySector}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/15 text-xs">
                    <div>
                      <span className="block text-white/60">Graduation Batch</span>
                      <span className="font-mono-num font-bold text-sm text-[#D4AF37]">
                        Class of {userProfile.graduationYear}
                      </span>
                    </div>
                    <div>
                      <span className="block text-white/60">Strand / Section</span>
                      <span className="font-semibold text-white">
                        {userProfile.strand} · {userProfile.formerSection}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/15 flex items-center justify-between text-[11px] text-white/75">
                    <span className="font-mono-num">
                      ID: BNHS-{userProfile.graduationYear}-{currentUser.uid.slice(0, 6).toUpperCase()}
                    </span>
                    <span className="text-[#D4AF37] font-semibold uppercase">
                      Mentorship: {userProfile.mentorshipRole || 'Active'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-6 py-4 text-center space-y-3">
                  <p className="text-sm font-semibold text-white">
                    Your Digital Eagle Alumni ID is not yet activated
                  </p>
                  <p className="text-xs text-white/75">
                    Complete your online Alumni Registration to generate your official batch credential.
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate('register')}
                    className="px-4 py-2 rounded-lg bg-[#D4AF37] text-[#450012] font-bold text-xs hover:bg-[#e3c14d] transition-colors cursor-pointer"
                  >
                    Register My Batch Record Now
                  </button>
                </div>
              )}
            </div>

            {/* Isolated Private Contact Registry Card */}
            <div className="bg-white text-gray-900 rounded-xl p-6 border border-gray-200">
              <div className="flex items-center justify-between pb-3 border-b border-gray-200 mb-4">
                <div>
                  <h2 className="text-base font-bold text-[#650019]">
                    Private Contact Information
                  </h2>
                  <p className="text-xs text-gray-500">
                    Visible only to you and authorized BNHS administrators
                  </p>
                </div>
                <ShieldCheck className="w-5 h-5 text-[#650019]" />
              </div>

              {userPrivate ? (
                <dl className="space-y-3 text-xs">
                  <div className="flex items-start gap-2.5">
                    <Mail className="w-4 h-4 text-[#650019] shrink-0 mt-0.5" />
                    <div>
                      <dt className="text-gray-500 font-medium">Registered Email</dt>
                      <dd className="text-gray-900 font-semibold mt-0.5">{userPrivate.email}</dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Phone className="w-4 h-4 text-[#650019] shrink-0 mt-0.5" />
                    <div>
                      <dt className="text-gray-500 font-medium">Contact Number</dt>
                      <dd className="text-gray-900 font-semibold mt-0.5 font-mono-num">
                        {userPrivate.phone}
                      </dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <MapPin className="w-4 h-4 text-[#650019] shrink-0 mt-0.5" />
                    <div>
                      <dt className="text-gray-500 font-medium">Home / Mailing Address</dt>
                      <dd className="text-gray-900 font-semibold mt-0.5">{userPrivate.homeAddress}</dd>
                    </div>
                  </div>
                </dl>
              ) : (
                <p className="text-xs text-gray-600">
                  No private contact details recorded yet. Click "Complete Alumni Registration" to add your contact number and mailing address.
                </p>
              )}
            </div>
          </div>

          {/* Right Column: Academic & Career Profile Summary + Event RSVPs */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white text-gray-900 rounded-xl p-6 sm:p-8 border border-gray-200">
              <div className="flex items-center justify-between pb-4 border-b border-gray-200 mb-5">
                <div>
                  <h2 className="text-lg font-bold text-[#650019]">
                    Public Alumni Directory Record
                  </h2>
                  <p className="text-xs text-gray-500">
                    Academic and career milestones shared with the BNHS Alumni Community
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('register')}
                  className="text-xs font-bold text-[#650019] hover:underline cursor-pointer"
                >
                  {userProfile ? 'Update Record' : 'Create Record'}
                </button>
              </div>

              {userProfile ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div className="p-3.5 rounded-lg bg-gray-50 border border-gray-200">
                      <span className="block text-xs text-gray-500">Graduation Year & Section</span>
                      <span className="font-bold text-gray-900 font-mono-num">
                        Batch {userProfile.graduationYear} · {userProfile.formerSection}
                      </span>
                    </div>
                    <div className="p-3.5 rounded-lg bg-gray-50 border border-gray-200">
                      <span className="block text-xs text-gray-500">SHS Strand / Curriculum</span>
                      <span className="font-bold text-gray-900">{userProfile.strand}</span>
                    </div>
                    <div className="p-3.5 rounded-lg bg-gray-50 border border-gray-200">
                      <span className="block text-xs text-gray-500">College Degree / Course</span>
                      <span className="font-semibold text-gray-900">{userProfile.course}</span>
                    </div>
                    <div className="p-3.5 rounded-lg bg-gray-50 border border-gray-200">
                      <span className="block text-xs text-gray-500">Current Employment</span>
                      <span className="font-semibold text-gray-900">
                        {userProfile.profession} at {userProfile.currentEmployment}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                    <span className="block text-xs text-gray-500 mb-1">
                      Alumni Bio & Message ({userProfile.visibility.toUpperCase()} visibility)
                    </span>
                    <p className="text-sm text-gray-800 italic">"{userProfile.bio}"</p>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-sm font-semibold text-gray-800">
                    You have not registered your Alumni Directory profile yet.
                  </p>
                  <p className="text-xs text-gray-500 mt-1 mb-4">
                    Add your graduation year, former section, course, and current profession so your batchmates can reconnect with you.
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate('register')}
                    className="px-5 py-2.5 bg-[#650019] text-white text-xs font-semibold rounded-lg hover:bg-[#450012] cursor-pointer"
                  >
                    Register as BNHS Alumni
                  </button>
                </div>
              )}
            </div>

            {/* Registered Event RSVPs */}
            <div className="bg-white text-gray-900 rounded-xl p-6 sm:p-8 border border-gray-200">
              <div className="flex items-center justify-between pb-4 border-b border-gray-200 mb-5">
                <div>
                  <h2 className="text-lg font-bold text-[#650019]">
                    My Alumni Event RSVPs ({activeRsvpList.length})
                  </h2>
                  <p className="text-xs text-gray-500">
                    Homecomings, reunions, and school activities you are participating in
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('events')}
                  className="text-xs font-bold text-[#650019] hover:underline cursor-pointer"
                >
                  Explore All Events
                </button>
              </div>

              {activeRsvpList.length === 0 ? (
                <div className="py-6 text-center">
                  <Calendar className="w-8 h-8 text-[#650019] mx-auto mb-2 opacity-80" />
                  <p className="text-sm font-semibold text-gray-800">
                    No upcoming event RSVPs yet
                  </p>
                  <p className="text-xs text-gray-500 mt-1 mb-4">
                    Check out the 56th Grand Alumni Homecoming Gala and Career Mentorship Summit.
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate('events')}
                    className="px-4 py-2 bg-[#650019] text-white text-xs font-semibold rounded-lg hover:bg-[#450012] cursor-pointer"
                  >
                    View Alumni Events
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeRsvpList.map((rsvp) => {
                    const matchedEvent = events.find((e) => e.id === rsvp.eventId);
                    return (
                      <div
                        key={rsvp.id}
                        className="p-4 rounded-lg bg-gray-50 border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <p className="text-xs font-semibold text-[#650019]">
                            {matchedEvent?.category || 'Alumni Event'} · Status: {rsvp.status.toUpperCase()}
                          </p>
                          <h3 className="text-sm font-bold text-gray-900 mt-0.5">
                            {matchedEvent?.title || rsvp.eventId}
                          </h3>
                          {matchedEvent && (
                            <p className="text-xs text-gray-600 mt-0.5">
                              {matchedEvent.eventDate} · {matchedEvent.venue}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => onNavigate('events')}
                          className="text-xs font-semibold text-[#650019] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Manage RSVP →
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
