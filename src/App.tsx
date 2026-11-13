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
  X,
  CheckCircle2,
  Facebook,
  Twitter,
  Linkedin,
  Cloud,
  Edit3,
  LogIn,
  Trash2,
} from 'lucide-react';
import {
  auth,
  db,
  handleFirestoreError,
  logOutUser,
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
import { EventSlidingGallery } from './components/EventSlidingGallery';
import { EditMenuTab, PortalEditMenuModal } from './components/PortalEditMenuModal';
import { DeleteMenuTab, PortalDeleteMenuModal } from './components/PortalDeleteMenuModal';

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
  rsvps: 'bnhs_local_rsvps_v2',
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

  // Unified Edit Menu & Unified Delete Menu Modal State
  const [editMenuState, setEditMenuState] = useState<{
    isOpen: boolean;
    tab: EditMenuTab;
    itemId: string | null;
  }>({ isOpen: false, tab: 'branding', itemId: null });

  const [deleteMenuState, setDeleteMenuState] = useState<{
    isOpen: boolean;
    tab: DeleteMenuTab;
    focusId: string | null;
  }>({ isOpen: false, tab: 'directory', focusId: null });

  const [adminToast, setAdminToast] = useState<string | null>(null);

  // Online Alumni Registration Modal State
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);

  // Track if first mount already hydrated so Auto-Sync triggers cleanly on changes
  const autoSyncMountedRef = useRef(false);

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

  const [myRsvps, setMyRsvps] = useState<Record<string, EventRsvpRecord>>(() =>
    loadJsonFromStorage(STORAGE_KEYS.rsvps, {})
  );

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

  useEffect(() => {
    saveJsonToStorage(STORAGE_KEYS.rsvps, myRsvps);
  }, [myRsvps]);

  // Real-time Debounced Auto-Sync (saves all portal changes automatically)
  useEffect(() => {
    if (!autoSyncMountedRef.current) {
      autoSyncMountedRef.current = true;
      return;
    }
    setCloudSyncStatus('syncing');
    const timer = window.setTimeout(() => {
      saveJsonToStorage(STORAGE_KEYS.settings, portalSettings);
      saveJsonToStorage(STORAGE_KEYS.profiles, localProfileOverrides);
      saveJsonToStorage(STORAGE_KEYS.deletedProfiles, deletedProfileUids);
      saveJsonToStorage(STORAGE_KEYS.events, localEventOverrides);
      saveJsonToStorage(STORAGE_KEYS.deletedEvents, deletedEventIds);
      saveJsonToStorage(STORAGE_KEYS.announcements, localAnnouncementOverrides);
      saveJsonToStorage(STORAGE_KEYS.deletedAnnouncements, deletedAnnouncementIds);
      saveJsonToStorage(STORAGE_KEYS.spotlights, localSpotlightOverrides);
      saveJsonToStorage(STORAGE_KEYS.deletedSpotlights, deletedSpotlightIds);
      saveJsonToStorage(STORAGE_KEYS.rsvps, myRsvps);

      setCloudSyncStatus('synced');
      setLastSyncedTime(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
    }, 450);

    return () => window.clearTimeout(timer);
  }, [
    portalSettings,
    localProfileOverrides,
    deletedProfileUids,
    localEventOverrides,
    deletedEventIds,
    localAnnouncementOverrides,
    deletedAnnouncementIds,
    localSpotlightOverrides,
    deletedSpotlightIds,
    myRsvps,
  ]);

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
          const gallery = Array.isArray(d.galleryUrls)
            ? d.galleryUrls.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
            : undefined;
          rows.push({
            id: docSnap.id,
            authorId: d.authorId || 'system_bnhs_admin',
            title: d.title || '',
            category: d.category || 'Homecoming',
            eventDate: d.eventDate || '',
            venue: d.venue || '',
            description: d.description || '',
            imageUrl: d.imageUrl || (gallery && gallery[0]) || '',
            galleryUrls: gallery,
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
        const mergedGallery =
          ev.galleryUrls && ev.galleryUrls.length > 0
            ? ev.galleryUrls
            : existing?.galleryUrls;
        map.set(ev.id, {
          ...ev,
          imageUrl: ev.imageUrl || existing?.imageUrl || BNHS_ASSETS.homecomingEvent,
          galleryUrls: mergedGallery,
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
    saveJsonToStorage(STORAGE_KEYS.deletedProfiles, deletedProfileUids);
    saveJsonToStorage(STORAGE_KEYS.events, localEventOverrides);
    saveJsonToStorage(STORAGE_KEYS.deletedEvents, deletedEventIds);
    saveJsonToStorage(STORAGE_KEYS.announcements, localAnnouncementOverrides);
    saveJsonToStorage(STORAGE_KEYS.deletedAnnouncements, deletedAnnouncementIds);
    saveJsonToStorage(STORAGE_KEYS.spotlights, localSpotlightOverrides);
    saveJsonToStorage(STORAGE_KEYS.deletedSpotlights, deletedSpotlightIds);
    saveJsonToStorage(STORAGE_KEYS.rsvps, myRsvps);

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
    setAdminToast(`Auto-Sync Verified (${nowStr}) — All portal edits, photos, and deletions are saved.`);
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

  // Save or update an Event & its sliding photo gallery
  const handleSaveEvent = async (eventData: AlumniEventRecord, _isNew: boolean) => {
    const cleanSlides = Array.from(
      new Set([
        ...(eventData.galleryUrls || []),
        ...(eventData.imageUrl ? [eventData.imageUrl] : []),
      ])
    )
      .filter((u) => typeof u === 'string' && u.trim().length > 0)
      .slice(0, 10)
      .map((u) => sanitizeString(u, 150000));

    const primaryImg =
      cleanSlides[0] || sanitizeString(eventData.imageUrl || BNHS_ASSETS.homecomingEvent, 150000);

    const normalizedEvent: AlumniEventRecord = {
      ...eventData,
      imageUrl: primaryImg,
      galleryUrls: cleanSlides.length > 0 ? cleanSlides : [primaryImg],
    };

    setDeletedEventIds((prev) => {
      const next = { ...prev };
      delete next[normalizedEvent.id];
      return next;
    });
    setLocalEventOverrides((prev) => ({
      ...prev,
      [normalizedEvent.id]: normalizedEvent,
    }));
    setCloudSyncStatus('syncing');

    if (firebaseUser) {
      try {
        const eventRef = doc(db, 'events', normalizedEvent.id);
        const snap = await getDoc(eventRef);
        const payload = {
          authorId: snap.exists() ? snap.data().authorId : firebaseUser.uid,
          title: sanitizeString(normalizedEvent.title, 140),
          category: normalizedEvent.category,
          eventDate: sanitizeString(normalizedEvent.eventDate, 50),
          venue: sanitizeString(normalizedEvent.venue, 140),
          description: sanitizeString(normalizedEvent.description, 1000),
          imageUrl: primaryImg,
          galleryUrls: normalizedEvent.galleryUrls || [primaryImg],
          status: normalizedEvent.status,
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

  // Delete an individual slide from an Event's sliding photo gallery
  const handleDeleteEventSlide = async (eventId: string, slideIndex: number) => {
    const targetEv = combinedEvents.find((ev) => ev.id === eventId);
    if (!targetEv) return;
    const slides = Array.from(
      new Set([
        ...(targetEv.galleryUrls || []),
        ...(targetEv.imageUrl ? [targetEv.imageUrl] : []),
      ])
    ).filter(Boolean);
    const remaining = slides.filter((_, idx) => idx !== slideIndex);
    const nextSlides = remaining.length > 0 ? remaining : [BNHS_ASSETS.homecomingEvent];
    await handleSaveEvent(
      {
        ...targetEv,
        imageUrl: nextSlides[0],
        galleryUrls: nextSlides,
      },
      false
    );
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

  const openEditMenu = (tab: EditMenuTab = 'branding', itemId: string | null = null) => {
    setEditMenuState({ isOpen: true, tab, itemId });
  };

  const openDeleteMenu = (tab: DeleteMenuTab = 'directory', focusId: string | null = null) => {
    setDeleteMenuState({ isOpen: true, tab, focusId });
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

          {/* Zone 2: Navigation Links + Unified Edit Menu & Delete Menu beside Announcements */}
          <nav className="hidden lg:flex flex-wrap items-center gap-4 xl:gap-5 text-xs xl:text-sm font-medium text-white/85">
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

            {/* Unified Edit Menu beside Announcements */}
            <button
              type="button"
              onClick={() => openEditMenu('branding', null)}
              className="px-3 py-1.5 rounded-lg bg-[#650019] border border-[#D4AF37]/70 text-xs font-bold text-[#D4AF37] hover:bg-black/30 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer shadow-sm"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Menu</span>
            </button>

            {/* Unified Delete Menu beside Edit Menu */}
            <button
              type="button"
              onClick={() => openDeleteMenu('directory', null)}
              className="px-3 py-1.5 rounded-lg bg-[#650019] border border-red-400/60 text-xs font-bold text-red-200 hover:bg-red-700 hover:text-white transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Menu</span>
            </button>
          </nav>

          {/* Zone 3: Auto-Sync + Alumni Login / Dashboard Action */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleManualCloudSync}
              title={`Auto-Sync Active (${lastSyncedTime}) — Automatically saves all changes`}
              className="px-2.5 py-2 rounded-lg bg-[#650019] border border-[#D4AF37]/40 text-[11px] font-semibold text-[#D4AF37] hover:bg-black/30 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {cloudSyncStatus === 'syncing'
                  ? 'Auto-Syncing...'
                  : `Auto-Synced · ${lastSyncedTime}`}
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

        {/* Mobile & Tablet Quick Navigation Strip (with Unified Edit Menu & Delete Menu beside Announcements) */}
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
            onClick={() => openEditMenu('branding', null)}
            className="px-2.5 py-1 rounded-md bg-[#650019] border border-[#D4AF37]/60 text-[11px] font-bold text-[#D4AF37] whitespace-nowrap shrink-0 inline-flex items-center gap-1 cursor-pointer"
          >
            <Edit3 className="w-3 h-3" />
            <span>Edit Menu</span>
          </button>

          <button
            type="button"
            onClick={() => openDeleteMenu('directory', null)}
            className="px-2.5 py-1 rounded-md bg-[#650019] border border-red-400/60 text-[11px] font-bold text-red-200 whitespace-nowrap shrink-0 inline-flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            <span>Delete Menu</span>
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
                        onClick={() => openEditMenu('branding', null)}
                        title="Click to edit BNHS Animated GIF Logo in Edit Menu"
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

                  {/* Right Column: BNHS Campus Quadrangle Hero Card */}
                  <div className="lg:col-span-5 flex flex-col">
                    <div className="relative rounded-xl overflow-hidden border-2 border-[#D4AF37]/60 bg-[#450012] h-full min-h-[260px] sm:min-h-[320px] shadow-xl flex flex-col justify-end group">
                      <ResilientImage
                        src={portalSettings.heroImageUrl}
                        alt="Barobo National High School Campus Quadrangle"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div className="relative z-10 bg-gradient-to-t from-black/90 via-black/55 to-transparent p-5 sm:p-6 pt-16">
                        <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold mb-1">
                          {portalSettings.heroCaptionLocation ||
                            DEFAULT_PORTAL_SETTINGS.heroCaptionLocation}
                        </p>
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
                onSelectBatchYear={(yr) => {
                  setDirectoryYearFilter(String(yr));
                  setDirectoryCityFilter('ALL');
                  setActiveTab('directory');
                }}
                onOpenEditMenu={(tab, itemId) => openEditMenu(tab, itemId ?? null)}
                onOpenDeleteMenu={(tab, itemId) => openDeleteMenu(tab, itemId ?? null)}
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
                      {combinedEvents.slice(0, 2).map((ev) => {
                        const slideImages = [
                          ...(ev.galleryUrls || []),
                          ...(ev.imageUrl ? [ev.imageUrl] : []),
                        ].filter(Boolean);

                        return (
                          <div
                            key={ev.id}
                            onClick={() => setActiveTab('events')}
                            className="bg-white text-gray-900 rounded-xl overflow-hidden border border-gray-200 hover:border-[#D4AF37] transition-colors cursor-pointer"
                          >
                            <EventSlidingGallery
                              images={
                                slideImages.length > 0
                                  ? slideImages
                                  : [BNHS_ASSETS.homecomingEvent]
                              }
                              title={ev.title}
                              category={ev.category}
                              heightClass="h-36 sm:h-40"
                              autoPlayIntervalMs={3800}
                              onManageSlides={() => openEditMenu('events', ev.id)}
                            />
                            <div className="p-4">
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
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/15 flex flex-wrap items-center justify-between gap-3 text-xs text-white/80">
                    <span>Sliding galleries for Homecoming, Batch Reunion, Mentorship, Scholarship & Outreach</span>
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
            onNavigateRegister={() => setShowRegistrationModal(true)}
            onOpenEditMenu={(tab, itemId) => openEditMenu(tab, itemId ?? null)}
            onOpenDeleteMenu={(tab, itemId) => openDeleteMenu(tab, itemId ?? null)}
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
            onSaveLocalRsvp={(eventId, rsvp) =>
              setMyRsvps((prev) => ({ ...prev, [eventId]: rsvp }))
            }
            onOpenEditMenu={(tab, itemId) => openEditMenu(tab, itemId ?? null)}
            onOpenDeleteMenu={(tab, itemId) => openDeleteMenu(tab, itemId ?? null)}
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
            onSaveLocalRsvp={(eventId, rsvp) =>
              setMyRsvps((prev) => ({ ...prev, [eventId]: rsvp }))
            }
            onOpenEditMenu={(tab, itemId) => openEditMenu(tab, itemId ?? null)}
            onOpenDeleteMenu={(tab, itemId) => openDeleteMenu(tab, itemId ?? null)}
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

      {/* Unified Edit Menu Modal (All Edit Menus Combined into One) */}
      <PortalEditMenuModal
        isOpen={editMenuState.isOpen}
        initialTab={editMenuState.tab}
        initialItemId={editMenuState.itemId}
        onClose={() => setEditMenuState((prev) => ({ ...prev, isOpen: false }))}
        portalSettings={portalSettings}
        alumniList={combinedAlumniDirectory}
        events={combinedEvents}
        announcements={combinedAnnouncements}
        spotlights={combinedSpotlights}
        onSavePortalSettings={handleSavePortalSettings}
        onSaveEvent={handleSaveEvent}
        onSaveAlumnusProfile={handleSaveAlumnusProfile}
        onSaveAnnouncement={handleSaveAnnouncement}
        onSaveSpotlight={handleSaveSpotlight}
      />

      {/* Unified Delete Menu Modal (All Delete Menus Combined into One) */}
      <PortalDeleteMenuModal
        isOpen={deleteMenuState.isOpen}
        initialTab={deleteMenuState.tab}
        initialFocusId={deleteMenuState.focusId}
        onClose={() => setDeleteMenuState((prev) => ({ ...prev, isOpen: false }))}
        alumniList={combinedAlumniDirectory}
        events={combinedEvents}
        announcements={combinedAnnouncements}
        spotlights={combinedSpotlights}
        onDeleteAlumnusProfile={handleDeleteAlumnusProfile}
        onDeleteEvent={handleDeleteEvent}
        onDeleteEventSlide={handleDeleteEventSlide}
        onDeleteAnnouncement={handleDeleteAnnouncement}
        onDeleteSpotlight={handleDeleteSpotlight}
      />

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
                <p className="text-xs text-white/80 mt-1">
                  {portalSettings.footerSubtitle || DEFAULT_PORTAL_SETTINGS.footerSubtitle}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              {/* Navigation Links */}
              <div className="flex flex-wrap items-center gap-4 sm:gap-5 text-xs text-white/80">
                <button
                  type="button"
                  onClick={() => openEditMenu('branding', null)}
                  className="text-[#D4AF37] font-semibold hover:underline transition-colors cursor-pointer"
                >
                  Edit Menu
                </button>
                <button
                  type="button"
                  onClick={() => openDeleteMenu('directory', null)}
                  className="text-red-300 font-semibold hover:underline transition-colors cursor-pointer"
                >
                  Delete Menu
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
