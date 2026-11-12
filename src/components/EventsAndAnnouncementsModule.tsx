import React, { useRef, useState } from 'react';
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
  Save,
  Camera,
  Trash2,
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
import { ResilientImage } from './ResilientImage';

interface EventsAndAnnouncementsProps {
  mode: 'events' | 'announcements';
  currentUser: User | null;
  userProfile: AlumniProfileRecord | null;
  events: AlumniEventRecord[];
  announcements: AnnouncementRecord[];
  userRsvps: Record<string, EventRsvpRecord>;
  onSignIn: () => Promise<void>;
  onSaveEvent: (eventData: AlumniEventRecord, isNew: boolean) => Promise<void>;
  onDeleteEvent: (eventId: string, title: string) => Promise<void>;
  onSaveAnnouncement: (annData: AnnouncementRecord, isNew: boolean) => Promise<void>;
  onDeleteAnnouncement: (annId: string, title: string) => Promise<void>;
  onSaveLocalRsvp?: (eventId: string, rsvp: EventRsvpRecord) => void;
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
  onDeleteEvent,
  onSaveAnnouncement,
  onDeleteAnnouncement,
  onSaveLocalRsvp,
}) => {
  const [selectedEventCategory, setSelectedEventCategory] = useState<string>('ALL');
  const [selectedAnnCategory, setSelectedAnnCategory] = useState<string>('ALL');
  const [rsvpBusyId, setRsvpBusyId] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  // Modals for reading full announcement or creating/editing an event / announcement
  const [activeAnnouncement, setActiveAnnouncement] = useState<AnnouncementRecord | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [showCreateAnnModal, setShowCreateAnnModal] = useState(false);
  const [editingAnnId, setEditingAnnId] = useState<string | null>(null);

  // Create / Edit Event State
  const [eventTitle, setEventTitle] = useState('');
  const [eventCategory, setEventCategory] = useState<EventCategory>('Homecoming');
  const [eventDate, setEventDate] = useState('');
  const [eventVenue, setEventVenue] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventStatus, setEventStatus] = useState<
    'upcoming' | 'ongoing' | 'completed' | 'archived'
  >('upcoming');
  const [eventImageUrl, setEventImageUrl] = useState('');
  const [eventPhotoMode, setEventPhotoMode] = useState<'local' | 'link'>('local');
  const [eventPhotoLink, setEventPhotoLink] = useState('');
  const [uploadingEventPhoto, setUploadingEventPhoto] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);

  const eventFileInputRef = useRef<HTMLInputElement | null>(null);

  // Create / Edit Announcement State
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnCategory, setNewAnnCategory] = useState<AnnouncementCategory>('Official Bulletin');
  const [newAnnAuthor, setNewAnnAuthor] = useState('');
  const [newAnnSummary, setNewAnnSummary] = useState('');
  const [newAnnContent, setNewAnnContent] = useState('');
  const [creatingAnn, setCreatingAnn] = useState(false);

  const openCreateEventModal = () => {
    setEditingEventId(null);
    setEventTitle('');
    setEventCategory(
      selectedEventCategory !== 'ALL'
        ? (selectedEventCategory as EventCategory)
        : 'Homecoming'
    );
    setEventDate('');
    setEventVenue('Barobo National High School Grand Gymnasium, Poblacion, Barobo');
    setEventDesc('');
    setEventStatus('upcoming');
    setEventImageUrl(BNHS_ASSETS.homecomingEvent);
    setEventPhotoLink('');
    setShowEventModal(true);
  };

  const openEditEventModal = (ev: AlumniEventRecord) => {
    setEditingEventId(ev.id);
    setEventTitle(ev.title || '');
    setEventCategory(ev.category || 'Homecoming');
    setEventDate(ev.eventDate || '');
    setEventVenue(ev.venue || '');
    setEventDesc(ev.description || '');
    setEventStatus(ev.status || 'upcoming');
    const currentImg = ev.imageUrl || BNHS_ASSETS.homecomingEvent;
    setEventImageUrl(currentImg);
    setEventPhotoLink(currentImg.startsWith('http') ? currentImg : '');
    setShowEventModal(true);
  };

  const handleDeleteEventClick = async (ev: AlumniEventRecord) => {
    await onDeleteEvent(ev.id, ev.title);
    if (editingEventId === ev.id) {
      setShowEventModal(false);
      setEditingEventId(null);
    }
    setFeedbackBanner(`Removed event "${ev.title}" from Alumni Events.`);
  };

  const openCreateAnnModal = () => {
    setEditingAnnId(null);
    setNewAnnTitle('');
    setNewAnnCategory(
      selectedAnnCategory !== 'ALL'
        ? (selectedAnnCategory as AnnouncementCategory)
        : 'Official Bulletin'
    );
    setNewAnnAuthor(userProfile?.fullName || currentUser?.displayName || 'BNHS Alumni Federation');
    setNewAnnSummary('');
    setNewAnnContent('');
    setShowCreateAnnModal(true);
  };

  const openEditAnnModal = (ann: AnnouncementRecord) => {
    setEditingAnnId(ann.id);
    setNewAnnTitle(ann.title || '');
    setNewAnnCategory(ann.category || 'Official Bulletin');
    setNewAnnAuthor(ann.authorName || 'BNHS Alumni Federation');
    setNewAnnSummary(ann.summary || '');
    setNewAnnContent(ann.content || '');
    setShowCreateAnnModal(true);
  };

  const handleDeleteAnnouncementClick = async (ann: AnnouncementRecord) => {
    await onDeleteAnnouncement(ann.id, ann.title);
    if (activeAnnouncement?.id === ann.id) {
      setActiveAnnouncement(null);
    }
    if (editingAnnId === ann.id) {
      setShowCreateAnnModal(false);
      setEditingAnnId(null);
    }
    setFeedbackBanner(`Deleted announcement "${ann.title}".`);
  };

  const handleEventPhotoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingEventPhoto(true);
    try {
      const compressedDataUrl = await fileToCompressedDataUrl(file, 720, 0.8);
      setEventImageUrl(compressedDataUrl);
    } catch (err) {
      console.error('Error processing event image:', err);
    } finally {
      setUploadingEventPhoto(false);
      if (eventFileInputRef.current) {
        eventFileInputRef.current.value = '';
      }
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
          : `Confirmed! You are marked as "${desiredStatus}" for ${eventItem.title}.`
      );
      return;
    }

    setRsvpBusyId(eventItem.id);

    try {
      // Ensure parent event exists in Firestore to satisfy Global Consistency Invariant exists(/events/$(eventId))
      const eventRef = doc(db, 'events', eventItem.id);
      const eventSnap = await getDoc(eventRef);
      if (!eventSnap.exists()) {
        await setDoc(eventRef, {
          authorId: currentUser.uid,
          title: sanitizeString(eventItem.title, 140),
          category: eventItem.category,
          eventDate: sanitizeString(eventItem.eventDate, 50),
          venue: sanitizeString(eventItem.venue, 140),
          description: sanitizeString(eventItem.description, 1000),
          imageUrl: sanitizeString(
            eventItem.imageUrl || BNHS_ASSETS.homecomingEvent,
            150000
          ),
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
          : `Confirmed! You are marked as "${desiredStatus}" for ${eventItem.title}.`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `event_rsvps/${rsvpDocId}`);
    } finally {
      setRsvpBusyId(null);
    }
  };

  const handleSaveEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanTitle = sanitizeString(eventTitle, 140);
    const cleanDate = sanitizeString(eventDate, 50);
    const cleanVenue = sanitizeString(eventVenue, 140);
    const cleanDesc = sanitizeString(eventDesc, 1000);
    const rawPhoto =
      eventPhotoMode === 'link' && eventPhotoLink.trim()
        ? normalizeImageUrl(eventPhotoLink)
        : eventImageUrl || BNHS_ASSETS.homecomingEvent;
    const cleanImageUrl = sanitizeString(rawPhoto, 150000);

    if (
      cleanTitle.length < 5 ||
      cleanDate.length < 4 ||
      cleanVenue.length < 3 ||
      cleanDesc.length < 10
    ) {
      return;
    }

    setSavingEvent(true);
    const isNew = !editingEventId;
    const targetId = editingEventId || sanitizeId(`evt_${Date.now()}`);

    const eventRecord: AlumniEventRecord = {
      id: targetId,
      authorId: currentUser?.uid || 'system_bnhs_admin',
      title: cleanTitle,
      category: eventCategory,
      eventDate: cleanDate,
      venue: cleanVenue,
      description: cleanDesc,
      status: eventStatus,
      visibility: 'public',
      imageUrl: cleanImageUrl,
    };

    try {
      await onSaveEvent(eventRecord, isNew);
      setShowEventModal(false);
      setFeedbackBanner(
        isNew
          ? `New ${eventCategory} event "${cleanTitle}" has been published with its photo banner.`
          : `Updated "${cleanTitle}" (${eventCategory}) and its event photo banner.`
      );
    } finally {
      setSavingEvent(false);
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanTitle = sanitizeString(newAnnTitle, 150);
    const cleanAuthor = sanitizeString(
      newAnnAuthor || userProfile?.fullName || currentUser?.displayName || 'BNHS Alumni Officer',
      100
    );
    const cleanSummary = sanitizeString(newAnnSummary, 300);
    const cleanContent = sanitizeString(newAnnContent, 2000);

    if (cleanTitle.length < 5 || cleanSummary.length < 10 || cleanContent.length < 20) {
      return;
    }

    setCreatingAnn(true);
    const isNew = !editingAnnId;
    const annId = editingAnnId || sanitizeId(`ann_${Date.now()}`);
    const annRecord: AnnouncementRecord = {
      id: annId,
      authorId: currentUser?.uid || 'system_bnhs_admin',
      authorName: cleanAuthor,
      title: cleanTitle,
      category: newAnnCategory,
      summary: cleanSummary,
      content: cleanContent,
      status: 'published',
      visibility: 'public',
      publishedLabel: 'Verified Portal Release',
    };

    try {
      await onSaveAnnouncement(annRecord, isNew);
      if (activeAnnouncement?.id === annId) {
        setActiveAnnouncement(annRecord);
      }
      setShowCreateAnnModal(false);
      setEditingAnnId(null);
      setNewAnnTitle('');
      setNewAnnSummary('');
      setNewAnnContent('');
      setFeedbackBanner(
        isNew
          ? 'Official announcement published to the BNHS Alumni Portal.'
          : `Updated official announcement "${cleanTitle}".`
      );
    } finally {
      setCreatingAnn(false);
    }
  };

  if (mode === 'events') {
    const filteredEvents = events.filter(
      (ev) => selectedEventCategory === 'ALL' || ev.category === selectedEventCategory
    );

    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-[#450012] border border-[#D4AF37]/30 rounded-xl p-6 sm:p-8 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold mb-2">
                Barobo National High School · Campus & Chapter Activities
              </p>
              <h1 className="font-display text-2xl sm:text-4xl font-bold text-white">
                Alumni Events & Homecomings
              </h1>
              <p className="text-white/80 text-sm sm:text-base mt-2 max-w-2xl leading-relaxed">
                Participate in or edit events and upload custom photos for Homecoming, Batch Reunion, Career Mentorship, Scholarship Drive, and Community Outreach activities.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateEventModal}
              className="px-5 py-3 rounded-lg bg-[#D4AF37] text-[#450012] font-semibold text-sm hover:bg-[#e3c14d] transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Post Event & Upload Photo
            </button>
          </div>

          {/* Interactive Category Filter Bar (Homecoming, Batch Reunion, Career Mentorship, Scholarship Drive, Community Outreach) */}
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredEvents.map((ev, index) => {
            const myRsvp = userRsvps[ev.id];
            const imgSource =
              ev.imageUrl ||
              (index % 2 === 0 ? BNHS_ASSETS.homecomingEvent : BNHS_ASSETS.mentorshipEvent);

            return (
              <article
                key={ev.id}
                className="bg-white text-gray-900 rounded-xl overflow-hidden border border-gray-200 flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-56 w-full overflow-hidden bg-[#450012] group">
                    <ResilientImage
                      src={imgSource}
                      alt={ev.title}
                      fallbackTitle={ev.category}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => openEditEventModal(ev)}
                      className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-[#450012]/90 border border-[#D4AF37] text-[#D4AF37] text-xs font-bold hover:bg-[#650019] transition-colors flex items-center gap-1.5 shadow-md cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Edit Event & Upload Photo
                    </button>
                  </div>
                  <div className="p-6">
                    {/* Unboxed metadata line per Zero-Pill Discipline */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#650019]">
                        <span>{ev.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="uppercase">{ev.status}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditEventModal(ev)}
                          className="px-2.5 py-1 rounded-md border border-[#650019]/30 text-xs font-bold text-[#650019] hover:bg-[#650019] hover:text-white transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteEventClick(ev)}
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

        {/* Create / Edit Event & Photo Upload Modal */}
        {showEventModal && (
          <div
            className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setShowEventModal(false)}
          >
            <div
              className="bg-white text-gray-900 rounded-xl max-w-xl w-full overflow-hidden border border-[#D4AF37] my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-[#450012] text-white p-6 flex items-center justify-between border-b border-[#D4AF37]/30">
                <div>
                  <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold">
                    BNHS Alumni Activities & Photo Manager
                  </p>
                  <h2 className="font-display text-xl font-bold mt-0.5">
                    {editingEventId ? 'Edit Event & Upload Event Photo' : 'Post Batch or Alumni Event'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  className="text-white/70 hover:text-white p-1 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={handleSaveEventSubmit}
                className="p-6 space-y-4 max-h-[80vh] overflow-y-auto"
              >
                {/* Event Banner Photo Upload (Local File or Google Link) */}
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#650019] flex items-center gap-1.5">
                      <Camera className="w-4 h-4" />
                      Event Banner Photo ({eventCategory})
                    </span>
                    <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-300">
                      <button
                        type="button"
                        onClick={() => setEventPhotoMode('local')}
                        className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                          eventPhotoMode === 'local'
                            ? 'bg-[#650019] text-white'
                            : 'text-gray-700'
                        }`}
                      >
                        Upload Local File
                      </button>
                      <button
                        type="button"
                        onClick={() => setEventPhotoMode('link')}
                        className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                          eventPhotoMode === 'link'
                            ? 'bg-[#650019] text-white'
                            : 'text-gray-700'
                        }`}
                      >
                        Google / Web Link
                      </button>
                    </div>
                  </div>

                  {/* Live Banner Preview */}
                  <div className="h-40 w-full rounded-lg overflow-hidden bg-[#450012] border border-[#D4AF37]/50">
                    <ResilientImage
                      src={eventImageUrl || BNHS_ASSETS.homecomingEvent}
                      alt="Event Banner Preview"
                      fallbackTitle={eventCategory}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {eventPhotoMode === 'local' ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        ref={eventFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleEventPhotoFileSelect}
                        className="hidden"
                        id="event-photo-file-input"
                      />
                      <label
                        htmlFor="event-photo-file-input"
                        className="px-4 py-2 rounded-lg bg-[#650019] text-white text-xs font-bold hover:bg-[#450012] inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5 text-[#D4AF37]" />
                        {uploadingEventPhoto ? 'Processing Image...' : 'Choose Local Event Photo'}
                      </label>
                      <button
                        type="button"
                        onClick={() => setEventImageUrl(BNHS_ASSETS.homecomingEvent)}
                        className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-100 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Reset Default Banner
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={eventPhotoLink ?? ''}
                        onChange={(e) => {
                          setEventPhotoLink(e.target.value);
                          setEventImageUrl(normalizeImageUrl(e.target.value));
                        }}
                        placeholder="Paste Google Drive link or image URL for this event..."
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setEventImageUrl(normalizeImageUrl(eventPhotoLink))}
                        className="px-3.5 py-2 rounded-lg bg-[#650019] text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        Apply
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Event Title (5–140 chars) *
                  </label>
                  <input
                    type="text"
                    required
                    minLength={5}
                    maxLength={140}
                    value={eventTitle ?? ''}
                    onChange={(e) => setEventTitle(e.target.value)}
                    placeholder="e.g., 56th Grand Alumni Homecoming Gala: Eagles Soar Home"
                    className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                      Event Category *
                    </label>
                    <select
                      value={eventCategory ?? 'Homecoming'}
                      onChange={(e) => setEventCategory(e.target.value as EventCategory)}
                      className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                    >
                      {ALLOWED_EVENT_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                      Date & Time *
                    </label>
                    <input
                      type="text"
                      required
                      minLength={4}
                      maxLength={50}
                      value={eventDate ?? ''}
                      onChange={(e) => setEventDate(e.target.value)}
                      placeholder="e.g., April 10, 2027 · 2:00 PM"
                      className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                      Status *
                    </label>
                    <select
                      value={eventStatus ?? 'upcoming'}
                      onChange={(e) =>
                        setEventStatus(
                          e.target.value as 'upcoming' | 'ongoing' | 'completed'
                        )
                      }
                      className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                    >
                      <option value="upcoming">Upcoming</option>
                      <option value="ongoing">Ongoing</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Venue / Location *
                  </label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    maxLength={140}
                    value={eventVenue ?? ''}
                    onChange={(e) => setEventVenue(e.target.value)}
                    placeholder="e.g., BNHS Covered Court, Poblacion, Barobo"
                    className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Event Description & Agenda (10–1000 chars) *
                  </label>
                  <textarea
                    rows={4}
                    required
                    minLength={10}
                    maxLength={1000}
                    value={eventDesc ?? ''}
                    onChange={(e) => setEventDesc(e.target.value)}
                    placeholder="Describe the program schedule, batch coordinator details, and registration instructions..."
                    className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                  />
                </div>

                <div className="pt-3 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
                  {editingEventId ? (
                    <button
                      type="button"
                      onClick={() => {
                        const targetEv = events.find((e) => e.id === editingEventId);
                        if (targetEv) handleDeleteEventClick(targetEv);
                      }}
                      className="px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-bold hover:bg-red-600 hover:text-white transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Event
                    </button>
                  ) : (
                    <div />
                  )}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowEventModal(false)}
                      className="px-4 py-2 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingEvent}
                      className="px-5 py-2 rounded-lg bg-[#650019] text-white text-xs font-semibold hover:bg-[#450012] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5 text-[#D4AF37]" />
                      {savingEvent
                        ? 'Saving Event...'
                        : editingEventId
                        ? 'Save Event & Photo Changes'
                        : 'Publish Event'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
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
          <button
            type="button"
            onClick={openCreateAnnModal}
            className="px-5 py-3 rounded-lg bg-[#D4AF37] text-[#450012] font-semibold text-sm hover:bg-[#e3c14d] transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Megaphone className="w-4 h-4" />
            Publish Bulletin
          </button>
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
                  onClick={() => openEditAnnModal(ann)}
                  className="px-2.5 py-1 rounded-md border border-[#650019]/30 text-xs font-bold text-[#650019] hover:bg-[#650019] hover:text-white transition-colors inline-flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteAnnouncementClick(ann)}
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
                      const target = activeAnnouncement;
                      setActiveAnnouncement(null);
                      openEditAnnModal(target);
                    }}
                    className="px-4 py-2 rounded-lg bg-[#D4AF37] text-[#450012] text-xs font-bold hover:bg-[#e3c14d] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit Bulletin
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteAnnouncementClick(activeAnnouncement)}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Bulletin
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

      {/* Create / Edit Announcement Modal */}
      {showCreateAnnModal && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowCreateAnnModal(false)}
        >
          <div
            className="bg-white text-gray-900 rounded-xl max-w-lg w-full overflow-hidden border border-[#D4AF37]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#450012] text-white p-6 flex items-center justify-between border-b border-[#D4AF37]/30">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold">
                  BNHS Alumni Communications
                </p>
                <h2 className="font-display text-xl font-bold mt-0.5">
                  {editingAnnId ? 'Edit Official Announcement' : 'Publish Official Announcement'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateAnnModal(false)}
                className="text-white/70 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAnnouncement} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Headline Title (5–150 chars) *
                </label>
                <input
                  type="text"
                  required
                  minLength={5}
                  maxLength={150}
                  value={newAnnTitle ?? ''}
                  onChange={(e) => setNewAnnTitle(e.target.value)}
                  placeholder="e.g., Batch 2010 Medical Mission Volunteer Call"
                  className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={newAnnCategory ?? 'Official Bulletin'}
                    onChange={(e) => setNewAnnCategory(e.target.value as AnnouncementCategory)}
                    className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
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
                    value={newAnnAuthor ?? ''}
                    onChange={(e) => setNewAnnAuthor(e.target.value)}
                    placeholder={userProfile?.fullName || 'BNHS Alumni Chapter'}
                    className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
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
                  value={newAnnSummary ?? ''}
                  onChange={(e) => setNewAnnSummary(e.target.value)}
                  placeholder="Brief 1-sentence overview of the announcement..."
                  className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Full Bulletin Content (20–2000 chars) *
                </label>
                <textarea
                  rows={4}
                  required
                  minLength={20}
                  maxLength={2000}
                  value={newAnnContent ?? ''}
                  onChange={(e) => setNewAnnContent(e.target.value)}
                  placeholder="Write the complete memorandum or announcement details..."
                  className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
                />
              </div>

              <div className="pt-3 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
                {editingAnnId ? (
                  <button
                    type="button"
                    onClick={() => {
                      const targetAnn = announcements.find((a) => a.id === editingAnnId);
                      if (targetAnn) handleDeleteAnnouncementClick(targetAnn);
                    }}
                    className="px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-bold hover:bg-red-600 hover:text-white transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Bulletin
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateAnnModal(false)}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingAnn}
                    className="px-5 py-2 rounded-lg bg-[#650019] text-white text-xs font-semibold hover:bg-[#450012] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5 text-[#D4AF37]" />
                    {creatingAnn
                      ? 'Saving...'
                      : editingAnnId
                      ? 'Save Bulletin Changes'
                      : 'Publish Bulletin'}
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
