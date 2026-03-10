import { useState, useEffect } from 'react';
import { Search, Plus, Star, Trash2, X, RotateCcw } from 'lucide-react';
import { Note } from './types';

function stripHtml(html: string): string {
  if (typeof document === 'undefined') return html.replace(/<[^>]*>/g, '');
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.innerText || div.textContent || '';
}

interface MiddlePanelProps {
  notes: Note[];
  currentNoteId: string | null;
  selectedTag: string | null;
  showTrash?: boolean;
  showStarred?: boolean;
  onSelectNote: (id: string) => void;
  onCreateNote: () => void;
  onDeleteNote: (id: string) => void;
  onRestoreNote?: (id: string) => void;
  onPermanentDelete?: (id: string) => void;
  notebookName?: string;
  canCreateNote?: boolean;
}

function DeleteModal({ 
  isOpen, 
  onClose, 
  onConfirm,
  noteTitle,
  isPermanent = false
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: () => void;
  noteTitle: string;
  isPermanent?: boolean;
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200" role="dialog" aria-modal="true">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full mx-4 animate-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-semibold text-zinc-100">{isPermanent ? 'Delete Permanently' : 'Delete Note'}</h3>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X size={18} className="text-zinc-400" />
          </button>
        </div>
        <p className="text-zinc-400 mb-6">
          {isPermanent 
            ? <>Permanently delete "<span className="text-zinc-200 font-medium">{noteTitle}</span>"? This cannot be undone.</>
            : <>Move "<span className="text-zinc-200 font-medium">{noteTitle}</span>" to Trash?</>
          }
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-all duration-200"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-2 bg-red-900 hover:bg-red-800 text-white rounded-lg transition-all duration-200"
          >
            {isPermanent ? 'Delete Permanently' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MiddlePanel({ 
  notes, 
  currentNoteId, 
  selectedTag,
  showTrash = false,
  showStarred = false,
  onSelectNote, 
  onCreateNote,
  onDeleteNote,
  onRestoreNote,
  onPermanentDelete,
  notebookName,
  canCreateNote = true
}: MiddlePanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<{ id: string; title: string } | null>(null);

  const filteredNotes = notes.filter(note => {
    const q = searchQuery.toLowerCase();
    const plainContent = stripHtml(note.content).toLowerCase();
    return note.title.toLowerCase().includes(q) || plainContent.includes(q);
  });

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
  };

  const handleDeleteClick = (e: React.MouseEvent, note: Note) => {
    e.stopPropagation();
    setNoteToDelete({ id: note.id, title: note.title });
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (noteToDelete) {
      if (showTrash && onPermanentDelete) onPermanentDelete(noteToDelete.id);
      else onDeleteNote(noteToDelete.id);
      setNoteToDelete(null);
    }
  };

  return (
    <>
      <div className="w-full h-full bg-black border-r border-zinc-800/50 flex flex-col">
        {/* Search and Add - min-h matches LeftSidebar logo header for border alignment */}
        <div className="px-3 py-2 min-h-[52px] flex flex-col justify-center border-b border-zinc-800/50">
          <div className="flex items-center gap-2 mb-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                id="search-notes"
                name="search-notes"
                type="text"
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 transition-all duration-200"
              />
            </div>
            <button
              onClick={onCreateNote}
              disabled={!canCreateNote}
              title={canCreateNote ? 'New note' : 'Select a notebook first'}
              className="p-2.5 bg-zinc-900/50 hover:bg-zinc-800 rounded-lg transition-all duration-200 shrink-0 disabled:opacity-50 disabled:pointer-events-none"
            >
              <Plus size={18} className="text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Notes List */}
        <div className="flex-1 overflow-y-auto" data-scroll="notes-list">
          {!canCreateNote && !showTrash && !selectedTag && !showStarred ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <p className="text-zinc-500 text-sm mb-1">No notebook selected</p>
              <p className="text-zinc-600 text-xs">Select or create a notebook in the sidebar</p>
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <p className="text-zinc-500 text-sm mb-2">{searchQuery ? 'No matching notes' : showTrash ? 'Trash is empty' : showStarred ? 'No starred notes' : selectedTag ? 'No notes with this tag' : 'No notes yet'}</p>
              {!searchQuery && !showTrash && (
                <button
                  onClick={onCreateNote}
                  className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
                >
                  Create first note
                </button>
              )}
            </div>
          ) : filteredNotes.map((note) => {
            // Extract first line as title, second line as preview
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = note.content;
            const textContent = tempDiv.innerText || '';
            const lines = textContent.split('\n').filter(line => line.trim());
            const previewText = lines.slice(0, 2).join(' ').substring(0, 100);
            
            return (
              <div
                key={note.id}
                onClick={() => onSelectNote(note.id)}
                className={`group relative px-4 py-4 border-b border-zinc-800/30 cursor-pointer transition-all duration-300 ${
                  currentNoteId === note.id
                    ? 'bg-gradient-to-r from-blue-500/10 to-transparent border-l-2 border-l-blue-500'
                    : 'hover:bg-zinc-900/30'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {note.starred === true && (
                      <Star size={16} className="text-amber-400 fill-amber-400 shrink-0 flex-shrink-0" title="Starred" aria-hidden={false} />
                    )}
                    <h3 className={`font-medium text-sm line-clamp-1 transition-colors ${
                      currentNoteId === note.id ? 'text-zinc-100' : 'text-zinc-300'
                    }`}>
                      {note.title || 'Untitled'}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {showTrash && onRestoreNote && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onRestoreNote(note.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-700 rounded transition-all duration-200"
                        title="Restore"
                      >
                        <RotateCcw size={14} className="text-zinc-400" />
                      </button>
                    )}
                    <button
                      onClick={(e) => handleDeleteClick(e, note)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-900/20 rounded transition-all duration-200"
                      title={showTrash ? 'Delete permanently' : 'Delete'}
                    >
                      <Trash2 size={14} className="text-red-400" />
                    </button>
                  </div>
                </div>
                {(note.tags?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {note.tags!.slice(0, 3).map((t) => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400">#{t}</span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-zinc-500 line-clamp-2 mb-2">
                  {previewText || 'No content'}
                </p>
                <span className="text-xs text-zinc-600">
                  {formatDate(note.updatedAt)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <DeleteModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        noteTitle={noteToDelete?.title || ''}
        isPermanent={showTrash}
      />
    </>
  );
}