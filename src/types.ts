import { Timestamp } from 'firebase/firestore';

export type UserRole = 'user' | 'sudo';

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  lastSeen: Timestamp;
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
