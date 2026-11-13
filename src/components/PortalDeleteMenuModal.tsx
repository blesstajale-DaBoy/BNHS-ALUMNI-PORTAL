import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Calendar,
  CheckCircle2,
  Cloud,
  Megaphone,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  AlumniEventRecord,
  AlumniProfileRecord,
  AnnouncementRecord,
  SpotlightStoryRecord,
} from '../data/bnhsData';

export type DeleteMenuTab = 'directory' | 'events' | 'announcements' | 'spotlights';

interface PortalDeleteMenuModalProps {
  isOpen: boolean;
  initialTab?: DeleteMenuTab;
  initialFocusId?: string | null;
  onClose: () => void;
  alumniList: AlumniProfileRecord[];
  events: AlumniEventRecord[];
  announcements: AnnouncementRecord[];
  spotlights: SpotlightStoryRecord[];
  onDeleteAlumnusProfile: (uid: string, fullName: string) => Promise<void>;
  onDeleteEvent: (eventId: string, title: string) => Promise<void>;
  onDeleteEventSlide?: (eventId: string, slideIndex: number) => Promise<void>;
  onDeleteAnnouncement: (annId: string, title: string) => Promise<void>;
  onDeleteSpotlight: (storyId: string, nomineeName: string) => Promise<void>;
}

