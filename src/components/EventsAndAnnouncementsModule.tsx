import React, { useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import {
  Calendar,
  MapPin,
  Check,
  CheckCircle2,
  Cloud,
  Plus,
  X,
  BookOpen,
  Megaphone,
  Edit3,
  Upload,
  Link2,
  Trash2,
  Images,
} from 'lucide-react';
import {
  ALLOWED_ANNOUNCEMENT_CATEGORIES,
  ALLOWED_EVENT_CATEGORIES,
  AnnouncementCategory,
  auth,
  db,
  EventCategory,
  fileToCompressedDataUrl,
  handleFirestoreError,
  normalizeImageUrl,
  OperationType,
  sanitizeId,
  sanitizeString,
} from '../lib/firebase';
import {
  AlumniEventRecord,
  AlumniProfileRecord,
  AnnouncementRecord,
  BNHS_ASSETS,
  EventRsvpRecord,
} from '../data/bnhsData';
import { EventSlidingGallery } from './EventSlidingGallery';

interface EventsAndAnnouncementsProps {
  mode: 'events' | 'announcements';
  currentUser: User | null;
  userProfile: AlumniProfileRecord | null;
  events: AlumniEventRecord[];
  announcements: AnnouncementRecord[];
  userRsvps: Record<string, EventRsvpRecord>;
  onSignIn: () => Promise<void>;
  onSaveEvent: (eventData: AlumniEventRecord, isNew: boolean) => Promise<void>;
  onSaveAnnouncement?: (annData: AnnouncementRecord, isNew: boolean) => Promise<void>;
  onSaveLocalRsvp?: (eventId: string, rsvp: EventRsvpRecord) => void;
  onOpenEditMenu: (tab: 'events' | 'announcements', itemId?: string | null) => void;
  onOpenDeleteMenu: (tab: 'events' | 'announcements', itemId?: string | null) => void;
}

export const EventsAndAnnouncementsModule: React.FC<EventsAndAnnouncementsProps> = ({
  mode,
  currentUser,
  userProfile,
  events,
  announcements,
  userRsvps,
  onSignIn,
  onSaveEvent,
  onSaveAnnouncement,
  onSaveLocalRsvp,
  onOpenEditMenu,
  onOpenDeleteMenu,
}) => {
  const [selectedEventCategory, setSelectedEventCategory] = useState<string>('ALL');
  const [selectedAnnCategory, setSelectedAnnCategory] = useState<string>('ALL');
  const [rsvpBusyId, setRsvpBusyId] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
  const [activeAnnouncement, setActiveAnnouncement] = useState<AnnouncementRecord | null>(null);

  // 5-Category Sliding Showcase State
  const [showcaseCategory, setShowcaseCategory] = useState<EventCategory>('Homecoming');
  const [showcaseUploadMode, setShowcaseUploadMode] = useState<'local' | 'link'>('local');
  const [showcaseLinkInput, setShowcaseLinkInput] = useState('');
  const [uploadingShowcasePhoto, setUploadingShowcasePhoto] = useState(false);
  const showcaseFileInputRef = useRef<HTMLInputElement | null>(null);

  // Inline Showcase Text Editor State (avoids forcing user into selection dropdown)
  const [editingShowcaseText, setEditingShowcaseText] = useState(false);
  const [showcaseDraft, setShowcaseDraft] = useState<AlumniEventRecord | null>(null);
  const [showcaseAutoSaving, setShowcaseAutoSaving] = useState(false);
  const showcaseTitleRef = useRef<HTMLInputElement | null>(null);
  const showcaseDirtyRef = useRef(false);

  // Inline Event Card Editor State (click Edit -> edit text & slides directly, auto-saves!)
  const [inlineEditingEventId, setInlineEditingEventId] = useState<string | null>(null);
  const [inlineEventDraft, setInlineEventDraft] = useState<AlumniEventRecord | null>(null);
  const [inlineEventSaving, setInlineEventSaving] = useState(false);
  const [inlineSlideMode, setInlineSlideMode] = useState<'local' | 'link'>('local');
  const [inlineSlideLink, setInlineSlideLink] = useState('');
  const [inlineUploadingSlide, setInlineUploadingSlide] = useState(false);
  const inlineTitleInputRef = useRef<HTMLInputElement | null>(null);
  const inlineSlideFileRef = useRef<HTMLInputElement | null>(null);
  const inlineEventDirtyRef = useRef(false);

  // Inline Announcement Editor State
  const [inlineEditingAnnId, setInlineEditingAnnId] = useState<string | null>(null);
  const [inlineAnnDraft, setInlineAnnDraft] = useState<AnnouncementRecord | null>(null);
  const [inlineAnnSaving, setInlineAnnSaving] = useState(false);
  const inlineAnnTitleRef = useRef<HTMLInputElement | null>(null);
  const inlineAnnDirtyRef = useRef(false);

  // Find target event & slides for the selected showcase category
  const showcaseEvent = useMemo(() => {
    return events.find((ev) => ev.category === showcaseCategory) || null;
  }, [events, showcaseCategory]);

  const showcaseSlides = useMemo(() => {
    const matching = events.filter((ev) => ev.category === showcaseCategory);
    const urls = matching.flatMap((ev) => [
      ...(ev.galleryUrls || []),
      ...(ev.imageUrl ? [ev.imageUrl] : []),
    ]);
    const unique = Array.from(new Set(urls.filter(Boolean)));
    return unique.length > 0 ? unique : [BNHS_ASSETS.homecomingEvent, BNHS_ASSETS.campusHero];
  }, [events, showcaseCategory]);

  const appendSlidesToCategory = async (newUrls: string[]) => {
    if (newUrls.length === 0) return;
    if (showcaseEvent) {
      const existing = [
        ...(showcaseEvent.galleryUrls || []),
        ...(showcaseEvent.imageUrl ? [showcaseEvent.imageUrl] : []),
      ].filter(Boolean);
      const merged = Array.from(new Set([...existing, ...newUrls])).slice(0, 10);
      await onSaveEvent(
        {
          ...showcaseEvent,
          imageUrl: merged[0],
          galleryUrls: merged,
        },
        false
      );
      setFeedbackBanner(
        `Added & auto-synced ${newUrls.length} sliding photo(s) to ${showcaseCategory} ("${showcaseEvent.title}").`
      );
    } else {
      const newId = sanitizeId(`evt_${Date.now()}`);
      const merged = Array.from(new Set(newUrls)).slice(0, 10);
      const newEvent: AlumniEventRecord = {
        id: newId,
        authorId: currentUser?.uid || 'system_bnhs_admin',
        title: `BNHS ${showcaseCategory} Gathering`,
        category: showcaseCategory,
        eventDate: 'Upcoming Schedule · TBA',
        venue: 'Barobo National High School Campus, Poblacion, Barobo',
        description: `Official ${showcaseCategory} celebration and alumni fellowship gallery for Barobo National High School graduates.`,
        status: 'upcoming',
        visibility: 'public',
        imageUrl: merged[0],
        galleryUrls: merged,
      };
      await onSaveEvent(newEvent, true);
      setFeedbackBanner(
        `Created ${showcaseCategory} showcase event and auto-synced ${merged.length} sliding photo(s).`
      );
    }
  };

  // Auto-save inline Showcase Text changes automatically
  useEffect(() => {
    if (!editingShowcaseText || !showcaseDraft || !showcaseDirtyRef.current) return;
    const cleanTitle = sanitizeString(showcaseDraft.title, 140);
    const cleanDate = sanitizeString(showcaseDraft.eventDate, 50);
    const cleanVenue = sanitizeString(showcaseDraft.venue, 140);
    const cleanDesc = sanitizeString(showcaseDraft.description, 1000);
    if (cleanTitle.length < 5 || cleanDate.length < 4 || cleanVenue.length < 3 || cleanDesc.length < 10) {
      return;
    }

    const timer = window.setTimeout(async () => {
      setShowcaseAutoSaving(true);
      try {
        const existsAlready = events.some((ev) => ev.id === showcaseDraft.id);
        await onSaveEvent(
          {
            ...showcaseDraft,
            title: cleanTitle,
            eventDate: cleanDate,
            venue: cleanVenue,
            description: cleanDesc,
          },
          !existsAlready
        );
        showcaseDirtyRef.current = false;
      } finally {
        setShowcaseAutoSaving(false);
      }
    }, 450);

    return () => window.clearTimeout(timer);
  }, [editingShowcaseText, showcaseDraft, events, onSaveEvent]);

  // Auto-save inline Event Card changes automatically
  useEffect(() => {
    if (!inlineEditingEventId || !inlineEventDraft || !inlineEventDirtyRef.current) return;
    const cleanTitle = sanitizeString(inlineEventDraft.title, 140);
    const cleanDate = sanitizeString(inlineEventDraft.eventDate, 50);
    const cleanVenue = sanitizeString(inlineEventDraft.venue, 140);
    const cleanDesc = sanitizeString(inlineEventDraft.description, 1000);
    if (cleanTitle.length < 5 || cleanDate.length < 4 || cleanVenue.length < 3 || cleanDesc.length < 10) {
      return;
    }

    const timer = window.setTimeout(async () => {
      setInlineEventSaving(true);
      try {
        await onSaveEvent(
          {
            ...inlineEventDraft,
            title: cleanTitle,
            eventDate: cleanDate,
            venue: cleanVenue,
            description: cleanDesc,
          },
          false
        );
        inlineEventDirtyRef.current = false;
      } finally {
        setInlineEventSaving(false);
      }
    }, 450);

    return () => window.clearTimeout(timer);
  }, [inlineEditingEventId, inlineEventDraft, onSaveEvent]);

  // Auto-save inline Announcement Card changes automatically
  useEffect(() => {
    if (!inlineEditingAnnId || !inlineAnnDraft || !inlineAnnDirtyRef.current || !onSaveAnnouncement) return;
    const cleanTitle = sanitizeString(inlineAnnDraft.title, 150);
    const cleanAuthor = sanitizeString(inlineAnnDraft.authorName || 'BNHS Alumni Federation', 100);
    const cleanSummary = sanitizeString(inlineAnnDraft.summary, 300);
    const cleanContent = sanitizeString(inlineAnnDraft.content, 2000);
    if (cleanTitle.length < 5 || cleanAuthor.length < 2 || cleanSummary.length < 10 || cleanContent.length < 20) {
      return;
    }

    const timer = window.setTimeout(async () => {
      setInlineAnnSaving(true);
      try {
        await onSaveAnnouncement(
          {
            ...inlineAnnDraft,
            title: cleanTitle,
            authorName: cleanAuthor,
            summary: cleanSummary,
            content: cleanContent,
          },
          false
        );
        inlineAnnDirtyRef.current = false;
      } finally {
        setInlineAnnSaving(false);
      }
    }, 450);

    return () => window.clearTimeout(timer);
  }, [inlineEditingAnnId, inlineAnnDraft, onSaveAnnouncement]);

  const startShowcaseTextEdit = () => {
    const baseEvent: AlumniEventRecord = showcaseEvent
      ? { ...showcaseEvent }
      : {
          id: sanitizeId(`evt_${showcaseCategory.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`),
          authorId: currentUser?.uid || 'system_bnhs_admin',
          title: `BNHS ${showcaseCategory} Gathering`,
          category: showcaseCategory,
          eventDate: 'Upcoming Schedule · TBA',
          venue: 'Barobo National High School Campus, Poblacion, Barobo',
          description: `Official ${showcaseCategory} celebration and alumni fellowship gallery for Barobo National High School graduates.`,
          status: 'upcoming',
          visibility: 'public',
          imageUrl: showcaseSlides[0] || BNHS_ASSETS.homecomingEvent,
          galleryUrls: showcaseSlides,
        };
    showcaseDirtyRef.current = false;
    setShowcaseDraft(baseEvent);
    setEditingShowcaseText(true);
    window.setTimeout(() => showcaseTitleRef.current?.focus(), 60);
  };

  const startInlineEventEdit = (ev: AlumniEventRecord) => {
    const slides = Array.from(
      new Set([...(ev.galleryUrls || []), ...(ev.imageUrl ? [ev.imageUrl] : [])])
    ).filter(Boolean);
    inlineEventDirtyRef.current = false;
    setInlineEditingEventId(ev.id);
    setInlineEventDraft({
      ...ev,
      galleryUrls: slides.length > 0 ? slides : [BNHS_ASSETS.homecomingEvent],
      imageUrl: slides[0] || ev.imageUrl || BNHS_ASSETS.homecomingEvent,
    });
    setInlineSlideLink('');
    window.setTimeout(() => inlineTitleInputRef.current?.focus(), 60);
  };

  const finishInlineEventEdit = async () => {
    if (inlineEventDraft && inlineEventDirtyRef.current) {
      const cleanTitle = sanitizeString(inlineEventDraft.title, 140);
      const cleanDate = sanitizeString(inlineEventDraft.eventDate, 50);
      const cleanVenue = sanitizeString(inlineEventDraft.venue, 140);
      const cleanDesc = sanitizeString(inlineEventDraft.description, 1000);
      if (cleanTitle.length >= 5 && cleanDate.length >= 4 && cleanVenue.length >= 3 && cleanDesc.length >= 10) {
        setInlineEventSaving(true);
        try {
          await onSaveEvent(
            {
              ...inlineEventDraft,
              title: cleanTitle,
              eventDate: cleanDate,
              venue: cleanVenue,
              description: cleanDesc,
            },
            false
          );
          inlineEventDirtyRef.current = false;
        } finally {
          setInlineEventSaving(false);
        }
      }
    }
    setInlineEditingEventId(null);
    setInlineEventDraft(null);
  };

  const handleInlineEventSlideUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !inlineEventDraft) return;
    setInlineUploadingSlide(true);
    try {
      const currentSlides = inlineEventDraft.galleryUrls || [];
      const newUrls: string[] = [];
      for (let i = 0; i < files.length && currentSlides.length + newUrls.length < 10; i++) {
        const compressed = await fileToCompressedDataUrl(files[i], 480, 0.72);
        newUrls.push(compressed);
      }
      if (newUrls.length > 0) {
        const merged = Array.from(new Set([...currentSlides, ...newUrls])).slice(0, 10);
        inlineEventDirtyRef.current = true;
        setInlineEventDraft((prev) =>
          prev ? { ...prev, imageUrl: merged[0], galleryUrls: merged } : null
        );
      }
    } finally {
      setInlineUploadingSlide(false);
      if (inlineSlideFileRef.current) inlineSlideFileRef.current.value = '';
    }
  };

  const handleInlineEventSlideLinkAdd = () => {
    if (!inlineEventDraft) return;
    const norm = normalizeImageUrl(inlineSlideLink);
    if (!norm) return;
    const merged = Array.from(
      new Set([...(inlineEventDraft.galleryUrls || []), norm])
    ).slice(0, 10);
    inlineEventDirtyRef.current = true;
    setInlineEventDraft((prev) =>
      prev ? { ...prev, imageUrl: merged[0], galleryUrls: merged } : null
    );
    setInlineSlideLink('');
  };

  const handleShowcaseLocalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingShowcasePhoto(true);
    try {
      const uploaded: string[] = [];
      for (let i = 0; i < files.length && uploaded.length < 5; i++) {
        const dataUrl = await fileToCompressedDataUrl(files[i], 480, 0.72);
        uploaded.push(dataUrl);
      }
      await appendSlidesToCategory(uploaded);
    } catch (err) {
      console.error('Error uploading showcase photo:', err);
    } finally {
      setUploadingShowcasePhoto(false);
      if (showcaseFileInputRef.current) {
        showcaseFileInputRef.current.value = '';
      }
    }
  };

  const handleShowcaseLinkAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeImageUrl(showcaseLinkInput);
    if (!normalized) return;
    setUploadingShowcasePhoto(true);
    try {
      await appendSlidesToCategory([normalized]);
      setShowcaseLinkInput('');
    } finally {
      setUploadingShowcasePhoto(false);
    }
  };

  const handleRsvp = async (
    eventItem: AlumniEventRecord,
    desiredStatus: 'attending' | 'interested' | 'cancelled'
  ) => {
    setFeedbackBanner(null);
    if (!currentUser) {
      await onSignIn();
      return;
    }

    const rsvpDocId = sanitizeId(`${currentUser.uid}_${eventItem.id}`);
    const attendeeName = sanitizeString(
      userProfile?.fullName || currentUser.displayName || 'BNHS Alumnus',
      100
    );
    const gradYear = userProfile?.graduationYear || 2020;

    const localRsvp: EventRsvpRecord = {
      id: rsvpDocId,
      uid: currentUser.uid,
      eventId: eventItem.id,
      attendeeName,
      graduationYear: gradYear,
      status: desiredStatus,
    };

    if (!auth.currentUser || auth.currentUser.uid !== currentUser.uid) {
      if (onSaveLocalRsvp) {
        onSaveLocalRsvp(eventItem.id, localRsvp);
      }
      setFeedbackBanner(
        desiredStatus === 'cancelled'
          ? `Your RSVP for "${eventItem.title}" has been cancelled.`
          : `Confirmed & auto-synced! You are marked as "${desiredStatus}" for ${eventItem.title}.`
      );
      return;
    }

    setRsvpBusyId(eventItem.id);

    try {
      const eventRef = doc(db, 'events', eventItem.id);
      const eventSnap = await getDoc(eventRef);
      if (!eventSnap.exists()) {
        const slides = Array.from(
          new Set([
            ...(eventItem.galleryUrls || []),
            ...(eventItem.imageUrl ? [eventItem.imageUrl] : []),
          ])
        )
          .filter(Boolean)
          .slice(0, 10)
          .map((u) => sanitizeString(u, 150000));

        await setDoc(eventRef, {
          authorId: currentUser.uid,
          title: sanitizeString(eventItem.title, 140),
          category: eventItem.category,
          eventDate: sanitizeString(eventItem.eventDate, 50),
          venue: sanitizeString(eventItem.venue, 140),
          description: sanitizeString(eventItem.description, 1000),
          imageUrl: sanitizeString(
            eventItem.imageUrl || slides[0] || BNHS_ASSETS.homecomingEvent,
            150000
          ),
          galleryUrls: slides,
          status: eventItem.status,
          visibility: 'public',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      const rsvpRef = doc(db, 'event_rsvps', rsvpDocId);
      const rsvpSnap = await getDoc(rsvpRef);

      if (rsvpSnap.exists() && rsvpSnap.data().status !== 'cancelled') {
        await updateDoc(rsvpRef, {
          attendeeName,
          graduationYear: gradYear,
          status: desiredStatus,
          updatedAt: serverTimestamp(),
        });
      } else if (!rsvpSnap.exists()) {
        await setDoc(rsvpRef, {
          uid: currentUser.uid,
          eventId: eventItem.id,
          attendeeName,
          graduationYear: gradYear,
          status: desiredStatus,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      if (onSaveLocalRsvp) {
        onSaveLocalRsvp(eventItem.id, localRsvp);
      }

      setFeedbackBanner(
        desiredStatus === 'cancelled'
          ? `Your RSVP for "${eventItem.title}" has been cancelled.`
          : `Confirmed & auto-synced! You are marked as "${desiredStatus}" for ${eventItem.title}.`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `event_rsvps/${rsvpDocId}`);
    } finally {
      setRsvpBusyId(null);
    }
  };

  if (mode === 'events') {
    const filteredEvents = events.filter(
      (ev) => selectedEventCategory === 'ALL' || ev.category === selectedEventCategory
    );

    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Events Header */}
        <div className="bg-[#450012] border border-[#D4AF37]/30 rounded-xl p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold mb-2">
                Barobo National High School · Campus & Chapter Activities
              </p>
              <h1 className="font-display text-2xl sm:text-4xl font-bold text-white">
                Alumni Events & Sliding Photo Galleries
              </h1>
              <p className="text-white/80 text-sm sm:text-base mt-2 max-w-2xl leading-relaxed">
                Explore auto-sliding photo carousels and upload local photos or Google links for Homecoming, Batch Reunion, Career Mentorship, Scholarship Drive, and Community Outreach.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => onOpenEditMenu('events', 'NEW')}
                className="px-4 py-2.5 rounded-lg bg-[#D4AF37] text-[#450012] font-bold text-xs sm:text-sm hover:bg-[#e3c14d] transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add / Edit Event in Edit Menu
              </button>
              <button
                type="button"
                onClick={() => onOpenDeleteMenu('events', null)}
                className="px-4 py-2.5 rounded-lg bg-[#650019] border border-red-400/50 text-white font-bold text-xs sm:text-sm hover:bg-red-700 transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Delete Events
              </button>
            </div>
          </div>

          {/* Interactive Category Filter Bar */}
          <div className="mt-6 pt-6 border-t border-white/15 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedEventCategory('ALL')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedEventCategory === 'ALL'
                  ? 'bg-[#D4AF37] text-[#450012]'
                  : 'bg-[#650019] text-white/80 hover:text-white'
              }`}
            >
              All Events ({events.length})
            </button>
            {ALLOWED_EVENT_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedEventCategory(cat)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedEventCategory === cat
                    ? 'bg-[#D4AF37] text-[#450012]'
                    : 'bg-[#650019] text-white/80 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {feedbackBanner && (
          <div className="p-4 rounded-xl bg-[#450012] border border-[#D4AF37] text-white text-sm flex items-center justify-between gap-3">
            <span>{feedbackBanner}</span>
            <button
              type="button"
              onClick={() => setFeedbackBanner(null)}
              className="text-[#D4AF37] hover:underline text-xs ml-4 cursor-pointer shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Featured 5-Category Sliding Picture Showcase */}
        <div className="bg-[#450012] border border-[#D4AF37]/40 rounded-xl overflow-hidden shadow-lg">
          <div className="p-5 sm:p-6 border-b border-white/15 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-bold flex items-center gap-1.5">
                <Images className="w-4 h-4" />
                <span>Featured Event Category Sliding Showcase · Auto-Save Active</span>
              </p>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-white mt-1">
                {showcaseEvent?.title || `${showcaseCategory} Highlight Slides`} ({showcaseSlides.length} Photos)
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {ALLOWED_EVENT_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setShowcaseCategory(cat);
                    setEditingShowcaseText(false);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    showcaseCategory === cat
                      ? 'bg-[#D4AF37] text-[#450012]'
                      : 'bg-[#650019] text-white/85 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
              <button
                type="button"
                onClick={() =>
                  editingShowcaseText ? setEditingShowcaseText(false) : startShowcaseTextEdit()
                }
                className="px-3 py-1.5 rounded-lg bg-white text-[#650019] text-xs font-bold hover:bg-gray-100 transition-colors inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Edit3 className="w-3.5 h-3.5" />
                {editingShowcaseText ? 'Close Text Editor' : 'Edit Event Text'}
              </button>
            </div>
          </div>

          {editingShowcaseText && showcaseDraft && (
            <div className="p-4 sm:p-5 bg-[#650019]/90 border-b border-[#D4AF37]/40 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#D4AF37] uppercase tracking-wider">
                  Editing {showcaseCategory} Showcase Text (Auto-Saves as You Type)
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-200">
                  {showcaseAutoSaving ? (
                    <>
                      <Cloud className="w-3.5 h-3.5 text-[#D4AF37] animate-pulse" />
                      <span>Cloud Syncing (Auto-Saving)...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Cloud Synced (Auto-Saved)</span>
                    </>
                  )}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-white/80 mb-1">
                    Showcase Event Title *
                  </label>
                  <input
                    ref={showcaseTitleRef}
                    type="text"
                    value={showcaseDraft.title ?? ''}
                    onChange={(e) => {
                      showcaseDirtyRef.current = true;
                      setShowcaseDraft((prev) =>
                        prev ? { ...prev, title: e.target.value } : null
                      );
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-white text-gray-900 text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-white/80 mb-1">
                    Date & Time *
                  </label>
                  <input
                    type="text"
                    value={showcaseDraft.eventDate ?? ''}
                    onChange={(e) => {
                      showcaseDirtyRef.current = true;
                      setShowcaseDraft((prev) =>
                        prev ? { ...prev, eventDate: e.target.value } : null
                      );
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-white text-gray-900 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-white/80 mb-1">
                    Venue *
                  </label>
                  <input
                    type="text"
                    value={showcaseDraft.venue ?? ''}
                    onChange={(e) => {
                      showcaseDirtyRef.current = true;
                      setShowcaseDraft((prev) =>
                        prev ? { ...prev, venue: e.target.value } : null
                      );
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-white text-gray-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-white/80 mb-1">
                    Description *
                  </label>
                  <input
                    type="text"
                    value={showcaseDraft.description ?? ''}
                    onChange={(e) => {
                      showcaseDirtyRef.current = true;
                      setShowcaseDraft((prev) =>
                        prev ? { ...prev, description: e.target.value } : null
                      );
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-white text-gray-900 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          <EventSlidingGallery
            images={showcaseSlides}
            title={showcaseEvent?.title || `BNHS ${showcaseCategory} Photo Highlights`}
            category={showcaseCategory}
            heightClass="h-64 sm:h-80 lg:h-96"
            autoPlayIntervalMs={3600}
            showCaptionOverlay={true}
            onManageSlides={startShowcaseTextEdit}
          />

          {/* Quick Local Upload / Google Link Slide Adder */}
          <div className="p-4 sm:p-5 bg-white text-gray-900 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold uppercase tracking-wider text-[#650019]">
                Add {showcaseCategory} Slide:
              </span>
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowcaseUploadMode('local')}
                  className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                    showcaseUploadMode === 'local'
                      ? 'bg-[#650019] text-white'
                      : 'text-gray-700'
                  }`}
                >
                  Local File
                </button>
                <button
                  type="button"
                  onClick={() => setShowcaseUploadMode('link')}
                  className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                    showcaseUploadMode === 'link'
                      ? 'bg-[#650019] text-white'
                      : 'text-gray-700'
                  }`}
                >
                  Google Link
                </button>
              </div>
            </div>

            {showcaseUploadMode === 'local' ? (
              <div
                key="showcase-upload-local"
                className="flex flex-wrap items-center gap-2.5 flex-1 md:justify-end"
              >
                <input
                  key="showcase-file-input"
                  ref={showcaseFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleShowcaseLocalUpload}
                  className="hidden"
                  id="showcase-slide-local-upload"
                />
                <label
                  htmlFor="showcase-slide-local-upload"
                  className="px-4 py-2 rounded-lg bg-[#650019] text-white text-xs font-bold hover:bg-[#450012] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-[#D4AF37]" />
                  {uploadingShowcasePhoto
                    ? 'Uploading & Auto-Syncing...'
                    : `Upload Local Photo(s) to ${showcaseCategory}`}
                </label>
              </div>
            ) : (
              <form
                key="showcase-upload-link"
                onSubmit={handleShowcaseLinkAdd}
                className="flex flex-1 gap-2 max-w-xl md:justify-end"
              >
                <input
                  key="showcase-link-input"
                  type="url"
                  required
                  value={showcaseLinkInput ?? ''}
                  onChange={(e) => setShowcaseLinkInput(e.target.value)}
                  placeholder={`Paste Google Drive or web photo link for ${showcaseCategory}...`}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-xs"
                />
                <button
                  type="submit"
                  disabled={uploadingShowcasePhoto}
                  className="px-4 py-2 rounded-lg bg-[#650019] text-white text-xs font-bold hover:bg-[#450012] inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Link2 className="w-3.5 h-3.5 text-[#D4AF37]" />
                  {uploadingShowcasePhoto ? 'Syncing...' : 'Add Slide Link'}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Event Cards Grid with Auto-Sliding Galleries */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredEvents.map((ev, index) => {
            const myRsvp = userRsvps[ev.id];
            const fallbackImg =
              index % 2 === 0 ? BNHS_ASSETS.homecomingEvent : BNHS_ASSETS.mentorshipEvent;
            const slideImages = [
              ...(ev.galleryUrls || []),
              ...(ev.imageUrl ? [ev.imageUrl] : []),
            ].filter(Boolean);

            const isEditingCard = inlineEditingEventId === ev.id && inlineEventDraft;
            const activeCardSlides = isEditingCard
              ? inlineEventDraft.galleryUrls || [fallbackImg]
              : slideImages.length > 0
              ? slideImages
              : [fallbackImg];

            return (
              <article
                key={ev.id}
                className="bg-white text-gray-900 rounded-xl overflow-hidden border border-gray-200 flex flex-col justify-between"
              >
                <div>
                  <EventSlidingGallery
                    images={activeCardSlides}
                    title={isEditingCard ? inlineEventDraft.title : ev.title}
                    category={isEditingCard ? inlineEventDraft.category : ev.category}
                    heightClass="h-56 sm:h-64"
                    autoPlayIntervalMs={3800}
                    onManageSlides={() => startInlineEventEdit(ev)}
                  />

                  <div className="p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#650019]">
                        <span>{isEditingCard ? inlineEventDraft.category : ev.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="uppercase">
                          {isEditingCard ? inlineEventDraft.status : ev.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {isEditingCard ? (
                          <button
                            type="button"
                            onClick={finishInlineEventEdit}
                            className="px-3 py-1 rounded-md bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Done Editing
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startInlineEventEdit(ev)}
                            className="px-2.5 py-1 rounded-md border border-[#650019]/30 text-xs font-bold text-[#650019] hover:bg-[#650019] hover:text-white transition-colors inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Edit Text & Photos
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onOpenDeleteMenu('events', ev.id)}
                          className="px-2.5 py-1 rounded-md border border-red-200 text-xs font-bold text-red-700 hover:bg-red-600 hover:text-white transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>

                    {isEditingCard ? (
                      <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-[#D4AF37]/50">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-gray-200">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[#650019]">
                            Direct Event Text Editor (Auto-Saves Live)
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                            {inlineEventSaving ? (
                              <>
                                <Cloud className="w-3.5 h-3.5 text-[#650019] animate-pulse" />
                                <span>Auto-Saving...</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Cloud Synced (Auto-Saved)</span>
                              </>
                            )}
                          </span>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold uppercase text-gray-700 mb-1">
                            Event Title *
                          </label>
                          <input
                            ref={inlineTitleInputRef}
                            type="text"
                            minLength={5}
                            maxLength={140}
                            value={inlineEventDraft.title ?? ''}
                            onChange={(e) => {
                              inlineEventDirtyRef.current = true;
                              setInlineEventDraft((prev) =>
                                prev ? { ...prev, title: e.target.value } : null
                              );
                            }}
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm font-bold bg-white"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold uppercase text-gray-700 mb-1">
                              Date & Time *
                            </label>
                            <input
                              type="text"
                              minLength={4}
                              maxLength={50}
                              value={inlineEventDraft.eventDate ?? ''}
                              onChange={(e) => {
                                inlineEventDirtyRef.current = true;
                                setInlineEventDraft((prev) =>
                                  prev ? { ...prev, eventDate: e.target.value } : null
                                );
                              }}
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold uppercase text-gray-700 mb-1">
                              Category *
                            </label>
                            <select
                              value={inlineEventDraft.category ?? 'Homecoming'}
                              onChange={(e) => {
                                inlineEventDirtyRef.current = true;
                                setInlineEventDraft((prev) =>
                                  prev
                                    ? { ...prev, category: e.target.value as EventCategory }
                                    : null
                                );
                              }}
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs bg-white"
                            >
                              {ALLOWED_EVENT_CATEGORIES.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-bold uppercase text-gray-700 mb-1">
                              Venue *
                            </label>
                            <input
                              type="text"
                              minLength={3}
                              maxLength={140}
                              value={inlineEventDraft.venue ?? ''}
                              onChange={(e) => {
                                inlineEventDirtyRef.current = true;
                                setInlineEventDraft((prev) =>
                                  prev ? { ...prev, venue: e.target.value } : null
                                );
                              }}
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold uppercase text-gray-700 mb-1">
                              Status
                            </label>
                            <select
                              value={inlineEventDraft.status ?? 'upcoming'}
                              onChange={(e) => {
                                inlineEventDirtyRef.current = true;
                                setInlineEventDraft((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        status: e.target.value as
                                          | 'upcoming'
                                          | 'ongoing'
                                          | 'completed'
                                          | 'archived',
                                      }
                                    : null
                                );
                              }}
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs bg-white"
                            >
                              <option value="upcoming">Upcoming</option>
                              <option value="ongoing">Ongoing</option>
                              <option value="completed">Completed</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold uppercase text-gray-700 mb-1">
                            Event Description *
                          </label>
                          <textarea
                            rows={3}
                            minLength={10}
                            maxLength={1000}
                            value={inlineEventDraft.description ?? ''}
                            onChange={(e) => {
                              inlineEventDirtyRef.current = true;
                              setInlineEventDraft((prev) =>
                                prev ? { ...prev, description: e.target.value } : null
                              );
                            }}
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs bg-white"
                          />
                        </div>

                        {/* Inline Sliding Photos Strip & Uploader */}
                        <div className="pt-2 border-t border-gray-200 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-[#650019]">
                              Sliding Photos ({activeCardSlides.length}/10)
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setInlineSlideMode('local')}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                                  inlineSlideMode === 'local'
                                    ? 'bg-[#650019] text-white'
                                    : 'bg-white border border-gray-300 text-gray-700'
                                }`}
                              >
                                Local
                              </button>
                              <button
                                type="button"
                                onClick={() => setInlineSlideMode('link')}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                                  inlineSlideMode === 'link'
                                    ? 'bg-[#650019] text-white'
                                    : 'bg-white border border-gray-300 text-gray-700'
                                }`}
                              >
                                Google Link
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {activeCardSlides.map((src, sIdx) => (
                              <div
                                key={`${ev.id}_inline_${sIdx}`}
                                className="relative w-14 h-10 rounded overflow-hidden border border-gray-300"
                              >
                                <img src={src} alt="" className="w-full h-full object-cover" />
                                {activeCardSlides.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextSlides = activeCardSlides.filter(
                                        (_, i) => i !== sIdx
                                      );
                                      inlineEventDirtyRef.current = true;
                                      setInlineEventDraft((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              imageUrl: nextSlides[0],
                                              galleryUrls: nextSlides,
                                            }
                                          : null
                                      );
                                    }}
                                    title="Remove slide"
                                    className="absolute top-0 right-0 bg-red-600 text-white p-0.5 rounded-bl cursor-pointer"
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>

                          {inlineSlideMode === 'local' ? (
                            <div
                              key={`inline-slide-local-${ev.id}`}
                              className="flex flex-wrap items-center justify-between gap-2"
                            >
                              <input
                                key={`inline-slide-file-${ev.id}`}
                                ref={inlineSlideFileRef}
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleInlineEventSlideUpload}
                                className="hidden"
                                id={`inline-slide-upload-${ev.id}`}
                              />
                              <label
                                htmlFor={`inline-slide-upload-${ev.id}`}
                                className="px-3 py-1.5 rounded-lg bg-[#650019] text-white text-[11px] font-bold hover:bg-[#450012] inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <Upload className="w-3 h-3 text-[#D4AF37]" />
                                {inlineUploadingSlide ? 'Adding...' : 'Upload Local Slide(s)'}
                              </label>
                              <button
                                type="button"
                                onClick={() => onOpenEditMenu('events', ev.id)}
                                className="text-[11px] font-semibold text-[#650019] hover:underline cursor-pointer"
                              >
                                Open Full Edit Menu →
                              </button>
                            </div>
                          ) : (
                            <div
                              key={`inline-slide-link-${ev.id}`}
                              className="flex gap-1.5"
                            >
                              <input
                                key={`inline-slide-url-${ev.id}`}
                                type="url"
                                value={inlineSlideLink ?? ''}
                                onChange={(e) => setInlineSlideLink(e.target.value)}
                                placeholder="Paste Google Drive or image link..."
                                className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-300 text-xs bg-white"
                              />
                              <button
                                type="button"
                                onClick={handleInlineEventSlideLinkAdd}
                                className="px-3 py-1.5 rounded-lg bg-[#650019] text-white text-[11px] font-bold hover:bg-[#450012] cursor-pointer"
                              >
                                Add
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        <h2 className="font-display text-xl font-bold text-gray-900 leading-snug">
                          {ev.title}
                        </h2>

                        <div className="mt-3 space-y-1.5 text-xs text-gray-600">
                          <p className="flex items-center gap-2 font-medium text-gray-800">
                            <Calendar className="w-3.5 h-3.5 text-[#650019] shrink-0" />
                            <span>{ev.eventDate}</span>
                          </p>
                          <p className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-[#650019] shrink-0" />
                            <span>{ev.venue}</span>
                          </p>
                        </div>

                        <p className="mt-4 text-sm text-gray-700 leading-relaxed">
                          {ev.description}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-gray-600">
                    {myRsvp && myRsvp.status !== 'cancelled' ? (
                      <span className="font-bold text-[#650019] flex items-center gap-1.5">
                        <Check className="w-4 h-4" />
                        RSVP Registered: {myRsvp.status.toUpperCase()}
                      </span>
                    ) : (
                      <span>Confirm your attendance with the Alumni Secretariat</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={rsvpBusyId === ev.id || myRsvp?.status === 'cancelled'}
                      onClick={() => handleRsvp(ev, 'attending')}
                      className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        myRsvp?.status === 'attending'
                          ? 'bg-[#D4AF37] text-[#450012]'
                          : 'bg-[#650019] text-white hover:bg-[#450012]'
                      }`}
                    >
                      {rsvpBusyId === ev.id
                        ? 'Saving...'
                        : myRsvp?.status === 'attending'
                        ? 'Attending ✓'
                        : 'RSVP Attending'}
                    </button>

                    <button
                      type="button"
                      disabled={rsvpBusyId === ev.id || myRsvp?.status === 'cancelled'}
                      onClick={() => handleRsvp(ev, 'interested')}
                      className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        myRsvp?.status === 'interested'
                          ? 'border-[#650019] bg-[#650019]/10 text-[#650019]'
                          : 'border-gray-300 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      Interested
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  // Announcements View
  const filteredAnnouncements = announcements.filter(
    (ann) => selectedAnnCategory === 'ALL' || ann.category === selectedAnnCategory
  );

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="bg-[#450012] border border-[#D4AF37]/30 rounded-xl p-6 sm:p-8 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold mb-2">
              Barobo National High School · Official Bulletins
            </p>
            <h1 className="font-display text-2xl sm:text-4xl font-bold text-white">
              Alumni Announcements & News
            </h1>
            <p className="text-white/80 text-sm sm:text-base mt-2 max-w-2xl leading-relaxed">
              Official communications from the BNHS Office of the Principal, Alumni Federation Board, Scholarship Committee, and Batch Chapters.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onOpenEditMenu('announcements', 'NEW')}
              className="px-4 py-2.5 rounded-lg bg-[#D4AF37] text-[#450012] font-bold text-xs sm:text-sm hover:bg-[#e3c14d] transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <Megaphone className="w-4 h-4" />
              Publish / Edit Bulletin
            </button>
            <button
              type="button"
              onClick={() => onOpenDeleteMenu('announcements', null)}
              className="px-4 py-2.5 rounded-lg bg-[#650019] border border-red-400/50 text-white font-bold text-xs sm:text-sm hover:bg-red-700 transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              Delete Bulletins
            </button>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-white/15 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedAnnCategory('ALL')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              selectedAnnCategory === 'ALL'
                ? 'bg-[#D4AF37] text-[#450012]'
                : 'bg-[#650019] text-white/80 hover:text-white'
            }`}
          >
            All Bulletins ({announcements.length})
          </button>
          {ALLOWED_ANNOUNCEMENT_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedAnnCategory(cat)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedAnnCategory === cat
                  ? 'bg-[#D4AF37] text-[#450012]'
                  : 'bg-[#650019] text-white/80 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {feedbackBanner && (
        <div className="mb-6 p-4 rounded-xl bg-[#450012] border border-[#D4AF37] text-white text-sm flex items-center justify-between">
          <span>{feedbackBanner}</span>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-[#D4AF37] hover:underline text-xs ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="space-y-5">
        {filteredAnnouncements.map((ann) => {
          const isEditingAnn = inlineEditingAnnId === ann.id && inlineAnnDraft && onSaveAnnouncement;
          return (
            <article
              key={ann.id}
              className="bg-white text-gray-900 rounded-xl p-6 sm:p-8 border border-gray-200 hover:border-[#D4AF37] transition-colors"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 mb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-[#650019]">{ann.category}</span>
                  <span aria-hidden="true">·</span>
                  <span>{ann.authorName}</span>
                  {ann.publishedLabel && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{ann.publishedLabel}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isEditingAnn ? (
                    <button
                      type="button"
                      onClick={() => {
                        setInlineEditingAnnId(null);
                        setInlineAnnDraft(null);
                      }}
                      className="px-3 py-1 rounded-md bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3 h-3" />
                      Done Editing
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (onSaveAnnouncement) {
                          inlineAnnDirtyRef.current = false;
                          setInlineEditingAnnId(ann.id);
                          setInlineAnnDraft({ ...ann });
                          window.setTimeout(() => inlineAnnTitleRef.current?.focus(), 60);
                        } else {
                          onOpenEditMenu('announcements', ann.id);
                        }
                      }}
                      className="px-2.5 py-1 rounded-md border border-[#650019]/30 text-xs font-bold text-[#650019] hover:bg-[#650019] hover:text-white transition-colors inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      Edit
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenDeleteMenu('announcements', ann.id)}
                    className="px-2.5 py-1 rounded-md border border-red-200 text-xs font-bold text-red-700 hover:bg-red-600 hover:text-white transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </div>
              </div>

              {isEditingAnn ? (
                <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-[#D4AF37]/50 mt-3">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="uppercase tracking-wider text-[#650019]">
                      Direct Bulletin Text Editor (Auto-Saves Live)
                    </span>
                    <span className="text-emerald-700 flex items-center gap-1">
                      {inlineAnnSaving ? 'Auto-Saving...' : 'Cloud Synced (Auto-Saved)'}
                    </span>
                  </div>
                  <input
                    ref={inlineAnnTitleRef}
                    type="text"
                    value={inlineAnnDraft.title ?? ''}
                    onChange={(e) => {
                      inlineAnnDirtyRef.current = true;
                      setInlineAnnDraft((prev) =>
                        prev ? { ...prev, title: e.target.value } : null
                      );
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm font-bold bg-white"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <select
                      value={inlineAnnDraft.category ?? 'Official Bulletin'}
                      onChange={(e) => {
                        inlineAnnDirtyRef.current = true;
                        setInlineAnnDraft((prev) =>
                          prev
                            ? { ...prev, category: e.target.value as AnnouncementCategory }
                            : null
                        );
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs bg-white"
                    >
                      {ALLOWED_ANNOUNCEMENT_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={inlineAnnDraft.authorName ?? ''}
                      onChange={(e) => {
                        inlineAnnDirtyRef.current = true;
                        setInlineAnnDraft((prev) =>
                          prev ? { ...prev, authorName: e.target.value } : null
                        );
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs bg-white"
                    />
                  </div>
                  <input
                    type="text"
                    value={inlineAnnDraft.summary ?? ''}
                    onChange={(e) => {
                      inlineAnnDirtyRef.current = true;
                      setInlineAnnDraft((prev) =>
                        prev ? { ...prev, summary: e.target.value } : null
                      );
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs bg-white"
                  />
                  <textarea
                    rows={4}
                    value={inlineAnnDraft.content ?? ''}
                    onChange={(e) => {
                      inlineAnnDirtyRef.current = true;
                      setInlineAnnDraft((prev) =>
                        prev ? { ...prev, content: e.target.value } : null
                      );
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs bg-white"
                  />
                </div>
              ) : (
                <>
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-gray-900">
                    {ann.title}
                  </h2>

                  <p className="mt-2 text-sm font-medium text-gray-700 leading-relaxed">
                    {ann.summary}
                  </p>

                  <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-gray-500">
                      Barobo National High School Official Memorandum
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveAnnouncement(ann)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#650019] hover:underline cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      Read Complete Bulletin
                    </button>
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>

      {/* Announcement Reader Modal */}
      {activeAnnouncement && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setActiveAnnouncement(null)}
        >
          <div
            className="bg-white text-gray-900 rounded-xl max-w-2xl w-full overflow-hidden border border-[#D4AF37]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#450012] text-white p-6 sm:p-8 border-b border-[#D4AF37]/30 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-[#D4AF37] font-semibold">
                  <span>{activeAnnouncement.category}</span>
                  <span aria-hidden="true">·</span>
                  <span>{activeAnnouncement.publishedLabel || 'Official Release'}</span>
                </div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-white mt-1.5">
                  {activeAnnouncement.title}
                </h2>
                <p className="text-xs text-white/80 mt-1">
                  Issued by: {activeAnnouncement.authorName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveAnnouncement(null)}
                className="text-white/70 hover:text-white p-1.5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 sm:p-8 space-y-4">
              <p className="text-sm font-semibold text-[#650019] leading-relaxed">
                {activeAnnouncement.summary}
              </p>
              <div className="border-t border-gray-200 pt-4 text-sm text-gray-800 leading-relaxed whitespace-pre-line">
                {activeAnnouncement.content}
              </div>
              <div className="pt-6 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const targetId = activeAnnouncement.id;
                      setActiveAnnouncement(null);
                      onOpenEditMenu('announcements', targetId);
                    }}
                    className="px-4 py-2 rounded-lg bg-[#D4AF37] text-[#450012] text-xs font-bold hover:bg-[#e3c14d] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit in Edit Menu
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const targetId = activeAnnouncement.id;
                      setActiveAnnouncement(null);
                      onOpenDeleteMenu('announcements', targetId);
                    }}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete in Delete Menu
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveAnnouncement(null)}
                  className="px-5 py-2.5 bg-[#650019] text-white text-xs font-semibold rounded-lg hover:bg-[#450012] cursor-pointer"
                >
                  Close Bulletin
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
