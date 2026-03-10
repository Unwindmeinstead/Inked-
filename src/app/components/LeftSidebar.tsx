import { useState, useEffect } from 'react';
import { Search, Plus, Folder, X, Star, Trash2 } from 'lucide-react';
import { InkedLogo } from './InkedLogo';

export interface Notebook {
  id: string;
  name: string;
}

function DeleteNotebookModal({
  isOpen,
  onClose,
  onConfirm,
  notebookName
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  notebookName: string;
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
          <h3 className="text-lg font-semibold text-zinc-100">Delete Notebook</h3>
          <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded-lg transition-colors">
            <X size={18} className="text-zinc-400" />
          </button>
        </div>
        <p className="text-zinc-400 mb-6">
          Delete &quot;<span className="text-zinc-200 font-medium">{notebookName}</span>&quot;? All notes in this notebook will be removed. This cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-all duration-200">Cancel</button>
          <button onClick={() => { onConfirm(); onClose(); }} className="px-4 py-2 bg-red-900 hover:bg-red-800 text-white rounded-lg transition-all duration-200">Delete</button>
        </div>
      </div>
    </div>
  );
}

interface LeftSidebarProps {
  notebooks: Notebook[];
  currentNotebookId: string | null;
  selectedTag: string | null;
  showStarred: boolean;
  showTrash: boolean;
  allTags: string[];
  onSelectNotebook: (id: string) => void;
  onSelectTag: (tag: string | null) => void;
  onShowStarred: (v: boolean) => void;
  onShowTrash: (v: boolean) => void;
  onCreateNotebook: () => void;
  onDeleteNotebook: (id: string) => void;
}

export function LeftSidebar({ 
  notebooks, 
  currentNotebookId, 
  selectedTag,
  showStarred,
  showTrash,
  allTags,
  onSelectNotebook,
  onSelectTag,
  onShowStarred,
  onShowTrash,
  onCreateNotebook,
  onDeleteNotebook
}: LeftSidebarProps) {
  const [activeTab, setActiveTab] = useState<'notebooks' | 'tags'>('notebooks');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [notebookToDelete, setNotebookToDelete] = useState<Notebook | null>(null);

  const filteredNotebooks = notebooks.filter(nb => 
    nb.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredTags = searchQuery
    ? allTags.filter(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
    : allTags;

  return (
    <div className="w-[200px] h-full bg-black border-r border-zinc-800/50 flex flex-col">
      {/* App Branding - min-h matches MiddlePanel search header for border alignment */}
      <div className="px-2 py-2 min-h-[52px] flex flex-col justify-center border-b border-zinc-800/50">
        <InkedLogo size="md" />
      </div>

      {/* Quick filters: Starred, Trash */}
      <div className="flex gap-1 px-2 py-1.5 border-b border-zinc-800/50">
        <button
          onClick={() => { onShowStarred(!showStarred); onShowTrash(false); if (showStarred) onSelectTag(null); }}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
            showStarred ? 'bg-amber-900/40 text-amber-400' : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'
          }`}
          title="Starred notes"
        >
          Starred
        </button>
        <button
          onClick={() => { onShowTrash(!showTrash); onShowStarred(false); if (showTrash) onSelectTag(null); }}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
            showTrash ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'
          }`}
          title="Trash"
        >
          <Trash2 size={14} />
          Trash
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800/50">
        <button
          onClick={() => { setActiveTab('notebooks'); if (showStarred || showTrash) { onShowStarred(false); onShowTrash(false); } }}
          className={`flex-1 px-3 py-2 text-sm font-medium transition-all duration-200 ${
            activeTab === 'notebooks'
              ? 'text-zinc-100 border-b-2 border-blue-500'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Notebooks
        </button>
        <button
          onClick={() => setActiveTab('tags')}
          className={`flex-1 px-3 py-2 text-sm font-medium transition-all duration-200 ${
            activeTab === 'tags'
              ? 'text-zinc-100 border-b-2 border-blue-500'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Tags
        </button>
      </div>

      {/* Search */}
      <div className="p-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            id="sidebar-search"
            name="sidebar-search"
            type="text"
            placeholder={activeTab === 'tags' ? 'Search tags...' : 'Search notebooks...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 transition-all duration-200"
          />
        </div>
      </div>

      {/* Notebooks or Tags List */}
      <div className="flex-1 overflow-y-auto px-3">
        {activeTab === 'tags' ? (
          filteredTags.length === 0 ? (
            <div className="py-6 text-center text-zinc-500 text-xs px-2">
              {allTags.length === 0 ? 'No tags yet' : 'No tags match your search'}
            </div>
          ) : (
            filteredTags.map((tag) => (
              <button
                key={tag}
                onClick={() => onSelectTag(selectedTag === tag ? null : tag)}
                className={`group w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-all duration-200 mb-1 ${
                  selectedTag === tag ? 'bg-zinc-800/80 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200'
                }`}
              >
                <span className="text-xs truncate font-medium flex-1">#{tag}</span>
              </button>
            ))
          )
        ) : filteredNotebooks.length === 0 ? (
          <div className="py-6 text-center text-zinc-500 text-xs px-2">
            {notebooks.length === 0 ? 'No notebooks yet' : 'No notebooks match your search'}
          </div>
        ) : (
          filteredNotebooks.map((notebook) => (
            <div
              key={notebook.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectNotebook(notebook.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectNotebook(notebook.id);
                }
              }}
              className={`group w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-all duration-200 mb-1 cursor-pointer ${
                currentNotebookId === notebook.id
                  ? 'bg-zinc-800/80 text-zinc-100'
                  : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200'
              }`}
            >
              <Folder size={16} className="shrink-0" />
              <span className="text-xs truncate font-medium flex-1">{notebook.name}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setNotebookToDelete(notebook);
                  setDeleteModalOpen(true);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-0.5 hover:bg-red-500/10 rounded"
                aria-label={`Delete ${notebook.name}`}
              >
                <X size={14} className="text-red-400 hover:text-red-300" />
              </button>
            </div>
          ))
        )}
      </div>

      <DeleteNotebookModal
        isOpen={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setNotebookToDelete(null); }}
        onConfirm={() => notebookToDelete && onDeleteNotebook(notebookToDelete.id)}
        notebookName={notebookToDelete?.name ?? ''}
      />

      {/* Bottom Add Button */}
      <div className="p-3 border-t border-zinc-800/50">
        <button
          onClick={onCreateNotebook}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-950/80 hover:bg-zinc-900/80 border border-zinc-800/50 hover:border-zinc-700/50 rounded-full transition-all duration-200"
        >
          <Plus size={16} className="text-white" />
          <span className="text-sm text-white font-light">New Notebook</span>
        </button>
      </div>
    </div>
  );
}