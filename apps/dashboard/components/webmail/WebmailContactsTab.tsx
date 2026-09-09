'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui';
import { Users, UserPlus, Download, Upload, Search, Mail, Phone, Building, X } from 'lucide-react';

interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  notes?: string;
}

interface WebmailContactsTabProps {
  onComposeTo: (email: string) => void;
}

export function WebmailContactsTab({ onComposeTo }: WebmailContactsTabProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');

  const { toast } = useToast();

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = () => {
    api.email.contacts().then((res) => {
      setContacts(res.contacts || []);
    }).catch(() => {});
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;
    try {
      const res = await api.email.createContact({ name, email, phone, company });
      toast(`Contact "${name}" saved!`, 'success');
      setContacts((prev) => [...prev, res.contact]);
      setShowAddModal(false);
      setName('');
      setEmail('');
      setPhone('');
      setCompany('');
    } catch {
      toast('Failed to add contact', 'error');
    }
  };

  const handleExportCsv = () => {
    const csvRows = ['Name,Email,Phone,Company'];
    contacts.forEach((c) => csvRows.push(`"${c.name}","${c.email}","${c.phone || ''}","${c.company || ''}"`));
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `webmail-contacts-${Date.now()}.csv`;
    a.click();
    toast('Contacts exported to CSV!', 'success');
  };

  const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      let count = 0;
      for (const line of lines) {
        if (line.toLowerCase().startsWith('name,email')) continue;
        const cols = line.split(',').map((c) => c.replace(/^"|"$/g, '').trim());
        if (cols.length >= 2 && cols[1].includes('@')) {
          try {
            await api.email.createContact({
              name: cols[0] || cols[1].split('@')[0],
              email: cols[1],
              phone: cols[2] || '',
              company: cols[3] || '',
            });
            count++;
          } catch {}
        }
      }
      fetchContacts();
      toast(`Successfully imported ${count} contact(s) from ${file.name}`, 'success');
    };
    reader.readAsText(file);
  };

  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-full bg-slate-900 text-slate-100 p-6 overflow-y-auto space-y-6">
      {/* CONTACTS HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-950/80 p-5 rounded-3xl border border-slate-800">
        <div>
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-400" />
            <span>Address Book & Contacts</span>
          </h2>
          <p className="text-xs text-slate-400">Auto-collected & custom contacts with CSV/vCard import and export.</p>
        </div>

        <div className="flex items-center gap-2">
          <label className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl cursor-pointer flex items-center gap-1.5">
            <Upload className="h-3.5 w-3.5" />
            <span>Import CSV</span>
            <input type="file" accept=".csv,.vcf" onChange={handleImportCsv} className="hidden" />
          </label>

          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow flex items-center gap-1.5"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Add Contact</span>
          </button>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="relative max-w-md">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search contacts by name or email..."
          className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-2 pl-9 pr-4 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
      </div>

      {/* CONTACTS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredContacts.length === 0 ? (
          <div className="col-span-full p-8 text-center text-slate-500 text-xs font-medium border border-dashed border-slate-800 rounded-2xl">
            No contacts found
          </div>
        ) : (
          filteredContacts.map((c) => (
            <div key={c.id} className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3 hover:border-slate-700 transition-all">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white font-extrabold flex items-center justify-center text-sm shadow">
                  {c.name[0].toUpperCase()}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">{c.name}</h4>
                  <p className="text-[11px] text-indigo-300 font-mono">{c.email}</p>
                </div>
              </div>

              {(c.phone || c.company) && (
                <div className="text-[11px] text-slate-400 space-y-1 pt-1 border-t border-slate-800/60 font-sans">
                  {c.company && (
                    <p className="flex items-center gap-1.5">
                      <Building className="h-3 w-3 text-slate-500" />
                      <span>{c.company}</span>
                    </p>
                  )}
                  {c.phone && (
                    <p className="flex items-center gap-1.5">
                      <Phone className="h-3 w-3 text-slate-500" />
                      <span>{c.phone}</span>
                    </p>
                  )}
                </div>
              )}

              <button
                onClick={() => onComposeTo(c.email)}
                className="w-full py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <Mail className="h-3.5 w-3.5" />
                <span>Send Email</span>
              </button>
            </div>
          ))
        )}
      </div>

      {/* ADD CONTACT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-indigo-400" />
                <span>Create New Contact</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddContact} className="space-y-3 text-xs">
              <input
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                required
              />
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                required
              />
              <input
                type="text"
                placeholder="Phone Number (optional)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
              />
              <input
                type="text"
                placeholder="Company / Organization (optional)"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
              />
              <button type="submit" className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5">
                <UserPlus className="h-3.5 w-3.5" />
                <span>Save Contact</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
