import { useState, useEffect, useRef } from 'react';
import { Branch, Message, UserProfile } from '../types';
import { collection, onSnapshot, query, orderBy, limit, addDoc, serverTimestamp, doc, setDoc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import { Send, Bot, User, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from '@google/genai';

interface ChatProps {
  branch: Branch;
  profile: UserProfile | null;
  isTutorMode?: boolean;
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function Chat({ branch, profile, isTutorMode = false }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [tutorSessionId, setTutorSessionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isTutorMode && profile) {
      // Initialize or fetch tutor session
      const sessionId = `${profile.uid}_${branch.id}_tutor`;
      setTutorSessionId(sessionId);
      
      const unsubscribe = onSnapshot(doc(db, 'aiTutoringSessions', sessionId), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const msgs = (data.messages || []).map((m: any, i: number) => ({
            id: `tutor_${i}`,
            text: m.text,
            senderUid: m.role === 'user' ? profile.uid : 'ai-root',
            senderName: m.role === 'user' ? profile.displayName : 'ROOT',
            senderRole: m.role === 'user' ? profile.role : 'sudo',
            timestamp: Timestamp.fromMillis(m.timestamp),
            branchId: branch.id
          } as Message));
          setMessages(msgs);
        } else {
          setDoc(doc(db, 'aiTutoringSessions', sessionId), {
            uid: profile.uid,
            branchId: branch.id,
            topic: branch.name,
            messages: [{
              role: 'model',
              text: `Hello ${profile.displayName}! I am ROOT, your dedicated tutor for the **${branch.name}** branch. How can I help you master this topic today?`,
              timestamp: Date.now()
            }],
            createdAt: serverTimestamp()
          });
        }
      });
      return () => unsubscribe();
    } else {
      const q = query(
        collection(db, 'branches', branch.id, 'messages'),
        orderBy('timestamp', 'asc'),
        limit(100)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
        setMessages(msgs);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `branches/${branch.id}/messages`);
      });

      return () => unsubscribe();
    }
  }, [branch.id, isTutorMode, profile]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
        handleAiTutorResponse(text);
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
          handleAiResponse(text);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `branches/${branch.id}/messages`);
      }
    }
  };

  const handleAiTutorResponse = async (userPrompt: string) => {
    if (!tutorSessionId) return;
    setIsAiThinking(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: userPrompt,
        config: {
          systemInstruction: `You are 'ROOT', a dedicated 1-on-1 tutor. 
          Topic: ${branch.name}. 
          Goal: Provide personalized explanations, code examples, and small exercises. 
          Be encouraging but technical. Use markdown.`
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

  const handleAiResponse = async (userPrompt: string) => {
    setIsAiThinking(true);
    try {
      const prompt = userPrompt.replace(/^@(root|ai)\s*/i, '');
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          systemInstruction: `You are 'ROOT', the lead technical instructor at The SWAL Terminal. 
          Your tone is professional, technical, and slightly cyber-punk/terminal-esque. 
          You provide high-level educational guidance on React, Python, and Design. 
          Use markdown for code snippets. Keep responses concise and impactful.
          Current Branch Context: ${branch.name} - ${branch.description || 'General learning'}`
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
    <div className="flex-1 flex flex-col overflow-hidden">
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth"
      >
        <div className="border-b border-terminal-green/10 pb-4 mb-8">
          <h2 className="text-xl font-bold text-terminal-green uppercase tracking-widest">
            Branch: {branch.name}
          </h2>
          <p className="text-xs text-terminal-text/40 mt-1">
            {branch.description || 'Welcome to this learning branch. Type @root to ask the instructor.'}
          </p>
        </div>

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="group"
            >
              <div className="flex items-start gap-3">
                <div className={`mt-1 p-1.5 rounded ${
                  msg.senderRole === 'sudo' ? 'bg-terminal-green/20 text-terminal-green' : 'bg-white/5 text-terminal-text/60'
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
                  <div className="markdown-body text-sm text-terminal-text/90">
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
            className="flex items-center gap-2 text-terminal-green/40 text-xs italic"
          >
            <Bot className="w-3 h-3 animate-pulse" />
            <span>ROOT is processing command...</span>
          </motion.div>
        )}
      </div>

      <div className="p-4 bg-black/20">
        <form onSubmit={sendMessage} className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Message ${branch.name}... (Type @root to ask AI)`}
            className="flex-1 bg-white/5 border border-white/10 rounded px-4 py-2 text-sm focus:outline-none focus:border-terminal-green/50 transition-colors"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2 bg-terminal-green text-terminal-bg rounded hover:bg-terminal-green/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
