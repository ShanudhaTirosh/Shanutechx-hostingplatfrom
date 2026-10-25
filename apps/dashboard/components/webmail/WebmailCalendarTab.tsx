'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui';
import { Calendar, Link2, Plus, ChevronLeft, ChevronRight, UserCheck, Clock, Globe, X } from 'lucide-react';

interface CalendarEvent {
  id: string;
  title: string;
  dateStr: string;
  timeStr: string;
  participants: string[];
  location?: string;
}

export function WebmailCalendarTab() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [syncs, setSyncs] = useState<any[]>([]);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncProvider, setSyncProvider] = useState<'google' | 'ical' | 'outlook'>('google');
  const [syncName, setSyncName] = useState('');
  const [iCalUrl, setICalUrl] = useState('');

  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newParticipants, setNewParticipants] = useState('');

  const { toast } = useToast();

  useEffect(() => {
    fetchCalendarData();
  }, []);

  const fetchCalendarData = () => {
    api.email.events().then((res) => {
      if (res.events) setEvents(res.events);
    }).catch(() => {});

    api.webmail.calendarSync.list().then((res) => {
      setSyncs(res.syncs || []);
    }).catch(() => {});
  };

  const handleAddSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!syncName) return;
    try {
      const res = await api.webmail.calendarSync.add({
        provider: syncProvider,
        name: syncName,
        calendarUrl: iCalUrl || undefined,
      });
      toast(res.message || `Calendar "${syncName}" connected successfully!`, 'success');
      setShowSyncModal(false);
      setSyncName('');
      setICalUrl('');
      fetchCalendarData();
    } catch (err: any) {
      toast(err.message || 'Failed to connect calendar', 'error');
    }
  };

  const handleRemoveSync = async (id: string) => {
    try {
      await api.webmail.calendarSync.delete(id);
      toast('Calendar sync removed', 'info');
      fetchCalendarData();
    } catch {
      toast('Failed to remove calendar sync', 'error');
    }
  };

  const now = new Date();
  const [currentDate, setCurrentDate] = useState(new Date());

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0-indexed
  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const isCurrentMonthToday = now.getFullYear() === currentYear && now.getMonth() === currentMonth;
  const todayDateNum = now.getDate();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return;
    const participantsList = newParticipants ? newParticipants.split(',').map((p) => p.trim()) : ['Me'];
    const newEv: CalendarEvent = {
      id: `ev-${Date.now()}`,
      title: newTitle,
      dateStr: newDate || 'Today',
      timeStr: newTime || '12:00 PM',
      participants: participantsList,
    };
    setEvents((prev) => [...prev, newEv]);
    toast(`Event "${newTitle}" saved to calendar!`, 'success');
    setShowAddEventModal(false);
    setNewTitle('');
    setNewDate('');
    setNewTime('');
    setNewParticipants('');
  };

  return (
    <div className="h-full bg-slate-900 text-slate-100 p-6 overflow-y-auto space-y-6">
      {/* TOP CALENDAR HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-950/80 p-5 rounded-3xl border border-slate-800">
        <div>
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <Calendar className="h-5 w-5 text-white" />
            <span>Integrated Calendar & Scheduling</span>
          </h2>
          <p className="text-xs text-slate-400">Manage meetings, .ics invites, and Google Calendar / iCal feeds.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSyncModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-1.5"
          >
            <Link2 className="h-3.5 w-3.5" />
            <span>Sync Google Calendar & iCal</span>
          </button>

          <button
            onClick={() => setShowAddEventModal(true)}
            className="px-4 py-2 bg-white text-black hover:bg-neutral-200 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Event</span>
          </button>
        </div>
      </div>

      {/* CONNECTED CALENDAR FEEDS BADGES */}
      {syncs.length > 0 && (
        <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-2">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-white">Active External Calendar Syncs</p>
          <div className="flex flex-wrap gap-2">
            {syncs.map((s) => (
              <div key={s.id} className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs flex items-center gap-2">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-white" />
                  <span>{s.provider === 'google' ? 'Google Calendar' : 'iCal Feed'}: {s.name}</span>
                </span>
                <button onClick={() => handleRemoveSync(s.id)} className="text-slate-500 hover:text-rose-400 p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MAIN CALENDAR GRID & EVENTS SPLIT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* MINI CALENDAR WIDGET */}
        <div className="lg:col-span-5 bg-slate-950/60 border border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">{monthName} {currentYear}</h3>
            <div className="flex gap-1">
              <button onClick={handlePrevMonth} className="p-1 bg-slate-800 rounded text-slate-400 hover:text-white text-xs">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={handleNextMonth} className="p-1 bg-slate-800 rounded text-slate-400 hover:text-white text-xs">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-500">
            <span>SU</span><span>MO</span><span>TU</span><span>WE</span><span>TH</span><span>FR</span><span>SA</span>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center text-xs">
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isToday = isCurrentMonthToday && day === todayDateNum;
              return (
                <div
                  key={day}
                  className={`py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                    isToday
                      ? 'bg-white text-black text-white font-extrabold border-white/30 shadow-md'
                      : 'bg-slate-900/60 border-slate-800/60 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {day}
                </div>
              );
            })}
          </div>
        </div>

        {/* UPCOMING SCHEDULED EVENTS LIST */}
        <div className="lg:col-span-7 bg-slate-950/60 border border-slate-800 rounded-3xl p-5 space-y-4">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">Upcoming Scheduled Meetings & Events</h3>
          <div className="space-y-3">
            {events.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs font-medium border border-dashed border-slate-800 rounded-2xl">
                No scheduled events. Click &quot;New Event&quot; to add a meeting.
              </div>
            ) : (
              events.map((ev) => (
                <div key={ev.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white">{ev.title}</h4>
                    <span className="text-[10px] bg-white/10 text-neutral-300 font-mono px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{ev.dateStr} @ {ev.timeStr}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Participants: {ev.participants.join(', ')}</span>
                    <button onClick={() => toast(`RSVP Accepted for ${ev.title}!`, 'success')} className="text-white hover:underline font-bold flex items-center gap-1">
                      <UserCheck className="h-3.5 w-3.5" />
                      <span>RSVP Accepted</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* GOOGLE CALENDAR / ICAL SYNC MODAL */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Link2 className="h-4 w-4 text-white" />
                <span>Sync External Calendar (Google / iCal)</span>
              </h3>
              <button onClick={() => setShowSyncModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddSync} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Provider Type:</label>
                <select
                  value={syncProvider}
                  onChange={(e) => setSyncProvider(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                >
                  <option value="google">Google Calendar (OAuth 2.0)</option>
                  <option value="ical">Public iCal Feed URL (.ics)</option>
                  <option value="outlook">Microsoft Outlook Calendar</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Calendar Account / Label Name:</label>
                <input
                  type="text"
                  placeholder="e.g. My Google Work Calendar"
                  value={syncName}
                  onChange={(e) => setSyncName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                  required
                />
              </div>

              {syncProvider === 'ical' && (
                <div>
                  <label className="text-slate-400 block mb-1">iCal Feed Subscription URL (.ics):</label>
                  <input
                    type="url"
                    placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
                    value={iCalUrl}
                    onChange={(e) => setICalUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono"
                    required
                  />
                </div>
              )}

              {syncProvider === 'google' && (
                <div className="bg-white/5 border border-white/15 p-3 rounded-2xl text-[11px] text-neutral-300">
                  Google Calendar OAuth integration configured. Clicking Connect will sync events between ShanuTechX Webmail and your Google Calendar account.
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowSyncModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-white text-black hover:bg-neutral-200 text-white font-bold rounded-xl shadow">
                  Connect & Sync Calendar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD NEW EVENT MODAL */}
      {showAddEventModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Calendar className="h-4 w-4 text-white" />
                <span>Create Meeting Event</span>
              </h3>
              <button onClick={() => setShowAddEventModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddEvent} className="space-y-3 text-xs">
              <input
                type="text"
                placeholder="Event Title (e.g. Design Sync)"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                required
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Date (e.g. 18 May)"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                />
                <input
                  type="text"
                  placeholder="Time (e.g. 10:30 AM)"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                />
              </div>
              <input
                type="text"
                placeholder="Participants (comma separated emails)"
                value={newParticipants}
                onChange={(e) => setNewParticipants(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
              />
              <button type="submit" className="w-full py-2.5 bg-white text-black hover:bg-neutral-200 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                <span>Save Event to Calendar</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
