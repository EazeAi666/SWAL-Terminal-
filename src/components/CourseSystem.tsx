import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, getDoc, setDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Course, Module, Quiz, UserProgress, UserProfile } from '../types';
import { BookOpen, CheckCircle, Lock, Play, Github, Award } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface CourseSystemProps {
  profile: UserProfile | null;
}

export default function CourseSystem({ profile }: CourseSystemProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [activeModule, setActiveModule] = useState<Module | null>(null);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [quizResult, setQuizResult] = useState<{ score: number; passed: boolean } | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'courses'), orderBy('order'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const courseList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
      setCourses(courseList);
      if (courseList.length > 0 && !activeCourse) {
        setActiveCourse(courseList[0]);
      }
    });
    return () => unsubscribe();
  }, [activeCourse]);

  useEffect(() => {
    if (activeCourse) {
      const q = query(collection(db, 'courses', activeCourse.id, 'modules'), orderBy('order'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const moduleList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Module));
        setModules(moduleList);
      });
      return () => unsubscribe();
    }
  }, [activeCourse]);

  useEffect(() => {
    if (profile && activeCourse) {
      const progressId = `${profile.uid}_${activeCourse.id}`;
      const unsubscribe = onSnapshot(doc(db, 'userProgress', progressId), (docSnap) => {
        if (docSnap.exists()) {
          setProgress(docSnap.data() as UserProgress);
        } else {
          const initialProgress: UserProgress = {
            uid: profile.uid,
            courseId: activeCourse.id,
            completedModules: [],
            quizScores: {},
            currentModuleId: ''
          };
          setDoc(doc(db, 'userProgress', progressId), initialProgress);
        }
      });
      return () => unsubscribe();
    }
  }, [profile, activeCourse]);

  useEffect(() => {
    if (activeModule) {
      const fetchQuiz = async () => {
        const q = query(collection(db, 'quizzes'));
        // In a real app, we'd query by moduleId, but for now we'll find it in the list
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const found = snapshot.docs.find(d => d.data().moduleId === activeModule.id);
          if (found) {
            setQuiz({ id: found.id, ...found.data() } as Quiz);
            setQuizAnswers(new Array(found.data().questions.length).fill(-1));
            setQuizResult(null);
          } else {
            setQuiz(null);
          }
        });
        return unsubscribe;
      };
      fetchQuiz();
    }
  }, [activeModule]);

  const isModuleUnlocked = (module: Module) => {
    if (module.order === 1) return true;
    const prevModule = modules.find(m => m.order === module.order - 1);
    // Ensure the previous module is completed with a score >= 70 (which is already enforced in handleQuizSubmit)
    return prevModule ? progress?.completedModules.includes(prevModule.id) : false;
  };

  const getModuleStatus = (module: Module) => {
    const unlocked = isModuleUnlocked(module);
    const completed = progress?.completedModules.includes(module.id);
    const score = progress?.quizScores[module.id];
    
    return { unlocked, completed, score };
  };

  const handleQuizSubmit = async () => {
    if (!quiz || !profile || !activeCourse || !activeModule) return;

    let correctCount = 0;
    quiz.questions.forEach((q, i) => {
      if (quizAnswers[i] === q.correctAnswer) correctCount++;
    });

    const score = Math.round((correctCount / quiz.questions.length) * 100);
    const passed = score >= 70;

    setQuizResult({ score, passed });

    if (passed) {
      const progressId = `${profile.uid}_${activeCourse.id}`;
      const currentCompleted = progress?.completedModules || [];
      const newCompletedModules = Array.from(new Set([...currentCompleted, activeModule.id]));

      const allModuleIds = modules.map(m => m.id);
      const isCourseComplete = allModuleIds.every(id => newCompletedModules.includes(id));

      const updateData: any = {
        completedModules: newCompletedModules,
        [`quizScores.${activeModule.id}`]: score,
        lastUpdated: serverTimestamp()
      };

      if (isCourseComplete && !progress?.certificateIssued) {
        updateData.certificateIssued = true;
        updateData.certificateDate = serverTimestamp();
      }

      await updateDoc(doc(db, 'userProgress', progressId), updateData);
    }
  };

  return (
    <div className="flex h-full overflow-hidden bg-terminal-bg">
      {/* Course Sidebar */}
      <div className="w-72 border-r border-terminal-green/20 flex flex-col bg-black/20">
        <div className="p-4 border-b border-terminal-green/20">
          <h2 className="text-sm font-bold text-terminal-green uppercase tracking-widest flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Curriculum
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-6">
          {courses.map(course => (
            <div key={course.id} className="space-y-2">
              <button
                onClick={() => setActiveCourse(course)}
                className={`w-full text-left px-3 py-2 rounded text-xs font-bold uppercase tracking-wider transition-colors ${
                  activeCourse?.id === course.id ? 'text-terminal-green bg-terminal-green/10' : 'text-terminal-text/40 hover:text-terminal-green'
                }`}
              >
                {course.title}
              </button>
              
              {activeCourse?.id === course.id && (
                <div className="ml-2 space-y-1 border-l border-terminal-green/10 pl-2">
                  {modules.map(m => {
                    const { unlocked, completed, score } = getModuleStatus(m);
                    return (
                      <button
                        key={m.id}
                        disabled={!unlocked}
                        onClick={() => setActiveModule(m)}
                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-[11px] group transition-all ${
                          activeModule?.id === m.id 
                            ? 'bg-terminal-green/20 text-terminal-green' 
                            : unlocked ? 'text-terminal-text/60 hover:text-terminal-green hover:bg-terminal-green/5' : 'text-terminal-text/20 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {completed ? <CheckCircle className="w-3 h-3 text-terminal-green" /> : unlocked ? <Play className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                          <span className="truncate">{m.title}</span>
                        </div>
                        {score !== undefined && (
                          <span className={`text-[9px] font-bold px-1 rounded ${score >= 70 ? 'text-terminal-green bg-terminal-green/10' : 'text-red-500 bg-red-500/10'}`}>
                            {score}%
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-8">
        {activeModule ? (
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-terminal-green uppercase tracking-tighter">{activeModule.title}</h1>
                {activeModule.githubLink && (
                  <a 
                    href={activeModule.githubLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-terminal-blue hover:underline"
                  >
                    <Github className="w-4 h-4" />
                    View on GitHub
                  </a>
                )}
              </div>
              <div className="h-1 w-24 bg-terminal-green/30" />
            </div>

            <div className="markdown-body text-terminal-text/90 leading-relaxed">
              <ReactMarkdown>{activeModule.content}</ReactMarkdown>
            </div>

            {/* Certificate Section */}
            {progress?.certificateIssued && (
              <div className="mt-8 p-8 border-2 border-terminal-green bg-terminal-green/5 rounded-lg text-center space-y-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-terminal-green animate-pulse" />
                <Award className="w-16 h-16 text-terminal-green mx-auto" />
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-terminal-green uppercase tracking-tighter">Certificate of Achievement</h2>
                  <p className="text-xs text-terminal-text/60 uppercase tracking-widest">This certifies that</p>
                  <p className="text-xl font-bold text-terminal-text border-b border-terminal-green/20 inline-block px-4 pb-1">{profile?.displayName}</p>
                  <p className="text-xs text-terminal-text/60 uppercase tracking-widest">has successfully completed the course</p>
                  <p className="text-lg font-bold text-terminal-green">{activeCourse?.title}</p>
                </div>
                <div className="pt-4 flex justify-between items-end text-[10px] text-terminal-green/40 uppercase tracking-widest">
                  <div>Date: {progress.certificateDate?.toDate ? progress.certificateDate.toDate().toLocaleDateString() : 'N/A'}</div>
                  <div className="text-right">SWAL Terminal Verified</div>
                </div>
              </div>
            )}

            {/* Quiz Section */}
            {quiz && (
              <div className="mt-12 p-6 border border-terminal-green/20 bg-black/40 rounded-lg space-y-6">
                <h3 className="text-lg font-bold text-terminal-green uppercase tracking-widest flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  Module Quiz
                </h3>
                
                <div className="space-y-8">
                  {quiz.questions.map((q, qIndex) => (
                    <div key={qIndex} className="space-y-4">
                      <p className="text-sm font-medium">{qIndex + 1}. {q.question}</p>
                      <div className="grid grid-cols-1 gap-2">
                        {q.options.map((opt, oIndex) => (
                          <button
                            key={oIndex}
                            onClick={() => {
                              const newAnswers = [...quizAnswers];
                              newAnswers[qIndex] = oIndex;
                              setQuizAnswers(newAnswers);
                            }}
                            className={`text-left px-4 py-2 rounded text-xs border transition-all ${
                              quizAnswers[qIndex] === oIndex 
                                ? 'border-terminal-green bg-terminal-green/10 text-terminal-green' 
                                : 'border-white/10 hover:border-terminal-green/50'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-6 border-t border-terminal-green/10 flex items-center justify-between">
                  <button
                    onClick={handleQuizSubmit}
                    disabled={quizAnswers.includes(-1)}
                    className="bg-terminal-green text-terminal-bg px-6 py-2 rounded font-bold uppercase tracking-widest text-xs hover:bg-terminal-green/90 disabled:opacity-50 transition-colors"
                  >
                    Submit Quiz
                  </button>

                  {quizResult && (
                    <div className={`text-sm font-bold uppercase tracking-widest ${quizResult.passed ? 'text-terminal-green' : 'text-red-500'}`}>
                      Result: {quizResult.score}% - {quizResult.passed ? 'PASSED' : 'FAILED (70% Required)'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-terminal-green/20 space-y-4">
            <BookOpen className="w-16 h-16 opacity-20" />
            <p className="uppercase tracking-[0.5em] text-sm">Select a module to begin learning</p>
          </div>
        )}
      </div>
    </div>
  );
}
