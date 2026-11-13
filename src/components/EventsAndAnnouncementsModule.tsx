import React, { useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import {
  Calendar,
  MapPin,
  Check,
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

  const handleShowcaseLocalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingShowcasePhoto(true);
    try {
      const uploaded: string[] = [];
      for (let i = 0; i < files.length && uploaded.length < 5; i++) {
        const dataUrl = await fileToCompressedDataUrl(files[i], 560, 0.72);
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
                <span>Featured Event Category Sliding Showcase · Auto-Sync Enabled</span>
              </p>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-white mt-1">
                {showcaseCategory} Highlight Slides ({showcaseSlides.length} Photos)
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {ALLOWED_EVENT_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setShowcaseCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    showcaseCategory === cat
                      ? 'bg-[#D4AF37] text-[#450012]'
                      : 'bg-[#650019] text-white/85 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <EventSlidingGallery
            images={showcaseSlides}
            title={showcaseEvent?.title || `BNHS ${showcaseCategory} Photo Highlights`}
            category={showcaseCategory}
            heightClass="h-64 sm:h-80 lg:h-96"
            autoPlayIntervalMs={3600}
            showCaptionOverlay={true}
            onManageSlides={
              showcaseEvent
                ? () => onOpenEditMenu('events', showcaseEvent.id)
                : () => onOpenEditMenu('events', 'NEW')
            }
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
              <div className="flex flex-wrap items-center gap-2.5 flex-1 md:justify-end">
                <input
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
                onSubmit={handleShowcaseLinkAdd}
                className="flex flex-1 gap-2 max-w-xl md:justify-end"
              >
                <input
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

            return (
              <article
                key={ev.id}
                className="bg-white text-gray-900 rounded-xl overflow-hidden border border-gray-200 flex flex-col justify-between"
              >
                <div>
                  <EventSlidingGallery
                    images={slideImages.length > 0 ? slideImages : [fallbackImg]}
                    title={ev.title}
                    category={ev.category}
                    heightClass="h-56 sm:h-64"
                    autoPlayIntervalMs={3800}
                    onManageSlides={() => onOpenEditMenu('events', ev.id)}
                  />

                  <div className="p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#650019]">
                        <span>{ev.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="uppercase">{ev.status}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenEditMenu('events', ev.id)}
                          className="px-2.5 py-1 rounded-md border border-[#650019]/30 text-xs font-bold text-[#650019] hover:bg-[#650019] hover:text-white transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Edit
                        </button>
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
        {filteredAnnouncements.map((ann) => (
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
                <button
                  type="button"
                  onClick={() => onOpenEditMenu('announcements', ann.id)}
                  className="px-2.5 py-1 rounded-md border border-[#650019]/30 text-xs font-bold text-[#650019] hover:bg-[#650019] hover:text-white transition-colors inline-flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" />
                  Edit
                </button>
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
          </article>
        ))}
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