export const PortalDeleteMenuModal: React.FC<PortalDeleteMenuModalProps> = ({
  isOpen,
  initialTab = 'directory',
  initialFocusId = null,
  onClose,
  alumniList,
  events,
  announcements,
  spotlights,
  onDeleteAlumnusProfile,
  onDeleteEvent,
  onDeleteEventSlide,
  onDeleteAnnouncement,
  onDeleteSpotlight,
}) => {
  const [activeTab, setActiveTab] = useState<DeleteMenuTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
    setSearchQuery('');
    setDeleteNotice(null);
    if (initialFocusId) {
      setSelectedIds({ [initialFocusId]: true });
    } else {
      setSelectedIds({});
    }
  }, [isOpen, initialTab, initialFocusId]);

  if (!isOpen) return null;

  const q = searchQuery.trim().toLowerCase();

  const filteredAlumni = alumniList.filter(
    (a) =>
      !q ||
      a.fullName.toLowerCase().includes(q) ||
      a.profession.toLowerCase().includes(q) ||
      String(a.graduationYear).includes(q)
  );

  const filteredEvents = events.filter(
    (e) =>
      !q ||
      e.title.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q) ||
      e.venue.toLowerCase().includes(q)
  );

  const filteredAnnouncements = announcements.filter(
    (a) =>
      !q ||
      a.title.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q) ||
      a.authorName.toLowerCase().includes(q)
  );

  const filteredSpotlights = spotlights.filter(
    (s) =>
      !q ||
      s.nomineeName.toLowerCase().includes(q) ||
      s.milestoneTitle.toLowerCase().includes(q) ||
      String(s.graduationYear).includes(q)
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const selectedCount = Object.values(selectedIds).filter(Boolean).length;

  const handleDeleteSelected = async () => {
    if (selectedCount === 0) return;
    setBusy(true);
    try {
      const ids = Object.entries(selectedIds)
        .filter(([, checked]) => checked)
        .map(([id]) => id);

      let removed = 0;
      if (activeTab === 'directory') {
        for (const uid of ids) {
          const item = alumniList.find((a) => a.uid === uid);
          if (item) {
            await onDeleteAlumnusProfile(item.uid, item.fullName);
            removed++;
          }
        }
      } else if (activeTab === 'events') {
        for (const id of ids) {
          const item = events.find((e) => e.id === id);
          if (item) {
            await onDeleteEvent(item.id, item.title);
            removed++;
          }
        }
      } else if (activeTab === 'announcements') {
        for (const id of ids) {
          const item = announcements.find((a) => a.id === id);
          if (item) {
            await onDeleteAnnouncement(item.id, item.title);
            removed++;
          }
        }
      } else if (activeTab === 'spotlights') {
        for (const id of ids) {
          const item = spotlights.find((s) => s.id === id);
          if (item) {
            await onDeleteSpotlight(item.id, item.nomineeName);
            removed++;
          }
        }
      }
      setSelectedIds({});
      setDeleteNotice(`Cloud Synced (Auto-Saved): Deleted ${removed} selected item(s).`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white text-gray-900 rounded-xl max-w-4xl w-full overflow-hidden border-2 border-[#D4AF37] my-4 shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#450012] text-white p-4 sm:p-6 flex items-center justify-between gap-3 border-b border-[#D4AF37]/40 shrink-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] sm:text-xs uppercase tracking-widest text-[#D4AF37] font-bold flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5" />
                <span>Unified BNHS Portal Delete Menu</span>
              </p>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-400/50 text-[10px] font-bold text-emerald-200">
                {busy ? (
                  <Cloud className="w-3 h-3 text-[#D4AF37] animate-pulse" />
                ) : (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                )}
                <span>{busy ? 'Cloud Syncing (Auto-Saving)...' : 'Cloud Synced (Auto-Saved)'}</span>
              </span>
            </div>
            <h2 className="font-display text-lg sm:text-2xl font-bold mt-1">
              Delete Directory Profiles, Events & Slides, Announcements or Spotlight Stories
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Delete Menu"
            className="text-white/75 hover:text-white p-1.5 rounded-lg hover:bg-white/10 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="bg-[#650019] px-4 sm:px-6 py-2.5 flex items-center gap-1.5 overflow-x-auto border-b border-[#D4AF37]/30 shrink-0">
          {[
            { id: 'directory', label: `Directory (${alumniList.length})`, icon: Users },
            { id: 'events', label: `Events & Slides (${events.length})`, icon: Calendar },
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
                  setActiveTab(tab.id as DeleteMenuTab);
                  setSelectedIds({});
                  setDeleteNotice(null);
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

        {/* Search & Bulk Action Bar */}
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery ?? ''}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeTab} records to delete...`}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-300 text-xs sm:text-sm bg-white"
            />
          </div>
          {selectedCount > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={handleDeleteSelected}
              className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Selected ({selectedCount})
            </button>
          )}
        </div>

        {deleteNotice && (
          <div className="mx-4 mt-3 p-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold flex items-center justify-between gap-2 shrink-0">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {deleteNotice}
            </span>
            <button
              type="button"
              onClick={() => setDeleteNotice(null)}
              className="text-amber-800 hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* List Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-2.5">
          {activeTab === 'directory' &&
            (filteredAlumni.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No alumni records match your search.
              </p>
            ) : (
              filteredAlumni.map((alum) => (
                <div
                  key={alum.uid}
                  className="p-3.5 rounded-xl border border-gray-200 hover:border-red-300 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <label className="flex items-start sm:items-center gap-3 cursor-pointer flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedIds[alum.uid])}
                      onChange={() => toggleSelect(alum.uid)}
                      className="accent-red-600 mt-1 sm:mt-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{alum.fullName}</p>
                      <p className="text-xs text-gray-600 truncate">
                        Batch {alum.graduationYear} · {alum.strand} · {alum.profession} ·{' '}
                        {alum.locationCity}
                      </p>
                    </div>
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await onDeleteAlumnusProfile(alum.uid, alum.fullName);
                        setDeleteNotice(
                          `Cloud Synced (Auto-Saved): Deleted "${alum.fullName}" from Directory.`
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-bold hover:bg-red-600 hover:text-white transition-colors inline-flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              ))
            ))}

          {activeTab === 'events' &&
            (filteredEvents.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No events match your search.
              </p>
            ) : (
              filteredEvents.map((ev) => {
                const slides = Array.from(
                  new Set([...(ev.galleryUrls || []), ...(ev.imageUrl ? [ev.imageUrl] : [])])
                ).filter(Boolean);
                return (
                  <div
                    key={ev.id}
                    className="p-4 rounded-xl border border-gray-200 hover:border-red-300 bg-white space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <label className="flex items-start sm:items-center gap-3 cursor-pointer flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedIds[ev.id])}
                          onChange={() => toggleSelect(ev.id)}
                          className="accent-red-600 mt-1 sm:mt-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#650019] uppercase">
                            {ev.category} · {ev.eventDate}
                          </p>
                          <p className="text-sm font-bold text-gray-900 truncate">{ev.title}</p>
                        </div>
                      </label>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await onDeleteEvent(ev.id, ev.title);
                            setDeleteNotice(
                              `Cloud Synced (Auto-Saved): Deleted event "${ev.title}".`
                            );
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-bold hover:bg-red-600 hover:text-white transition-colors inline-flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete Event
                      </button>
                    </div>

                    {slides.length > 0 && onDeleteEventSlide && (
                      <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-semibold text-gray-500">
                          Sliding Photos ({slides.length}):
                        </span>
                        {slides.map((src, idx) => (
                          <div
                            key={`${ev.id}_slide_${idx}`}
                            className="relative w-14 h-10 rounded overflow-hidden border border-gray-300"
                          >
                            <img src={src} alt="" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              disabled={busy}
                              onClick={async () => {
                                setBusy(true);
                                try {
                                  await onDeleteEventSlide(ev.id, idx);
                                  setDeleteNotice(
                                    `Cloud Synced (Auto-Saved): Removed slide #${idx + 1} from "${ev.title}".`
                                  );
                                } finally {
                                  setBusy(false);
                                }
                              }}
                              title="Delete this slide"
                              className="absolute top-0 right-0 bg-red-600 text-white p-0.5 rounded-bl hover:bg-red-700 cursor-pointer"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            ))}

          {activeTab === 'announcements' &&
            (filteredAnnouncements.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No announcements match your search.
              </p>
            ) : (
              filteredAnnouncements.map((ann) => (
                <div
                  key={ann.id}
                  className="p-3.5 rounded-xl border border-gray-200 hover:border-red-300 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <label className="flex items-start sm:items-center gap-3 cursor-pointer flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedIds[ann.id])}
                      onChange={() => toggleSelect(ann.id)}
                      className="accent-red-600 mt-1 sm:mt-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#650019] uppercase">
                        {ann.category} · {ann.authorName}
                      </p>
                      <p className="text-sm font-bold text-gray-900 truncate">{ann.title}</p>
                    </div>
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await onDeleteAnnouncement(ann.id, ann.title);
                        setDeleteNotice(
                          `Cloud Synced (Auto-Saved): Deleted announcement "${ann.title}".`
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-bold hover:bg-red-600 hover:text-white transition-colors inline-flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              ))
            ))}

          {activeTab === 'spotlights' &&
            (filteredSpotlights.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No spotlight stories match your search.
              </p>
            ) : (
              filteredSpotlights.map((st) => (
                <div
                  key={st.id}
                  className="p-3.5 rounded-xl border border-gray-200 hover:border-red-300 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <label className="flex items-start sm:items-center gap-3 cursor-pointer flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedIds[st.id])}
                      onChange={() => toggleSelect(st.id)}
                      className="accent-red-600 mt-1 sm:mt-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#650019]">
                        Batch {st.graduationYear} · {st.strand}
                      </p>
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {st.nomineeName} — {st.milestoneTitle}
                      </p>
                    </div>
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await onDeleteSpotlight(st.id, st.nomineeName);
                        setDeleteNotice(
                          `Cloud Synced (Auto-Saved): Deleted spotlight story for ${st.nomineeName}.`
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-bold hover:bg-red-600 hover:text-white transition-colors inline-flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              ))
            ))}
        </div>
      </div>
    </div>
  );
};
