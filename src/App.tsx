/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  ArrowRight,
  Calendar,
  GraduationCap,
  Megaphone,
  Users,
  UserPlus,
  Briefcase,
  MapPin,
  Settings,
  Upload,
  Link2,
  Save,
  X,
  CheckCircle2,
  Facebook,
  Twitter,
  Linkedin,
  Cloud,
  Edit3,
  LogIn,
} from 'lucide-react';
import {
  auth,
  db,
  fileToCompressedDataUrl,
  handleFirestoreError,
  logOutUser,
  normalizeImageUrl,
  OperationType,
  sanitizeId,
  sanitizeString,
  signInWithGoogle,
} from './lib/firebase';
import {
  AlumniEventRecord,
  AlumniPrivateRecord,
  AlumniProfileRecord,
  AnnouncementRecord,
  BNHS_ASSETS,
  DEFAULT_PORTAL_SETTINGS,
  EventRsvpRecord,
  INITIAL_ALUMNI_DIRECTORY,
  INITIAL_ANNOUNCEMENTS,
  INITIAL_EVENTS,
  INITIAL_SPOTLIGHT_STORIES,
  PortalSettingsRecord,
  SpotlightStoryRecord,
} from './data/bnhsData';
import { ResilientImage } from './components/ResilientImage';
import { DirectoryModule } from './components/DirectoryModule';
import { RegistrationModule } from './components/RegistrationModule';
import { EventsAndAnnouncementsModule } from './components/EventsAndAnnouncementsModule';
import { AlumniDashboardModule } from './components/AlumniDashboardModule';
import { AlumniInsightsSection } from './components/AlumniInsightsSection';
import { AlumniSpotlightCarousel } from './components/AlumniSpotlightCarousel';

type PortalTab = 'home' | 'directory' | 'register' | 'events' | 'announcements' | 'dashboard';

const STORAGE_KEYS = {
  settings: 'bnhs_portal_settings_v2',
  profiles: 'bnhs_local_profiles_v2',
  deletedProfiles: 'bnhs_deleted_profiles_v2',
  events: 'bnhs_local_events_v2',
  deletedEvents: 'bnhs_deleted_events_v2',
  announcements: 'bnhs_local_announcements_v2',
  deletedAnnouncements: 'bnhs_deleted_announcements_v2',
  spotlights: 'bnhs_local_spotlights_v2',
  deletedSpotlights: 'bnhs_deleted_spotlights_v2',
  directUser: 'bnhs_direct_portal_user_v2',
};

interface DirectPortalUser {
  uid: string;
  displayName: string;
  email: string;
  graduationYear: number;
  photoURL: string | null;
}

function loadJsonFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJsonToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('Local storage write warning:', err);
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<PortalTab>('home');
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [directUser, setDirectUser] = useState<DirectPortalUser | null>(() =>
    loadJsonFromStorage<DirectPortalUser | null>(STORAGE_KEYS.directUser, null)
  );
  const [authReady, setAuthReady] = useState(false);
  const [directoryYearFilter, setDirectoryYearFilter] = useState<string>('ALL');
  const [directoryCityFilter, setDirectoryCityFilter] = useState<string>('ALL');

  // Persistent Alumni Portal Login Modal State (prevents disappearing login on published URLs)
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [modalLoginName, setModalLoginName] = useState('');
  const [modalLoginEmail, setModalLoginEmail] = useState('');
  const [modalLoginBatchYear, setModalLoginBatchYear] = useState<number>(2020);
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);
  const [googleSigningIn, setGoogleSigningIn] = useState(false);

  // Cloud Sync Indicator State
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'synced' | 'syncing' | 'local'>('synced');
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('Live');

  // Effective user combines Firebase Auth User or Direct Alumni Portal Session User
  const currentUser = useMemo<User | null>(() => {
    if (firebaseUser) return firebaseUser;
    if (directUser) {
      return {
        uid: directUser.uid,
        displayName: directUser.displayName,
        email: directUser.email,
        photoURL: directUser.photoURL,
        emailVerified: true,
      } as unknown as User;
    }
    return null;
  }, [firebaseUser, directUser]);

  // Portal Settings (Logo GIF, Hero Picture, Welcome Content, Directory Header, Hero Caption, Footer Subtitle)
  const [portalSettings, setPortalSettings] = useState<PortalSettingsRecord>(() => {
    const saved = loadJsonFromStorage<Partial<PortalSettingsRecord>>(STORAGE_KEYS.settings, {});
    return {
      ...DEFAULT_PORTAL_SETTINGS,
      ...saved,
      logoUrl: saved.logoUrl || DEFAULT_PORTAL_SETTINGS.logoUrl,
      logoAnimated:
        typeof saved.logoAnimated === 'boolean'
          ? saved.logoAnimated
          : DEFAULT_PORTAL_SETTINGS.logoAnimated,
      heroImageUrl: saved.heroImageUrl || DEFAULT_PORTAL_SETTINGS.heroImageUrl,
      schoolKicker: saved.schoolKicker || DEFAULT_PORTAL_SETTINGS.schoolKicker,
      portalSubtitle: saved.portalSubtitle || DEFAULT_PORTAL_SETTINGS.portalSubtitle,
      welcomeTitle: saved.welcomeTitle || DEFAULT_PORTAL_SETTINGS.welcomeTitle,
      mottoText: saved.mottoText || DEFAULT_PORTAL_SETTINGS.mottoText,
      welcomeDescription: (
        saved.welcomeDescription || DEFAULT_PORTAL_SETTINGS.welcomeDescription
      )
        .replace(/Batch 1971/g, 'Batch 1982')
        .replace(/1971-1999/g, '1982-1999'),
      directoryKicker: saved.directoryKicker || DEFAULT_PORTAL_SETTINGS.directoryKicker,
      directoryTitle: saved.directoryTitle || DEFAULT_PORTAL_SETTINGS.directoryTitle,
      directoryDescription:
        saved.directoryDescription || DEFAULT_PORTAL_SETTINGS.directoryDescription,
      facebookUrl:
        typeof saved.facebookUrl === 'string'
          ? saved.facebookUrl
          : DEFAULT_PORTAL_SETTINGS.facebookUrl,
      twitterUrl:
        typeof saved.twitterUrl === 'string'
          ? saved.twitterUrl
          : DEFAULT_PORTAL_SETTINGS.twitterUrl,
      linkedinUrl:
        typeof saved.linkedinUrl === 'string'
          ? saved.linkedinUrl
          : DEFAULT_PORTAL_SETTINGS.linkedinUrl,
      heroCaptionLocation:
        saved.heroCaptionLocation || DEFAULT_PORTAL_SETTINGS.heroCaptionLocation,
      heroCaptionTitle: saved.heroCaptionTitle || DEFAULT_PORTAL_SETTINGS.heroCaptionTitle,
      heroCaptionDescription:
        saved.heroCaptionDescription || DEFAULT_PORTAL_SETTINGS.heroCaptionDescription,
      footerSubtitle: saved.footerSubtitle || DEFAULT_PORTAL_SETTINGS.footerSubtitle,
      visibility: 'public',
    };
  });

  // Admin Hero / Branding Editor Modal State
  const [showAdminHeroModal, setShowAdminHeroModal] = useState(false);
  const [editLogoUrl, setEditLogoUrl] = useState(DEFAULT_PORTAL_SETTINGS.logoUrl);
  const [editLogoMode, setEditLogoMode] = useState<'local' | 'link'>('local');
  const [editLogoLink, setEditLogoLink] = useState('');
  const [editLogoAnimated, setEditLogoAnimated] = useState(true);
  const [editHeroImageUrl, setEditHeroImageUrl] = useState(DEFAULT_PORTAL_SETTINGS.heroImageUrl);
  const [editHeroMode, setEditHeroMode] = useState<'local' | 'link'>('local');
  const [editHeroLink, setEditHeroLink] = useState('');
  const [editSchoolKicker, setEditSchoolKicker] = useState(DEFAULT_PORTAL_SETTINGS.schoolKicker);
  const [editPortalSubtitle, setEditPortalSubtitle] = useState(
    DEFAULT_PORTAL_SETTINGS.portalSubtitle
  );
  const [editWelcomeTitle, setEditWelcomeTitle] = useState(DEFAULT_PORTAL_SETTINGS.welcomeTitle);
  const [editMottoText, setEditMottoText] = useState(DEFAULT_PORTAL_SETTINGS.mottoText);
  const [editWelcomeDesc, setEditWelcomeDesc] = useState(
    DEFAULT_PORTAL_SETTINGS.welcomeDescription
  );
  const [editFacebookUrl, setEditFacebookUrl] = useState(DEFAULT_PORTAL_SETTINGS.facebookUrl);
  const [editTwitterUrl, setEditTwitterUrl] = useState(DEFAULT_PORTAL_SETTINGS.twitterUrl);
  const [editLinkedinUrl, setEditLinkedinUrl] = useState(DEFAULT_PORTAL_SETTINGS.linkedinUrl);
  const [editHeroCaptionLocation, setEditHeroCaptionLocation] = useState(
    DEFAULT_PORTAL_SETTINGS.heroCaptionLocation
  );
  const [editHeroCaptionTitle, setEditHeroCaptionTitle] = useState(
    DEFAULT_PORTAL_SETTINGS.heroCaptionTitle
  );
  const [editHeroCaptionDescription, setEditHeroCaptionDescription] = useState(
    DEFAULT_PORTAL_SETTINGS.heroCaptionDescription
  );
  const [editFooterSubtitle, setEditFooterSubtitle] = useState(
    DEFAULT_PORTAL_SETTINGS.footerSubtitle
  );
  const [savingHeroSettings, setSavingHeroSettings] = useState(false);
  const [adminToast, setAdminToast] = useState<string | null>(null);

  // Dedicated Hero Caption Edit Modal State
  const [showHeroCaptionModal, setShowHeroCaptionModal] = useState(false);
  // Dedicated Footer Subtitle Edit Modal State
  const [showFooterEditModal, setShowFooterEditModal] = useState(false);

  // Online Alumni Registration Modal State
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);

  const logoFileInputRef = useRef<HTMLInputElement | null>(null);
  const heroFileInputRef = useRef<HTMLInputElement | null>(null);

  // Firestore & Local Persisted Collections
  const [firestoreProfiles, setFirestoreProfiles] = useState<AlumniProfileRecord[]>([]);
  const [localProfileOverrides, setLocalProfileOverrides] = useState<
    Record<string, AlumniProfileRecord>
  >(() => loadJsonFromStorage(STORAGE_KEYS.profiles, {}));
  const [deletedProfileUids, setDeletedProfileUids] = useState<Record<string, boolean>>(() =>
    loadJsonFromStorage(STORAGE_KEYS.deletedProfiles, {})
  );

  const [myProfile, setMyProfile] = useState<AlumniProfileRecord | null>(null);
  const [myPrivate, setMyPrivate] = useState<AlumniPrivateRecord | null>(null);

  const [firestoreEvents, setFirestoreEvents] = useState<AlumniEventRecord[]>([]);
  const [localEventOverrides, setLocalEventOverrides] = useState<
    Record<string, AlumniEventRecord>
  >(() => loadJsonFromStorage(STORAGE_KEYS.events, {}));
  const [deletedEventIds, setDeletedEventIds] = useState<Record<string, boolean>>(() =>
    loadJsonFromStorage(STORAGE_KEYS.deletedEvents, {})
  );

  const [firestoreAnnouncements, setFirestoreAnnouncements] = useState<AnnouncementRecord[]>([]);
  const [localAnnouncementOverrides, setLocalAnnouncementOverrides] = useState<
    Record<string, AnnouncementRecord>
  >(() => loadJsonFromStorage(STORAGE_KEYS.announcements, {}));
  const [deletedAnnouncementIds, setDeletedAnnouncementIds] = useState<Record<string, boolean>>(
    () => loadJsonFromStorage(STORAGE_KEYS.deletedAnnouncements, {})
  );

  const [firestoreSpotlights, setFirestoreSpotlights] = useState<SpotlightStoryRecord[]>([]);
  const [localSpotlightOverrides, setLocalSpotlightOverrides] = useState<
    Record<string, SpotlightStoryRecord>
  >(() => loadJsonFromStorage(STORAGE_KEYS.spotlights, {}));
  const [deletedSpotlightIds, setDeletedSpotlightIds] = useState<Record<string, boolean>>(() =>
    loadJsonFromStorage(STORAGE_KEYS.deletedSpotlights, {})
  );

  const [myRsvps, setMyRsvps] = useState<Record<string, EventRsvpRecord>>({});

  // Persist local overrides & deletions to localStorage automatically
  useEffect(() => {
    saveJsonToStorage(STORAGE_KEYS.settings, portalSettings);
  }, [portalSettings]);

  useEffect(() => {
    saveJsonToStorage(STORAGE_KEYS.profiles, localProfileOverrides);
  }, [localProfileOverrides]);

  useEffect(() => {
    saveJsonToStorage(STORAGE_KEYS.deletedProfiles, deletedProfileUids);
  }, [deletedProfileUids]);

  useEffect(() => {
    saveJsonToStorage(STORAGE_KEYS.events, localEventOverrides);
  }, [localEventOverrides]);

  useEffect(() => {
    saveJsonToStorage(STORAGE_KEYS.deletedEvents, deletedEventIds);
  }, [deletedEventIds]);

  useEffect(() => {
    saveJsonToStorage(STORAGE_KEYS.announcements, localAnnouncementOverrides);
  }, [localAnnouncementOverrides]);

  useEffect(() => {
    saveJsonToStorage(STORAGE_KEYS.deletedAnnouncements, deletedAnnouncementIds);
  }, [deletedAnnouncementIds]);

  useEffect(() => {
    saveJsonToStorage(STORAGE_KEYS.spotlights, localSpotlightOverrides);
  }, [localSpotlightOverrides]);

  useEffect(() => {
    saveJsonToStorage(STORAGE_KEYS.deletedSpotlights, deletedSpotlightIds);
  }, [deletedSpotlightIds]);

  useEffect(() => {
    saveJsonToStorage(STORAGE_KEYS.directUser, directUser);
  }, [directUser]);

  // Track Firebase Auth State
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Public Firestore Listeners (strictly querying where visibility == 'public' per Query Enforcer rule)
  useEffect(() => {
    if (!authReady) return;

    const settingsQuery = query(
      collection(db, 'portal_settings'),
      where('visibility', '==', 'public')
    );
    const unsubSettings = onSnapshot(
      settingsQuery,
      (snap) => {
        snap.forEach((docSnap) => {
          if (docSnap.id === 'main') {
            const d = docSnap.data();
            const updatedSettings: PortalSettingsRecord = {
              logoUrl: d.logoUrl || DEFAULT_PORTAL_SETTINGS.logoUrl,
              logoAnimated:
                typeof d.logoAnimated === 'boolean'
                  ? d.logoAnimated
                  : DEFAULT_PORTAL_SETTINGS.logoAnimated,
              heroImageUrl: d.heroImageUrl || DEFAULT_PORTAL_SETTINGS.heroImageUrl,
              schoolKicker: d.schoolKicker || DEFAULT_PORTAL_SETTINGS.schoolKicker,
              portalSubtitle: d.portalSubtitle || DEFAULT_PORTAL_SETTINGS.portalSubtitle,
              welcomeTitle: d.welcomeTitle || DEFAULT_PORTAL_SETTINGS.welcomeTitle,
              mottoText: d.mottoText || DEFAULT_PORTAL_SETTINGS.mottoText,
              welcomeDescription: (
                d.welcomeDescription || DEFAULT_PORTAL_SETTINGS.welcomeDescription
              )
                .replace(/Batch 1971/g, 'Batch 1982')
                .replace(/1971-1999/g, '1982-1999'),
              directoryKicker: d.directoryKicker || DEFAULT_PORTAL_SETTINGS.directoryKicker,
              directoryTitle: d.directoryTitle || DEFAULT_PORTAL_SETTINGS.directoryTitle,
              directoryDescription:
                d.directoryDescription || DEFAULT_PORTAL_SETTINGS.directoryDescription,
              facebookUrl:
                typeof d.facebookUrl === 'string'
                  ? d.facebookUrl
                  : DEFAULT_PORTAL_SETTINGS.facebookUrl,
              twitterUrl:
                typeof d.twitterUrl === 'string'
                  ? d.twitterUrl
                  : DEFAULT_PORTAL_SETTINGS.twitterUrl,
              linkedinUrl:
                typeof d.linkedinUrl === 'string'
                  ? d.linkedinUrl
                  : DEFAULT_PORTAL_SETTINGS.linkedinUrl,
              heroCaptionLocation:
                d.heroCaptionLocation || DEFAULT_PORTAL_SETTINGS.heroCaptionLocation,
              heroCaptionTitle: d.heroCaptionTitle || DEFAULT_PORTAL_SETTINGS.heroCaptionTitle,
              heroCaptionDescription:
                d.heroCaptionDescription || DEFAULT_PORTAL_SETTINGS.heroCaptionDescription,
              footerSubtitle: d.footerSubtitle || DEFAULT_PORTAL_SETTINGS.footerSubtitle,
              visibility: 'public',
            };
            setPortalSettings(updatedSettings);
            setCloudSyncStatus('synced');
            setLastSyncedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
          }
        });
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'portal_settings')
    );

    const profilesQuery = query(
      collection(db, 'alumni_profiles'),
      where('visibility', '==', 'public')
    );
    const unsubProfiles = onSnapshot(
      profilesQuery,
      (snap) => {
        const rows: AlumniProfileRecord[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          rows.push({
            uid: d.uid || docSnap.id,
            fullName: d.fullName || '',
            graduationYear: Number(d.graduationYear) || 2020,
            formerSection: d.formerSection || '',
            strand: d.strand || 'STEM',
            course: d.course || '',
            profession: d.profession || '',
            currentEmployment: d.currentEmployment || '',
            locationCity: d.locationCity || 'Barobo, Surigao del Sur',
            bio: d.bio || '',
            mentorshipRole: d.mentorshipRole || 'none',
            industrySector: d.industrySector || 'Engineering & Architecture',
            photoUrl: d.photoUrl || '',
            visibility: d.visibility || 'public',
            isVerifiedRecord: true,
          });
        });
        setFirestoreProfiles(rows);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'alumni_profiles')
    );

    const eventsQuery = query(collection(db, 'events'), where('visibility', '==', 'public'));
    const unsubEvents = onSnapshot(
      eventsQuery,
      (snap) => {
        const rows: AlumniEventRecord[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          rows.push({
            id: docSnap.id,
            authorId: d.authorId || 'system_bnhs_admin',
            title: d.title || '',
            category: d.category || 'Homecoming',
            eventDate: d.eventDate || '',
            venue: d.venue || '',
            description: d.description || '',
            imageUrl: d.imageUrl || '',
            status: d.status || 'upcoming',
            visibility: 'public',
          });
        });
        setFirestoreEvents(rows);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'events')
    );

    const annQuery = query(collection(db, 'announcements'), where('visibility', '==', 'public'));
    const unsubAnn = onSnapshot(
      annQuery,
      (snap) => {
        const rows: AnnouncementRecord[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          rows.push({
            id: docSnap.id,
            authorId: d.authorId || 'system_bnhs_admin',
            authorName: d.authorName || 'BNHS Alumni Federation',
            title: d.title || '',
            category: d.category || 'Official Bulletin',
            summary: d.summary || '',
            content: d.content || '',
            status: d.status || 'published',
            visibility: 'public',
            publishedLabel: 'Verified Portal Release',
          });
        });
        setFirestoreAnnouncements(rows);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'announcements')
    );

    const spotlightQuery = query(
      collection(db, 'spotlight_nominations'),
      where('visibility', '==', 'public')
    );
    const unsubSpotlights = onSnapshot(
      spotlightQuery,
      (snap) => {
        const rows: SpotlightStoryRecord[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          rows.push({
            id: docSnap.id,
            nominatorUid: d.nominatorUid || 'system_bnhs_admin',
            nominatorName: d.nominatorName || 'BNHS Alumni Federation',
            nomineeName: d.nomineeName || '',
            graduationYear: Number(d.graduationYear) || 2020,
            strand: d.strand || 'STEM',
            profession: d.profession || '',
            milestoneTitle: d.milestoneTitle || '',
            story: d.story || '',
            visibility: 'public',
          });
        });
        setFirestoreSpotlights(rows);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'spotlight_nominations')
    );

    return () => {
      unsubSettings();
      unsubProfiles();
      unsubEvents();
      unsubAnn();
      unsubSpotlights();
    };
  }, [authReady]);

  // Authenticated User Listeners
  useEffect(() => {
    if (!authReady || !firebaseUser) {
      if (directUser) {
        const localProf = localProfileOverrides[directUser.uid];
        if (localProf) {
          setMyProfile(localProf);
        }
      } else {
        setMyProfile(null);
        setMyPrivate(null);
        setMyRsvps({});
      }
      return;
    }

    const myProfileRef = doc(db, 'alumni_profiles', firebaseUser.uid);
    const unsubMyProfile = onSnapshot(
      myProfileRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const d = docSnap.data();
          setMyProfile({
            uid: d.uid || firebaseUser.uid,
            fullName: d.fullName || '',
            graduationYear: Number(d.graduationYear) || 2020,
            formerSection: d.formerSection || '',
            strand: d.strand || 'STEM',
            course: d.course || '',
            profession: d.profession || '',
            currentEmployment: d.currentEmployment || '',
            locationCity: d.locationCity || 'Barobo, Surigao del Sur',
            bio: d.bio || '',
            mentorshipRole: d.mentorshipRole || 'none',
            industrySector: d.industrySector || 'Engineering & Architecture',
            photoUrl: d.photoUrl || '',
            visibility: d.visibility || 'public',
          });
        } else {
          setMyProfile(null);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `alumni_profiles/${firebaseUser.uid}`)
    );

    const myPrivateRef = doc(db, 'alumni_private', firebaseUser.uid);
    const unsubMyPrivate = onSnapshot(
      myPrivateRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const d = docSnap.data();
          setMyPrivate({
            uid: d.uid || firebaseUser.uid,
            email: d.email || '',
            phone: d.phone || '',
            homeAddress: d.homeAddress || '',
          });
        } else {
          setMyPrivate(null);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `alumni_private/${firebaseUser.uid}`)
    );

    const myRsvpsQuery = query(
      collection(db, 'event_rsvps'),
      where('uid', '==', firebaseUser.uid)
    );
    const unsubRsvps = onSnapshot(
      myRsvpsQuery,
      (snap) => {
        const map: Record<string, EventRsvpRecord> = {};
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          map[d.eventId] = {
            id: docSnap.id,
            uid: d.uid,
            eventId: d.eventId,
            attendeeName: d.attendeeName || '',
            graduationYear: Number(d.graduationYear) || 2020,
            status: d.status || 'attending',
          };
        });
        setMyRsvps(map);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'event_rsvps')
    );

    return () => {
      unsubMyProfile();
      unsubMyPrivate();
      unsubRsvps();
    };
  }, [authReady, firebaseUser, directUser, localProfileOverrides]);

  // Merge live Firestore data + local edits - deleted items
  const combinedAlumniDirectory = useMemo(() => {
    const map = new Map<string, AlumniProfileRecord>();
    INITIAL_ALUMNI_DIRECTORY.forEach((p) => {
      if (!deletedProfileUids[p.uid]) map.set(p.uid, p);
    });
    firestoreProfiles.forEach((p) => {
      if (!deletedProfileUids[p.uid]) map.set(p.uid, p);
    });
    Object.values(localProfileOverrides).forEach((p) => {
      if (!deletedProfileUids[p.uid]) map.set(p.uid, p);
    });
    return Array.from(map.values()).sort((a, b) => b.graduationYear - a.graduationYear);
  }, [firestoreProfiles, localProfileOverrides, deletedProfileUids]);

  const combinedEvents = useMemo(() => {
    const map = new Map<string, AlumniEventRecord>();
    INITIAL_EVENTS.forEach((ev) => {
      if (!deletedEventIds[ev.id]) map.set(ev.id, ev);
    });
    firestoreEvents.forEach((ev) => {
      if (!deletedEventIds[ev.id]) {
        const existing = map.get(ev.id);
        map.set(ev.id, {
          ...ev,
          imageUrl: ev.imageUrl || existing?.imageUrl || BNHS_ASSETS.homecomingEvent,
        });
      }
    });
    Object.values(localEventOverrides).forEach((ev) => {
      if (!deletedEventIds[ev.id]) map.set(ev.id, ev);
    });
    return Array.from(map.values());
  }, [firestoreEvents, localEventOverrides, deletedEventIds]);

  const combinedAnnouncements = useMemo(() => {
    const map = new Map<string, AnnouncementRecord>();
    INITIAL_ANNOUNCEMENTS.forEach((a) => {
      if (!deletedAnnouncementIds[a.id]) map.set(a.id, a);
    });
    firestoreAnnouncements.forEach((a) => {
      if (!deletedAnnouncementIds[a.id]) map.set(a.id, a);
    });
    Object.values(localAnnouncementOverrides).forEach((a) => {
      if (!deletedAnnouncementIds[a.id]) map.set(a.id, a);
    });
    return Array.from(map.values());
  }, [firestoreAnnouncements, localAnnouncementOverrides, deletedAnnouncementIds]);

  const combinedSpotlights = useMemo(() => {
    const map = new Map<string, SpotlightStoryRecord>();
    INITIAL_SPOTLIGHT_STORIES.forEach((s) => {
      if (!deletedSpotlightIds[s.id]) map.set(s.id, s);
    });
    firestoreSpotlights.forEach((s) => {
      if (!deletedSpotlightIds[s.id]) map.set(s.id, s);
    });
    Object.values(localSpotlightOverrides).forEach((s) => {
      if (!deletedSpotlightIds[s.id]) map.set(s.id, s);
    });
    return Array.from(map.values());
  }, [firestoreSpotlights, localSpotlightOverrides, deletedSpotlightIds]);

  // Persistent Sign-In Flow that never disappears on published URLs
  const handleSignIn = async () => {
    setAuthErrorMessage(null);
    setGoogleSigningIn(true);
    try {
      await signInWithGoogle();
      setShowLoginModal(false);
      setAdminToast('Signed in with Google! Cloud Sync is active.');
    } catch (err: unknown) {
      console.warn('Google popup sign-in notice:', err);
      const errCode =
        err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : '';
      if (errCode.includes('unauthorized-domain')) {
        setAuthErrorMessage(
          'This published domain is not yet listed in Firebase Authorized Domains. Please use the Direct BNHS Alumni Login form below to sign in immediately!'
        );
      } else if (errCode.includes('popup')) {
        setAuthErrorMessage(
          'Google Sign-In popup was closed or blocked by the browser. Please use the Direct BNHS Alumni Login form below to sign in immediately.'
        );
      } else {
        setAuthErrorMessage(
          'Use the Direct BNHS Alumni Login below to access your Alumni Dashboard immediately.'
        );
      }
      setShowLoginModal(true);
    } finally {
      setGoogleSigningIn(false);
    }
  };

  const handleDirectSignIn = (fullName: string, email: string, graduationYear: number) => {
    const cleanName = sanitizeString(fullName, 100);
    const cleanMail = sanitizeString(email, 120).toLowerCase();
    const uid = sanitizeId(`alum_${cleanMail.replace(/[^a-z0-9]/g, '_')}`);

    const sessionObj: DirectPortalUser = {
      uid,
      displayName: cleanName,
      email: cleanMail,
      graduationYear: Number(graduationYear) || 2020,
      photoURL: null,
    };

    setDirectUser(sessionObj);
    setAuthErrorMessage(null);
    setShowLoginModal(false);

    // Ensure a starter profile exists if not already in directory
    const existing =
      localProfileOverrides[uid] ||
      firestoreProfiles.find((p) => p.uid === uid) ||
      INITIAL_ALUMNI_DIRECTORY.find(
        (p) => p.fullName.toLowerCase() === cleanName.toLowerCase()
      );

    if (existing) {
      setMyProfile(existing);
    } else {
      const newProf: AlumniProfileRecord = {
        uid,
        fullName: cleanName,
        graduationYear: Number(graduationYear) || 2020,
        formerSection: 'Section A',
        strand: 'STEM',
        course: 'BS Education / Engineering',
        profession: 'BNHS Alumnus Professional',
        currentEmployment: 'Barobo Alumni Chapter',
        locationCity: 'Barobo, Surigao del Sur',
        bio: 'Once a Student, Always an Eagle! Proud graduate of Barobo National High School.',
        mentorshipRole: 'mentee',
        industrySector: 'Engineering & Architecture',
        photoUrl: '',
        visibility: 'public',
        isVerifiedRecord: true,
      };
      setLocalProfileOverrides((prev) => ({ ...prev, [uid]: newProf }));
      setMyProfile(newProf);
    }

    setMyPrivate({
      uid,
      email: cleanMail,
      phone: '+63 917 000 0000',
      homeAddress: 'Poblacion, Barobo, Surigao del Sur',
    });

    setActiveTab('dashboard');
    setAdminToast(`Welcome, ${cleanName}! You are signed in to the BNHS Alumni Portal.`);
  };

  const handleModalDirectLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (modalLoginName.trim().length < 2 || !modalLoginEmail.includes('@')) {
      setAuthErrorMessage('Please enter your Full Name and valid Email Address.');
      return;
    }
    handleDirectSignIn(modalLoginName, modalLoginEmail, modalLoginBatchYear);
  };

  const handleSignOut = async () => {
    try {
      if (firebaseUser) {
        await logOutUser();
      }
      setDirectUser(null);
      setMyProfile(null);
      setMyPrivate(null);
      setActiveTab('home');
      setAdminToast('You have signed out of the BNHS Alumni Portal.');
    } catch (err) {
      console.error('Sign-out failed:', err);
    }
  };

  // Manual & Automatic Cloud Sync Handler
  const handleManualCloudSync = async () => {
    setCloudSyncStatus('syncing');
    saveJsonToStorage(STORAGE_KEYS.settings, portalSettings);
    saveJsonToStorage(STORAGE_KEYS.profiles, localProfileOverrides);
    saveJsonToStorage(STORAGE_KEYS.events, localEventOverrides);
    saveJsonToStorage(STORAGE_KEYS.announcements, localAnnouncementOverrides);
    saveJsonToStorage(STORAGE_KEYS.spotlights, localSpotlightOverrides);

    if (firebaseUser) {
      try {
        await handleSavePortalSettings(portalSettings);
      } catch (err) {
        console.warn('Cloud sync warning:', err);
      }
    }

    setCloudSyncStatus('synced');
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setLastSyncedTime(nowStr);
    setAdminToast(`Cloud Sync Complete (${nowStr}) — All portal changes are saved.`);
  };

  // Persist Portal Settings (Logo, Hero Picture, Welcome Text, Directory Header, Hero Caption, Footer Subtitle)
  const handleSavePortalSettings = async (updates: Partial<PortalSettingsRecord>) => {
    const merged: PortalSettingsRecord = {
      ...DEFAULT_PORTAL_SETTINGS,
      ...portalSettings,
      ...updates,
      visibility: 'public',
    };
    setPortalSettings(merged);
    saveJsonToStorage(STORAGE_KEYS.settings, merged);
    setCloudSyncStatus('syncing');

    if (firebaseUser) {
      try {
        const settingsRef = doc(db, 'portal_settings', 'main');
        const snap = await getDoc(settingsRef);
        const payload = {
          authorId: firebaseUser.uid,
          logoUrl: sanitizeString(merged.logoUrl || DEFAULT_PORTAL_SETTINGS.logoUrl, 150000),
          logoAnimated: Boolean(merged.logoAnimated),
          heroImageUrl: sanitizeString(
            merged.heroImageUrl || DEFAULT_PORTAL_SETTINGS.heroImageUrl,
            150000
          ),
          schoolKicker: sanitizeString(
            merged.schoolKicker || DEFAULT_PORTAL_SETTINGS.schoolKicker,
            120
          ),
          portalSubtitle: sanitizeString(
            merged.portalSubtitle || DEFAULT_PORTAL_SETTINGS.portalSubtitle,
            140
          ),
          welcomeTitle: sanitizeString(
            merged.welcomeTitle || DEFAULT_PORTAL_SETTINGS.welcomeTitle,
            120
          ),
          mottoText: sanitizeString(merged.mottoText || DEFAULT_PORTAL_SETTINGS.mottoText, 140),
          welcomeDescription: sanitizeString(
            merged.welcomeDescription || DEFAULT_PORTAL_SETTINGS.welcomeDescription,
            600
          ),
          directoryKicker: sanitizeString(
            merged.directoryKicker || DEFAULT_PORTAL_SETTINGS.directoryKicker,
            120
          ),
          directoryTitle: sanitizeString(
            merged.directoryTitle || DEFAULT_PORTAL_SETTINGS.directoryTitle,
            140
          ),
          directoryDescription: sanitizeString(
            merged.directoryDescription || DEFAULT_PORTAL_SETTINGS.directoryDescription,
            500
          ),
          facebookUrl: sanitizeString(merged.facebookUrl ?? '', 500),
          twitterUrl: sanitizeString(merged.twitterUrl ?? '', 500),
          linkedinUrl: sanitizeString(merged.linkedinUrl ?? '', 500),
          heroCaptionLocation: sanitizeString(
            merged.heroCaptionLocation || DEFAULT_PORTAL_SETTINGS.heroCaptionLocation,
            140
          ),
          heroCaptionTitle: sanitizeString(
            merged.heroCaptionTitle || DEFAULT_PORTAL_SETTINGS.heroCaptionTitle,
            140
          ),
          heroCaptionDescription: sanitizeString(
            merged.heroCaptionDescription || DEFAULT_PORTAL_SETTINGS.heroCaptionDescription,
            400
          ),
          footerSubtitle: sanitizeString(
            merged.footerSubtitle || DEFAULT_PORTAL_SETTINGS.footerSubtitle,
            240
          ),
          visibility: 'public' as const,
          updatedAt: serverTimestamp(),
        };

        if (snap.exists()) {
          await updateDoc(settingsRef, payload);
        } else {
          await setDoc(settingsRef, {
            ...payload,
            createdAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.warn('Saved settings locally; cloud sync error:', err);
      }
    }
    setCloudSyncStatus('synced');
    setLastSyncedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  };

  // Save or update an Alumni Profile from Directory, Dashboard, or Registration
  const handleSaveAlumnusProfile = async (updated: AlumniProfileRecord) => {
    setDeletedProfileUids((prev) => {
      const next = { ...prev };
      delete next[updated.uid];
      return next;
    });
    setLocalProfileOverrides((prev) => ({
      ...prev,
      [updated.uid]: updated,
    }));
    if (currentUser && updated.uid === currentUser.uid) {
      setMyProfile(updated);
    }
    setCloudSyncStatus('syncing');

    if (firebaseUser) {
      try {
        const ref = doc(db, 'alumni_profiles', updated.uid);
        const snap = await getDoc(ref);
        const payload = {
          uid: updated.uid,
          fullName: sanitizeString(updated.fullName, 100),
          graduationYear: Number(updated.graduationYear),
          formerSection: sanitizeString(updated.formerSection, 60),
          strand: updated.strand,
          course: sanitizeString(updated.course, 120),
          profession: sanitizeString(updated.profession, 100),
          currentEmployment: sanitizeString(updated.currentEmployment, 120),
          locationCity: sanitizeString(updated.locationCity, 100),
          bio: sanitizeString(updated.bio, 600),
          mentorshipRole: updated.mentorshipRole || 'none',
          industrySector: sanitizeString(
            updated.industrySector || 'Engineering & Architecture',
            80
          ),
          photoUrl: sanitizeString(updated.photoUrl || '', 150000),
          visibility: 'public' as const,
          updatedAt: serverTimestamp(),
        };
        if (snap.exists()) {
          await updateDoc(ref, payload);
        } else {
          await setDoc(ref, {
            ...payload,
            createdAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.warn('Updated profile locally:', err);
      }
    }
    setCloudSyncStatus('synced');
    setLastSyncedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  };

  // Delete an Alumni Profile from Directory & Cloud
  const handleDeleteAlumnusProfile = async (uid: string, _fullName: string) => {
    setDeletedProfileUids((prev) => ({ ...prev, [uid]: true }));
    setLocalProfileOverrides((prev) => {
      const next = { ...prev };
      delete next[uid];
      return next;
    });
    if (firebaseUser) {
      try {
        await deleteDoc(doc(db, 'alumni_profiles', uid));
      } catch (err) {
        console.warn('Deleted profile locally:', err);
      }
    }
    setCloudSyncStatus('synced');
    setLastSyncedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  };

  // Save or update an Event & its uploaded photo
  const handleSaveEvent = async (eventData: AlumniEventRecord, _isNew: boolean) => {
    setDeletedEventIds((prev) => {
      const next = { ...prev };
      delete next[eventData.id];
      return next;
    });
    setLocalEventOverrides((prev) => ({
      ...prev,
      [eventData.id]: eventData,
    }));

    if (firebaseUser) {
      try {
        const eventRef = doc(db, 'events', eventData.id);
        const snap = await getDoc(eventRef);
        const payload = {
          authorId: snap.exists() ? snap.data().authorId : firebaseUser.uid,
          title: sanitizeString(eventData.title, 140),
          category: eventData.category,
          eventDate: sanitizeString(eventData.eventDate, 50),
          venue: sanitizeString(eventData.venue, 140),
          description: sanitizeString(eventData.description, 1000),
          imageUrl: sanitizeString(
            eventData.imageUrl || BNHS_ASSETS.homecomingEvent,
            150000
          ),
          status: eventData.status,
          visibility: 'public' as const,
          updatedAt: serverTimestamp(),
        };

        if (snap.exists()) {
          await updateDoc(eventRef, payload);
        } else {
          await setDoc(eventRef, {
            ...payload,
            authorId: firebaseUser.uid,
            createdAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.warn('Saved event locally:', err);
      }
    }
    setCloudSyncStatus('synced');
    setLastSyncedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  };

  // Delete an Event
  const handleDeleteEvent = async (eventId: string, _title: string) => {
    setDeletedEventIds((prev) => ({ ...prev, [eventId]: true }));
    setLocalEventOverrides((prev) => {
      const next = { ...prev };
      delete next[eventId];
      return next;
    });
    if (firebaseUser) {
      try {
        await deleteDoc(doc(db, 'events', eventId));
      } catch (err) {
        console.warn('Deleted event locally:', err);
      }
    }
    setCloudSyncStatus('synced');
    setLastSyncedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  };

  // Save or update an Announcement
  const handleSaveAnnouncement = async (annData: AnnouncementRecord, _isNew: boolean) => {
    setDeletedAnnouncementIds((prev) => {
      const next = { ...prev };
      delete next[annData.id];
      return next;
    });
    setLocalAnnouncementOverrides((prev) => ({
      ...prev,
      [annData.id]: annData,
    }));

    if (firebaseUser) {
      try {
        const annRef = doc(db, 'announcements', annData.id);
        const snap = await getDoc(annRef);
        const payload = {
          authorId: snap.exists() ? snap.data().authorId : firebaseUser.uid,
          authorName: sanitizeString(annData.authorName, 100),
          title: sanitizeString(annData.title, 150),
          category: annData.category,
          summary: sanitizeString(annData.summary, 300),
          content: sanitizeString(annData.content, 2000),
          status: 'published' as const,
          visibility: 'public' as const,
          updatedAt: serverTimestamp(),
        };

        if (snap.exists()) {
          await updateDoc(annRef, payload);
        } else {
          await setDoc(annRef, {
            ...payload,
            authorId: firebaseUser.uid,
            createdAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.warn('Saved announcement locally:', err);
      }
    }
    setCloudSyncStatus('synced');
    setLastSyncedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  };

  // Delete an Announcement
  const handleDeleteAnnouncement = async (annId: string, _title: string) => {
    setDeletedAnnouncementIds((prev) => ({ ...prev, [annId]: true }));
    setLocalAnnouncementOverrides((prev) => {
      const next = { ...prev };
      delete next[annId];
      return next;
    });
    if (firebaseUser) {
      try {
        await deleteDoc(doc(db, 'announcements', annId));
      } catch (err) {
        console.warn('Deleted announcement locally:', err);
      }
    }
    setCloudSyncStatus('synced');
    setLastSyncedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  };

  // Save or update a Spotlight Story
  const handleSaveSpotlight = async (storyData: SpotlightStoryRecord, _isNew: boolean) => {
    setDeletedSpotlightIds((prev) => {
      const next = { ...prev };
      delete next[storyData.id];
      return next;
    });
    setLocalSpotlightOverrides((prev) => ({
      ...prev,
      [storyData.id]: storyData,
    }));

    if (firebaseUser) {
      try {
        const spotRef = doc(db, 'spotlight_nominations', storyData.id);
        const snap = await getDoc(spotRef);
        const payload = {
          nominatorUid: snap.exists() ? snap.data().nominatorUid : firebaseUser.uid,
          nominatorName: sanitizeString(storyData.nominatorName, 100),
          nomineeName: sanitizeString(storyData.nomineeName, 100),
          graduationYear: Number(storyData.graduationYear),
          strand: storyData.strand,
          profession: sanitizeString(storyData.profession, 100),
          milestoneTitle: sanitizeString(storyData.milestoneTitle, 140),
          story: sanitizeString(storyData.story, 800),
          visibility: 'public' as const,
          updatedAt: serverTimestamp(),
        };

        if (snap.exists()) {
          await updateDoc(spotRef, payload);
        } else {
          await setDoc(spotRef, {
            ...payload,
            nominatorUid: firebaseUser.uid,
            createdAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.warn('Saved spotlight locally:', err);
      }
    }
    setCloudSyncStatus('synced');
    setLastSyncedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  };

  // Delete a Spotlight Story
  const handleDeleteSpotlight = async (storyId: string, _nomineeName: string) => {
    setDeletedSpotlightIds((prev) => ({ ...prev, [storyId]: true }));
    setLocalSpotlightOverrides((prev) => {
      const next = { ...prev };
      delete next[storyId];
      return next;
    });
    if (firebaseUser) {
      try {
        await deleteDoc(doc(db, 'spotlight_nominations', storyId));
      } catch (err) {
        console.warn('Deleted spotlight locally:', err);
      }
    }
    setCloudSyncStatus('synced');
    setLastSyncedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  };

  const openAdminHeroEditor = () => {
    setEditLogoUrl(portalSettings.logoUrl || DEFAULT_PORTAL_SETTINGS.logoUrl);
    setEditLogoLink(
      portalSettings.logoUrl && portalSettings.logoUrl.startsWith('http')
        ? portalSettings.logoUrl
        : ''
    );
    setEditLogoAnimated(Boolean(portalSettings.logoAnimated));
    setEditHeroImageUrl(portalSettings.heroImageUrl || DEFAULT_PORTAL_SETTINGS.heroImageUrl);
    setEditHeroLink(
      portalSettings.heroImageUrl && portalSettings.heroImageUrl.startsWith('http')
        ? portalSettings.heroImageUrl
        : ''
    );
    setEditSchoolKicker(portalSettings.schoolKicker || '');
    setEditPortalSubtitle(portalSettings.portalSubtitle || '');
    setEditWelcomeTitle(portalSettings.welcomeTitle || '');
    setEditMottoText(portalSettings.mottoText || '');
    setEditWelcomeDesc(portalSettings.welcomeDescription || '');
    setEditFacebookUrl(portalSettings.facebookUrl || '');
    setEditTwitterUrl(portalSettings.twitterUrl || '');
    setEditLinkedinUrl(portalSettings.linkedinUrl || '');
    setEditHeroCaptionLocation(
      portalSettings.heroCaptionLocation || DEFAULT_PORTAL_SETTINGS.heroCaptionLocation
    );
    setEditHeroCaptionTitle(
      portalSettings.heroCaptionTitle || DEFAULT_PORTAL_SETTINGS.heroCaptionTitle
    );
    setEditHeroCaptionDescription(
      portalSettings.heroCaptionDescription || DEFAULT_PORTAL_SETTINGS.heroCaptionDescription
    );
    setEditFooterSubtitle(
      portalSettings.footerSubtitle || DEFAULT_PORTAL_SETTINGS.footerSubtitle
    );
    setShowAdminHeroModal(true);
  };

  const openHeroCaptionEditor = () => {
    setEditHeroCaptionLocation(
      portalSettings.heroCaptionLocation || DEFAULT_PORTAL_SETTINGS.heroCaptionLocation
    );
    setEditHeroCaptionTitle(
      portalSettings.heroCaptionTitle || DEFAULT_PORTAL_SETTINGS.heroCaptionTitle
    );
    setEditHeroCaptionDescription(
      portalSettings.heroCaptionDescription || DEFAULT_PORTAL_SETTINGS.heroCaptionDescription
    );
    setShowHeroCaptionModal(true);
  };

  const openFooterSubtitleEditor = () => {
    setEditFooterSubtitle(
      portalSettings.footerSubtitle || DEFAULT_PORTAL_SETTINGS.footerSubtitle
    );
    setShowFooterEditModal(true);
  };

  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.type === 'image/gif' && file.size <= 105000) {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            setEditLogoUrl(reader.result);
          }
        };
        reader.readAsDataURL(file);
      } else {
        const compressed = await fileToCompressedDataUrl(file, 360, 0.85);
        setEditLogoUrl(compressed);
      }
    } catch (err) {
      console.error('Logo upload error:', err);
    } finally {
      if (logoFileInputRef.current) {
        logoFileInputRef.current.value = '';
      }
    }
  };

  const handleHeroFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await fileToCompressedDataUrl(file, 800, 0.82);
      setEditHeroImageUrl(compressed);
    } catch (err) {
      console.error('Hero photo upload error:', err);
    } finally {
      if (heroFileInputRef.current) {
        heroFileInputRef.current.value = '';
      }
    }
  };

  const handleSaveHeroSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingHeroSettings(true);
    try {
      const finalLogo =
        editLogoMode === 'link' && editLogoLink.trim()
          ? normalizeImageUrl(editLogoLink)
          : editLogoUrl || BNHS_ASSETS.eagleCrest;
      const finalHeroImg =
        editHeroMode === 'link' && editHeroLink.trim()
          ? normalizeImageUrl(editHeroLink)
          : editHeroImageUrl || BNHS_ASSETS.campusHero;

      await handleSavePortalSettings({
        logoUrl: finalLogo,
        logoAnimated: editLogoAnimated,
        heroImageUrl: finalHeroImg,
        schoolKicker: editSchoolKicker,
        portalSubtitle: editPortalSubtitle,
        welcomeTitle: editWelcomeTitle,
        mottoText: editMottoText,
        welcomeDescription: editWelcomeDesc,
        facebookUrl: editFacebookUrl.trim(),
        twitterUrl: editTwitterUrl.trim(),
        linkedinUrl: editLinkedinUrl.trim(),
        heroCaptionLocation: editHeroCaptionLocation,
        heroCaptionTitle: editHeroCaptionTitle,
        heroCaptionDescription: editHeroCaptionDescription,
        footerSubtitle: editFooterSubtitle,
      });
      setShowAdminHeroModal(false);
      setAdminToast('Cloud Synced: Updated BNHS Logo, Picture, Welcome Content & Portal Texts!');
    } finally {
      setSavingHeroSettings(false);
    }
  };

  const handleSaveHeroCaptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingHeroSettings(true);
    try {
      await handleSavePortalSettings({
        heroCaptionLocation: editHeroCaptionLocation,
        heroCaptionTitle: editHeroCaptionTitle,
        heroCaptionDescription: editHeroCaptionDescription,
      });
      setShowHeroCaptionModal(false);
      setAdminToast('Updated Hero Campus Caption text and synced!');
    } finally {
      setSavingHeroSettings(false);
    }
  };

  const handleSaveFooterSubtitleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingHeroSettings(true);
    try {
      await handleSavePortalSettings({
        footerSubtitle: editFooterSubtitle,
      });
      setShowFooterEditModal(false);
      setAdminToast('Updated Footer location & motto text and synced!');
    } finally {
      setSavingHeroSettings(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#650019] text-white w-full overflow-x-hidden">
      {/* Top Navigation Bar — Responsive across Mobile, Tablet, Laptop, and Desktop */}
      <header className="sticky top-0 z-40 bg-[#450012] border-b border-[#D4AF37]/30 px-3 sm:px-6 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 lg:gap-6">
          {/* Zone 1: School Wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('home');
            }}
            className="font-display text-sm sm:text-base lg:text-lg font-bold tracking-wider text-[#D4AF37] whitespace-nowrap shrink-0"
          >
            Barobo National High School
          </a>

          {/* Zone 2: Navigation Links + Admin Menu beside Announcements */}
          <nav className="hidden lg:flex flex-wrap items-center gap-4 xl:gap-6 text-xs xl:text-sm font-medium text-white/85">
            {[
              { id: 'home', label: 'Home' },
              { id: 'directory', label: 'Directory' },
              { id: 'register', label: 'Register' },
              { id: 'events', label: 'Events' },
              { id: 'announcements', label: 'Announcements' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id as PortalTab)}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === item.id
                    ? 'text-[#D4AF37] font-semibold underline underline-offset-8 decoration-[#D4AF37] decoration-2'
                    : 'hover:text-[#D4AF37]'
                }`}
              >
                {item.label}
              </button>
            ))}

            {/* Admin Menu beside Announcement menu */}
            <button
              type="button"
              onClick={openAdminHeroEditor}
              className="px-3 py-1.5 rounded-lg bg-[#650019] border border-[#D4AF37]/70 text-xs font-bold text-[#D4AF37] hover:bg-black/30 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer shadow-sm"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Admin Menu: Edit Logo, Picture & Welcome Content</span>
            </button>
          </nav>

          {/* Zone 3: Cloud Sync + Alumni Login / Dashboard Action */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleManualCloudSync}
              title={`Cloud Sync Active (${lastSyncedTime}) — Click to sync`}
              className="px-2.5 py-2 rounded-lg bg-[#650019] border border-[#D4AF37]/40 text-[11px] font-semibold text-[#D4AF37] hover:bg-black/30 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {cloudSyncStatus === 'syncing' ? 'Syncing...' : 'Cloud Sync'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (currentUser) {
                  setActiveTab('dashboard');
                } else {
                  setAuthErrorMessage(null);
                  setShowLoginModal(true);
                }
              }}
              className="px-3.5 sm:px-4 py-2 text-xs font-bold bg-[#D4AF37] text-[#450012] rounded-lg hover:bg-[#e3c14d] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {currentUser ? 'Alumni Dashboard' : 'Alumni Portal Login'}
            </button>
          </div>
        </div>

        {/* Mobile & Tablet Quick Navigation Strip (with Admin Menu beside Announcements) */}
        <div className="lg:hidden mt-3 pt-2.5 border-t border-white/10 flex items-center gap-3 sm:gap-4 overflow-x-auto text-xs font-medium pb-1">
          {[
            { id: 'home', label: 'Home' },
            { id: 'directory', label: 'Directory' },
            { id: 'register', label: 'Register' },
            { id: 'events', label: 'Events' },
            { id: 'announcements', label: 'Announcements' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id as PortalTab)}
              className={`py-1 whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === item.id
                  ? 'text-[#D4AF37] font-bold underline underline-offset-4'
                  : 'text-white/80'
              }`}
            >
              {item.label}
            </button>
          ))}

          <button
            type="button"
            onClick={openAdminHeroEditor}
            className="px-2.5 py-1 rounded-md bg-[#650019] border border-[#D4AF37]/60 text-[11px] font-bold text-[#D4AF37] whitespace-nowrap shrink-0 inline-flex items-center gap-1 cursor-pointer"
          >
            <Settings className="w-3 h-3" />
            <span>Admin Menu: Edit Logo, Picture & Welcome Content</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full">
        {adminToast && (
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-5">
            <div className="p-4 rounded-xl bg-[#450012] border border-[#D4AF37] text-white text-xs sm:text-sm flex items-center justify-between gap-3 shadow-lg">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#D4AF37] shrink-0" />
                {adminToast}
              </span>
              <button
                type="button"
                onClick={() => setAdminToast(null)}
                className="text-[#D4AF37] hover:underline text-xs shrink-0 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {activeTab === 'home' && (
          <div>
            {/* Institutional Maroon & Gold Hero Section */}
            <section className="relative bg-gradient-to-b from-[#450012] to-[#650019] border-b border-[#D4AF37]/30">
              <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
                  {/* Left Column: Animated GIF Seal, Welcome Headline & Primary Actions */}
                  <div className="lg:col-span-7 flex flex-col justify-center">
                    <div className="flex items-center gap-3.5 sm:gap-4 mb-5 sm:mb-6">
                      <div
                        onClick={openAdminHeroEditor}
                        title="Click to edit BNHS Animated GIF Logo"
                        className={`w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-2xl overflow-hidden border-2 border-[#D4AF37] bg-white shrink-0 shadow-lg cursor-pointer ${
                          portalSettings.logoAnimated ? 'animate-bnhs-seal' : ''
                        }`}
                      >
                        <ResilientImage
                          src={portalSettings.logoUrl}
                          alt="Barobo National High School Animated Seal"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm uppercase tracking-widest text-[#D4AF37] font-bold">
                          {portalSettings.schoolKicker}
                        </p>
                        <p className="text-[11px] sm:text-xs uppercase tracking-wider text-white/80 mt-0.5">
                          {portalSettings.portalSubtitle}
                        </p>
                      </div>
                    </div>

                    <h1 className="font-display text-2xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-tight">
                      {portalSettings.welcomeTitle}
                    </h1>

                    <p className="font-display text-base sm:text-xl lg:text-2xl font-semibold text-[#D4AF37] mt-2.5 sm:mt-3">
                      {portalSettings.mottoText}
                    </p>

                    <p className="text-sm sm:text-base lg:text-lg text-white/90 mt-3 max-w-2xl leading-relaxed">
                      {portalSettings.welcomeDescription}
                    </p>

                    {/* Primary CTA Action Bar */}
                    <div className="mt-6 sm:mt-8 flex flex-wrap items-center gap-3 sm:gap-4">
                      <button
                        type="button"
                        onClick={() => setShowRegistrationModal(true)}
                        className="w-full sm:w-auto justify-center px-6 py-3.5 rounded-lg bg-[#D4AF37] text-[#450012] font-bold text-sm hover:bg-[#e3c14d] transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <UserPlus className="w-4 h-4" />
                        Online Alumni Registration
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab('directory')}
                        className="w-full sm:w-auto justify-center px-6 py-3.5 rounded-lg bg-white text-[#650019] font-bold text-sm hover:bg-gray-100 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Users className="w-4 h-4" />
                        Explore Alumni Directory
                      </button>
                    </div>
                  </div>

                  {/* Right Column: BNHS Campus Quadrangle Hero Card with Editable Caption Menu */}
                  <div className="lg:col-span-5 flex flex-col">
                    <div className="relative rounded-xl overflow-hidden border-2 border-[#D4AF37]/60 bg-[#450012] h-full min-h-[260px] sm:min-h-[320px] shadow-xl flex flex-col justify-end group">
                      <ResilientImage
                        src={portalSettings.heroImageUrl}
                        alt="Barobo National High School Campus Quadrangle"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div className="relative z-10 bg-gradient-to-t from-black/90 via-black/55 to-transparent p-5 sm:p-6 pt-16">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                          <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold">
                            {portalSettings.heroCaptionLocation ||
                              DEFAULT_PORTAL_SETTINGS.heroCaptionLocation}
                          </p>
                          <button
                            type="button"
                            onClick={openHeroCaptionEditor}
                            className="px-2.5 py-1 rounded-md bg-[#450012]/90 border border-[#D4AF37]/60 text-[11px] font-bold text-[#D4AF37] hover:bg-[#650019] transition-colors inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3" />
                            Edit Text
                          </button>
                        </div>
                        <p className="font-display text-base sm:text-lg font-bold text-white mt-0.5">
                          {portalSettings.heroCaptionTitle ||
                            DEFAULT_PORTAL_SETTINGS.heroCaptionTitle}
                        </p>
                        <p className="text-xs text-white/85 mt-1 leading-relaxed">
                          {portalSettings.heroCaptionDescription ||
                            DEFAULT_PORTAL_SETTINGS.heroCaptionDescription}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Full-Width 4-Module Portal Navigation Strip below Hero */}
                <div className="mt-10 sm:mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('directory')}
                    className="bg-white text-gray-900 rounded-xl p-5 sm:p-6 border border-gray-200 hover:border-[#D4AF37] text-left transition-all flex flex-col justify-between group cursor-pointer"
                  >
                    <div>
                      <div className="w-10 h-10 rounded-lg bg-[#650019] text-[#D4AF37] flex items-center justify-center mb-4">
                        <Users className="w-5 h-5" />
                      </div>
                      <h2 className="font-display text-lg font-bold text-gray-900 group-hover:text-[#650019]">
                        Alumni Directory
                      </h2>
                      <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                        Search registered alumni, filter by auto-created batch ranges (1982–1999, 2020–2026 & 2027–2032), and edit or delete profiles.
                      </p>
                    </div>
                    <span className="mt-4 pt-3 border-t border-gray-100 text-xs font-bold text-[#650019] flex items-center justify-between">
                      <span>Search Directory ({combinedAlumniDirectory.length})</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowRegistrationModal(true)}
                    className="bg-white text-gray-900 rounded-xl p-5 sm:p-6 border border-gray-200 hover:border-[#D4AF37] text-left transition-all flex flex-col justify-between group cursor-pointer"
                  >
                    <div>
                      <div className="w-10 h-10 rounded-lg bg-[#650019] text-[#D4AF37] flex items-center justify-center mb-4">
                        <GraduationCap className="w-5 h-5" />
                      </div>
                      <h2 className="font-display text-lg font-bold text-gray-900 group-hover:text-[#650019]">
                        Register as Alumni
                      </h2>
                      <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                        Upload your profile photo (local file or Google link), select your graduation batch, and join mentorship.
                      </p>
                    </div>
                    <span className="mt-4 pt-3 border-t border-gray-100 text-xs font-bold text-[#650019] flex items-center justify-between">
                      <span>{myProfile ? 'Update My Profile' : 'Online Registration Modal'}</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('events')}
                    className="bg-white text-gray-900 rounded-xl p-5 sm:p-6 border border-gray-200 hover:border-[#D4AF37] text-left transition-all flex flex-col justify-between group cursor-pointer"
                  >
                    <div>
                      <div className="w-10 h-10 rounded-lg bg-[#650019] text-[#D4AF37] flex items-center justify-center mb-4">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <h2 className="font-display text-lg font-bold text-gray-900 group-hover:text-[#650019]">
                        Alumni Events
                      </h2>
                      <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                        Add, edit, delete, and upload photos for Homecoming, Batch Reunion, Career Mentorship, Scholarship Drive, and Outreach.
                      </p>
                    </div>
                    <span className="mt-4 pt-3 border-t border-gray-100 text-xs font-bold text-[#650019] flex items-center justify-between">
                      <span>Manage {combinedEvents.length} Events</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('announcements')}
                    className="bg-white text-gray-900 rounded-xl p-5 sm:p-6 border border-gray-200 hover:border-[#D4AF37] text-left transition-all flex flex-col justify-between group cursor-pointer"
                  >
                    <div>
                      <div className="w-10 h-10 rounded-lg bg-[#650019] text-[#D4AF37] flex items-center justify-center mb-4">
                        <Megaphone className="w-5 h-5" />
                      </div>
                      <h2 className="font-display text-lg font-bold text-gray-900 group-hover:text-[#650019]">
                        Announcements
                      </h2>
                      <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                        Publish, edit, or delete official school memoranda, scholarship endowment updates, and licensure commendations.
                      </p>
                    </div>
                    <span className="mt-4 pt-3 border-t border-gray-100 text-xs font-bold text-[#650019] flex items-center justify-between">
                      <span>Read {combinedAnnouncements.length} Official Bulletins</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </button>
                </div>
              </div>
            </section>

            {/* Alumni Spotlight Carousel, Most Active Batch Leaderboard & City Density Map */}
            <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10 sm:space-y-12">
              {/* Spotlight Carousel of Success Stories & Career Milestones */}
              <AlumniSpotlightCarousel
                stories={combinedSpotlights}
                currentUser={currentUser}
                userProfile={myProfile}
                onSignIn={handleSignIn}
                onSaveSpotlight={handleSaveSpotlight}
                onDeleteSpotlight={handleDeleteSpotlight}
                onSelectBatchYear={(yr) => {
                  setDirectoryYearFilter(String(yr));
                  setDirectoryCityFilter('ALL');
                  setActiveTab('directory');
                }}
              />

              {/* Most Active Batch Leaderboard & City Professional Distribution Density Map */}
              <AlumniInsightsSection
                alumniList={combinedAlumniDirectory}
                onFilterByBatchYear={(yr) => {
                  setDirectoryYearFilter(String(yr));
                  setDirectoryCityFilter('ALL');
                  setActiveTab('directory');
                }}
                onFilterByCity={(city) => {
                  setDirectoryCityFilter(city);
                  setDirectoryYearFilter('ALL');
                  setActiveTab('directory');
                }}
                onNavigateRegister={() => setShowRegistrationModal(true)}
              />

              {/* Featured Registered Alumni */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold">
                      Featured Batch Profiles
                    </p>
                    <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mt-1">
                      Meet Fellow Barobo National High School Alumni
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('directory')}
                    className="text-xs font-bold text-[#D4AF37] hover:underline flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <span>Open Full Alumni Directory</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {combinedAlumniDirectory.slice(0, 3).map((alum) => (
                    <div
                      key={alum.uid}
                      onClick={() => setActiveTab('directory')}
                      className="bg-white text-gray-900 rounded-xl p-6 border border-gray-200 hover:border-[#D4AF37] transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#650019] mb-2">
                          <span className="font-mono-num">Batch {alum.graduationYear}</span>
                          <span aria-hidden="true">·</span>
                          <span>{alum.strand}</span>
                          <span aria-hidden="true">·</span>
                          <span>{alum.formerSection}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {alum.photoUrl && (
                            <img
                              src={alum.photoUrl}
                              alt={alum.fullName}
                              className="w-10 h-10 rounded-lg object-cover border border-[#D4AF37]"
                            />
                          )}
                          <h3 className="font-display text-lg font-bold text-gray-900">
                            {alum.fullName}
                          </h3>
                        </div>
                        <p className="text-xs font-semibold text-gray-700 mt-2 flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5 text-[#650019] shrink-0" />
                          <span>{alum.profession}</span>
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{alum.currentEmployment}</p>
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#650019] shrink-0" />
                          <span>{alum.locationCity}</span>
                        </p>
                        <p className="mt-3 text-xs text-gray-600 italic line-clamp-2">
                          "{alum.bio}"
                        </p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-gray-100 text-xs font-bold text-[#650019]">
                        Degree: {alum.course}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Two-Column Split: Upcoming Events & Latest Announcements */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                {/* Upcoming Homecoming Highlight */}
                <div className="lg:col-span-6 bg-[#450012] border border-[#D4AF37]/30 rounded-xl p-5 sm:p-8 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <span className="text-xs uppercase tracking-widest text-[#D4AF37] font-bold">
                        Upcoming Alumni Events
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('events')}
                        className="text-xs font-semibold text-[#D4AF37] hover:underline cursor-pointer"
                      >
                        Manage & Upload Event Photos →
                      </button>
                    </div>

                    <div className="space-y-4">
                      {combinedEvents.slice(0, 2).map((ev) => (
                        <div
                          key={ev.id}
                          onClick={() => setActiveTab('events')}
                          className="bg-white text-gray-900 rounded-xl p-5 border border-gray-200 hover:border-[#D4AF37] transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2 text-xs font-semibold text-[#650019] mb-1">
                            <span>{ev.category}</span>
                            <span aria-hidden="true">·</span>
                            <span>{ev.eventDate}</span>
                          </div>
                          <h3 className="font-display text-base font-bold text-gray-900">
                            {ev.title}
                          </h3>
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                            {ev.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/15 flex flex-wrap items-center justify-between gap-3 text-xs text-white/80">
                    <span>Edit events, delete, upload photos, or RSVP online</span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('events')}
                      className="px-4 py-2 rounded-lg bg-[#D4AF37] text-[#450012] font-bold hover:bg-[#e3c14d] transition-colors cursor-pointer"
                    >
                      Open Events Section
                    </button>
                  </div>
                </div>

                {/* Official School & Federation Announcements */}
                <div className="lg:col-span-6 bg-[#450012] border border-[#D4AF37]/30 rounded-xl p-5 sm:p-8 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <span className="text-xs uppercase tracking-widest text-[#D4AF37] font-bold">
                        Official Announcements
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('announcements')}
                        className="text-xs font-semibold text-[#D4AF37] hover:underline cursor-pointer"
                      >
                        All Bulletins →
                      </button>
                    </div>

                    <div className="space-y-4">
                      {combinedAnnouncements.slice(0, 2).map((ann) => (
                        <div
                          key={ann.id}
                          onClick={() => setActiveTab('announcements')}
                          className="bg-white text-gray-900 rounded-xl p-5 border border-gray-200 hover:border-[#D4AF37] transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2 text-xs font-semibold text-[#650019] mb-1">
                            <span>{ann.category}</span>
                            <span aria-hidden="true">·</span>
                            <span>{ann.authorName}</span>
                          </div>
                          <h3 className="font-display text-base font-bold text-gray-900">
                            {ann.title}
                          </h3>
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                            {ann.summary}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/15 flex flex-wrap items-center justify-between gap-3 text-xs text-white/80">
                    <span>Publish, edit, or delete official BNHS bulletins</span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('announcements')}
                      className="px-4 py-2 rounded-lg bg-white text-[#650019] font-bold hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      Read Bulletins
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'directory' && (
          <DirectoryModule
            alumniList={combinedAlumniDirectory}
            currentUserUid={currentUser?.uid}
            initialYearFilter={directoryYearFilter}
            initialCityFilter={directoryCityFilter}
            portalSettings={portalSettings}
            onSavePortalSettings={handleSavePortalSettings}
            onSaveAlumnusProfile={handleSaveAlumnusProfile}
            onDeleteAlumnusProfile={handleDeleteAlumnusProfile}
            onNavigateRegister={() => setShowRegistrationModal(true)}
          />
        )}

        {activeTab === 'register' && (
          <RegistrationModule
            currentUser={currentUser}
            existingProfile={myProfile}
            existingPrivate={myPrivate}
            onSignIn={handleSignIn}
            onSavedSuccess={() => {}}
            onLocalProfileSave={(rec) => {
              handleSaveAlumnusProfile(rec);
              setMyProfile(rec);
            }}
            onLocalPrivateSave={(priv) => setMyPrivate(priv)}
          />
        )}

        {activeTab === 'events' && (
          <EventsAndAnnouncementsModule
            mode="events"
            currentUser={currentUser}
            userProfile={myProfile}
            events={combinedEvents}
            announcements={combinedAnnouncements}
            userRsvps={myRsvps}
            onSignIn={handleSignIn}
            onSaveEvent={handleSaveEvent}
            onDeleteEvent={handleDeleteEvent}
            onSaveAnnouncement={handleSaveAnnouncement}
            onDeleteAnnouncement={handleDeleteAnnouncement}
            onSaveLocalRsvp={(eventId, rsvp) =>
              setMyRsvps((prev) => ({ ...prev, [eventId]: rsvp }))
            }
          />
        )}

        {activeTab === 'announcements' && (
          <EventsAndAnnouncementsModule
            mode="announcements"
            currentUser={currentUser}
            userProfile={myProfile}
            events={combinedEvents}
            announcements={combinedAnnouncements}
            userRsvps={myRsvps}
            onSignIn={handleSignIn}
            onSaveEvent={handleSaveEvent}
            onDeleteEvent={handleDeleteEvent}
            onSaveAnnouncement={handleSaveAnnouncement}
            onDeleteAnnouncement={handleDeleteAnnouncement}
            onSaveLocalRsvp={(eventId, rsvp) =>
              setMyRsvps((prev) => ({ ...prev, [eventId]: rsvp }))
            }
          />
        )}

        {activeTab === 'dashboard' && (
          <AlumniDashboardModule
            currentUser={currentUser}
            userProfile={myProfile}
            userPrivate={myPrivate}
            userRsvps={myRsvps}
            allAlumni={combinedAlumniDirectory}
            events={combinedEvents}
            logoUrl={portalSettings.logoUrl}
            logoAnimated={portalSettings.logoAnimated}
            authError={authErrorMessage}
            onSignIn={handleSignIn}
            onDirectSignIn={handleDirectSignIn}
            onSaveAlumnusProfile={handleSaveAlumnusProfile}
            onSignOut={handleSignOut}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}
      </main>

      {/* Persistent Alumni Portal Login Modal (Never disappears when published) */}
      {showLoginModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowLoginModal(false)}
        >
          <div
            className="bg-white text-gray-900 rounded-xl max-w-lg w-full overflow-hidden border-2 border-[#D4AF37] my-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#450012] text-white p-6 flex items-center justify-between border-b border-[#D4AF37]/40">
              <div className="flex items-center gap-3">
                <div
                  className={`w-11 h-11 rounded-xl overflow-hidden border border-[#D4AF37] bg-white shrink-0 ${
                    portalSettings.logoAnimated ? 'animate-bnhs-seal' : ''
                  }`}
                >
                  <ResilientImage
                    src={portalSettings.logoUrl}
                    alt="BNHS Seal"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-bold">
                    Barobo National High School
                  </p>
                  <h2 className="font-display text-xl font-bold mt-0.5">
                    Alumni Portal Login
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLoginModal(false)}
                className="text-white/70 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {authErrorMessage && (
                <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs leading-relaxed">
                  {authErrorMessage}
                </div>
              )}

              <form onSubmit={handleModalDirectLoginSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Alumnus / Alumna Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={modalLoginName ?? ''}
                    onChange={(e) => setModalLoginName(e.target.value)}
                    placeholder="e.g., Bless T. Tajale / Engr. Juan Dela Cruz"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#650019]"
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
                      value={modalLoginEmail ?? ''}
                      onChange={(e) => setModalLoginEmail(e.target.value)}
                      placeholder="blesstajale@gmail.com"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#650019]"
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
                      value={modalLoginBatchYear ?? 2020}
                      onChange={(e) => setModalLoginBatchYear(Number(e.target.value))}
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 font-mono-num focus:outline-none focus:ring-2 focus:ring-[#650019]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 px-5 rounded-lg bg-[#650019] text-white font-bold text-sm hover:bg-[#450012] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <LogIn className="w-4 h-4 text-[#D4AF37]" />
                  Sign In to Alumni Dashboard
                </button>
              </form>

              <div className="flex items-center gap-3 py-1">
                <div className="h-px bg-gray-200 flex-1" />
                <span className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
                  Or Google Account
                </span>
                <div className="h-px bg-gray-200 flex-1" />
              </div>

              <button
                type="button"
                disabled={googleSigningIn}
                onClick={handleSignIn}
                className="w-full py-2.5 px-5 rounded-lg border-2 border-[#650019] text-[#650019] font-bold text-xs sm:text-sm hover:bg-[#650019] hover:text-white transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                {googleSigningIn ? 'Opening Google Sign-In...' : 'Sign In with Google'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Online Alumni Registration Modal */}
      {showRegistrationModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={() => setShowRegistrationModal(false)}
        >
          <div
            className="max-w-4xl w-full my-4 sm:my-6"
            onClick={(e) => e.stopPropagation()}
          >
            <RegistrationModule
              currentUser={currentUser}
              existingProfile={myProfile}
              existingPrivate={myPrivate}
              onSignIn={handleSignIn}
              onSavedSuccess={() => {}}
              onLocalProfileSave={(rec) => {
                handleSaveAlumnusProfile(rec);
                setMyProfile(rec);
              }}
              onLocalPrivateSave={(priv) => setMyPrivate(priv)}
              isModal={true}
              onCloseModal={() => setShowRegistrationModal(false)}
            />
          </div>
        </div>
      )}

      {/* Dedicated Modal: Edit Hero Campus Caption Text */}
      {showHeroCaptionModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowHeroCaptionModal(false)}
        >
          <div
            className="bg-white text-gray-900 rounded-xl max-w-lg w-full overflow-hidden border-2 border-[#D4AF37]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#450012] text-white p-6 flex items-center justify-between border-b border-[#D4AF37]/40">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-bold">
                  Hero Banner Caption Editor
                </p>
                <h2 className="font-display text-xl font-bold mt-0.5">
                  Edit Campus Location & Legacy Text
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowHeroCaptionModal(false)}
                className="text-white/70 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveHeroCaptionSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Location Kicker *
                </label>
                <input
                  type="text"
                  required
                  value={editHeroCaptionLocation ?? ''}
                  onChange={(e) => setEditHeroCaptionLocation(e.target.value)}
                  placeholder="Poblacion, Barobo · Surigao del Sur"
                  className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Headline Title *
                </label>
                <input
                  type="text"
                  required
                  value={editHeroCaptionTitle ?? ''}
                  onChange={(e) => setEditHeroCaptionTitle(e.target.value)}
                  placeholder="Home of the Soaring BNHS Eagles"
                  className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Description *
                </label>
                <textarea
                  rows={3}
                  required
                  value={editHeroCaptionDescription ?? ''}
                  onChange={(e) => setEditHeroCaptionDescription(e.target.value)}
                  placeholder="Over five decades of academic excellence, service, and community leadership across Caraga and beyond."
                  className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                />
              </div>

              <div className="pt-3 border-t border-gray-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowHeroCaptionModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingHeroSettings}
                  className="px-5 py-2 rounded-lg bg-[#650019] text-white text-xs font-bold hover:bg-[#450012] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5 text-[#D4AF37]" />
                  {savingHeroSettings ? 'Saving...' : 'Save Caption'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dedicated Modal: Edit Footer Location & Motto Subtitle */}
      {showFooterEditModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowFooterEditModal(false)}
        >
          <div
            className="bg-white text-gray-900 rounded-xl max-w-lg w-full overflow-hidden border-2 border-[#D4AF37]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#450012] text-white p-6 flex items-center justify-between border-b border-[#D4AF37]/40">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-bold">
                  Footer Content Editor
                </p>
                <h2 className="font-display text-xl font-bold mt-0.5">
                  Edit School Address & Motto Line
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowFooterEditModal(false)}
                className="text-white/70 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFooterSubtitleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Footer Subtitle Text *
                </label>
                <textarea
                  rows={3}
                  required
                  value={editFooterSubtitle ?? ''}
                  onChange={(e) => setEditFooterSubtitle(e.target.value)}
                  placeholder="Poblacion, Barobo, Surigao del Sur · Caraga Region XIII · Once a Student, Always an Eagle!"
                  className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                />
              </div>

              <div className="pt-3 border-t border-gray-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowFooterEditModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingHeroSettings}
                  className="px-5 py-2 rounded-lg bg-[#650019] text-white text-xs font-bold hover:bg-[#450012] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5 text-[#D4AF37]" />
                  {savingHeroSettings ? 'Saving...' : 'Save Footer Text'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Menu Modal: Edit Animated GIF Logo, Hero Picture & Welcome Content */}
      {showAdminHeroModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowAdminHeroModal(false)}
        >
          <div
            className="bg-white text-gray-900 rounded-xl max-w-2xl w-full overflow-hidden border-2 border-[#D4AF37] my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#450012] text-white p-6 flex items-center justify-between border-b border-[#D4AF37]/40">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-bold">
                  BNHS Portal Administration Menu
                </p>
                <h2 className="font-display text-xl font-bold mt-0.5">
                  Edit Animated Logo, Hero Picture & Welcome Content
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminHeroModal(false)}
                className="text-white/70 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveHeroSettingsSubmit}
              className="p-6 space-y-6 max-h-[80vh] overflow-y-auto"
            >
              {/* 1. Edit School Logo (GIF / Image) */}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-[#650019]">
                      1. Official School Seal / Animated GIF Logo
                    </h3>
                    <p className="text-xs text-gray-500">
                      Upload a local GIF/image or paste a Google link. Toggle GIF seal animation below.
                    </p>
                  </div>
                  <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-300">
                    <button
                      type="button"
                      onClick={() => setEditLogoMode('local')}
                      className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                        editLogoMode === 'local'
                          ? 'bg-[#650019] text-white'
                          : 'text-gray-700'
                      }`}
                    >
                      Upload File
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditLogoMode('link')}
                      className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                        editLogoMode === 'link'
                          ? 'bg-[#650019] text-white'
                          : 'text-gray-700'
                      }`}
                    >
                      Google / Web Link
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div
                    className={`w-20 h-20 rounded-2xl overflow-hidden border-2 border-[#D4AF37] bg-white shrink-0 flex items-center justify-center ${
                      editLogoAnimated ? 'animate-bnhs-seal' : ''
                    }`}
                  >
                    <ResilientImage
                      src={editLogoUrl || BNHS_ASSETS.eagleCrest}
                      alt="Logo Preview"
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <div className="flex-1 w-full space-y-2.5">
                    {editLogoMode === 'local' ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          ref={logoFileInputRef}
                          type="file"
                          accept="image/*,.gif"
                          onChange={handleLogoFileUpload}
                          className="hidden"
                          id="admin-logo-file-input"
                        />
                        <label
                          htmlFor="admin-logo-file-input"
                          className="px-3.5 py-2 rounded-lg bg-[#650019] text-white text-xs font-bold hover:bg-[#450012] inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5 text-[#D4AF37]" />
                          Upload Local GIF / Logo
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setEditLogoUrl(BNHS_ASSETS.eagleCrest);
                            setEditLogoAnimated(true);
                          }}
                          className="px-3 py-2 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer"
                        >
                          Use Official Animated BNHS GIF Seal
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={editLogoLink ?? ''}
                          onChange={(e) => {
                            setEditLogoLink(e.target.value);
                            setEditLogoUrl(normalizeImageUrl(e.target.value));
                          }}
                          placeholder="Paste Google Drive link or GIF/image URL..."
                          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => setEditLogoUrl(normalizeImageUrl(editLogoLink))}
                          className="px-3 py-2 rounded-lg bg-[#650019] text-white text-xs font-bold cursor-pointer"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <label className="flex items-center gap-2 text-xs font-semibold text-gray-800 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={Boolean(editLogoAnimated)}
                        onChange={(e) => setEditLogoAnimated(e.target.checked)}
                        className="accent-[#650019]"
                      />
                      <span>Enable Animated GIF Pulse & Glow Effect on School Logo</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* 2. Edit Hero Campus Picture */}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-[#650019]">
                      2. Hero Campus Picture
                    </h3>
                    <p className="text-xs text-gray-500">
                      Update the main featured Barobo National High School photograph on the Home section.
                    </p>
                  </div>
                  <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-300">
                    <button
                      type="button"
                      onClick={() => setEditHeroMode('local')}
                      className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                        editHeroMode === 'local'
                          ? 'bg-[#650019] text-white'
                          : 'text-gray-700'
                      }`}
                    >
                      Upload File
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditHeroMode('link')}
                      className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                        editHeroMode === 'link'
                          ? 'bg-[#650019] text-white'
                          : 'text-gray-700'
                      }`}
                    >
                      Google / Web Link
                    </button>
                  </div>
                </div>

                <div className="h-36 w-full rounded-lg overflow-hidden bg-[#450012] border border-[#D4AF37]/50">
                  <ResilientImage
                    src={editHeroImageUrl || BNHS_ASSETS.campusHero}
                    alt="Hero Campus Preview"
                    className="w-full h-full object-cover"
                  />
                </div>

                {editHeroMode === 'local' ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={heroFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleHeroFileUpload}
                      className="hidden"
                      id="admin-hero-file-input"
                    />
                    <label
                      htmlFor="admin-hero-file-input"
                      className="px-3.5 py-2 rounded-lg bg-[#650019] text-white text-xs font-bold hover:bg-[#450012] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-[#D4AF37]" />
                      Upload Local Campus Photo
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditHeroImageUrl(BNHS_ASSETS.campusHero)}
                      className="px-3 py-2 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer"
                    >
                      Restore Default Campus Photo
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={editHeroLink ?? ''}
                      onChange={(e) => {
                        setEditHeroLink(e.target.value);
                        setEditHeroImageUrl(normalizeImageUrl(e.target.value));
                      }}
                      placeholder="Paste Google Drive link or direct image URL..."
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setEditHeroImageUrl(normalizeImageUrl(editHeroLink))}
                      className="px-3 py-2 rounded-lg bg-[#650019] text-white text-xs font-bold cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>
                )}
              </div>

              {/* 3. Edit Welcome Content & Hero Caption */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-[#650019] border-b border-gray-200 pb-2">
                  3. Welcome Section Text, Hero Caption & Footer Content
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                      School Name Kicker *
                    </label>
                    <input
                      type="text"
                      required
                      value={editSchoolKicker ?? ''}
                      onChange={(e) => setEditSchoolKicker(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                      Portal Subtitle *
                    </label>
                    <input
                      type="text"
                      required
                      value={editPortalSubtitle ?? ''}
                      onChange={(e) => setEditPortalSubtitle(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Main Welcome Heading *
                  </label>
                  <input
                    type="text"
                    required
                    value={editWelcomeTitle ?? ''}
                    onChange={(e) => setEditWelcomeTitle(e.target.value)}
                    placeholder="Welcome, BNHS Alumni!"
                    className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Alumni Motto Line *
                  </label>
                  <input
                    type="text"
                    required
                    value={editMottoText ?? ''}
                    onChange={(e) => setEditMottoText(e.target.value)}
                    placeholder="Once a Student, Always an Eagle!"
                    className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-[#650019]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Welcome Paragraph Content *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={editWelcomeDesc ?? ''}
                    onChange={(e) => setEditWelcomeDesc(e.target.value)}
                    placeholder="Reconnect. Remember. Celebrate. Stay Connected. Join the official digital home of Barobo National High School graduates from Batch 1982 to Batch 2026."
                    className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                      Hero Caption Location *
                    </label>
                    <input
                      type="text"
                      required
                      value={editHeroCaptionLocation ?? ''}
                      onChange={(e) => setEditHeroCaptionLocation(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                      Hero Caption Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={editHeroCaptionTitle ?? ''}
                      onChange={(e) => setEditHeroCaptionTitle(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Hero Caption Description *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={editHeroCaptionDescription ?? ''}
                    onChange={(e) => setEditHeroCaptionDescription(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Footer Address & Motto Text *
                  </label>
                  <input
                    type="text"
                    required
                    value={editFooterSubtitle ?? ''}
                    onChange={(e) => setEditFooterSubtitle(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                  />
                </div>
              </div>

              {/* 4. School Social Media Links (Facebook, Twitter, LinkedIn) */}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-[#650019]">
                    4. School Social Media Links (Rendered as Footer Icons)
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Manage the official Barobo National High School social media profiles displayed as interactive icons in the portal footer.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1 flex items-center gap-1.5">
                      <Facebook className="w-3.5 h-3.5 text-[#650019]" />
                      <span>Facebook Page URL</span>
                    </label>
                    <input
                      type="url"
                      value={editFacebookUrl ?? ''}
                      onChange={(e) => setEditFacebookUrl(e.target.value)}
                      placeholder="https://www.facebook.com/BaroboNationalHighSchool"
                      className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1 flex items-center gap-1.5">
                      <Twitter className="w-3.5 h-3.5 text-[#650019]" />
                      <span>Twitter / X Profile URL</span>
                    </label>
                    <input
                      type="url"
                      value={editTwitterUrl ?? ''}
                      onChange={(e) => setEditTwitterUrl(e.target.value)}
                      placeholder="https://twitter.com/BNHSAlumni"
                      className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1 flex items-center gap-1.5">
                      <Linkedin className="w-3.5 h-3.5 text-[#650019]" />
                      <span>LinkedIn School Page URL</span>
                    </label>
                    <input
                      type="url"
                      value={editLinkedinUrl ?? ''}
                      onChange={(e) => setEditLinkedinUrl(e.target.value)}
                      placeholder="https://www.linkedin.com/school/barobo-national-high-school"
                      className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-xs font-semibold text-[#650019] text-center sm:text-left">
                  BNHS Alumni Portal developed by: Bless T. Tajale
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAdminHeroModal(false)}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingHeroSettings}
                    className="px-5 py-2.5 rounded-lg bg-[#650019] text-white text-xs font-bold hover:bg-[#450012] inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Save className="w-4 h-4 text-[#D4AF37]" />
                    {savingHeroSettings
                      ? 'Saving Changes...'
                      : 'Save & Sync All Settings'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dark Maroon Institutional Footer */}
      <footer className="bg-[#450012] border-t border-[#D4AF37]/30 text-white py-10 px-3 sm:px-6 lg:px-8 mt-12">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="flex items-start sm:items-center gap-4">
              <div
                className={`w-12 h-12 rounded-xl overflow-hidden border border-[#D4AF37] bg-white shrink-0 ${
                  portalSettings.logoAnimated ? 'animate-bnhs-seal' : ''
                }`}
              >
                <ResilientImage
                  src={portalSettings.logoUrl}
                  alt="Barobo National High School Seal"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <p className="font-display text-sm font-bold tracking-wider text-[#D4AF37]">
                  BAROBO NATIONAL HIGH SCHOOL • ALUMNI COMMUNITY
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <p className="text-xs text-white/80">
                    {portalSettings.footerSubtitle || DEFAULT_PORTAL_SETTINGS.footerSubtitle}
                  </p>
                  <button
                    type="button"
                    onClick={openFooterSubtitleEditor}
                    className="px-2 py-0.5 rounded bg-[#650019] border border-[#D4AF37]/50 text-[11px] font-bold text-[#D4AF37] hover:bg-black/30 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-2.5 h-2.5" />
                    Edit
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              {/* Navigation Links */}
              <div className="flex flex-wrap items-center gap-4 sm:gap-5 text-xs text-white/80">
                <button
                  type="button"
                  onClick={openAdminHeroEditor}
                  className="text-[#D4AF37] font-semibold hover:underline transition-colors cursor-pointer"
                >
                  Admin: Edit Logo, Welcome & Socials
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('directory')}
                  className="hover:text-[#D4AF37] transition-colors cursor-pointer"
                >
                  Alumni Directory
                </button>
                <button
                  type="button"
                  onClick={() => setShowRegistrationModal(true)}
                  className="hover:text-[#D4AF37] transition-colors cursor-pointer"
                >
                  Register as Alumni
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('events')}
                  className="hover:text-[#D4AF37] transition-colors cursor-pointer"
                >
                  Alumni Events
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('announcements')}
                  className="hover:text-[#D4AF37] transition-colors cursor-pointer"
                >
                  Announcements
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (currentUser) {
                      setActiveTab('dashboard');
                    } else {
                      setAuthErrorMessage(null);
                      setShowLoginModal(true);
                    }
                  }}
                  className="hover:text-[#D4AF37] transition-colors cursor-pointer"
                >
                  Alumni Portal Login
                </button>
              </div>

              {/* School Social Media Footer Icons (Facebook, Twitter, LinkedIn) */}
              <div className="flex items-center gap-2.5">
                {portalSettings.facebookUrl && (
                  <a
                    href={portalSettings.facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Barobo National High School Facebook"
                    title="Barobo National High School on Facebook"
                    className="w-9 h-9 rounded-lg bg-[#650019] border border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37] hover:text-[#450012] transition-colors flex items-center justify-center"
                  >
                    <Facebook className="w-4 h-4" />
                  </a>
                )}
                {portalSettings.twitterUrl && (
                  <a
                    href={portalSettings.twitterUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Barobo National High School Twitter"
                    title="Barobo National High School on Twitter / X"
                    className="w-9 h-9 rounded-lg bg-[#650019] border border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37] hover:text-[#450012] transition-colors flex items-center justify-center"
                  >
                    <Twitter className="w-4 h-4" />
                  </a>
                )}
                {portalSettings.linkedinUrl && (
                  <a
                    href={portalSettings.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Barobo National High School LinkedIn"
                    title="Barobo National High School on LinkedIn"
                    className="w-9 h-9 rounded-lg bg-[#650019] border border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37] hover:text-[#450012] transition-colors flex items-center justify-center"
                  >
                    <Linkedin className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Centered Developer Attribution Bar & Button */}
          <div className="pt-6 border-t border-white/15 flex flex-col items-center justify-center text-center gap-2">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="px-5 py-2.5 rounded-lg bg-[#650019] border border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37] hover:text-[#450012] transition-colors text-xs sm:text-sm font-bold tracking-wide text-center cursor-pointer shadow-sm"
            >
              BNHS Alumni Portal developed by: Bless T. Tajale
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
