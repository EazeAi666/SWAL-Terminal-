import { useState, useEffect } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, signInWithGoogle } from './firebase';
import { UserProfile } from './types';
import Terminal from './components/Terminal';
import { Terminal as TerminalIcon, LogIn, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (doc) => {
        if (doc.exists()) {
          setProfile(doc.data() as UserProfile);
        }
        setLoading(false);
      });

      // Seed initial branches if none exist
      const seedBranches = async () => {
        const branchesSnap = await getDocs(collection(db, 'branches'));
        if (branchesSnap.empty) {
          const initialBranches = [
            { name: 'main', description: 'The central hub for all SWAL Terminal users.' },
            { name: 'react-hooks', description: 'Deep dive into modern React development.' },
            { name: 'python-core', description: 'Mastering the fundamentals of Python.' },
            { name: 'ui-design', description: 'Crafting polished and functional interfaces.' }
          ];

          for (const b of initialBranches) {
            await addDoc(collection(db, 'branches'), {
              ...b,
              id: b.name,
              createdAt: serverTimestamp()
            });
          }
        }
      };
      seedBranches();

      return () => unsubscribe();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-terminal-bg flex items-center justify-center text-terminal-green">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="font-mono tracking-widest uppercase">Initializing SWAL Terminal...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text font-mono selection:bg-terminal-green selection:text-terminal-bg">
      <AnimatePresence mode="wait">
        {!user ? (
          <motion.div
            key="login"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="min-h-screen flex items-center justify-center p-4"
          >
            <div className="max-w-md w-full border border-terminal-green/30 bg-black/40 p-8 rounded-lg backdrop-blur-sm shadow-[0_0_30px_rgba(0,255,65,0.1)]">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-terminal-green/10 rounded-lg">
                  <TerminalIcon className="w-8 h-8 text-terminal-green" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-terminal-green tracking-tighter uppercase">The SWAL Terminal</h1>
                  <p className="text-xs text-terminal-green/60 uppercase tracking-widest">v1.0.0-stable</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <p className="text-sm text-terminal-text/80 leading-relaxed">
                    Welcome to the premier learning hub. Authenticate to access the command center, collaborate with peers, and learn from the root.
                  </p>
                </div>

                <button
                  onClick={() => signInWithGoogle()}
                  className="w-full flex items-center justify-center gap-3 bg-terminal-green text-terminal-bg py-3 px-6 rounded font-bold uppercase tracking-wider hover:bg-terminal-green/90 transition-colors group"
                >
                  <LogIn className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  Authenticate via Google
                </button>

                <div className="pt-4 border-t border-terminal-green/10">
                  <p className="text-[10px] text-terminal-green/40 uppercase text-center tracking-[0.2em]">
                    Secure connection established via SWAL-NET
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="app"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-screen flex flex-col"
          >
            <Terminal profile={profile} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
