import { useState, useEffect, useRef } from 'react';
import { UserProfile, Branch } from '../types';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import Chat from './Chat';
import { Terminal as TerminalIcon, Hash, Users, Settings, LogOut, ChevronRight, Command } from 'lucide-react';
import { motion } from 'motion/react';

interface TerminalProps {
  profile: UserProfile | null;
}

export default function Terminal({ profile }: TerminalProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranch, setActiveBranch] = useState<Branch | null>(null);
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'branches'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const branchList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch));
      setBranches(branchList);
      if (branchList.length > 0 && !activeBranch) {
        setActiveBranch(branchList[0]);
      }
    });

    return () => unsubscribe();
  }, [activeBranch]);

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;

    const cmd = command.trim().toLowerCase();
    setHistory(prev => [...prev, `> ${command}`]);

    if (cmd.startsWith('checkout ')) {
      const branchName = cmd.split(' ')[1];
      const found = branches.find(b => b.name.toLowerCase() === branchName);
      if (found) {
        setActiveBranch(found);
        setHistory(prev => [...prev, `Switched to branch '${found.name}'`]);
      } else {
        setHistory(prev => [...prev, `error: branch '${branchName}' not found`]);
      }
    } else if (cmd === 'ls' || cmd === 'branches') {
      setHistory(prev => [...prev, 'Available branches:', ...branches.map(b => `  * ${b.name}`)]);
    } else if (cmd === 'help') {
      setHistory(prev => [...prev, 
        'Available commands:',
        '  ls / branches - List all learning branches',
        '  checkout <branch> - Switch to a specific branch',
        '  clear - Clear terminal history',
        '  whoami - Show current user info',
        '  sudo <cmd> - Execute with root privileges (sudo only)',
        '  logout - Terminate session'
      ]);
    } else if (cmd === 'clear') {
      setHistory([]);
    } else if (cmd === 'whoami') {
      setHistory(prev => [...prev, 
        `User: ${profile?.displayName}`,
        `Role: ${profile?.role}`,
        `UID: ${profile?.uid}`
      ]);
    } else if (cmd === 'logout') {
      auth.signOut();
    } else if (cmd.startsWith('sudo ') && profile?.role !== 'sudo') {
      setHistory(prev => [...prev, `error: ${profile?.displayName} is not in the sudoers file. This incident will be reported.`]);
    } else {
      setHistory(prev => [...prev, `command not found: ${cmd}. Type 'help' for assistance.`]);
    }

    setCommand('');
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 border-r border-terminal-green/20 bg-black/20 flex flex-col">
        <div className="p-4 border-b border-terminal-green/20 flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-terminal-green" />
          <span className="text-xs font-bold uppercase tracking-widest text-terminal-green">SWAL-OS v1.0</span>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-terminal-green/40 px-2 mb-2">Branches</p>
            <div className="space-y-1">
              {branches.map(branch => (
                <button
                  key={branch.id}
                  onClick={() => setActiveBranch(branch)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                    activeBranch?.id === branch.id 
                      ? 'bg-terminal-green/10 text-terminal-green' 
                      : 'text-terminal-text/60 hover:text-terminal-green hover:bg-terminal-green/5'
                  }`}
                >
                  <Hash className="w-3 h-3" />
                  <span className="truncate">{branch.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-terminal-green/40 px-2 mb-2">System</p>
            <div className="space-y-1 text-sm text-terminal-text/60 px-2">
              <div className="flex items-center gap-2 py-1">
                <Users className="w-3 h-3" />
                <span>Online: {Math.floor(Math.random() * 10) + 1}</span>
              </div>
              <div className="flex items-center gap-2 py-1">
                <Command className="w-3 h-3" />
                <span>Latency: 24ms</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-terminal-green/20 bg-black/40">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded bg-terminal-green/20 flex items-center justify-center text-terminal-green font-bold text-xs">
              {profile?.displayName[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate text-terminal-green">{profile?.displayName}</p>
              <p className="text-[10px] uppercase text-terminal-green/40 tracking-tighter">{profile?.role}</p>
            </div>
          </div>
          <button 
            onClick={() => auth.signOut()}
            className="w-full flex items-center justify-center gap-2 py-1.5 text-[10px] uppercase tracking-widest border border-terminal-green/20 rounded hover:bg-terminal-green/10 transition-colors"
          >
            <LogOut className="w-3 h-3" />
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-terminal-bg relative">
        {/* Header */}
        <div className="h-12 border-b border-terminal-green/20 flex items-center justify-between px-4 bg-black/20">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-terminal-green/40">path:</span>
            <span className="text-terminal-green">/branches/{activeBranch?.name}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-terminal-green animate-pulse" />
              <span className="text-[10px] uppercase text-terminal-green tracking-widest">Live</span>
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeBranch ? (
            <Chat branch={activeBranch} profile={profile} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-terminal-green/20">
              <p className="uppercase tracking-[0.5em]">No Branch Selected</p>
            </div>
          )}
        </div>

        {/* Terminal Input Overlay (Optional or integrated) */}
        <div className="p-4 bg-black/40 border-t border-terminal-green/20">
          <form onSubmit={handleCommand} className="flex items-center gap-2 group">
            <span className="text-terminal-green font-bold">{profile?.role === 'sudo' ? '#' : '$'}</span>
            <input
              ref={inputRef}
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="Type 'help' for commands..."
              className="flex-1 bg-transparent border-none outline-none text-terminal-green placeholder:text-terminal-green/20 font-mono"
              autoFocus
            />
            <ChevronRight className="w-4 h-4 text-terminal-green/40 group-focus-within:text-terminal-green transition-colors" />
          </form>
          
          {/* Command History Tooltip/Overlay */}
          {history.length > 0 && (
            <div className="mt-2 text-[10px] text-terminal-green/40 max-h-20 overflow-y-auto scrollbar-hide">
              {history.slice(-3).map((h, i) => (
                <div key={i}>{h}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
