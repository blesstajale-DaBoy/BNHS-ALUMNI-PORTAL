import React, { useEffect, useRef, useState } from 'react';
import {
  Award,
  Calendar,
  Camera,
  CheckCircle2,
  Cloud,
  Edit3,
  Facebook,
  Images,
  Link2,
  Linkedin,
  Megaphone,
  Plus,
  Save,
  Settings,
  Trash2,
  Twitter,
  Upload,
  Users,
  X,
} from 'lucide-react';
import {
  AlumniEventRecord,
  AlumniProfileRecord,
  AnnouncementRecord,
  BNHS_ASSETS,
  PortalSettingsRecord,
  SpotlightStoryRecord,
} from '../data/bnhsData';
import {
  ALLOWED_ANNOUNCEMENT_CATEGORIES,
  ALLOWED_EVENT_CATEGORIES,
  ALLOWED_INDUSTRY_SECTORS,
  ALLOWED_STRANDS,
  AlumniStrand,
  AnnouncementCategory,
  EventCategory,
  fileToCompressedDataUrl,
  getCurrentMaxGraduationYear,
  MentorshipRole,
  normalizeImageUrl,
  sanitizeId,
  sanitizeString,
} from '../lib/firebase';
import { ResilientImage } from './ResilientImage';
import { EventSlidingGallery } from './EventSlidingGallery';

export type EditMenuTab = 'branding' | 'events' | 'directory' | 'announcements' | 'spotlights';

interface PortalEditMenuModalProps {
  isOpen: boolean;
  initialTab?: EditMenuTab;
  initialItemId?: string | null;
  onClose: () => void;
  portalSettings: PortalSettingsRecord;
  alumniList: AlumniProfileRecord[];
  events: AlumniEventRecord[];
  announcements: AnnouncementRecord[];
  spotlights: SpotlightStoryRecord[];
  onSavePortalSettings: (updates: Partial<PortalSettingsRecord>) => Promise<void>;
  onSaveEvent: (eventData: AlumniEventRecord, isNew: boolean) => Promise<void>;
  onSaveAlumnusProfile: (profile: AlumniProfileRecord) => Promise<void>;
  onSaveAnnouncement: (ann: AnnouncementRecord, isNew: boolean) => Promise<void>;
  onSaveSpotlight: (story: SpotlightStoryRecord, isNew: boolean) => Promise<void>;
  isCloudAuthenticated?: boolean;
  onSyncCloudNow?: () => Promise<void>;
}

