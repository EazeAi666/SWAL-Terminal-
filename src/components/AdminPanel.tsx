import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, getDocs, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, UserRole } from '../types';
import { Shield, UserPlus, Megaphone, Search, Check, X } from 'lucide-react';

interface AdminPanelProps {
  profile: UserProfile | null;
}

export default function AdminPanel({ profile }: AdminPanelProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchEmail, setSearchEmail] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => doc.data() as UserProfile));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });
    return () => unsubscribe();
  }, []);

  const handleUpdateRole = async (uid: string, newRole: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
      setStatus(`Updated user role to ${newRole}`);
    } catch (error) {
      setStatus('Error updating role');
    }
  };

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcement.trim()) return;

    try {
      await addDoc(collection(db, 'announcements'), {
        text: announcement,
        authorName: profile?.displayName || 'Admin',
        timestamp: serverTimestamp()
      });
      setAnnouncement('');
      setStatus('Announcement published!');
    } catch (error) {
      setStatus('Error publishing announcement');
    }
  };

  if (profile?.role !== 'sudo') {
    return <div className="p-8 text-red-500 font-mono">ACCESS DENIED: Insufficient Privileges</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto bg-terminal-bg p-8 space-y-8 font-mono">
      <div className="flex items-center gap-4 border-b border-terminal-green/20 pb-4">
        <Shield className="w-8 h-8 text-terminal-green" />
        <h1 className="text-2xl font-bold text-terminal-green uppercase tracking-tighter">Root Admin Terminal</h1>
      </div>

      {status && (
        <div className="p-2 border border-terminal-green/40 bg-terminal-green/5 text-terminal-green text-xs">
          [SYSTEM]: {status}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Announcement Section */}
        <div className="space-y-4 border border-terminal-green/20 p-6 bg-black/20 rounded">
          <h2 className="text-sm font-bold text-terminal-green uppercase tracking-widest flex items-center gap-2">
            <Megaphone className="w-4 h-4" />
            Global Broadcast
          </h2>
          <form onSubmit={handlePostAnnouncement} className="space-y-4">
            <textarea
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
              placeholder="Enter announcement text..."
              className="w-full h-32 bg-black/40 border border-terminal-green/20 rounded p-3 text-terminal-green text-sm outline-none focus:border-terminal-green/50"
            />
            <button
              type="submit"
              className="w-full bg-terminal-green text-terminal-bg py-2 rounded font-bold uppercase tracking-widest text-xs hover:bg-terminal-green/90 transition-colors"
            >
              Publish Announcement
            </button>
          </form>
        </div>

        {/* Teacher Management */}
        <div className="space-y-4 border border-terminal-green/20 p-6 bg-black/20 rounded">
          <h2 className="text-sm font-bold text-terminal-green uppercase tracking-widest flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Teacher Management
          </h2>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-terminal-green/40" />
              <input
                type="text"
                placeholder="Search users by name..."
                className="w-full bg-black/40 border border-terminal-green/20 rounded py-2 pl-10 pr-4 text-terminal-green text-sm outline-none"
                onChange={(e) => setSearchEmail(e.target.value)}
              />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
              {users
                .filter(u => u.displayName.toLowerCase().includes(searchEmail.toLowerCase()))
                .map(u => (
                  <div key={u.uid} className="flex items-center justify-between p-2 border border-terminal-green/10 rounded hover:bg-terminal-green/5 transition-colors">
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{u.displayName}</p>
                      <p className="text-[10px] text-terminal-green/40">ID: {u.terminalId}</p>
                    </div>
                    <div className="flex gap-2">
                      {u.role === 'user' ? (
                        <button
                          onClick={() => handleUpdateRole(u.uid, 'teacher')}
                          className="px-2 py-1 border border-terminal-green/20 rounded text-[10px] hover:bg-terminal-green/10"
                        >
                          Make Teacher
                        </button>
                      ) : u.role === 'teacher' ? (
                        <button
                          onClick={() => handleUpdateRole(u.uid, 'user')}
                          className="px-2 py-1 border border-red-500/20 text-red-500 rounded text-[10px] hover:bg-red-500/10"
                        >
                          Revoke Teacher
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
