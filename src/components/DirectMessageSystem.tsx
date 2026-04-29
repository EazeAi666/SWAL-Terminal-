import { useState, useEffect, useRef } from 'react';
import { collection, query, onSnapshot, addDoc, serverTimestamp, orderBy, where, getDocs, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, DirectMessage } from '../types';
import { MessageSquare, Send, Search, User, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';

interface DirectMessageSystemProps {
  profile: UserProfile | null;
}

export default function DirectMessageSystem({ profile }: DirectMessageSystemProps) {
  const [targetId, setTargetId] = useState('');
  const [targetUser, setTargetUser] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [status, setStatus] = useState('');
  const [allChats, setAllChats] = useState<{id: string, participants: string[]}[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Admin Monitoring: Fetch all chat IDs if admin
  useEffect(() => {
    if (profile?.role === 'sudo') {
      const q = query(collection(db, 'directMessages'), orderBy('timestamp', 'desc'), limit(1000));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DirectMessage));
        // Group by conversation pairs
        const chats = new Map();
        msgs.forEach(m => {
          const pair = [m.senderUid, m.receiverUid].sort().join('_');
          if (!chats.has(pair)) {
            chats.set(pair, { id: pair, participants: [m.senderUid, m.receiverUid] });
          }
        });
        setAllChats(Array.from(chats.values()));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'directMessages');
      });
      return () => unsubscribe();
    }
  }, [profile]);

  useEffect(() => {
    if (targetUser && profile) {
      const q = query(
        collection(db, 'directMessages'),
        where('senderUid', 'in', [profile.uid, targetUser.uid]),
        where('receiverUid', 'in', [profile.uid, targetUser.uid]),
        orderBy('timestamp', 'asc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DirectMessage));
        setMessages(msgs);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'directMessages_filtered');
      });
      return () => unsubscribe();
    }
  }, [targetUser, profile]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const findUser = async () => {
    if (!targetId.trim()) return;
    setStatus('Searching...');
    try {
      const q = query(collection(db, 'users'), where('terminalId', '==', targetId.trim()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setTargetUser(snap.docs[0].data() as UserProfile);
        setStatus('');
      } else {
        setStatus('User not found');
        setTargetUser(null);
      }
    } catch (error) {
      setStatus('Error searching user');
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !profile || !targetUser) return;

    try {
      await addDoc(collection(db, 'directMessages'), {
        text: inputText.trim(),
        senderUid: profile.uid,
        receiverUid: targetUser.uid,
        timestamp: serverTimestamp()
      });
      setInputText('');
    } catch (error) {
      console.error('DM Error:', error);
    }
  };

  return (
    <div className="flex h-full overflow-hidden bg-terminal-bg font-mono">
      {/* Sidebar: Chat List / Search */}
      <div className="w-72 border-r border-terminal-green/20 flex flex-col bg-black/20">
        <div className="p-4 border-b border-terminal-green/20 space-y-4">
          <h2 className="text-xs font-bold text-terminal-green uppercase tracking-widest flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Secure Comms
          </h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              placeholder="Enter Terminal ID..."
              className="flex-1 bg-black/40 border border-terminal-green/20 rounded px-2 py-1 text-[10px] text-terminal-green outline-none"
            />
            <button 
              onClick={findUser}
              className="bg-terminal-green/10 border border-terminal-green/20 p-1 rounded hover:bg-terminal-green/20"
            >
              <Search className="w-3 h-3 text-terminal-green" />
            </button>
          </div>
          {status && <p className="text-[10px] text-terminal-green/60">{status}</p>}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {profile?.role === 'sudo' && (
            <div className="mb-4">
              <p className="text-[9px] uppercase tracking-widest text-red-500/60 px-2 mb-2 flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" />
                Admin Monitoring
              </p>
              {allChats.map(chat => (
                <button
                  key={chat.id}
                  onClick={async () => {
                    // Fetch user info for monitor
                    const u1 = chat.participants[0];
                    const u2 = chat.participants[1];
                    const targetUid = u1 === profile.uid ? u2 : u1;
                    const uSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', targetUid)));
                    if (!uSnap.empty) setTargetUser(uSnap.docs[0].data() as UserProfile);
                  }}
                  className="w-full text-left px-2 py-1.5 rounded text-[10px] text-terminal-text/40 hover:bg-terminal-green/5 hover:text-terminal-green truncate"
                >
                  Monitor: {chat.id}
                </button>
              ))}
            </div>
          )}
          
          {targetUser && (
            <div className="p-2 bg-terminal-green/10 rounded border border-terminal-green/20">
              <p className="text-[10px] font-bold text-terminal-green">Active Session:</p>
              <p className="text-xs truncate">{targetUser.displayName}</p>
              <p className="text-[9px] text-terminal-green/40">ID: {targetUser.terminalId}</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {targetUser ? (
          <>
            <div className="p-4 border-b border-terminal-green/20 bg-black/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-terminal-green/20 flex items-center justify-center text-terminal-green font-bold text-xs">
                  {targetUser.displayName?.[0] || '?'}
                </div>
                <div>
                  <p className="text-xs font-bold text-terminal-green">{targetUser.displayName || 'Target User'}</p>
                  <p className="text-[10px] text-terminal-green/40">Encrypted Tunnel Active</p>
                </div>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
              {messages.map((m) => {
                const isMe = m.senderUid === profile?.uid;
                return (
                  <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded text-xs ${
                      isMe ? 'bg-terminal-green/10 text-terminal-green border border-terminal-green/20' : 'bg-black/40 text-terminal-text border border-white/10'
                    }`}>
                      {m.text}
                    </div>
                    <span className="text-[9px] text-terminal-green/20 mt-1">
                      {m.timestamp?.toDate ? format(m.timestamp.toDate(), 'HH:mm:ss') : '...'}
                    </span>
                  </div>
                );
              })}
            </div>

            <form onSubmit={sendMessage} className="p-4 border-t border-terminal-green/20 bg-black/40">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Type secure message..."
                  className="flex-1 bg-transparent border border-terminal-green/20 rounded px-4 py-2 text-xs text-terminal-green outline-none focus:border-terminal-green/50"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="bg-terminal-green text-terminal-bg p-2 rounded hover:bg-terminal-green/90 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-terminal-green/20 space-y-4">
            <MessageSquare className="w-16 h-16 opacity-10" />
            <p className="uppercase tracking-[0.5em] text-xs">Initialize Secure Connection</p>
          </div>
        )}
      </div>
    </div>
  );
}
