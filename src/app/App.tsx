import { useState, useEffect } from 'react';
import { LeftSidebar, Notebook } from './components/LeftSidebar';
import { MiddlePanel } from './components/MiddlePanel';
import { EditorPanel } from './components/EditorPanel';
import { Note, NoteTemplate } from './components/types';

declare global {
  interface Window {
    electronAPI?: { platform: string };
  }
}

export default function App() {
  const [isElectron, setIsElectron] = useState(false);
  const [middlePanelOpen, setMiddlePanelOpen] = useState(true);

  // Apply dark mode on mount; detect Electron for title-bar safe area
  useEffect(() => {
    document.documentElement.classList.add('dark');
    setIsElectron(!!window.electronAPI);
  }, []);

  const [notebooks, setNotebooks] = useState<Notebook[]>(() => {
    try {
      const saved = localStorage.getItem('noted-plus-notebooks');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch {
      // ignore corrupted localStorage
    }
    return [
      { id: '1', name: 'THINGS THAT NEEDS FIX' },
      { id: '2', name: 'TAPASHYAS STUFF' },
      { id: '3', name: 'AAHANS MEAL PLAN' },
      { id: '4', name: 'BACKUP PLAN' },
      { id: '5', name: 'SHOPPING LIST' },
      { id: '6', name: 'OOO' },
      { id: '7', name: 'WORK RELATED' },
      { id: '8', name: 'FAFSA' },
      { id: '9', name: 'BABY NAMES :' },
      { id: '10', name: 'CALORIE INTAKE' },
      { id: '11', name: 'INTERVIEW PREPARATION' },
      { id: '12', name: 'BUYING THE JEEP' }
    ];
  });

  const [notes, setNotes] = useState<Note[]>(() => {
    try {
      const saved = localStorage.getItem('noted-plus-notes');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed)) return [];
        return parsed.map((note: any) => ({
          ...note,
          starred: Boolean(note.starred),
          tags: Array.isArray(note.tags) ? note.tags : [],
          reminderAt: typeof note.reminderAt === 'string' ? note.reminderAt : undefined,
          deletedAt: typeof note.deletedAt === 'string' ? note.deletedAt : undefined,
          attachments: Array.isArray(note.attachments) ? note.attachments : [],
          createdAt: new Date(note.createdAt),
          updatedAt: new Date(note.updatedAt)
        }));
      }
    } catch {
      // ignore corrupted localStorage
    }
    return [
      {
        id: '1',
        title: 'Lets get this straight',
        content: '<p>But</p>',
        notebookId: '1',
        starred: false,
        tags: [],
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        id: '2',
        title: 'when i get a AI respons...',
        content: '<p>also when i share this in safari and...</p>',
        notebookId: '1',
        starred: false,
        tags: [],
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      },
      {
        id: '3',
        title: 'TOYOTA RAV 4 OR SIMI...',
        content: '<p>FORD EDGE OR SIMILAR - 309</p>',
        notebookId: '1',
        starred: false,
        tags: [],
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
      },
      {
        id: '4',
        title: 'Just Random Thoughts...',
        content: '<p>Been really stressed about this hou...</p>',
        notebookId: '1',
        starred: false,
        tags: [],
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      },
      {
        id: '5',
        title: 'SHIT THAT NEEDS FIXI...',
        content: '<p>HEALTH :</p>',
        notebookId: '1',
        starred: false,
        tags: [],
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      }
    ];
  });

  const [currentNotebookId, setCurrentNotebookId] = useState<string | null>(
    notebooks.length > 0 ? notebooks[0].id : null
  );
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(
    notes.length > 0 ? notes[0].id : null
  );
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showStarred, setShowStarred] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [newNotebookModalOpen, setNewNotebookModalOpen] = useState(false);
  const [newNotebookName, setNewNotebookName] = useState('');

  const [templates, setTemplates] = useState<NoteTemplate[]>(() => {
    try {
      const s = localStorage.getItem('inked-plus-templates');
      if (s) {
        const p = JSON.parse(s);
        return Array.isArray(p) ? p : [];
      }
    } catch { }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('noted-plus-notebooks', JSON.stringify(notebooks));
  }, [notebooks]);

  useEffect(() => {
    localStorage.setItem('noted-plus-notes', JSON.stringify(notes));
  }, [notes]);

  // Check due reminders and show browser notifications
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      notes.forEach(n => {
        if (!n.reminderAt) return;
        const at = new Date(n.reminderAt).getTime();
        if (at <= now) {
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(n.title || 'Note reminder', { body: 'Reminder for this note', tag: n.id });
            } catch (_) {}
          }
          setNotes(prev => prev.map(note => note.id === n.id ? { ...note, reminderAt: undefined, updatedAt: new Date() } : note));
        }
      });
    };
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    const id = setInterval(tick, 15000);
    tick();
    return () => clearInterval(id);
  }, [notes]);

  useEffect(() => {
    localStorage.setItem('inked-plus-templates', JSON.stringify(templates));
  }, [templates]);

  const activeNotes = notes.filter(n => !n.deletedAt);
  const trashedNotes = notes.filter(n => n.deletedAt);
  const currentNotebookNotes = activeNotes.filter(n => n.notebookId === currentNotebookId);
  const displayedNotes = showTrash
    ? trashedNotes
    : showStarred
      ? activeNotes.filter(n => n.starred)
      : selectedTag
        ? activeNotes.filter(n => n.tags?.includes(selectedTag))
        : currentNotebookNotes;
  const currentNote = notes.find(note => note.id === currentNoteId);

  const allTags = Array.from(new Set(notes.flatMap(n => n.tags || []))).sort();

  const handleCreateNotebook = () => {
    setNewNotebookName('');
    setNewNotebookModalOpen(true);
  };

  const confirmCreateNotebook = () => {
    const name = newNotebookName.trim();
    if (name) {
      const newNotebook: Notebook = {
        id: Date.now().toString(),
        name: name.toUpperCase()
      };
      setNotebooks(prev => [...prev, newNotebook]);
      setCurrentNotebookId(newNotebook.id);
      setNewNotebookModalOpen(false);
      setNewNotebookName('');
    }
  };

  const handleCreateNote = (template?: NoteTemplate) => {
    if (!currentNotebookId && !showTrash) return;
    const newNote: Note = {
      id: Date.now().toString(),
      title: template?.title ?? 'Untitled',
      content: template?.content ?? '<p></p>',
      notebookId: currentNotebookId!,
      starred: false,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    setNotes(prev => [newNote, ...prev]);
    setCurrentNoteId(newNote.id);
    setTimeout(() => {
      document.querySelector('[data-scroll="notes-list"]')?.scrollTo({ top: 0, behavior: 'smooth' });
    }, 50);
  };

  const handleSaveAsTemplate = (name: string, title: string, content: string) => {
    const t: NoteTemplate = {
      id: Date.now().toString(),
      name: name.trim() || 'Untitled template',
      title: title || 'Untitled',
      content: content || '<p></p>'
    };
    setTemplates(prev => [...prev, t]);
  };

  const handleNoteTagsChange = (noteId: string, tags: string[]) => {
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, tags, updatedAt: new Date() } : n));
  };

  /** Batched update for title+content+tags to avoid race conditions when EditorPanel syncs all at once */
  const handleNoteBatchUpdate = (noteId: string, updates: { title?: string; content?: string; tags?: string[] }) => {
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, ...updates, updatedAt: new Date() } : n));
  };

  const handleReminderChange = (noteId: string, reminderAt: string | null) => {
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, reminderAt: reminderAt ?? undefined, updatedAt: new Date() } : n));
  };

  const handleContentChange = (content: string) => {
    if (!currentNoteId) return;
    setNotes(prev => prev.map(note => 
      note.id === currentNoteId 
        ? { ...note, content, updatedAt: new Date() } 
        : note
    ));
  };

  const handleTitleChange = (title: string) => {
    if (!currentNoteId) return;
    setNotes(prev => prev.map(note => 
      note.id === currentNoteId 
        ? { ...note, title, updatedAt: new Date() } 
        : note
    ));
  };

  const handleDeleteNote = (noteId: string) => {
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, deletedAt: new Date().toISOString(), updatedAt: new Date() } : n));
    if (noteId === currentNoteId) {
      const next = displayedNotes.find(n => n.id !== noteId) ?? displayedNotes[0];
      setCurrentNoteId(next?.id ?? null);
    }
  };

  const handlePermanentDelete = (noteId: string) => {
    setNotes(prev => prev.filter(n => n.id !== noteId));
    if (noteId === currentNoteId) {
      const next = trashedNotes.find(n => n.id !== noteId) ?? trashedNotes[0];
      setCurrentNoteId(next?.id ?? null);
    }
  };

  const handleRestoreNote = (noteId: string) => {
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, deletedAt: undefined, updatedAt: new Date() } : n));
    setShowTrash(false);
    const restored = notes.find(n => n.id === noteId);
    if (restored) setCurrentNoteId(restored.id);
  };

  const handleStarChange = (noteId: string, starred: boolean) => {
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, starred, updatedAt: new Date() } : n));
  };

  const handleAttachmentsChange = (noteId: string, attachments: { name: string; data: string }[]) => {
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, attachments, updatedAt: new Date() } : n));
  };

  const handleDeleteNotebook = (notebookId: string) => {
    // Delete all notes in the notebook
    setNotes(prev => prev.filter(n => n.notebookId !== notebookId));
    
    // Delete the notebook
    setNotebooks(prev => {
      const filtered = prev.filter(nb => nb.id !== notebookId);
      // If we deleted the current notebook, select the first available one
      if (notebookId === currentNotebookId && filtered.length > 0) {
        setCurrentNotebookId(filtered[0].id);
      } else if (filtered.length === 0) {
        setCurrentNotebookId(null);
      }
      return filtered;
    });
    
    setCurrentNoteId(null);
  };

  return (
    <div className={`size-full flex flex-col bg-black overflow-hidden ${isElectron ? 'pt-[40px]' : ''}`}>
      <div className="flex-1 flex min-h-0 overflow-hidden">
      {/* New Notebook modal */}
      {newNotebookModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200" role="dialog" aria-modal="true">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full mx-4 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold text-zinc-100 mb-3">New Notebook</h3>
            <input
              id="new-notebook-name"
              name="new-notebook-name"
              type="text"
              value={newNotebookName}
              onChange={e => setNewNotebookName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') confirmCreateNotebook(); if (e.key === 'Escape') setNewNotebookModalOpen(false); }}
              placeholder="Notebook name"
              autoFocus
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-500 outline-none focus:ring-1 focus:ring-zinc-600 mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setNewNotebookModalOpen(false)} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-colors">Cancel</button>
              <button onClick={confirmCreateNotebook} disabled={!newNotebookName.trim()} className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-lg transition-colors disabled:opacity-50 disabled:pointer-events-none">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Left Sidebar - Collapses at lg breakpoint (1024px) */}
      <div className="hidden lg:block w-0 lg:w-[200px] overflow-hidden shrink-0 transition-[width] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]">
        <LeftSidebar
          notebooks={notebooks}
          currentNotebookId={currentNotebookId}
          selectedTag={selectedTag}
          showStarred={showStarred}
          showTrash={showTrash}
          allTags={allTags}
          onSelectNotebook={(id) => { setCurrentNotebookId(id); setSelectedTag(null); }}
          onSelectTag={setSelectedTag}
          onShowStarred={setShowStarred}
          onShowTrash={setShowTrash}
          onCreateNotebook={handleCreateNotebook}
          onDeleteNotebook={handleDeleteNotebook}
        />
      </div>

      {/* Middle Panel - Collapses at lg (1024px) or when toggled (Electron) */}
      <div className={`overflow-hidden shrink-0 transition-[width] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${middlePanelOpen ? 'hidden lg:block w-0 lg:w-[320px] xl:w-[380px]' : 'hidden w-0'}`}>
        <MiddlePanel
          notes={displayedNotes}
          currentNoteId={currentNoteId}
          selectedTag={selectedTag}
          showTrash={showTrash}
          showStarred={showStarred}
          onSelectNote={setCurrentNoteId}
          onCreateNote={() => handleCreateNote()}
          onDeleteNote={handleDeleteNote}
          onRestoreNote={handleRestoreNote}
          onPermanentDelete={handlePermanentDelete}
          notebookName={showTrash ? 'Trash' : showStarred ? 'Starred' : selectedTag ? `Tag: ${selectedTag}` : notebooks.find(nb => nb.id === currentNotebookId)?.name}
          canCreateNote={!!currentNotebookId && !selectedTag && !showTrash}
        />
      </div>
      
      {/* Editor Panel - Always visible, takes remaining space */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0 transition-[flex,min-width] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]">
        <EditorPanel
          note={currentNote || null}
          templates={templates}
          isElectron={isElectron}
          middlePanelOpen={middlePanelOpen}
          onToggleMiddlePanel={() => setMiddlePanelOpen(v => !v)}
          onContentChange={handleContentChange}
          onTitleChange={handleTitleChange}
          onNoteTagsChange={handleNoteTagsChange}
          onNoteBatchUpdate={handleNoteBatchUpdate}
          onReminderChange={handleReminderChange}
          onStarChange={handleStarChange}
          onAttachmentsChange={handleAttachmentsChange}
          onSaveAsTemplate={handleSaveAsTemplate}
          onCreateFromTemplate={handleCreateNote}
        />
      </div>
      </div>
    </div>
  );
}