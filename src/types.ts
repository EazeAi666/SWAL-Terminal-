import { Timestamp } from 'firebase/firestore';

export type UserRole = 'user' | 'teacher' | 'sudo';

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  lastSeen: Timestamp;
  terminalId: string;
}

export interface Branch {
  id: string;
  name: string;
  description?: string;
  createdBy?: string;
  createdAt?: Timestamp;
}

export interface Message {
  id: string;
  text: string;
  senderUid: string;
  senderName: string;
  senderRole: UserRole;
  timestamp: Timestamp;
  branchId: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  order: number;
}

export interface Module {
  id: string;
  courseId: string;
  title: string;
  content: string;
  order: number;
  githubLink?: string;
}

export interface Quiz {
  id: string;
  moduleId: string;
  questions: {
    question: string;
    options: string[];
    correctAnswer: number;
  }[];
}

export interface UserProgress {
  uid: string;
  courseId: string;
  completedModules: string[];
  quizScores: Record<string, number>;
  currentModuleId: string;
}

export interface AiTutoringSession {
  id: string;
  uid: string;
  branchId: string;
  topic: string;
  messages: { role: 'user' | 'model'; text: string; timestamp: number }[];
  createdAt: Timestamp;
}

export interface Announcement {
  id: string;
  text: string;
  authorName: string;
  timestamp: Timestamp;
}

export interface DirectMessage {
  id: string;
  text: string;
  senderUid: string;
  receiverUid: string;
  timestamp: Timestamp;
}
