import React, { useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import {
  CheckCircle2,
  ShieldCheck,
  LogIn,
  Save,
  AlertCircle,
  Handshake,
  Upload,
  Link2,
  Trash2,
  Calendar,
  Camera,
} from 'lucide-react';
import {
  ALLOWED_INDUSTRY_SECTORS,
  ALLOWED_STRANDS,
  AlumniStrand,
  auth,
  db,
  fileToCompressedDataUrl,
  generateDynamicBatchRanges,
  getCurrentMaxGraduationYear,
  handleFirestoreError,
  IndustrySector,
  MentorshipRole,
  normalizeImageUrl,
  OperationType,
  sanitizeString,
} from '../lib/firebase';
import { AlumniPrivateRecord, AlumniProfileRecord } from '../data/bnhsData';

interface RegistrationModuleProps {
  currentUser: User | null;
  existingProfile: AlumniProfileRecord | null;
  existingPrivate: AlumniPrivateRecord | null;
  onSignIn: () => Promise<void>;
  onSavedSuccess: () => void;
  onLocalProfileSave?: (profile: AlumniProfileRecord) => void;
  onLocalPrivateSave?: (privateInfo: AlumniPrivateRecord) => void;
  isModal?: boolean;
  onCloseModal?: () => void;
}

export const RegistrationModule: React.FC<RegistrationModuleProps> = ({
  currentUser,
  existingProfile,
  existingPrivate,
  onSignIn,
  onSavedSuccess,
  onLocalProfileSave,
  onLocalPrivateSave,
  isModal = false,
  onCloseModal,
}) => {
  const baseMaxYear = getCurrentMaxGraduationYear();
  const [enableNextBatchCycle, setEnableNextBatchCycle] = useState(false);
  const maxGraduationYear = enableNextBatchCycle ? Math.max(baseMaxYear, 2032) : baseMaxYear;

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [graduationYear, setGraduationYear] = useState<number>(baseMaxYear);
  const [formerSection, setFormerSection] = useState('');
  const [strand, setStrand] = useState<AlumniStrand>('STEM');
  const [course, setCourse] = useState('');
  const [profession, setProfession] = useState('');
  const [currentEmployment, setCurrentEmployment] = useState('');
  const [locationCity, setLocationCity] = useState('Barobo, Surigao del Sur');
  const [bio, setBio] = useState('');
  const [mentorshipRole, setMentorshipRole] = useState<MentorshipRole>('mentor');
  const [industrySector, setIndustrySector] = useState<string>('Engineering & Architecture');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [photoInputMode, setPhotoInputMode] = useState<'local' | 'link'>('local');
  const [photoLinkInput, setPhotoLinkInput] = useState<string>('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (existingProfile) {
      setFullName(existingProfile.fullName || '');
      setGraduationYear(existingProfile.graduationYear || baseMaxYear);
      if (existingProfile.graduationYear >= 2027) {
        setEnableNextBatchCycle(true);
      }
      setFormerSection(existingProfile.formerSection || '');
      setStrand(existingProfile.strand || 'STEM');
      setCourse(existingProfile.course || '');
      setProfession(existingProfile.profession || '');
      setCurrentEmployment(existingProfile.currentEmployment || '');
      setLocationCity(existingProfile.locationCity || 'Barobo, Surigao del Sur');
      setBio(existingProfile.bio || '');
      setMentorshipRole(existingProfile.mentorshipRole || 'none');
      setIndustrySector(existingProfile.industrySector || 'Engineering & Architecture');
      setPhotoUrl(existingProfile.photoUrl || '');
      if (existingProfile.photoUrl && existingProfile.photoUrl.startsWith('http')) {
        setPhotoLinkInput(existingProfile.photoUrl || '');
      }
      setVisibility(existingProfile.visibility || 'public');
    } else if (currentUser?.displayName && !fullName) {
      setFullName(currentUser.displayName || '');
      if (currentUser.photoURL && !photoUrl) {
        setPhotoUrl(currentUser.photoURL || '');
        setPhotoLinkInput(currentUser.photoURL || '');
      }
    }

    if (existingPrivate) {
      setEmail(existingPrivate.email || '');
      setPhone(existingPrivate.phone || '');
      setHomeAddress(existingPrivate.homeAddress || '');
    } else if (currentUser?.email && !email) {
      setEmail(currentUser.email || '');
    }
  }, [currentUser, existingProfile, existingPrivate]);

  // Automatically generates from the effective max year down to 1982
  const yearsList = Array.from(
    { length: maxGraduationYear - 1982 + 1 },
    (_, idx) => maxGraduationYear - idx
  );

  // Dynamic batch ranges (e.g. 1982-1999, 2020-2026, and automatically 2027-2032 when new year arrives)
  const batchRanges = generateDynamicBatchRanges(maxGraduationYear);
  const matchedBatchRange = batchRanges.find(
    (r) => graduationYear >= r.minYear && graduationYear <= r.maxYear
  );

  const handleLocalPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMessage(null);
    setUploadingPhoto(true);
    try {
      const compressedDataUrl = await fileToCompressedDataUrl(file, 360, 0.82);
      setPhotoUrl(compressedDataUrl);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to process the selected image file.'
      );
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleApplyGoogleLink = () => {
    const normalized = normalizeImageUrl(photoLinkInput);
    setPhotoUrl(normalized);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanName = sanitizeString(fullName, 100);
    const cleanEmail = sanitizeString(email, 120);
    const cleanPhone = sanitizeString(phone, 30);
    const cleanAddress = sanitizeString(homeAddress, 200);
    const cleanSection = sanitizeString(formerSection, 60);
    const cleanCourse = sanitizeString(course, 120);
    const cleanProfession = sanitizeString(profession, 100);
    const cleanEmployment = sanitizeString(currentEmployment, 120);
    const cleanCity = sanitizeString(locationCity, 100);
    const cleanBio = sanitizeString(bio, 600);
    const cleanIndustry = sanitizeString(industrySector, 80);
    const finalPhotoRaw =
      photoInputMode === 'link' && photoLinkInput.trim()
        ? normalizeImageUrl(photoLinkInput)
        : photoUrl;
    const cleanPhotoUrl = sanitizeString(finalPhotoRaw, 150000);

    if (cleanName.length < 2) {
      setErrorMessage('Full name must be at least 2 characters.');
      return;
    }
    if (cleanEmail.length < 5 || !cleanEmail.includes('@')) {
      setErrorMessage('Please provide a valid email address (at least 5 characters).');
      return;
    }
    if (cleanPhone.length < 7) {
      setErrorMessage('Please provide a valid contact phone number (at least 7 digits).');
      return;
    }
    if (cleanAddress.length < 5) {
      setErrorMessage('Please enter your complete residential or mailing address.');
      return;
    }
    if (graduationYear < 1971 || graduationYear > 2100) {
      setErrorMessage(`Graduation year must be between 1982 and ${maxGraduationYear}.`);
      return;
    }
    if (cleanSection.length < 1) {
      setErrorMessage('Please specify your former BNHS section or advisory class.');
      return;
    }
    if (cleanCourse.length < 2) {
      setErrorMessage('Please enter your college degree, course, or specialization.');
      return;
    }
    if (cleanProfession.length < 2) {
      setErrorMessage('Please enter your current profession or occupation.');
      return;
    }
    if (cleanEmployment.length < 2) {
      setErrorMessage('Please enter your current employer, company, or institution.');
      return;
    }
    if (cleanCity.length < 2) {
      setErrorMessage('Please enter your current city and province/country.');
      return;
    }
    if (cleanBio.length < 1) {
      setErrorMessage('Please share a brief BNHS memory or professional note.');
      return;
    }

    const localRecord: AlumniProfileRecord = {
      uid: currentUser?.uid || `local_alum_${Date.now()}`,
      fullName: cleanName,
      graduationYear: Number(graduationYear),
      formerSection: cleanSection,
      strand,
      course: cleanCourse,
      profession: cleanProfession,
      currentEmployment: cleanEmployment,
      locationCity: cleanCity,
      bio: cleanBio,
      mentorshipRole,
      industrySector: cleanIndustry,
      photoUrl: cleanPhotoUrl,
      visibility,
      isVerifiedRecord: true,
    };

    const localPrivateRecord: AlumniPrivateRecord = {
      uid: localRecord.uid,
      email: cleanEmail,
      phone: cleanPhone,
      homeAddress: cleanAddress,
    };

    if (!currentUser || !auth.currentUser || auth.currentUser.uid !== currentUser.uid) {
      if (onLocalProfileSave) {
        onLocalProfileSave(localRecord);
      }
      if (onLocalPrivateSave) {
        onLocalPrivateSave(localPrivateRecord);
      }
      setSuccessMessage(
        existingProfile
          ? 'Your BNHS Alumni Directory profile, photo, mentorship preference, and private contact record have been updated and saved!'
          : 'Welcome home, Eagle! Your official BNHS Alumni registration, profile photo, and mentorship preferences are now active.'
      );
      onSavedSuccess();
      return;
    }

    setSubmitting(true);
    try {
      const batch = writeBatch(db);
      const profileRef = doc(db, 'alumni_profiles', currentUser.uid);
      const privateRef = doc(db, 'alumni_private', currentUser.uid);
      const [profileSnap, privateSnap] = await Promise.all([
        getDoc(profileRef),
        getDoc(privateRef),
      ]);

      if (profileSnap.exists()) {
        batch.update(profileRef, {
          fullName: cleanName,
          graduationYear: Number(graduationYear),
          formerSection: cleanSection,
          strand,
          course: cleanCourse,
          profession: cleanProfession,
          currentEmployment: cleanEmployment,
          locationCity: cleanCity,
          bio: cleanBio,
          mentorshipRole,
          industrySector: cleanIndustry,
          photoUrl: cleanPhotoUrl,
          visibility,
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(profileRef, {
          uid: currentUser.uid,
          fullName: cleanName,
          graduationYear: Number(graduationYear),
          formerSection: cleanSection,
          strand,
          course: cleanCourse,
          profession: cleanProfession,
          currentEmployment: cleanEmployment,
          locationCity: cleanCity,
          bio: cleanBio,
          mentorshipRole,
          industrySector: cleanIndustry,
          photoUrl: cleanPhotoUrl,
          visibility,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      if (privateSnap.exists()) {
        batch.update(privateRef, {
          email: cleanEmail,
          phone: cleanPhone,
          homeAddress: cleanAddress,
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(privateRef, {
          uid: currentUser.uid,
          email: cleanEmail,
          phone: cleanPhone,
          homeAddress: cleanAddress,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();
      if (onLocalProfileSave) {
        onLocalProfileSave(localRecord);
      }
      if (onLocalPrivateSave) {
        onLocalPrivateSave(localPrivateRecord);
      }
      setSuccessMessage(
        existingProfile
          ? 'Your BNHS Alumni Directory profile, photo, mentorship preference, and private contact record have been updated.'
          : 'Welcome home, Eagle! Your official BNHS Alumni registration, profile photo, and mentorship preferences are now active.'
      );
      onSavedSuccess();
    } catch (error) {
      handleFirestoreError(
        error,
        existingProfile ? OperationType.UPDATE : OperationType.CREATE,
        `alumni_profiles/${currentUser.uid}`
      );
    } finally {
      setSubmitting(false);
    }
  };

  const initials = (fullName || 'BNHS')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <section className={isModal ? 'w-full' : 'max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10'}>
      {/* Institutional Header */}
      <div className="bg-[#450012] border border-[#D4AF37]/30 rounded-xl p-6 sm:p-8 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold mb-2">
              Barobo National High School · Official Registry (1982–{maxGraduationYear})
            </p>
            <h1 className="font-display text-2xl sm:text-4xl font-bold text-white">
              {existingProfile ? 'Update My BNHS Alumni Profile' : 'Online Alumni Registration'}
            </h1>
            <p className="text-white/80 text-sm sm:text-base mt-2 leading-relaxed">
              Upload your profile photo (local file or Google link), select your graduation batch (grouped automatically into 2020–2026 and 2027–2032 cohorts), and register your career details.
            </p>
          </div>
          {isModal && onCloseModal && (
            <button
              type="button"
              onClick={onCloseModal}
              className="px-3.5 py-2 rounded-lg bg-[#650019] border border-[#D4AF37]/40 text-xs font-bold text-[#D4AF37] hover:bg-black/30 cursor-pointer shrink-0"
            >
              Close Modal
            </button>
          )}
        </div>

        {!currentUser && (
          <div className="mt-6 p-4 bg-[#650019] border border-[#D4AF37]/40 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-white">
                Optional Google Sign-In for Cloud Sync
              </p>
              <p className="text-xs text-white/80 mt-0.5">
                You can register and upload your photo immediately below, or sign in with Google to bind your record across devices.
              </p>
            </div>
            <button
              type="button"
              onClick={onSignIn}
              className="px-4 py-2.5 bg-[#D4AF37] text-[#450012] font-bold text-xs rounded-lg hover:bg-[#e3c14d] transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              Sign In with Google
            </button>
          </div>
        )}
      </div>

      {/* Main White Registration Form Card */}
      <form
        onSubmit={handleSubmit}
        className="bg-white text-gray-900 rounded-xl p-6 sm:p-8 border border-gray-200 space-y-8"
      >
        {errorMessage && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Section 0: Alumni Profile Photo (Upload Local or Google Link) */}
        <div className="p-5 rounded-xl bg-gray-50 border border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-gray-200 mb-5">
            <div>
              <h2 className="text-lg font-bold text-[#650019] flex items-center gap-2">
                <Camera className="w-5 h-5 text-[#650019]" />
                <span>Alumni Profile Photo (Local Upload or Google Link)</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Upload a photo from your device or paste a Google Drive / web image link to display on your Alumni Directory card and Digital ID.
              </p>
            </div>
            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-300 shrink-0">
              <button
                type="button"
                onClick={() => setPhotoInputMode('local')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                  photoInputMode === 'local'
                    ? 'bg-[#650019] text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                Upload Local Photo
              </button>
              <button
                type="button"
                onClick={() => setPhotoInputMode('link')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                  photoInputMode === 'link'
                    ? 'bg-[#650019] text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Link2 className="w-3.5 h-3.5" />
                Google / Web Link
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Avatar Preview */}
            <div className="relative w-24 h-24 rounded-2xl overflow-hidden bg-[#650019] border-2 border-[#D4AF37] text-[#D4AF37] font-display font-bold text-2xl flex items-center justify-center shrink-0 shadow-md">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt="Alumni Profile Preview"
                  className="w-full h-full object-cover"
                  onError={() => setPhotoUrl('')}
                />
              ) : (
                <span>{initials || 'E'}</span>
              )}
            </div>

            {/* Upload or Link Controls */}
            <div className="flex-1 w-full space-y-3">
              {photoInputMode === 'local' ? (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                    Select Photo from Computer or Phone (JPG, PNG, GIF, WEBP)
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLocalPhotoSelect}
                      className="hidden"
                      id="alumni-local-photo-input"
                    />
                    <label
                      htmlFor="alumni-local-photo-input"
                      className="px-4 py-2.5 rounded-lg bg-[#650019] text-white text-xs font-bold hover:bg-[#450012] transition-colors inline-flex items-center gap-2 cursor-pointer"
                    >
                      <Upload className="w-4 h-4 text-[#D4AF37]" />
                      {uploadingPhoto ? 'Processing Photo...' : 'Choose Local Photo File'}
                    </label>
                    {photoUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoUrl('');
                          setPhotoLinkInput('');
                        }}
                        className="px-3 py-2 rounded-lg border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50 inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove Photo
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1.5">
                    Photos are automatically optimized for fast loading in the BNHS Alumni Directory.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                    Paste Google Drive Share Link or Direct Image URL
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="url"
                      value={photoLinkInput ?? ''}
                      onChange={(e) => {
                        setPhotoLinkInput(e.target.value);
                        setPhotoUrl(normalizeImageUrl(e.target.value));
                      }}
                      placeholder="https://drive.google.com/file/d/... or https://example.com/photo.jpg"
                      className="flex-1 px-3.5 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#650019]"
                    />
                    <button
                      type="button"
                      onClick={handleApplyGoogleLink}
                      className="px-4 py-2 rounded-lg bg-[#650019] text-white text-xs font-bold hover:bg-[#450012] transition-colors cursor-pointer shrink-0"
                    >
                      Apply Link
                    </button>
                    {photoUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoUrl('');
                          setPhotoLinkInput('');
                        }}
                        className="px-3 py-2 rounded-lg border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50 inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Clear
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1.5">
                    Supports Google Drive shared image links, Google Photos links, or any direct image URL.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 1: Full Name & Contact Information */}
        <div>
          <div className="pb-3 border-b border-gray-200 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-[#650019]">
                01. Full Name & Contact Information
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Your email, phone number, and home address are stored in an isolated private collection and never shown publicly.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#650019]">
              <ShieldCheck className="w-4 h-4" />
              PII Encrypted & Isolated
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Full Name (First, Middle Initial, Last Name, Suffix/Title) *
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={100}
                value={fullName ?? ''}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g., Engr. Juan M. Dela Cruz"
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#650019]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Personal Email Address (Private) *
              </label>
              <input
                type="email"
                required
                minLength={5}
                maxLength={120}
                value={email ?? ''}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="juan.delacruz@example.com"
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#650019]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Mobile / Contact Number (Private) *
              </label>
              <input
                type="tel"
                required
                minLength={7}
                maxLength={30}
                value={phone ?? ''}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+63 917 555 0192"
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#650019]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Complete Home / Mailing Address (Private) *
              </label>
              <input
                type="text"
                required
                minLength={5}
                maxLength={200}
                value={homeAddress ?? ''}
                onChange={(e) => setHomeAddress(e.target.value)}
                placeholder="Purok 4, Poblacion, Barobo, Surigao del Sur 8309"
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#650019]"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Graduation Year & Former Section (with Auto Batch Ranges 2020-2026 & 2027-2032) */}
        <div>
          <div className="pb-3 border-b border-gray-200 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-[#650019]">
                02. Graduation Year, Auto-Batch Group & Former Section
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Batches are automatically grouped into multi-year cohorts (e.g., <strong>2020–2026</strong>, and automatically creates <strong>2027–2032</strong> for new years).
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = !enableNextBatchCycle;
                setEnableNextBatchCycle(next);
                if (next && graduationYear < 2027) {
                  setGraduationYear(2027);
                } else if (!next && graduationYear > baseMaxYear) {
                  setGraduationYear(baseMaxYear);
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-[#650019]/10 text-[#650019] hover:bg-[#650019]/20 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Calendar className="w-3.5 h-3.5" />
              {enableNextBatchCycle
                ? 'Active: 2027–2032 New Year Cycle Enabled'
                : '+ Simulate New Year Batch (2027–2032)'}
            </button>
          </div>

          {/* Automatic Batch Cohort Selector Bar */}
          <div className="mb-4 p-3.5 rounded-lg bg-gray-50 border border-gray-200 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-gray-700">
              <span className="font-bold text-[#650019]">Auto-Assigned Batch Cohort:</span>{' '}
              <span className="font-mono-num font-bold">
                Batch {matchedBatchRange?.label || '2020–2026'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {batchRanges.map((range) => {
                const isSelectedRange =
                  graduationYear >= range.minYear && graduationYear <= range.maxYear;
                return (
                  <button
                    key={range.id}
                    type="button"
                    onClick={() => setGraduationYear(range.maxYear)}
                    className={`px-2.5 py-1 rounded text-xs font-mono-num font-semibold transition-colors cursor-pointer ${
                      isSelectedRange
                        ? 'bg-[#650019] text-[#D4AF37]'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {range.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Graduation Year (Auto-Updated) *
              </label>
              <select
                value={graduationYear ?? baseMaxYear}
                onChange={(e) => setGraduationYear(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 font-mono-num focus:outline-none focus:ring-2 focus:ring-[#650019]"
              >
                {yearsList.map((yr) => {
                  const cohort = batchRanges.find((r) => yr >= r.minYear && yr <= r.maxYear);
                  return (
                    <option key={yr} value={yr}>
                      Batch {yr} ({cohort?.label || '1982–1999'})
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Strand / Curriculum *
              </label>
              <select
                value={strand ?? 'STEM'}
                onChange={(e) => setStrand(e.target.value as AlumniStrand)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#650019]"
              >
                {ALLOWED_STRANDS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Former Section *
              </label>
              <input
                type="text"
                required
                minLength={1}
                maxLength={60}
                value={formerSection ?? ''}
                onChange={(e) => setFormerSection(e.target.value)}
                placeholder="e.g., Grade 12 - Galilei / IV - Rizal"
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#650019]"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Course, Profession & Current Employment */}
        <div>
          <div className="pb-3 border-b border-gray-200 mb-5">
            <h2 className="text-lg font-bold text-[#650019]">
              03. Course, Profession & Current Employment
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Share your post-secondary degree, career field, and current city for our City Professional Density Map.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                College Course / Degree / Technical Program *
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={120}
                value={course ?? ''}
                onChange={(e) => setCourse(e.target.value)}
                placeholder="e.g., BS Civil Engineering / BSED English"
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#650019]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Current Profession / Occupation *
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={100}
                value={profession ?? ''}
                onChange={(e) => setProfession(e.target.value)}
                placeholder="e.g., Licensed Civil Engineer / Public School Teacher"
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#650019]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Current Employment / Company / Institution *
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={120}
                value={currentEmployment ?? ''}
                onChange={(e) => setCurrentEmployment(e.target.value)}
                placeholder="e.g., DPWH Caraga / DepEd Surigao del Sur"
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#650019]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Current City & Province / Country *
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={100}
                value={locationCity ?? ''}
                onChange={(e) => setLocationCity(e.target.value)}
                placeholder="e.g., Barobo, Surigao del Sur"
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#650019]"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Eagle Career Mentorship Opt-In (Mentor / Mentee) */}
        <div>
          <div className="pb-3 border-b border-gray-200 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-[#650019]">
                04. Eagle Career Mentorship Program (Mentor / Mentee Opt-In)
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Opt-in to mentor fellow alumni or receive career mentorship matched by your industry sector and profession in your Alumni Dashboard.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#650019]">
              <Handshake className="w-4 h-4" />
              Dashboard Matchmaking Enabled
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Mentorship Participation Role *
              </label>
              <select
                value={mentorshipRole ?? 'mentor'}
                onChange={(e) => setMentorshipRole(e.target.value as MentorshipRole)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#650019]"
              >
                <option value="mentor">Opt-In as Mentor (Guide Younger Alumni)</option>
                <option value="mentee">Opt-In as Mentee (Seek Career Guidance)</option>
                <option value="both">Both Mentor & Mentee (Peer Exchange)</option>
                <option value="none">Not Participating at This Time</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Primary Industry Sector (For Matching) *
              </label>
              <select
                value={industrySector ?? 'Engineering & Architecture'}
                onChange={(e) => setIndustrySector(e.target.value as IndustrySector)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#650019]"
              >
                {ALLOWED_INDUSTRY_SECTORS.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Alumni Message / BNHS Memory / Career Bio (Max 600 chars) *
              </label>
              <textarea
                rows={3}
                required
                minLength={1}
                maxLength={600}
                value={bio ?? ''}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Share a favorite memory at Barobo National High School or how fellow Eagles can collaborate with you..."
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#650019]"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Displayed on your public Alumni Directory card</span>
                <span className="font-mono-num">{(bio || '').length} / 600</span>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Alumni Directory Visibility
              </label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
                  <input
                    type="radio"
                    name="visibility"
                    checked={visibility === 'public'}
                    onChange={() => setVisibility('public')}
                    className="accent-[#650019]"
                  />
                  <span>
                    <strong>Public Directory</strong> (Searchable by batchmates; private contact info remains hidden)
                  </span>
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
                  <input
                    type="radio"
                    name="visibility"
                    checked={visibility === 'private'}
                    onChange={() => setVisibility('private')}
                    className="accent-[#650019]"
                  />
                  <span>
                    <strong>Private Registry Only</strong> (Visible only to you and school administrators)
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-500">
            Once a Student, Always an Eagle · Barobo National High School Alumni Federation
          </p>
          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto px-6 py-3 bg-[#650019] text-white font-semibold text-sm rounded-lg hover:bg-[#450012] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4 text-[#D4AF37]" />
            {submitting
              ? 'Saving Official Record...'
              : existingProfile
              ? 'Save Profile Updates'
              : 'Complete Alumni Registration'}
          </button>
        </div>
      </form>
    </section>
  );
};