export const PortalEditMenuModal: React.FC<PortalEditMenuModalProps> = ({
  isOpen,
  initialTab = 'branding',
  initialItemId = null,
  onClose,
  portalSettings,
  alumniList,
  events,
  announcements,
  spotlights,
  onSavePortalSettings,
  onSaveEvent,
  onSaveAlumnusProfile,
  onSaveAnnouncement,
  onSaveSpotlight,
  isCloudAuthenticated = false,
  onSyncCloudNow,
}) => {
  const [activeTab, setActiveTab] = useState<EditMenuTab>(initialTab);
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const [showEventSelector, setShowEventSelector] = useState(true);
  const [showDirSelector, setShowDirSelector] = useState(true);
  const [showAnnSelector, setShowAnnSelector] = useState(true);
  const [showSpotSelector, setShowSpotSelector] = useState(true);

  const brandingDirtyRef = useRef(false);
  const eventDirtyRef = useRef(false);
  const alumDirtyRef = useRef(false);
  const annDirtyRef = useRef(false);
  const spotDirtyRef = useRef(false);
  const autoSaveLockRef = useRef(false);

  // --- TAB 1: BRANDING, HERO, DIRECTORY HEADER, FOOTER & SOCIALS ---
  const [logoUrl, setLogoUrl] = useState(portalSettings.logoUrl || BNHS_ASSETS.eagleCrest);
  const [logoMode, setLogoMode] = useState<'local' | 'link'>('local');
  const [logoLink, setLogoLink] = useState('');
  const [logoAnimated, setLogoAnimated] = useState(Boolean(portalSettings.logoAnimated));
  const [heroImageUrl, setHeroImageUrl] = useState(
    portalSettings.heroImageUrl || BNHS_ASSETS.campusHero
  );
  const [heroMode, setHeroMode] = useState<'local' | 'link'>('local');
  const [heroLink, setHeroLink] = useState('');
  const [schoolKicker, setSchoolKicker] = useState(portalSettings.schoolKicker || '');
  const [portalSubtitle, setPortalSubtitle] = useState(portalSettings.portalSubtitle || '');
  const [welcomeTitle, setWelcomeTitle] = useState(portalSettings.welcomeTitle || '');
  const [mottoText, setMottoText] = useState(portalSettings.mottoText || '');
  const [welcomeDesc, setWelcomeDesc] = useState(portalSettings.welcomeDescription || '');
  const [heroCaptionLocation, setHeroCaptionLocation] = useState(
    portalSettings.heroCaptionLocation || ''
  );
  const [heroCaptionTitle, setHeroCaptionTitle] = useState(
    portalSettings.heroCaptionTitle || ''
  );
  const [heroCaptionDesc, setHeroCaptionDesc] = useState(
    portalSettings.heroCaptionDescription || ''
  );
  const [directoryKicker, setDirectoryKicker] = useState(portalSettings.directoryKicker || '');
  const [directoryTitle, setDirectoryTitle] = useState(portalSettings.directoryTitle || '');
  const [directoryDesc, setDirectoryDesc] = useState(portalSettings.directoryDescription || '');
  const [footerSubtitle, setFooterSubtitle] = useState(portalSettings.footerSubtitle || '');
  const [facebookUrl, setFacebookUrl] = useState(portalSettings.facebookUrl || '');
  const [twitterUrl, setTwitterUrl] = useState(portalSettings.twitterUrl || '');
  const [linkedinUrl, setLinkedinUrl] = useState(portalSettings.linkedinUrl || '');

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const heroInputRef = useRef<HTMLInputElement | null>(null);

  // --- TAB 2: EVENTS & SLIDING PHOTOS ---
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [evTitle, setEvTitle] = useState('');
  const [evCategory, setEvCategory] = useState<EventCategory>('Homecoming');
  const [evDate, setEvDate] = useState('');
  const [evVenue, setEvVenue] = useState('');
  const [evStatus, setEvStatus] = useState<'upcoming' | 'ongoing' | 'completed' | 'archived'>(
    'upcoming'
  );
  const [evDesc, setEvDesc] = useState('');
  const [evSlides, setEvSlides] = useState<string[]>([BNHS_ASSETS.homecomingEvent]);
  const [evSlideMode, setEvSlideMode] = useState<'local' | 'link'>('local');
  const [evSlideLink, setEvSlideLink] = useState('');
  const [uploadingEvSlide, setUploadingEvSlide] = useState(false);
  const evFileInputRef = useRef<HTMLInputElement | null>(null);
  const evTitleInputRef = useRef<HTMLInputElement | null>(null);

  // --- TAB 3: DIRECTORY PROFILES ---
  const [selectedAlumUid, setSelectedAlumUid] = useState<string>('');
  const [alumName, setAlumName] = useState('');
  const [alumYear, setAlumYear] = useState<number>(2020);
  const [alumStrand, setAlumStrand] = useState<AlumniStrand>('STEM');
  const [alumSection, setAlumSection] = useState('');
  const [alumCourse, setAlumCourse] = useState('');
  const [alumProfession, setAlumProfession] = useState('');
  const [alumEmployment, setAlumEmployment] = useState('');
  const [alumCity, setAlumCity] = useState('');
  const [alumIndustry, setAlumIndustry] = useState('Engineering & Architecture');
  const [alumMentorship, setAlumMentorship] = useState<MentorshipRole>('mentor');
  const [alumBio, setAlumBio] = useState('');
  const [alumPhotoUrl, setAlumPhotoUrl] = useState('');
  const [alumPhotoMode, setAlumPhotoMode] = useState<'local' | 'link'>('local');
  const [alumPhotoLink, setAlumPhotoLink] = useState('');
  const alumFileRef = useRef<HTMLInputElement | null>(null);
  const alumNameInputRef = useRef<HTMLInputElement | null>(null);

  // --- TAB 4: ANNOUNCEMENTS ---
  const [selectedAnnId, setSelectedAnnId] = useState<string>('');
  const [annTitle, setAnnTitle] = useState('');
  const [annCategory, setAnnCategory] = useState<AnnouncementCategory>('Official Bulletin');
  const [annAuthor, setAnnAuthor] = useState('');
  const [annSummary, setAnnSummary] = useState('');
  const [annContent, setAnnContent] = useState('');
  const annTitleInputRef = useRef<HTMLInputElement | null>(null);

  // --- TAB 5: SPOTLIGHT MILESTONES ---
  const [selectedSpotId, setSelectedSpotId] = useState<string>('');
  const [spotNominee, setSpotNominee] = useState('');
  const [spotYear, setSpotYear] = useState<number>(2020);
  const [spotStrand, setSpotStrand] = useState<AlumniStrand>('STEM');
  const [spotProfession, setSpotProfession] = useState('');
  const [spotNominator, setSpotNominator] = useState('');
  const [spotMilestone, setSpotMilestone] = useState('');
  const [spotStory, setSpotStory] = useState('');
  const spotNomineeInputRef = useRef<HTMLInputElement | null>(null);

  const loadEventIntoForm = (ev: AlumniEventRecord | null) => {
    eventDirtyRef.current = false;
    if (!ev) {
      setSelectedEventId('NEW');
      setEvTitle('');
      setEvCategory('Homecoming');
      setEvDate('');
      setEvVenue('Barobo National High School Grand Gymnasium, Poblacion, Barobo');
      setEvStatus('upcoming');
      setEvDesc('');
      setEvSlides([BNHS_ASSETS.homecomingEvent]);
      setEvSlideLink('');
      return;
    }
    setSelectedEventId(ev.id);
    setEvTitle(ev.title || '');
    setEvCategory(ev.category || 'Homecoming');
    setEvDate(ev.eventDate || '');
    setEvVenue(ev.venue || '');
    setEvStatus(ev.status || 'upcoming');
    setEvDesc(ev.description || '');
    const combinedSlides = [
      ...(ev.galleryUrls || []),
      ...(ev.imageUrl ? [ev.imageUrl] : []),
    ].filter(Boolean);
    const uniqueSlides = Array.from(new Set(combinedSlides));
    setEvSlides(uniqueSlides.length > 0 ? uniqueSlides : [BNHS_ASSETS.homecomingEvent]);
    setEvSlideLink('');
  };

  const loadAlumIntoForm = (alum: AlumniProfileRecord | null) => {
    alumDirtyRef.current = false;
    if (!alum) return;
    setSelectedAlumUid(alum.uid);
    setAlumName(alum.fullName || '');
    setAlumYear(alum.graduationYear || 2020);
    setAlumStrand(alum.strand || 'STEM');
    setAlumSection(alum.formerSection || '');
    setAlumCourse(alum.course || '');
    setAlumProfession(alum.profession || '');
    setAlumEmployment(alum.currentEmployment || '');
    setAlumCity(alum.locationCity || '');
    setAlumIndustry(alum.industrySector || 'Engineering & Architecture');
    setAlumMentorship(alum.mentorshipRole || 'mentor');
    setAlumBio(alum.bio || '');
    setAlumPhotoUrl(alum.photoUrl || '');
    setAlumPhotoLink(alum.photoUrl?.startsWith('http') ? alum.photoUrl : '');
  };

  const loadAnnIntoForm = (ann: AnnouncementRecord | null) => {
    annDirtyRef.current = false;
    if (!ann) {
      setSelectedAnnId('NEW');
      setAnnTitle('');
      setAnnCategory('Official Bulletin');
      setAnnAuthor('BNHS Alumni Federation');
      setAnnSummary('');
      setAnnContent('');
      return;
    }
    setSelectedAnnId(ann.id);
    setAnnTitle(ann.title || '');
    setAnnCategory(ann.category || 'Official Bulletin');
    setAnnAuthor(ann.authorName || 'BNHS Alumni Federation');
    setAnnSummary(ann.summary || '');
    setAnnContent(ann.content || '');
  };

  const loadSpotlightIntoForm = (st: SpotlightStoryRecord | null) => {
    spotDirtyRef.current = false;
    if (!st) {
      setSelectedSpotId('NEW');
      setSpotNominee('');
      setSpotYear(2020);
      setSpotStrand('STEM');
      setSpotProfession('');
      setSpotNominator('BNHS Alumni Federation');
      setSpotMilestone('');
      setSpotStory('');
      return;
    }
    setSelectedSpotId(st.id);
    setSpotNominee(st.nomineeName || '');
    setSpotYear(st.graduationYear || 2020);
    setSpotStrand(st.strand || 'STEM');
    setSpotProfession(st.profession || '');
    setSpotNominator(st.nominatorName || 'BNHS Alumni Federation');
    setSpotMilestone(st.milestoneTitle || '');
    setSpotStory(st.story || '');
  };

  useEffect(() => {
    if (!isOpen) return;
    setSaveNotice(null);
    setActiveTab(initialTab);
    brandingDirtyRef.current = false;
    eventDirtyRef.current = false;
    alumDirtyRef.current = false;
    annDirtyRef.current = false;
    spotDirtyRef.current = false;

    setShowEventSelector(!(initialTab === 'events' && Boolean(initialItemId)));
    setShowDirSelector(!(initialTab === 'directory' && Boolean(initialItemId)));
    setShowAnnSelector(!(initialTab === 'announcements' && Boolean(initialItemId)));
    setShowSpotSelector(!(initialTab === 'spotlights' && Boolean(initialItemId)));

    // Hydrate Branding fields
    setLogoUrl(portalSettings.logoUrl || BNHS_ASSETS.eagleCrest);
    setLogoLink(portalSettings.logoUrl?.startsWith('http') ? portalSettings.logoUrl : '');
    setLogoAnimated(Boolean(portalSettings.logoAnimated));
    setHeroImageUrl(portalSettings.heroImageUrl || BNHS_ASSETS.campusHero);
    setHeroLink(
      portalSettings.heroImageUrl?.startsWith('http') ? portalSettings.heroImageUrl : ''
    );
    setSchoolKicker(portalSettings.schoolKicker || '');
    setPortalSubtitle(portalSettings.portalSubtitle || '');
    setWelcomeTitle(portalSettings.welcomeTitle || '');
    setMottoText(portalSettings.mottoText || '');
    setWelcomeDesc(portalSettings.welcomeDescription || '');
    setHeroCaptionLocation(portalSettings.heroCaptionLocation || '');
    setHeroCaptionTitle(portalSettings.heroCaptionTitle || '');
    setHeroCaptionDesc(portalSettings.heroCaptionDescription || '');
    setDirectoryKicker(portalSettings.directoryKicker || '');
    setDirectoryTitle(portalSettings.directoryTitle || '');
    setDirectoryDesc(portalSettings.directoryDescription || '');
    setFooterSubtitle(portalSettings.footerSubtitle || '');
    setFacebookUrl(portalSettings.facebookUrl || '');
    setTwitterUrl(portalSettings.twitterUrl || '');
    setLinkedinUrl(portalSettings.linkedinUrl || '');

    // Hydrate target or first item per tab
    const targetEv =
      (initialTab === 'events' && initialItemId
        ? events.find((e) => e.id === initialItemId)
        : events[0]) || null;
    loadEventIntoForm(initialTab === 'events' && initialItemId === 'NEW' ? null : targetEv);

    const targetAlum =
      (initialTab === 'directory' && initialItemId
        ? alumniList.find((a) => a.uid === initialItemId)
        : alumniList[0]) || null;
    loadAlumIntoForm(targetAlum);

    const targetAnn =
      (initialTab === 'announcements' && initialItemId
        ? announcements.find((a) => a.id === initialItemId)
        : announcements[0]) || null;
    loadAnnIntoForm(
      initialTab === 'announcements' && initialItemId === 'NEW' ? null : targetAnn
    );

    const targetSpot =
      (initialTab === 'spotlights' && initialItemId
        ? spotlights.find((s) => s.id === initialItemId)
        : spotlights[0]) || null;
    loadSpotlightIntoForm(
      initialTab === 'spotlights' && initialItemId === 'NEW' ? null : targetSpot
    );

    const focusTimer = window.setTimeout(() => {
      if (initialTab === 'events') evTitleInputRef.current?.focus();
      else if (initialTab === 'directory') alumNameInputRef.current?.focus();
      else if (initialTab === 'announcements') annTitleInputRef.current?.focus();
      else if (initialTab === 'spotlights') spotNomineeInputRef.current?.focus();
    }, 80);
    return () => window.clearTimeout(focusTimer);
  }, [isOpen, initialTab, initialItemId]);

  const persistBrandingNow = async (showBanner: boolean) => {
    if (autoSaveLockRef.current) return;
    autoSaveLockRef.current = true;
    setSaving(true);
    try {
      const finalLogo =
        logoMode === 'link' && logoLink.trim()
          ? normalizeImageUrl(logoLink)
          : logoUrl || BNHS_ASSETS.eagleCrest;
      const finalHero =
        heroMode === 'link' && heroLink.trim()
          ? normalizeImageUrl(heroLink)
          : heroImageUrl || BNHS_ASSETS.campusHero;

      brandingDirtyRef.current = false;
      await onSavePortalSettings({
        logoUrl: finalLogo,
        logoAnimated,
        heroImageUrl: finalHero,
        schoolKicker,
        portalSubtitle,
        welcomeTitle,
        mottoText,
        welcomeDescription: welcomeDesc,
        heroCaptionLocation,
        heroCaptionTitle,
        heroCaptionDescription: heroCaptionDesc,
        directoryKicker,
        directoryTitle,
        directoryDescription: directoryDesc,
        footerSubtitle,
        facebookUrl: facebookUrl.trim(),
        twitterUrl: twitterUrl.trim(),
        linkedinUrl: linkedinUrl.trim(),
      });
      if (showBanner) {
        setSaveNotice(
          isCloudAuthenticated
            ? 'Cloud Synced (Auto-Saved): Portal Logo, Hero Picture, Captions, Directory Header, Footer & Social Links.'
            : 'Auto-Saved Locally: Portal settings updated. Sign in with Google to push live to Published.'
        );
      }
    } finally {
      autoSaveLockRef.current = false;
      setSaving(false);
    }
  };

  const persistEventNow = async (showBanner: boolean) => {
    const cleanTitle = sanitizeString(evTitle, 140);
    const cleanDate = sanitizeString(evDate, 50);
    const cleanVenue = sanitizeString(evVenue, 140);
    const cleanDesc = sanitizeString(evDesc, 1000);
    if (
      cleanTitle.length < 5 ||
      cleanDate.length < 4 ||
      cleanVenue.length < 3 ||
      cleanDesc.length < 10 ||
      autoSaveLockRef.current
    ) {
      return;
    }

    autoSaveLockRef.current = true;
    setSaving(true);
    try {
      const isNew = selectedEventId === 'NEW' || !selectedEventId;
      const targetId = isNew ? sanitizeId(`evt_${Date.now()}`) : selectedEventId;
      const existingEv = events.find((ev) => ev.id === targetId);
      const validSlides = (evSlides.length > 0 ? evSlides : [BNHS_ASSETS.homecomingEvent]).slice(
        0,
        10
      );

      eventDirtyRef.current = false;
      if (isNew) {
        setSelectedEventId(targetId);
      }

      const record: AlumniEventRecord = {
        id: targetId,
        authorId: existingEv?.authorId || 'system_bnhs_admin',
        title: cleanTitle,
        category: evCategory,
        eventDate: cleanDate,
        venue: cleanVenue,
        description: cleanDesc,
        status: evStatus,
        visibility: 'public',
        imageUrl: validSlides[0],
        galleryUrls: validSlides,
      };
      await onSaveEvent(record, isNew);
      if (showBanner) {
        setSaveNotice(
          isCloudAuthenticated
            ? `Cloud Synced (Auto-Saved): ${evCategory} event "${cleanTitle}" with ${validSlides.length} sliding photo(s).`
            : `Auto-Saved Locally: ${evCategory} event "${cleanTitle}". Sign in with Google to push live to Published.`
        );
      }
    } finally {
      autoSaveLockRef.current = false;
      setSaving(false);
    }
  };

  const persistAlumNow = async (showBanner: boolean) => {
    const existing = alumniList.find((a) => a.uid === selectedAlumUid);
    if (!existing || sanitizeString(alumName, 100).length < 2 || autoSaveLockRef.current) return;
    autoSaveLockRef.current = true;
    setSaving(true);
    try {
      const finalPhoto =
        alumPhotoMode === 'link' && alumPhotoLink.trim()
          ? normalizeImageUrl(alumPhotoLink)
          : alumPhotoUrl;

      alumDirtyRef.current = false;
      const updated: AlumniProfileRecord = {
        ...existing,
        fullName: sanitizeString(alumName, 100),
        graduationYear: Number(alumYear),
        strand: alumStrand,
        formerSection: sanitizeString(alumSection, 60),
        course: sanitizeString(alumCourse, 120),
        profession: sanitizeString(alumProfession, 100),
        currentEmployment: sanitizeString(alumEmployment, 120),
        locationCity: sanitizeString(alumCity, 100),
        industrySector: sanitizeString(alumIndustry, 80),
        mentorshipRole: alumMentorship,
        bio: sanitizeString(alumBio, 600),
        photoUrl: sanitizeString(finalPhoto || '', 150000),
        visibility: 'public',
      };
      await onSaveAlumnusProfile(updated);
      if (showBanner) {
        setSaveNotice(
          isCloudAuthenticated
            ? `Cloud Synced (Auto-Saved): Directory Profile for ${updated.fullName}.`
            : `Auto-Saved Locally: Directory Profile for ${updated.fullName}.`
        );
      }
    } finally {
      autoSaveLockRef.current = false;
      setSaving(false);
    }
  };

  const persistAnnNow = async (showBanner: boolean) => {
    const cleanTitle = sanitizeString(annTitle, 150);
    const cleanAuthor = sanitizeString(annAuthor || 'BNHS Alumni Federation', 100);
    const cleanSummary = sanitizeString(annSummary, 300);
    const cleanContent = sanitizeString(annContent, 2000);
    if (
      cleanTitle.length < 5 ||
      cleanSummary.length < 10 ||
      cleanContent.length < 20 ||
      autoSaveLockRef.current
    ) {
      return;
    }

    autoSaveLockRef.current = true;
    setSaving(true);
    try {
      const isNew = selectedAnnId === 'NEW' || !selectedAnnId;
      const targetId = isNew ? sanitizeId(`ann_${Date.now()}`) : selectedAnnId;
      const existing = announcements.find((a) => a.id === targetId);
      annDirtyRef.current = false;
      if (isNew) {
        setSelectedAnnId(targetId);
      }

      const record: AnnouncementRecord = {
        id: targetId,
        authorId: existing?.authorId || 'system_bnhs_admin',
        authorName: cleanAuthor,
        title: cleanTitle,
        category: annCategory,
        summary: cleanSummary,
        content: cleanContent,
        status: 'published',
        visibility: 'public',
        publishedLabel: existing?.publishedLabel || 'Verified Portal Release',
      };
      await onSaveAnnouncement(record, isNew);
      if (showBanner) {
        setSaveNotice(
          isCloudAuthenticated
            ? `Cloud Synced (Auto-Saved): Official Announcement "${cleanTitle}".`
            : `Auto-Saved Locally: Official Announcement "${cleanTitle}".`
        );
      }
    } finally {
      autoSaveLockRef.current = false;
      setSaving(false);
    }
  };

  const persistSpotlightNow = async (showBanner: boolean) => {
    const cleanNominee = sanitizeString(spotNominee, 100);
    const cleanProfession = sanitizeString(spotProfession, 100);
    const cleanMilestone = sanitizeString(spotMilestone, 140);
    const cleanStory = sanitizeString(spotStory, 800);
    const cleanNominator = sanitizeString(spotNominator || 'BNHS Alumni Federation', 100);
    if (
      cleanNominee.length < 2 ||
      cleanProfession.length < 2 ||
      cleanMilestone.length < 5 ||
      cleanStory.length < 15 ||
      autoSaveLockRef.current
    ) {
      return;
    }

    autoSaveLockRef.current = true;
    setSaving(true);
    try {
      const isNew = selectedSpotId === 'NEW' || !selectedSpotId;
      const targetId = isNew ? sanitizeId(`spot_${Date.now()}`) : selectedSpotId;
      const existing = spotlights.find((s) => s.id === targetId);
      spotDirtyRef.current = false;
      if (isNew) {
        setSelectedSpotId(targetId);
      }

      const record: SpotlightStoryRecord = {
        id: targetId,
        nominatorUid: existing?.nominatorUid || 'system_bnhs_admin',
        nominatorName: cleanNominator,
        nomineeName: cleanNominee,
        graduationYear: Number(spotYear),
        strand: spotStrand,
        profession: cleanProfession,
        milestoneTitle: cleanMilestone,
        story: cleanStory,
        visibility: 'public',
      };
      await onSaveSpotlight(record, isNew);
      if (showBanner) {
        setSaveNotice(
          isCloudAuthenticated
            ? `Cloud Synced (Auto-Saved): Spotlight Milestone for ${cleanNominee}.`
            : `Auto-Saved Locally: Spotlight Milestone for ${cleanNominee}.`
        );
      }
    } finally {
      autoSaveLockRef.current = false;
      setSaving(false);
    }
  };

  // Real-Time Debounced Auto-Save Effects (550ms after any edit in any tab)
  useEffect(() => {
    if (!isOpen || activeTab !== 'branding' || !brandingDirtyRef.current) return;
    const t = window.setTimeout(() => {
      void persistBrandingNow(false);
    }, 550);
    return () => window.clearTimeout(t);
  }, [
    isOpen,
    activeTab,
    logoUrl,
    logoMode,
    logoLink,
    logoAnimated,
    heroImageUrl,
    heroMode,
    heroLink,
    schoolKicker,
    portalSubtitle,
    welcomeTitle,
    mottoText,
    welcomeDesc,
    heroCaptionLocation,
    heroCaptionTitle,
    heroCaptionDesc,
    directoryKicker,
    directoryTitle,
    directoryDesc,
    footerSubtitle,
    facebookUrl,
    twitterUrl,
    linkedinUrl,
  ]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'events' || !eventDirtyRef.current) return;
    const t = window.setTimeout(() => {
      void persistEventNow(false);
    }, 550);
    return () => window.clearTimeout(t);
  }, [isOpen, activeTab, selectedEventId, evTitle, evCategory, evDate, evVenue, evStatus, evDesc, evSlides]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'directory' || !alumDirtyRef.current) return;
    const t = window.setTimeout(() => {
      void persistAlumNow(false);
    }, 550);
    return () => window.clearTimeout(t);
  }, [
    isOpen,
    activeTab,
    selectedAlumUid,
    alumName,
    alumYear,
    alumStrand,
    alumSection,
    alumCourse,
    alumProfession,
    alumEmployment,
    alumCity,
    alumIndustry,
    alumMentorship,
    alumBio,
    alumPhotoUrl,
    alumPhotoMode,
    alumPhotoLink,
  ]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'announcements' || !annDirtyRef.current) return;
    const t = window.setTimeout(() => {
      void persistAnnNow(false);
    }, 550);
    return () => window.clearTimeout(t);
  }, [isOpen, activeTab, selectedAnnId, annTitle, annCategory, annAuthor, annSummary, annContent]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'spotlights' || !spotDirtyRef.current) return;
    const t = window.setTimeout(() => {
      void persistSpotlightNow(false);
    }, 550);
    return () => window.clearTimeout(t);
  }, [
    isOpen,
    activeTab,
    selectedSpotId,
    spotNominee,
    spotYear,
    spotStrand,
    spotProfession,
    spotNominator,
    spotMilestone,
    spotStory,
  ]);

  if (!isOpen) return null;

  const maxYear = getCurrentMaxGraduationYear();
  const yearsList = Array.from({ length: maxYear - 1982 + 1 }, (_, i) => maxYear - i);

  // Handlers for Branding uploads
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToCompressedDataUrl(file, 360, 0.85);
      brandingDirtyRef.current = true;
      setLogoUrl(dataUrl);
    } finally {
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToCompressedDataUrl(file, 720, 0.8);
      brandingDirtyRef.current = true;
      setHeroImageUrl(dataUrl);
    } finally {
      if (heroInputRef.current) heroInputRef.current.value = '';
    }
  };

  const handleSaveBrandingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await persistBrandingNow(true);
  };

  // Handlers for Event Sliding Gallery uploads
  const handleEventSlidesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingEvSlide(true);
    try {
      const newUrls: string[] = [];
      for (let i = 0; i < files.length && evSlides.length + newUrls.length < 10; i++) {
        const compressed = await fileToCompressedDataUrl(files[i], 480, 0.72);
        newUrls.push(compressed);
      }
      if (newUrls.length > 0) {
        eventDirtyRef.current = true;
        setEvSlides((prev) => [...prev, ...newUrls].slice(0, 10));
      }
    } finally {
      setUploadingEvSlide(false);
      if (evFileInputRef.current) evFileInputRef.current.value = '';
    }
  };

  const handleAddEventSlideLink = () => {
    const norm = normalizeImageUrl(evSlideLink);
    if (!norm) return;
    eventDirtyRef.current = true;
    setEvSlides((prev) => Array.from(new Set([...prev, norm])).slice(0, 10));
    setEvSlideLink('');
  };

  const handleSaveEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await persistEventNow(true);
  };

  // Handlers for Alumni Profile editing
  const handleAlumPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToCompressedDataUrl(file, 360, 0.82);
      alumDirtyRef.current = true;
      setAlumPhotoUrl(dataUrl);
    } finally {
      if (alumFileRef.current) alumFileRef.current.value = '';
    }
  };

  const handleSaveAlumSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await persistAlumNow(true);
  };

  // Handlers for Announcements
  const handleSaveAnnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await persistAnnNow(true);
  };

  // Handlers for Spotlight Milestones
  const handleSaveSpotlightSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await persistSpotlightNow(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white text-gray-900 rounded-xl max-w-4xl w-full overflow-hidden border-2 border-[#D4AF37] my-4 shadow-2xl flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#450012] text-white p-4 sm:p-6 flex items-center justify-between gap-3 border-b border-[#D4AF37]/40 shrink-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] sm:text-xs uppercase tracking-widest text-[#D4AF37] font-bold flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5" />
                <span>Unified BNHS Portal Edit Menu</span>
              </p>
              {saving ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-400/50 text-[10px] font-bold text-emerald-200">
                  <Cloud className="w-3 h-3 text-[#D4AF37] animate-pulse" />
                  <span>Cloud Syncing (Auto-Saving)...</span>
                </span>
              ) : isCloudAuthenticated ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-400/50 text-[10px] font-bold text-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Cloud Synced (Auto-Saved) · Live on Preview & Published</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void onSyncCloudNow?.()}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/85 border border-[#D4AF37]/70 text-[10px] font-bold text-[#D4AF37] hover:bg-amber-900 cursor-pointer"
                >
                  <Cloud className="w-3 h-3" />
                  <span>Auto-Saved Locally · Click to Sync Live</span>
                </button>
              )}
            </div>
            <h2 className="font-display text-lg sm:text-2xl font-bold mt-1">
              Edit Portal Branding, Events, Directory, Announcements & Spotlight
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Edit Menu"
            className="text-white/75 hover:text-white p-1.5 rounded-lg hover:bg-white/10 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Unified Category Tabs */}
        <div className="bg-[#650019] px-4 sm:px-6 py-2.5 flex items-center gap-1.5 overflow-x-auto border-b border-[#D4AF37]/30 shrink-0">
          {[
            { id: 'branding', label: 'Logo, Hero, Texts & Footer', icon: Settings },
            { id: 'events', label: `Events & Sliding Photos (${events.length})`, icon: Calendar },
            { id: 'directory', label: `Directory Profiles (${alumniList.length})`, icon: Users },
            {
              id: 'announcements',
              label: `Announcements (${announcements.length})`,
              icon: Megaphone,
            },
            { id: 'spotlights', label: `Spotlight (${spotlights.length})`, icon: Award },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setSaveNotice(null);
                  setActiveTab(tab.id as EditMenuTab);
                }}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#D4AF37] text-[#450012]'
                    : 'text-white/85 hover:text-white hover:bg-black/20'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {saveNotice && (
          <div className="mx-4 sm:mx-6 mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center justify-between gap-2 shrink-0">
            <span>{saveNotice}</span>
            <button
              type="button"
              onClick={() => setSaveNotice(null)}
              className="text-emerald-700 hover:underline cursor-pointer shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Scrollable Form Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {/* TAB 1: BRANDING, HERO, CAPTIONS, DIRECTORY HEADER, FOOTER & SOCIALS */}
          {activeTab === 'branding' && (
            <form key="tab-form-branding" onSubmit={handleSaveBrandingSubmit} className="space-y-6">
              {/* School Animated GIF Logo */}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-[#650019]">
                      1. School Logo (Animated GIF / Image)
                    </h3>
                    <p className="text-xs text-gray-500">
                      Upload a local GIF/image or paste a Google link — auto-saves automatically.
                    </p>
                  </div>
                  <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-300">
                    <button
                      type="button"
                      onClick={() => setLogoMode('local')}
                      className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                        logoMode === 'local' ? 'bg-[#650019] text-white' : 'text-gray-700'
                      }`}
                    >
                      Upload Local
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogoMode('link')}
                      className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                        logoMode === 'link' ? 'bg-[#650019] text-white' : 'text-gray-700'
                      }`}
                    >
                      Google / Web Link
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div
                    className={`w-16 h-16 rounded-xl overflow-hidden border-2 border-[#D4AF37] bg-white shrink-0 ${
                      logoAnimated ? 'animate-bnhs-seal' : ''
                    }`}
                  >
                    <ResilientImage
                      src={logoUrl || BNHS_ASSETS.eagleCrest}
                      alt="Logo Preview"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex-1 w-full space-y-2">
                    {logoMode === 'local' ? (
                      <div key="branding-logo-local" className="flex flex-wrap items-center gap-2">
                        <input
                          key="branding-logo-file-input"
                          ref={logoInputRef}
                          type="file"
                          accept="image/*,.gif"
                          onChange={handleLogoUpload}
                          className="hidden"
                          id="unified-logo-upload"
                        />
                        <label
                          htmlFor="unified-logo-upload"
                          className="px-3.5 py-2 rounded-lg bg-[#650019] text-white text-xs font-bold hover:bg-[#450012] inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5 text-[#D4AF37]" />
                          Upload Local Logo / GIF
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            brandingDirtyRef.current = true;
                            setLogoUrl(BNHS_ASSETS.eagleCrest);
                            setLogoAnimated(true);
                          }}
                          className="px-3 py-2 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer"
                        >
                          Restore Official GIF Seal
                        </button>
                      </div>
                    ) : (
                      <div key="branding-logo-link" className="flex gap-2">
                        <input
                          key="branding-logo-url-input"
                          type="url"
                          value={logoLink ?? ''}
                          onChange={(e) => {
                            brandingDirtyRef.current = true;
                            setLogoLink(e.target.value);
                            setLogoUrl(normalizeImageUrl(e.target.value));
                          }}
                          placeholder="Paste Google Drive link or GIF/image URL..."
                          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            brandingDirtyRef.current = true;
                            setLogoUrl(normalizeImageUrl(logoLink));
                          }}
                          className="px-3 py-2 rounded-lg bg-[#650019] text-white text-xs font-bold cursor-pointer"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    <label className="flex items-center gap-2 text-xs font-semibold text-gray-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(logoAnimated)}
                        onChange={(e) => {
                          brandingDirtyRef.current = true;
                          setLogoAnimated(e.target.checked);
                        }}
                        className="accent-[#650019]"
                      />
                      <span>Enable Animated GIF Pulse & Glow Effect</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Hero Campus Picture */}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-[#650019]">2. Hero Campus Picture</h3>
                  <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-300">
                    <button
                      type="button"
                      onClick={() => setHeroMode('local')}
                      className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                        heroMode === 'local' ? 'bg-[#650019] text-white' : 'text-gray-700'
                      }`}
                    >
                      Upload Local
                    </button>
                    <button
                      type="button"
                      onClick={() => setHeroMode('link')}
                      className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                        heroMode === 'link' ? 'bg-[#650019] text-white' : 'text-gray-700'
                      }`}
                    >
                      Google / Web Link
                    </button>
                  </div>
                </div>

                <div className="h-32 w-full rounded-lg overflow-hidden bg-[#450012] border border-[#D4AF37]/50">
                  <ResilientImage
                    src={heroImageUrl || BNHS_ASSETS.campusHero}
                    alt="Hero Preview"
                    className="w-full h-full object-cover"
                  />
                </div>

                {heroMode === 'local' ? (
                  <div key="branding-hero-local" className="flex flex-wrap items-center gap-2">
                    <input
                      key="branding-hero-file-input"
                      ref={heroInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleHeroUpload}
                      className="hidden"
                      id="unified-hero-upload"
                    />
                    <label
                      htmlFor="unified-hero-upload"
                      className="px-3.5 py-2 rounded-lg bg-[#650019] text-white text-xs font-bold hover:bg-[#450012] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-[#D4AF37]" />
                      Upload Local Campus Photo
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        brandingDirtyRef.current = true;
                        setHeroImageUrl(BNHS_ASSETS.campusHero);
                      }}
                      className="px-3 py-2 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer"
                    >
                      Restore Default Photo
                    </button>
                  </div>
                ) : (
                  <div key="branding-hero-link" className="flex gap-2">
                    <input
                      key="branding-hero-url-input"
                      type="url"
                      value={heroLink ?? ''}
                      onChange={(e) => {
                        brandingDirtyRef.current = true;
                        setHeroLink(e.target.value);
                        setHeroImageUrl(normalizeImageUrl(e.target.value));
                      }}
                      placeholder="Paste Google Drive link or image URL..."
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        brandingDirtyRef.current = true;
                        setHeroImageUrl(normalizeImageUrl(heroLink));
                      }}
                      className="px-3 py-2 rounded-lg bg-[#650019] text-white text-xs font-bold cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>
                )}
              </div>

              {/* Welcome Content & Hero Caption Texts */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-[#650019] border-b border-gray-200 pb-2">
                  3. Welcome Content, Hero Campus Caption & Directory Header Texts
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                      School Kicker *
                    </label>
                    <input
                      type="text"
                      required
                      value={schoolKicker ?? ''}
                      onChange={(e) => {
                        brandingDirtyRef.current = true;
                        setSchoolKicker(e.target.value);
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                      Portal Subtitle *
                    </label>
                    <input
                      type="text"
                      required
                      value={portalSubtitle ?? ''}
                      onChange={(e) => {
                        brandingDirtyRef.current = true;
                        setPortalSubtitle(e.target.value);
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                      Main Welcome Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={welcomeTitle ?? ''}
                      onChange={(e) => {
                        brandingDirtyRef.current = true;
                        setWelcomeTitle(e.target.value);
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                      Alumni Motto *
                    </label>
                    <input
                      type="text"
                      required
                      value={mottoText ?? ''}
                      onChange={(e) => {
                        brandingDirtyRef.current = true;
                        setMottoText(e.target.value);
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-[#650019]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Welcome Paragraph Content *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={welcomeDesc ?? ''}
                    onChange={(e) => {
                      brandingDirtyRef.current = true;
                      setWelcomeDesc(e.target.value);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                      Campus Overlay Location *
                    </label>
                    <input
                      type="text"
                      required
                      value={heroCaptionLocation ?? ''}
                      onChange={(e) => {
                        brandingDirtyRef.current = true;
                        setHeroCaptionLocation(e.target.value);
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                      Campus Overlay Headline *
                    </label>
                    <input
                      type="text"
                      required
                      value={heroCaptionTitle ?? ''}
                      onChange={(e) => {
                        brandingDirtyRef.current = true;
                        setHeroCaptionTitle(e.target.value);
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Campus Overlay Description *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={heroCaptionDesc ?? ''}
                    onChange={(e) => {
                      brandingDirtyRef.current = true;
                      setHeroCaptionDesc(e.target.value);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                      Directory Registry Kicker *
                    </label>
                    <input
                      type="text"
                      required
                      value={directoryKicker ?? ''}
                      onChange={(e) => {
                        brandingDirtyRef.current = true;
                        setDirectoryKicker(e.target.value);
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                      Directory Section Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={directoryTitle ?? ''}
                      onChange={(e) => {
                        brandingDirtyRef.current = true;
                        setDirectoryTitle(e.target.value);
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Directory Section Description *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={directoryDesc ?? ''}
                    onChange={(e) => {
                      brandingDirtyRef.current = true;
                      setDirectoryDesc(e.target.value);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Footer Address & Motto Line *
                  </label>
                  <input
                    type="text"
                    required
                    value={footerSubtitle ?? ''}
                    onChange={(e) => {
                      brandingDirtyRef.current = true;
                      setFooterSubtitle(e.target.value);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                  />
                </div>
              </div>

              {/* Social Links */}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
                <h3 className="text-sm font-bold text-[#650019]">
                  4. School Social Media Links (Footer Icons)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                      <Facebook className="w-3.5 h-3.5 text-[#650019]" /> Facebook URL
                    </label>
                    <input
                      type="url"
                      value={facebookUrl ?? ''}
                      onChange={(e) => {
                        brandingDirtyRef.current = true;
                        setFacebookUrl(e.target.value);
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                      <Twitter className="w-3.5 h-3.5 text-[#650019]" /> Twitter / X URL
                    </label>
                    <input
                      type="url"
                      value={twitterUrl ?? ''}
                      onChange={(e) => {
                        brandingDirtyRef.current = true;
                        setTwitterUrl(e.target.value);
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                      <Linkedin className="w-3.5 h-3.5 text-[#650019]" /> LinkedIn URL
                    </label>
                    <input
                      type="url"
                      value={linkedinUrl ?? ''}
                      onChange={(e) => {
                        brandingDirtyRef.current = true;
                        setLinkedinUrl(e.target.value);
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-200 flex items-center justify-between gap-3">
                <span className="text-[11px] text-emerald-700 font-semibold">
                  Changes auto-save automatically as you edit.
                </span>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-lg bg-[#650019] text-white text-xs font-bold hover:bg-[#450012] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4 text-[#D4AF37]" />
                  {saving ? 'Auto-Syncing...' : 'Save & Done'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: EVENTS & SLIDING PICTURES */}
          {activeTab === 'events' && (
            <form key="tab-form-events" onSubmit={handleSaveEventSubmit} className="space-y-5">
              {showEventSelector ? (
                <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                  <div className="flex-1 min-w-[220px]">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                      Select Event to Edit (Homecoming, Batch Reunion, Career Mentorship, Scholarship Drive, Community Outreach)
                    </label>
                    <select
                      value={selectedEventId ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'NEW') {
                          loadEventIntoForm(null);
                        } else {
                          const found = events.find((ev) => ev.id === val) || null;
                          loadEventIntoForm(found);
                        }
                        window.setTimeout(() => evTitleInputRef.current?.focus(), 40);
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm font-semibold"
                    >
                      {events.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          [{ev.category}] {ev.title}
                        </option>
                      ))}
                      <option value="NEW">+ Create New Event</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      loadEventIntoForm(null);
                      setShowEventSelector(false);
                      window.setTimeout(() => evTitleInputRef.current?.focus(), 40);
                    }}
                    className="px-3.5 py-2 rounded-lg bg-[#D4AF37] text-[#450012] text-xs font-bold hover:bg-[#e3c14d] inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Event
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2 bg-[#450012]/5 border border-[#D4AF37]/50 px-3.5 py-2.5 rounded-xl">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-[#650019]">
                      Direct Event Text & Sliding Photos Editor
                    </p>
                    <p className="text-xs font-bold text-gray-900 truncate">
                      {selectedEventId === 'NEW'
                        ? 'Creating New Event'
                        : `Editing: ${evTitle || evCategory}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowEventSelector(true)}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-800 text-xs font-semibold hover:bg-gray-100 cursor-pointer"
                    >
                      Switch Event
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        loadEventIntoForm(null);
                        window.setTimeout(() => evTitleInputRef.current?.focus(), 40);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#D4AF37] text-[#450012] text-xs font-bold hover:bg-[#e3c14d] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      New Event
                    </button>
                  </div>
                </div>
              )}

              {/* Direct Event Text Fields First */}
              <div className="p-4 rounded-xl bg-white border border-gray-200 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2">
                  <h3 className="text-sm font-bold text-[#650019]">
                    Event Text Details (Title, Date, Venue & Description)
                  </h3>
                  <span className="text-[11px] text-emerald-700 font-semibold">
                    Auto-saves every word automatically
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                      Event Title *
                    </label>
                    <input
                      ref={evTitleInputRef}
                      type="text"
                      required
                      minLength={5}
                      maxLength={140}
                      value={evTitle ?? ''}
                      onChange={(e) => {
                        eventDirtyRef.current = true;
                        setEvTitle(e.target.value);
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#650019]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                      Category *
                    </label>
                    <select
                      value={evCategory ?? 'Homecoming'}
                      onChange={(e) => {
                        eventDirtyRef.current = true;
                        setEvCategory(e.target.value as EventCategory);
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                    >
                      {ALLOWED_EVENT_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                      Date & Time *
                    </label>
                    <input
                      type="text"
                      required
                      minLength={4}
                      maxLength={50}
                      value={evDate ?? ''}
                      onChange={(e) => {
                        eventDirtyRef.current = true;
                        setEvDate(e.target.value);
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                      Venue *
                    </label>
                    <input
                      type="text"
                      required
                      minLength={3}
                      maxLength={140}
                      value={evVenue ?? ''}
                      onChange={(e) => {
                        eventDirtyRef.current = true;
                        setEvVenue(e.target.value);
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                      Status *
                    </label>
                    <select
                      value={evStatus ?? 'upcoming'}
                      onChange={(e) => {
                        eventDirtyRef.current = true;
                        setEvStatus(
                          e.target.value as 'upcoming' | 'ongoing' | 'completed' | 'archived'
                        );
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                    >
                      <option value="upcoming">Upcoming</option>
                      <option value="ongoing">Ongoing</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Event Description *
                  </label>
                  <textarea
                    rows={3}
                    required
                    minLength={10}
                    maxLength={1000}
                    value={evDesc ?? ''}
                    onChange={(e) => {
                      eventDirtyRef.current = true;
                      setEvDesc(e.target.value);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                  />
                </div>
              </div>

              {/* Sliding Pictures Manager */}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-[#650019] flex items-center gap-1.5">
                      <Images className="w-4 h-4" />
                      Sliding Event Pictures ({evSlides.length}/10) — {evCategory}
                    </h3>
                    <p className="text-xs text-gray-500">
                      Upload multiple photos from your device or paste Google Drive / web image links to animate this event's slideshow.
                    </p>
                  </div>
                  <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-300">
                    <button
                      type="button"
                      onClick={() => setEvSlideMode('local')}
                      className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                        evSlideMode === 'local' ? 'bg-[#650019] text-white' : 'text-gray-700'
                      }`}
                    >
                      Upload Local
                    </button>
                    <button
                      type="button"
                      onClick={() => setEvSlideMode('link')}
                      className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                        evSlideMode === 'link' ? 'bg-[#650019] text-white' : 'text-gray-700'
                      }`}
                    >
                      Google / Web Link
                    </button>
                  </div>
                </div>

                {/* Live Sliding Preview */}
                <div className="rounded-lg overflow-hidden border border-[#D4AF37]/50">
                  <EventSlidingGallery
                    images={evSlides}
                    title={evTitle || 'Event Slideshow Preview'}
                    category={evCategory}
                    heightClass="h-44 sm:h-52"
                    showCaptionOverlay={true}
                  />
                </div>

                {/* Thumbnails strip with remove */}
                {evSlides.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {evSlides.map((url, idx) => (
                      <div
                        key={`${idx}_${url.slice(0, 20)}`}
                        className="relative w-20 h-14 rounded-lg overflow-hidden border border-gray-300 bg-[#450012] group"
                      >
                        <img
                          src={url}
                          alt={`Slide ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            eventDirtyRef.current = true;
                            setEvSlides((prev) => prev.filter((_, i) => i !== idx));
                          }}
                          title="Remove slide"
                          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px] hover:bg-red-700 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        {idx === 0 && (
                          <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[#D4AF37] text-[9px] font-bold text-center">
                            Cover
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {evSlideMode === 'local' ? (
                  <div key="event-slide-local" className="flex flex-wrap items-center gap-2">
                    <input
                      key="event-slide-file-input"
                      ref={evFileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleEventSlidesUpload}
                      className="hidden"
                      id="unified-event-slides-upload"
                    />
                    <label
                      htmlFor="unified-event-slides-upload"
                      className="px-4 py-2 rounded-lg bg-[#650019] text-white text-xs font-bold hover:bg-[#450012] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5 text-[#D4AF37]" />
                      {uploadingEvSlide
                        ? 'Processing Photos...'
                        : 'Upload Local Photo(s) to Slideshow'}
                    </label>
                  </div>
                ) : (
                  <div key="event-slide-link" className="flex gap-2">
                    <input
                      key="event-slide-url-input"
                      type="url"
                      value={evSlideLink ?? ''}
                      onChange={(e) => setEvSlideLink(e.target.value)}
                      placeholder="Paste Google Drive share link or image URL..."
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAddEventSlideLink}
                      className="px-4 py-2 rounded-lg bg-[#650019] text-white text-xs font-bold hover:bg-[#450012] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#D4AF37]" />
                      Add Slide Link
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-gray-200 flex items-center justify-between gap-3">
                <span className="text-[11px] text-emerald-700 font-semibold">
                  Text & sliding photo changes auto-save automatically.
                </span>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-lg bg-[#650019] text-white text-xs font-bold hover:bg-[#450012] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4 text-[#D4AF37]" />
                  {saving ? 'Auto-Syncing...' : 'Save & Done'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: DIRECTORY PROFILES */}
          {activeTab === 'directory' && (
            <form key="tab-form-directory" onSubmit={handleSaveAlumSubmit} className="space-y-5">
              {showDirSelector ? (
                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                    Select Alumnus / Alumna Profile to Edit
                  </label>
                  <select
                    value={selectedAlumUid ?? ''}
                    onChange={(e) => {
                      const found = alumniList.find((a) => a.uid === e.target.value) || null;
                      loadAlumIntoForm(found);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm font-semibold"
                  >
                    {alumniList.map((a) => (
                      <option key={a.uid} value={a.uid}>
                        {a.fullName} (Batch {a.graduationYear} · {a.strand})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2 bg-[#450012]/5 border border-[#D4AF37]/50 px-3.5 py-2.5 rounded-xl">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-[#650019]">
                      Direct Alumni Profile Editor
                    </p>
                    <p className="text-xs font-bold text-gray-900 truncate">
                      Editing: {alumName} (Batch {alumYear})
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDirSelector(true)}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-800 text-xs font-semibold hover:bg-gray-100 cursor-pointer"
                  >
                    Switch Profile
                  </button>
                </div>
              )}

              {/* Photo upload */}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 flex flex-col sm:flex-row items-center gap-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#650019] border border-[#D4AF37] text-[#D4AF37] font-display font-bold text-xl flex items-center justify-center shrink-0">
                  {alumPhotoUrl ? (
                    <img
                      src={alumPhotoUrl}
                      alt={alumName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{alumName[0]?.toUpperCase() || 'E'}</span>
                  )}
                </div>
                <div className="flex-1 w-full space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAlumPhotoMode('local')}
                      className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                        alumPhotoMode === 'local'
                          ? 'bg-[#650019] text-white'
                          : 'bg-white border border-gray-300 text-gray-700'
                      }`}
                    >
                      Upload Local
                    </button>
                    <button
                      type="button"
                      onClick={() => setAlumPhotoMode('link')}
                      className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                        alumPhotoMode === 'link'
                          ? 'bg-[#650019] text-white'
                          : 'bg-white border border-gray-300 text-gray-700'
                      }`}
                    >
                      Google / Web Link
                    </button>
                  </div>
                  {alumPhotoMode === 'local' ? (
                    <div key="alum-photo-local" className="flex items-center gap-2">
                      <input
                        key="alum-photo-file-input"
                        ref={alumFileRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAlumPhotoUpload}
                        className="hidden"
                        id="unified-alum-photo"
                      />
                      <label
                        htmlFor="unified-alum-photo"
                        className="px-3.5 py-2 rounded-lg bg-[#650019] text-white text-xs font-bold hover:bg-[#450012] inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5 text-[#D4AF37]" />
                        Upload Profile Photo
                      </label>
                    </div>
                  ) : (
                    <div key="alum-photo-link" className="flex gap-2">
                      <input
                        key="alum-photo-url-input"
                        type="url"
                        value={alumPhotoLink ?? ''}
                        onChange={(e) => {
                          alumDirtyRef.current = true;
                          setAlumPhotoLink(e.target.value);
                          setAlumPhotoUrl(normalizeImageUrl(e.target.value));
                        }}
                        placeholder="Paste Google Drive link or image URL..."
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-xs"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    ref={alumNameInputRef}
                    type="text"
                    required
                    value={alumName ?? ''}
                    onChange={(e) => {
                      alumDirtyRef.current = true;
                      setAlumName(e.target.value);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Graduation Year *
                  </label>
                  <select
                    value={alumYear ?? 2020}
                    onChange={(e) => {
                      alumDirtyRef.current = true;
                      setAlumYear(Number(e.target.value));
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm font-mono-num"
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
                    Strand *
                  </label>
                  <select
                    value={alumStrand ?? 'STEM'}
                    onChange={(e) => {
                      alumDirtyRef.current = true;
                      setAlumStrand(e.target.value as AlumniStrand);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
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
                    onChange={(e) => {
                      alumDirtyRef.current = true;
                      setAlumSection(e.target.value);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Degree / Course *
                  </label>
                  <input
                    type="text"
                    required
                    value={alumCourse ?? ''}
                    onChange={(e) => {
                      alumDirtyRef.current = true;
                      setAlumCourse(e.target.value);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
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
                    onChange={(e) => {
                      alumDirtyRef.current = true;
                      setAlumProfession(e.target.value);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
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
                    onChange={(e) => {
                      alumDirtyRef.current = true;
                      setAlumEmployment(e.target.value);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Current City *
                  </label>
                  <input
                    type="text"
                    required
                    value={alumCity ?? ''}
                    onChange={(e) => {
                      alumDirtyRef.current = true;
                      setAlumCity(e.target.value);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Industry Sector *
                  </label>
                  <select
                    value={alumIndustry ?? 'Engineering & Architecture'}
                    onChange={(e) => {
                      alumDirtyRef.current = true;
                      setAlumIndustry(e.target.value);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                  >
                    {ALLOWED_INDUSTRY_SECTORS.map((sec) => (
                      <option key={sec} value={sec}>
                        {sec}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Mentorship Role *
                  </label>
                  <select
                    value={alumMentorship ?? 'mentor'}
                    onChange={(e) => {
                      alumDirtyRef.current = true;
                      setAlumMentorship(e.target.value as MentorshipRole);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                  >
                    <option value="mentor">Mentor</option>
                    <option value="mentee">Mentee</option>
                    <option value="both">Both Mentor & Mentee</option>
                    <option value="none">Opted Out</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Bio / Legacy Note *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={alumBio ?? ''}
                    onChange={(e) => {
                      alumDirtyRef.current = true;
                      setAlumBio(e.target.value);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-200 flex items-center justify-between gap-3">
                <span className="text-[11px] text-emerald-700 font-semibold">
                  Profile changes auto-save automatically.
                </span>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-lg bg-[#650019] text-white text-xs font-bold hover:bg-[#450012] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4 text-[#D4AF37]" />
                  {saving ? 'Auto-Syncing...' : 'Save & Done'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 4: ANNOUNCEMENTS */}
          {activeTab === 'announcements' && (
            <form key="tab-form-announcements" onSubmit={handleSaveAnnSubmit} className="space-y-4">
              {showAnnSelector ? (
                <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                  <div className="flex-1 min-w-[220px]">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                      Select Official Bulletin to Edit
                    </label>
                    <select
                      value={selectedAnnId ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'NEW') {
                          loadAnnIntoForm(null);
                        } else {
                          loadAnnIntoForm(announcements.find((a) => a.id === val) || null);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm font-semibold"
                    >
                      {announcements.map((a) => (
                        <option key={a.id} value={a.id}>
                          [{a.category}] {a.title}
                        </option>
                      ))}
                      <option value="NEW">+ Publish New Bulletin</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      loadAnnIntoForm(null);
                      setShowAnnSelector(false);
                      window.setTimeout(() => annTitleInputRef.current?.focus(), 40);
                    }}
                    className="px-3.5 py-2 rounded-lg bg-[#D4AF37] text-[#450012] text-xs font-bold hover:bg-[#e3c14d] inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Bulletin
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2 bg-[#450012]/5 border border-[#D4AF37]/50 px-3.5 py-2.5 rounded-xl">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-[#650019]">
                      Direct Official Bulletin Editor
                    </p>
                    <p className="text-xs font-bold text-gray-900 truncate">
                      {selectedAnnId === 'NEW' ? 'Publishing New Bulletin' : `Editing: ${annTitle}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowAnnSelector(true)}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-800 text-xs font-semibold hover:bg-gray-100 cursor-pointer"
                    >
                      Switch Bulletin
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        loadAnnIntoForm(null);
                        window.setTimeout(() => annTitleInputRef.current?.focus(), 40);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#D4AF37] text-[#450012] text-xs font-bold hover:bg-[#e3c14d] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      New
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Announcement Headline (5–150 chars) *
                </label>
                <input
                  ref={annTitleInputRef}
                  type="text"
                  required
                  minLength={5}
                  maxLength={150}
                  value={annTitle ?? ''}
                  onChange={(e) => {
                    annDirtyRef.current = true;
                    setAnnTitle(e.target.value);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={annCategory ?? 'Official Bulletin'}
                    onChange={(e) => {
                      annDirtyRef.current = true;
                      setAnnCategory(e.target.value as AnnouncementCategory);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                  >
                    {ALLOWED_ANNOUNCEMENT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Issuing Office / Author *
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={100}
                    value={annAuthor ?? ''}
                    onChange={(e) => {
                      annDirtyRef.current = true;
                      setAnnAuthor(e.target.value);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Summary Deck (10–300 chars) *
                </label>
                <input
                  type="text"
                  required
                  minLength={10}
                  maxLength={300}
                  value={annSummary ?? ''}
                  onChange={(e) => {
                    annDirtyRef.current = true;
                    setAnnSummary(e.target.value);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Full Bulletin Content (20–2000 chars) *
                </label>
                <textarea
                  rows={5}
                  required
                  minLength={20}
                  maxLength={2000}
                  value={annContent ?? ''}
                  onChange={(e) => {
                    annDirtyRef.current = true;
                    setAnnContent(e.target.value);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                />
              </div>

              <div className="pt-3 border-t border-gray-200 flex items-center justify-between gap-3">
                <span className="text-[11px] text-emerald-700 font-semibold">
                  Bulletin changes auto-save automatically.
                </span>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-lg bg-[#650019] text-white text-xs font-bold hover:bg-[#450012] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4 text-[#D4AF37]" />
                  {saving ? 'Auto-Syncing...' : 'Save & Done'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 5: SPOTLIGHT MILESTONES */}
          {activeTab === 'spotlights' && (
            <form key="tab-form-spotlights" onSubmit={handleSaveSpotlightSubmit} className="space-y-4">
              {showSpotSelector ? (
                <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                  <div className="flex-1 min-w-[220px]">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                      Select Alumni Spotlight Story to Edit
                    </label>
                    <select
                      value={selectedSpotId ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'NEW') {
                          loadSpotlightIntoForm(null);
                        } else {
                          loadSpotlightIntoForm(spotlights.find((s) => s.id === val) || null);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm font-semibold"
                    >
                      {spotlights.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nomineeName} (Batch {s.graduationYear})
                        </option>
                      ))}
                      <option value="NEW">+ Add New Spotlight Story</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      loadSpotlightIntoForm(null);
                      setShowSpotSelector(false);
                      window.setTimeout(() => spotNomineeInputRef.current?.focus(), 40);
                    }}
                    className="px-3.5 py-2 rounded-lg bg-[#D4AF37] text-[#450012] text-xs font-bold hover:bg-[#e3c14d] inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Spotlight
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2 bg-[#450012]/5 border border-[#D4AF37]/50 px-3.5 py-2.5 rounded-xl">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-[#650019]">
                      Direct Spotlight Milestone Editor
                    </p>
                    <p className="text-xs font-bold text-gray-900 truncate">
                      {selectedSpotId === 'NEW'
                        ? 'Adding New Spotlight Story'
                        : `Editing: ${spotNominee}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowSpotSelector(true)}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-800 text-xs font-semibold hover:bg-gray-100 cursor-pointer"
                    >
                      Switch Story
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        loadSpotlightIntoForm(null);
                        window.setTimeout(() => spotNomineeInputRef.current?.focus(), 40);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#D4AF37] text-[#450012] text-xs font-bold hover:bg-[#e3c14d] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      New
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Nominee Full Name *
                </label>
                <input
                  ref={spotNomineeInputRef}
                  type="text"
                  required
                  minLength={2}
                  maxLength={100}
                  value={spotNominee ?? ''}
                  onChange={(e) => {
                    spotDirtyRef.current = true;
                    setSpotNominee(e.target.value);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Graduation Year *
                  </label>
                  <select
                    value={spotYear ?? 2020}
                    onChange={(e) => {
                      spotDirtyRef.current = true;
                      setSpotYear(Number(e.target.value));
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm font-mono-num"
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
                    Strand *
                  </label>
                  <select
                    value={spotStrand ?? 'STEM'}
                    onChange={(e) => {
                      spotDirtyRef.current = true;
                      setSpotStrand(e.target.value as AlumniStrand);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
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
                    Current Profession *
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={100}
                    value={spotProfession ?? ''}
                    onChange={(e) => {
                      spotDirtyRef.current = true;
                      setSpotProfession(e.target.value);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Nominated By *
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={100}
                    value={spotNominator ?? ''}
                    onChange={(e) => {
                      spotDirtyRef.current = true;
                      setSpotNominator(e.target.value);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
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
                  value={spotMilestone ?? ''}
                  onChange={(e) => {
                    spotDirtyRef.current = true;
                    setSpotMilestone(e.target.value);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Success Story Summary (15–800 chars) *
                </label>
                <textarea
                  rows={4}
                  required
                  minLength={15}
                  maxLength={800}
                  value={spotStory ?? ''}
                  onChange={(e) => {
                    spotDirtyRef.current = true;
                    setSpotStory(e.target.value);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                />
              </div>

              <div className="pt-3 border-t border-gray-200 flex items-center justify-between gap-3">
                <span className="text-[11px] text-emerald-700 font-semibold">
                  Spotlight milestone changes auto-save automatically.
                </span>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-lg bg-[#650019] text-white text-xs font-bold hover:bg-[#450012] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4 text-[#D4AF37]" />
                  {saving ? 'Auto-Syncing...' : 'Save & Done'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
