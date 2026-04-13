import { useState, useEffect } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, collection, getDocs, addDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, signInWithGoogle, handleFirestoreError, OperationType } from './firebase';
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
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        setLoading(false);
      });

      // Seed initial branches if none exist
      const seedBranches = async () => {
        try {
          const branchesSnap = await getDocs(collection(db, 'branches'));
          if (branchesSnap.empty) {
            const initialBranches = [
              { name: 'main', description: 'The central hub for all SWAL Terminal users.' },
              { name: 'react-hooks', description: 'Deep dive into modern React development.' },
              { name: 'python-core', description: 'Mastering the fundamentals of Python.' },
              { name: 'ui-design', description: 'Crafting polished and functional interfaces.' },
              { name: 'cybersecurity', description: 'Defending the digital frontier.' },
              { name: 'ethical-hacking', description: 'Thinking like a hacker to build better defenses.' },
              { name: 'data-science', description: 'Extracting insights from complex data.' },
              { name: 'cloud-computing', description: 'Scaling applications in the cloud.' }
            ];

            for (const b of initialBranches) {
              await addDoc(collection(db, 'branches'), {
                ...b,
                id: b.name,
                createdAt: serverTimestamp()
              });
            }
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, 'branches');
        }
      };

      const seedCourses = async () => {
        try {
          const coursesSnap = await getDocs(collection(db, 'courses'));
          if (coursesSnap.empty) {
            const initialCourses = [
              {
                id: 'web-dev-101',
                title: 'Introduction to Web Development for Beginners',
                description: 'Learn the basics of HTML, CSS, and JavaScript.',
                order: 1,
                modules: [
                  {
                    id: 'html-basics',
                    title: 'HTML Basics',
                    content: 'HTML stands for HyperText Markup Language. It is the skeleton of all web pages.',
                    order: 1,
                    githubLink: 'https://github.com/swal-learn/html-basics',
                    quiz: {
                      id: 'quiz-html',
                      questions: [
                        {
                          question: 'What does HTML stand for?',
                          options: ['HyperText Markup Language', 'High Tech Modern Language', 'Hyperlink Text Management', 'Home Tool Markup Language'],
                          correctAnswer: 0
                        }
                      ]
                    }
                  },
                  {
                    id: 'css-styling',
                    title: 'CSS Styling',
                    content: 'CSS stands for Cascading Style Sheets. It is used to style the HTML skeleton.',
                    order: 2,
                    githubLink: 'https://github.com/swal-learn/css-styling'
                  }
                ]
              },
              {
                id: 'cyber-101',
                title: 'Cybersecurity Fundamentals',
                description: 'Protecting systems, networks, and programs from digital attacks.',
                order: 2,
                modules: [
                  {
                    id: 'intro-security',
                    title: 'Introduction to Security',
                    content: 'Cybersecurity is the practice of protecting systems, networks, and programs from digital attacks.',
                    order: 1,
                    githubLink: 'https://github.com/swal-learn/cyber-intro',
                    quiz: {
                      id: 'quiz-cyber-1',
                      questions: [
                        {
                          question: 'What is the primary goal of cybersecurity?',
                          options: ['To make computers faster', 'To protect systems and data', 'To build websites', 'To fix hardware'],
                          correctAnswer: 1
                        }
                      ]
                    }
                  }
                ]
              },
              {
                id: 'hacking-101',
                title: 'Ethical Hacking & Penetration Testing',
                description: 'Learn the tools and techniques used by security professionals to find vulnerabilities.',
                order: 3,
                modules: [
                  {
                    id: 'hacking-intro',
                    title: 'The Ethical Hacking Mindset',
                    content: 'Ethical hacking involves an authorized attempt to gain unauthorized access to a computer system, application, or data.',
                    order: 1,
                    githubLink: 'https://github.com/swal-learn/ethical-hacking',
                    quiz: {
                      id: 'quiz-hacking-1',
                      questions: [
                        {
                          question: 'What is the main difference between an ethical hacker and a malicious hacker?',
                          options: ['The tools they use', 'The amount of money they make', 'Authorization and intent', 'The speed of their typing'],
                          correctAnswer: 2
                        }
                      ]
                    }
                  }
                ]
              },
              {
                id: 'ds-101',
                title: 'Python for Data Science',
                description: 'Using Python to analyze data and build predictive models.',
                order: 4,
                modules: [
                  {
                    id: 'numpy-pandas',
                    title: 'NumPy and Pandas',
                    content: 'Learn how to use NumPy for numerical computing and Pandas for data manipulation.',
                    order: 1,
                    githubLink: 'https://github.com/swal-learn/python-ds',
                    quiz: {
                      id: 'quiz-ds-1',
                      questions: [
                        {
                          question: 'Which library is primarily used for data manipulation in Python?',
                          options: ['NumPy', 'Pandas', 'Matplotlib', 'Scikit-learn'],
                          correctAnswer: 1
                        }
                      ]
                    }
                  }
                ]
              }
            ];

            for (const courseData of initialCourses) {
              const { modules, ...course } = courseData;
              await setDoc(doc(db, 'courses', course.id), course);

              if (modules) {
                for (const mData of modules) {
                  const { quiz, ...m } = mData;
                  await setDoc(doc(db, 'courses', course.id, 'modules', m.id), {
                    ...m,
                    courseId: course.id
                  });

                  if (quiz) {
                    await setDoc(doc(db, 'quizzes', quiz.id), {
                      ...quiz,
                      moduleId: m.id
                    });
                  }
                }
              }
            }
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, 'courses');
        }
      };

      seedBranches();
      seedCourses();

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
