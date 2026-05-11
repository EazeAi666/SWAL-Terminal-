import { useState, useEffect, useRef } from 'react';
import { Branch, Message, UserProfile, Announcement, AiTutoringSession } from '../types';
import { collection, onSnapshot, query, orderBy, limit, addDoc, serverTimestamp, doc, setDoc, updateDoc, arrayUnion, Timestamp, where, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import { Send, Bot, User, ShieldCheck, Megaphone, Plus, Trash2, Pin, Edit2, ChevronLeft, ChevronRight, BrainCircuit, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from '@google/genai';

interface ChatProps {
  branch: Branch;
  profile: UserProfile | null;
  isTutorMode?: boolean;
}

const getAiClient = () => {
  const apiKey = (import.meta.env.VITE_GEMINI_API_KEY as string) || (process.env.GEMINI_API_KEY as string);
  if (!apiKey) {
    console.warn('GEMINI_API_KEY is missing. AI features will be disabled.');
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export default function Chat({ branch, profile, isTutorMode = false }: ChatProps) {
  const ai = getAiClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [inputText, setInputText] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [tutorSessionId, setTutorSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<AiTutoringSession[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Announcements listener
    const qAnn = query(collection(db, 'announcements'), orderBy('timestamp', 'desc'), limit(3));
    const unsubscribeAnn = onSnapshot(qAnn, (snapshot) => {
      setAnnouncements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'announcements');
    });

    if (isTutorMode && profile) {
      // Listen for all sessions of this user for this branch
      const qSessions = query(
        collection(db, 'aiTutoringSessions'),
        where('uid', '==', profile.uid),
        where('branchId', '==', branch.id),
        orderBy('createdAt', 'desc')
      );

      const unsubscribeSessions = onSnapshot(qSessions, (snapshot) => {
        const sessionList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AiTutoringSession));
        setSessions(sessionList);
        
        // If no session selected, select the most recent one or create first if none exist
        if (sessionList.length > 0) {
          if (!tutorSessionId) {
            setTutorSessionId(sessionList[0].id);
          }
        } else {
          createNewSession();
        }
      });

      return () => {
        unsubscribeAnn();
        unsubscribeSessions();
      };
    } else {
      // Fetch latest 100 messages and sort them
      const q = query(
        collection(db, 'branches', branch.id, 'messages'),
        orderBy('timestamp', 'desc'),
        limit(100)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
        // Sort ascending for display
        setMessages(msgs.reverse());
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `branches/${branch.id}/messages`);
      });

      return () => {
        unsubscribeAnn();
        unsubscribe();
      };
    }
  }, [branch.id, isTutorMode, profile]);

  useEffect(() => {
    if (isTutorMode && tutorSessionId && profile) {
      const unsubscribeMessages = onSnapshot(doc(db, 'aiTutoringSessions', tutorSessionId), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const msgs = (data.messages || []).map((m: any, i: number) => ({
            id: `${tutorSessionId}_${i}`,
            text: m.text,
            senderUid: m.role === 'user' ? profile.uid : 'ai-root',
            senderName: m.role === 'user' ? profile.displayName : 'ROOT',
            senderRole: m.role === 'user' ? profile.role : 'sudo',
            timestamp: Timestamp.fromMillis(m.timestamp),
            branchId: branch.id
          } as Message));
          setMessages(msgs);
        }
      });
      return () => unsubscribeMessages();
    }
  }, [tutorSessionId, isTutorMode, profile, branch.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isAiThinking]);

  const createNewSession = async () => {
    if (!profile) return;
    try {
      const sessionRef = await addDoc(collection(db, 'aiTutoringSessions'), {
        uid: profile.uid,
        branchId: branch.id,
        topic: branch.name,
        title: `Neural Link - ${new Date().toLocaleTimeString()}`,
        isPinned: false,
        messages: [{
          role: 'model',
          text: `Connection established. I am ROOT, your tutor for **${branch.name}**. What knowledge shall we extract today?`,
          timestamp: Date.now()
        }],
        createdAt: serverTimestamp()
      });
      setTutorSessionId(sessionRef.id);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'aiTutoringSessions');
    }
  };

  const togglePin = async (sessionId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'aiTutoringSessions', sessionId), {
        isPinned: !currentStatus
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `aiTutoringSessions/${sessionId}`);
    }
  };

  const renameSession = async (sessionId: string, currentTitle: string) => {
    const newTitle = prompt('Rename Neural Link:', currentTitle);
    if (!newTitle || newTitle === currentTitle) return;
    try {
      await updateDoc(doc(db, 'aiTutoringSessions', sessionId), {
        title: newTitle
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `aiTutoringSessions/${sessionId}`);
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to terminate this neural link? History will be purged.')) return;
    try {
      await deleteDoc(doc(db, 'aiTutoringSessions', sessionId));
      if (tutorSessionId === sessionId) setTutorSessionId(null);
    } catch (error) {
       handleFirestoreError(error, OperationType.DELETE, `aiTutoringSessions/${sessionId}`);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !profile) return;

    const text = inputText.trim();
    setInputText('');

    if (isTutorMode && tutorSessionId) {
      try {
        const sessionRef = doc(db, 'aiTutoringSessions', tutorSessionId);
        await updateDoc(sessionRef, {
          messages: arrayUnion({
            role: 'user',
            text,
            timestamp: Date.now()
          })
        });
        handleAiTutorResponse(text, messages);
      } catch (error) {
        console.error('Tutor Error:', error);
      }
    } else {
      try {
        await addDoc(collection(db, 'branches', branch.id, 'messages'), {
          text,
          senderUid: profile.uid,
          senderName: profile.displayName,
          senderRole: profile.role,
          timestamp: serverTimestamp(),
          branchId: branch.id
        });

        if (text.toLowerCase().startsWith('@root') || text.toLowerCase().startsWith('@ai')) {
          handleAiResponse(text, messages);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `branches/${branch.id}/messages`);
      }
    }
  };

  const handleAiTutorResponse = async (userPrompt: string, history: Message[]) => {
    if (!tutorSessionId || !ai) return;
    setIsAiThinking(true);
    try {
      const historyContext = history.slice(-15).map(m => 
        `${m.senderName === 'ROOT' ? 'AI' : 'User'}: ${m.text}`
      ).join('\n');

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Previous History:\n${historyContext}\n\nCurrent Question: ${userPrompt}`,
        config: {
          systemInstruction: `You are 'ROOT', a dedicated 1-on-1 tutor. 
          Topic: ${branch.name}. 
          Goal: Provide personalized explanations, code examples, and exercises. 
          Be technical, using markdown. Remember the history to provide continuity in the session.`
        }
      });

      const aiText = response.text;
      const sessionRef = doc(db, 'aiTutoringSessions', tutorSessionId);
      await updateDoc(sessionRef, {
        messages: arrayUnion({
          role: 'model',
          text: aiText,
          timestamp: Date.now()
        })
      });
    } catch (error) {
      console.error('AI Tutor Error:', error);
    } finally {
      setIsAiThinking(false);
    }
  };

  const handleAiResponse = async (userPrompt: string, history: Message[]) => {
    if (!ai) return;
    setIsAiThinking(true);
    try {
      const prompt = userPrompt.replace(/^@(root|ai)\s*/i, '');
      const historyContext = history.slice(-5).map(m => 
        `${m.senderName}: ${m.text}`
      ).join('\n');

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Conversation Context:\n${historyContext}\n\nNew Request: ${prompt}`,
        config: {
          systemInstruction: `You are 'ROOT', the lead instructor at The SWAL Terminal. Professional, technical, cyberpunk tone. Concise responses.`
        }
      });

      const aiText = response.text;

      await addDoc(collection(db, 'branches', branch.id, 'messages'), {
        text: aiText,
        senderUid: 'ai-root',
        senderName: 'ROOT',
        senderRole: 'sudo',
        timestamp: serverTimestamp(),
        branchId: branch.id
      });
    } catch (error) {
      console.error('AI Error:', error);
    } finally {
      setIsAiThinking(false);
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Session Sidebar for Tutor Mode */}
      {isTutorMode && isSidebarOpen && (
        <div className="w-64 border-r border-terminal-green/10 bg-black/40 flex flex-col">
          <div className="p-3 border-b border-terminal-green/10 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-terminal-green/60">Sessions</span>
            <button 
              onClick={createNewSession}
              className="p-1 hover:bg-terminal-green/10 rounded group transition-colors"
              title="New Session"
            >
              <Plus className="w-3 h-3 text-terminal-green" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {/* Pinned Sessions */}
            {sessions.filter(s => s.isPinned).length > 0 && (
              <div className="space-y-1 mb-4">
                <p className="text-[9px] uppercase tracking-tighter text-terminal-green/30 px-2">Pinned</p>
                {sessions.filter(s => s.isPinned).map(session => (
                  <SessionItem 
                    key={session.id} 
                    session={session} 
                    active={tutorSessionId === session.id} 
                    onSelect={setTutorSessionId}
                    onPin={togglePin}
                    onDelete={deleteSession}
                    onRename={renameSession}
                  />
                ))}
              </div>
            )}
            
            {/* Recent Sessions */}
            <div className="space-y-1">
              <p className="text-[9px] uppercase tracking-tighter text-terminal-green/30 px-2">Recent</p>
                {sessions.filter(s => !s.isPinned).map(session => (
                  <SessionItem 
                    key={session.id} 
                    session={session} 
                    active={tutorSessionId === session.id} 
                    onSelect={setTutorSessionId}
                    onPin={togglePin}
                    onDelete={deleteSession}
                    onRename={renameSession}
                  />
                ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Toggle Sidebar Button */}
        {isTutorMode && (
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="absolute left-0 top-1/2 -translate-y-1/2 -ml-px z-10 p-1 bg-terminal-bg border border-terminal-green/20 rounded-r text-terminal-green/40 hover:text-terminal-green transition-colors"
          >
            {isSidebarOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        )}

        {/* Announcements */}
        {!isTutorMode && announcements.length > 0 && (
          <div className="px-4 py-2 bg-terminal-green/5 border-b border-terminal-green/10 space-y-2">
            {announcements.map(ann => (
              <div key={ann.id} className="flex items-start gap-2 text-[10px] text-terminal-green/80 animate-pulse">
                <Megaphone className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <p>
                  <span className="font-bold uppercase">[BROADCAST]:</span> {ann.text}
                </p>
              </div>
            ))}
          </div>
        )}

        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth"
        >
          <div className="border-b border-terminal-green/10 pb-4 mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-terminal-green uppercase tracking-widest">
                {isTutorMode ? 'AI TUTOR TERMINAL' : `Branch: ${branch.name}`}
              </h2>
              <p className="text-[10px] text-terminal-text/40 mt-1 uppercase tracking-tighter">
                {isTutorMode ? 
                  `Session ID: ${tutorSessionId?.slice(-8) || 'NONE'}` : 
                  (branch.description || 'Welcome to this learning branch.')}
              </p>
            </div>
            {isTutorMode && (
               <div className="text-[10px] text-terminal-green/40 italic">
                 Security Context: Active
               </div>
            )}
          </div>

          <AnimatePresence initial={false}>
            {messages.length === 0 ? (
               <div className="flex flex-col items-center justify-center p-12 text-terminal-green/10 gap-4 opacity-50">
                 <BrainCircuit className="w-12 h-12" />
                 <p className="uppercase tracking-[0.3em] text-xs">Awaiting Neural Inputs...</p>
               </div>
            ) : messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="group"
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-1 p-1.5 rounded border ${
                    msg.senderRole === 'sudo' ? 'bg-terminal-green/10 border-terminal-green/20 text-terminal-green' : 'bg-white/5 border-white/10 text-terminal-text/60'
                  }`}>
                    {msg.senderUid === 'ai-root' ? <Bot className="w-4 h-4" /> : 
                     msg.senderRole === 'sudo' ? <ShieldCheck className="w-4 h-4" /> : 
                     <User className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold uppercase tracking-wider ${
                        msg.senderRole === 'sudo' ? 'text-terminal-green' : 'text-terminal-text/80'
                      }`}>
                        {msg.senderName}
                      </span>
                      <span className="text-[10px] text-terminal-text/20">
                        {msg.timestamp ? format(msg.timestamp.toDate(), 'HH:mm:ss') : '...'}
                      </span>
                    </div>
                    <div className="markdown-body text-sm text-terminal-text/90 leading-relaxed">
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isAiThinking && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 text-terminal-green/40 text-[10px] italic uppercase tracking-widest"
            >
              <div className="flex gap-1">
                <span className="w-1 h-3 bg-terminal-green/20 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-3 bg-terminal-green/20 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-3 bg-terminal-green/20 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span>ROOT is processing command...</span>
            </motion.div>
          )}
        </div>

        <div className="p-4 bg-black/40 border-t border-terminal-green/10">
          <form onSubmit={sendMessage} className="flex items-center gap-2 max-w-4xl mx-auto w-full">
            <div className="flex-1 relative">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={isTutorMode ? "Submit query to ROOT..." : `Message ${branch.name}... (@root to ping AI)`}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-terminal-green/40 focus:bg-terminal-green/5 transition-all"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <span className="text-[9px] text-terminal-green/20 font-mono hidden md:block">ENTR</span>
              </div>
            </div>
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-2.5 bg-terminal-green text-terminal-bg rounded-lg hover:bg-terminal-green/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-terminal-green/10"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

interface SessionItemProps {
  session: AiTutoringSession;
  active: boolean;
  onSelect: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}

function SessionItem({ session, active, onSelect, onPin, onDelete, onRename }: SessionItemProps) {
  return (
    <div 
      className={`group relative flex items-center gap-2 px-2 py-2 rounded text-xs transition-colors cursor-pointer ${
        active ? 'bg-terminal-green/10 text-terminal-green' : 'text-terminal-text/60 hover:text-terminal-green hover:bg-terminal-green/5'
      }`}
      onClick={() => onSelect(session.id)}
    >
      <MessageSquare className="w-3 h-3 flex-shrink-0" />
      <span className="flex-1 truncate pr-8" onDoubleClick={() => onRename(session.id, session.title || '')}>
        {session.title || 'Untitled Session'}
      </span>
      <div className="absolute right-1 flex items-center opacity-0 group-hover:opacity-100 transition-opacity bg-inherit">
        <button 
          onClick={(e) => { e.stopPropagation(); onRename(session.id, session.title || ''); }}
          className="p-1 hover:bg-white/10 rounded text-terminal-green/30 hover:text-terminal-green"
          title="Rename"
        >
          <Edit2 className="w-2.5 h-2.5" />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onPin(session.id, session.isPinned || false); }}
          className={`p-1 hover:bg-white/10 rounded ${session.isPinned ? 'text-terminal-green' : 'text-terminal-green/30'}`}
          title={session.isPinned ? "Unpin" : "Pin"}
        >
          <Pin className="w-2.5 h-2.5" />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
          className="p-1 hover:bg-red-500/20 text-red-500/30 hover:text-red-500 rounded"
        >
           <Trash2 className="w-2.5 h-2.5" />
        </button>
      </div>
    </div>
  );
}

