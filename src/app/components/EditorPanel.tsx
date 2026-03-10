import { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Bold, 
  Italic, 
  Underline, 
  Strikethrough, 
  Code,
  Quote,
  List,
  ListOrdered,
  Link as LinkIcon,
  Paperclip,
  Mic,
  Sparkles,
  Video,
  MoreHorizontal,
  Bell,
  Share2,
  Hash,
  Type,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Star,
  X
} from 'lucide-react';
import { Note, NoteTemplate } from './types';
import { exportNoteAsPDF, exportNoteAsMarkdown, exportNoteAsHTML } from '../lib/export';

const SAVE_IDLE_MS = 600;
const SAVED_SHOW_MS = 1800;
const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';

function getGroqKey(): string | undefined {
  return (import.meta as any).env?.VITE_GROQ_API_KEY ?? '';
}

interface EditorPanelProps {
  note: Note | null;
  templates: NoteTemplate[];
  isElectron?: boolean;
  middlePanelOpen?: boolean;
  onToggleMiddlePanel?: () => void;
  onContentChange: (content: string) => void;
  onTitleChange: (title: string) => void;
  onNoteTagsChange?: (noteId: string, tags: string[]) => void;
  onNoteBatchUpdate?: (noteId: string, updates: { title?: string; content?: string; tags?: string[] }) => void;
  onReminderChange?: (noteId: string, reminderAt: string | null) => void;
  onStarChange?: (noteId: string, starred: boolean) => void;
  onAttachmentsChange?: (noteId: string, attachments: { name: string; data: string }[]) => void;
  onSaveAsTemplate?: (name: string, title: string, content: string) => void;
  onCreateFromTemplate?: (template: NoteTemplate) => void;
}

export function EditorPanel({ note, templates = [], isElectron, middlePanelOpen = true, onToggleMiddlePanel, onContentChange, onTitleChange, onNoteTagsChange, onNoteBatchUpdate, onReminderChange, onStarChange, onAttachmentsChange, onSaveAsTemplate, onCreateFromTemplate }: EditorPanelProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const lastNoteIdRef = useRef<string | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [showPlaceholder, setShowPlaceholder] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const recognitionRef = useRef<any>(null);
  const isRecordingRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const contentSyncRef = useRef<() => void>(() => {});
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [tagInputValue, setTagInputValue] = useState('');
  const tagInputRef = useRef<HTMLInputElement>(null);
  const interimSpanRef = useRef<HTMLSpanElement | null>(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderDraft, setReminderDraft] = useState('');
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoUrlDraft, setVideoUrlDraft] = useState('');
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrlDraft, setLinkUrlDraft] = useState('');
  const linkInputRef = useRef<HTMLInputElement>(null);
  const [editTagsOpen, setEditTagsOpen] = useState(false);
  const [editTagsValue, setEditTagsValue] = useState('');
  const editTagsInputRef = useRef<HTMLInputElement>(null);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const saveTemplateInputRef = useRef<HTMLInputElement>(null);
  const [acSuggestions, setAcSuggestions] = useState<string[]>([]);
  const [acIndex, setAcIndex] = useState(0);
  const [acPrefix, setAcPrefix] = useState('');
  const [acCaretRect, setAcCaretRect] = useState<{ top: number; left: number } | null>(null);
  const acTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const acSuggestionsRef = useRef<string[]>([]);
  const acIndexRef = useRef(0);
  const acPrefixRef = useRef('');
  const savedSelectionRef = useRef<Range | null>(null);
  acSuggestionsRef.current = acSuggestions;
  acIndexRef.current = acIndex;
  acPrefixRef.current = acPrefix;

  isRecordingRef.current = isRecording;

  /** Prevent focus steal - keeps editor selection when clicking format buttons (fixes PWA) */
  const handleFormatClick = useCallback((e: React.MouseEvent, format: string) => {
    e.preventDefault();
    e.stopPropagation();
    editorRef.current?.focus();
    handleFormat(format);
  }, []);

  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
    } else {
      savedSelectionRef.current = null;
    }
  }, []);

  const restoreSelection = useCallback(() => {
    if (!savedSelectionRef.current || !editorRef.current) return false;
    try {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(savedSelectionRef.current!);
        return true;
      }
    } catch {}
    return false;
  }, []);

  const showToast = useCallback((msg: string) => {
    if (toastRef.current) clearTimeout(toastRef.current);
    setToast(msg);
    toastRef.current = setTimeout(() => { setToast(null); toastRef.current = null; }, 2000);
  }, []);

  /** Insert speech at current cursor. Adds space between phrases. */
  const insertSpeechAtCursor = useCallback((text: string) => {
    if (!editorRef.current || !note || !text.trim()) return;
    editorRef.current.focus();
    const sel = window.getSelection();
    if (!sel) return;
    let range = sel.rangeCount ? sel.getRangeAt(0) : null;
    if (!range || !editorRef.current.contains(range.commonAncestorContainer)) {
      range = document.createRange();
      const last = editorRef.current.lastElementChild;
      if (last) {
        range.setStart(last, last.childNodes.length);
        range.collapse(true);
      } else {
        range.setStart(editorRef.current, 0);
        range.collapse(true);
      }
      sel.removeAllRanges();
      sel.addRange(range);
    }
    const needsSpace = (() => {
      try {
        const r = range.cloneRange();
        r.collapse(true);
        r.setStart(editorRef.current!, 0);
        const textBefore = r.toString();
        const last = textBefore.slice(-1);
        return last !== '' && last !== ' ' && last !== '\n';
      } catch { return false; }
    })();
    const toInsert = (needsSpace ? ' ' : '') + text.trim() + ' ';
    document.execCommand('insertText', false, toInsert);
    // Defer sync so DOM is updated before we read (fixes empty-note dictation vanishing)
    requestAnimationFrame(() => contentSyncRef.current());
  }, [note]);

  /** Show interim speech at cursor in editor (animated ghost); commit final and remove ghost. */
  const setInterimAtCursor = useCallback((interim: string) => {
    if (!editorRef.current || !interim) return;
    const sel = window.getSelection();
    if (!sel) return;
    let range = sel.rangeCount ? sel.getRangeAt(0) : null;
    if (!range || !editorRef.current.contains(range.commonAncestorContainer)) return;
    let span = interimSpanRef.current;
    if (span && span.parentNode) {
      span.textContent = interim;
      range.setStartAfter(span);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    span = document.createElement('span');
    span.setAttribute('data-interim', 'true');
    span.className = 'text-zinc-400 italic opacity-90 animate-pulse';
    span.textContent = interim;
    try {
      range.insertNode(span);
      range.setStartAfter(span);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      interimSpanRef.current = span;
    } catch (_) {}
  }, []);

  const commitFinalAndRemoveInterim = useCallback((finalText: string) => {
    if (!editorRef.current || !finalText.trim()) return;
    const span = interimSpanRef.current;
    if (span && span.parentNode) {
      const range = document.createRange();
      range.setStartBefore(span);
      range.collapse(true);
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
        const needsSpace = (() => {
          try {
            const r = range.cloneRange();
            r.collapse(true);
            r.setStart(editorRef.current!, 0);
            const textBefore = r.toString();
            return textBefore.slice(-1) !== '' && textBefore.slice(-1) !== ' ' && textBefore.slice(-1) !== '\n';
          } catch { return false; }
        })();
        const toInsert = (needsSpace ? ' ' : '') + finalText.trim() + ' ';
        document.execCommand('insertText', false, toInsert);
      }
      span.remove();
      interimSpanRef.current = null;
      requestAnimationFrame(() => contentSyncRef.current());
    } else {
      insertSpeechAtCursor(finalText);
    }
  }, [insertSpeechAtCursor]);

  // Refs for speech callbacks — effect must not depend on these or it re-runs when note updates (clearing dictated text)
  const insertSpeechRef = useRef(insertSpeechAtCursor);
  const setInterimRef = useRef(setInterimAtCursor);
  const commitFinalRef = useRef(commitFinalAndRemoveInterim);
  insertSpeechRef.current = insertSpeechAtCursor;
  setInterimRef.current = setInterimAtCursor;
  commitFinalRef.current = commitFinalAndRemoveInterim;

  const fetchGroqSuggestion = useCallback(async () => {
    const key = getGroqKey();
    if (!key) {
      showToast('Add VITE_GROQ_API_KEY to .env');
      return;
    }
    const context = editorRef.current?.innerText?.trim().slice(-1200) || note?.title || 'My note';
    setAiLoading(true);
    try {
      const res = await fetch(GROQ_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: 'system', content: 'You are a concise writing assistant. Suggest 1-2 short sentences that continue or improve the following note. Output only the suggestion, no quotes or labels.' },
            { role: 'user', content: context },
          ],
          max_tokens: 150,
          temperature: 0.7,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const suggestion = data.choices?.[0]?.message?.content?.trim();
      if (suggestion) {
        insertTextAtCursor(' ' + suggestion);
        showToast('Suggestion added');
      }
    } catch (e) {
      showToast('AI error: ' + (e instanceof Error ? e.message : 'Failed'));
    } finally {
      setAiLoading(false);
    }
  }, [note, showToast]);

  // Electron-only transcription using Whisper when Web Speech API is unavailable
  const transcribeElectronAudio = useCallback(
    async (blob: Blob) => {
      const key = (import.meta as any).env?.VITE_OPENAI_API_KEY ?? '';
      if (!key) {
        showToast('Add VITE_OPENAI_API_KEY to .env for desktop dictation');
        return;
      }
      try {
        const form = new FormData();
        form.append('file', blob, 'audio.webm');
        form.append('model', 'whisper-1');

        const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}` },
          body: form,
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        const text = (data.text || '').trim();
        if (text) {
          insertSpeechAtCursor(text);
          showToast('Transcribed');
        } else {
          showToast('No speech detected');
        }
      } catch (e) {
        showToast('Speech error: ' + (e instanceof Error ? e.message : 'Failed'));
      }
    },
    [insertSpeechAtCursor, showToast]
  );

  useEffect(() => {
    if (editorRef.current && note && note.id !== lastNoteIdRef.current) {
      const combinedContent = `<h1>${note.title || ''}</h1>${note.content || '<p><br></p>'}`;
      editorRef.current.innerHTML = combinedContent;
      lastNoteIdRef.current = note.id;
      setShowPlaceholder(!(note.title && note.title.trim().length > 0));
      setIsSaving(false);
      setShowSaved(false);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
      setAcSuggestions([]);
      setAcCaretRect(null);
      updateCounts();
      // Sync tags from content on load (in case note has #hashtags but empty note.tags)
      const text = (note.title || '') + '\n' + (note.content || '').replace(/<[^>]+>/g, ' ');
      const tagsFromContent = [...new Set((text.match(/#[\w-]+/g) || []).map(m => m.slice(1)))];
      if (tagsFromContent.length > 0 && onNoteTagsChange) {
        const merged = [...new Set([...(note.tags || []), ...tagsFromContent])];
        onNoteTagsChange(note.id, merged);
      }
    }
  }, [note?.id, onNoteTagsChange]);

  // Browser Web Speech API (non-Electron)
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition || !note || isElectron) return;
    if (isRecording) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';
      rec.onresult = (e: any) => {
        let interim = '';
        let finalText = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) {
            finalText += t;
          } else {
            interim += t;
          }
        }
        if (finalText) commitFinalRef.current(finalText);
        if (interim) setInterimRef.current(interim);
      };
      rec.onend = () => {
        if (interimSpanRef.current) {
          interimSpanRef.current.remove();
          interimSpanRef.current = null;
        }
        if (isRecordingRef.current && recognitionRef.current === rec) {
          try { rec.start(); } catch {}
        }
      };
      rec.onerror = (e: any) => {
        if (e?.error !== 'aborted' && interimSpanRef.current) {
          interimSpanRef.current.remove();
          interimSpanRef.current = null;
        }
        if (isRecordingRef.current && recognitionRef.current === rec && e?.error !== 'not-allowed') {
          try { rec.start(); } catch {}
        }
      };
      recognitionRef.current = rec;
      rec.start();
      return () => {
        try { rec.stop(); } catch {}
        recognitionRef.current = null;
        if (interimSpanRef.current) {
          interimSpanRef.current.remove();
          interimSpanRef.current = null;
        }
      };
    } else {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
        recognitionRef.current = null;
      }
      if (interimSpanRef.current) {
        interimSpanRef.current.remove();
        interimSpanRef.current = null;
      }
    }
  }, [isRecording, note?.id, isElectron]);

  // Electron dictation: record audio and send to Whisper when Web Speech API is unavailable
  useEffect(() => {
    if (!note || !isElectron) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    // If Electron ever gains native Web Speech support, defer to the browser path above
    if (SpeechRecognition) return;

    if (!isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      return;
    }

    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const rec = new MediaRecorder(stream);
        mediaRecorderRef.current = rec;
        audioChunksRef.current = [];

        rec.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        rec.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          audioChunksRef.current = [];
          if (blob.size > 0) {
            transcribeElectronAudio(blob);
          }
        };

        rec.start();
      })
      .catch((err) => {
        showToast('Mic error: ' + (err instanceof Error ? err.message : 'Failed'));
      });

    return () => {
      cancelled = true;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, [isRecording, isElectron, note?.id, transcribeElectronAudio, showToast]);

  const updateCounts = () => {
    if (editorRef.current) {
      const text = editorRef.current.innerText || '';
      const words = text.trim().split(/\s+/).filter(word => word.length > 0);
      setWordCount(words.length);
      setCharCount(text.length);
    }
  };

  const extractTitleAndContent = (html: string) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Get first line as title
    const firstElement = tempDiv.firstElementChild;
    const title = firstElement?.textContent || 'Untitled';
    
    // Remove first element and get rest as content
    firstElement?.remove();
    const content = tempDiv.innerHTML || '<p><br></p>';
    
    return { title, content };
  };

  const execCommand = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  };

  const insertTextAtCursor = (text: string) => {
    editorRef.current?.focus();
    document.execCommand('insertText', false, text);
    handleContentChange();
  };

  const handleFormat = (format: string) => {
    switch (format) {
      case 'h1':
        execCommand('formatBlock', '<h1>');
        break;
      case 'h2':
        execCommand('formatBlock', '<h2>');
        break;
      case 'h3':
        execCommand('formatBlock', '<h3>');
        break;
      case 'p':
        execCommand('formatBlock', '<p>');
        break;
      case 'bold':
        execCommand('bold');
        break;
      case 'italic':
        execCommand('italic');
        break;
      case 'underline':
        execCommand('underline');
        break;
      case 'strikethrough':
        execCommand('strikeThrough');
        break;
      case 'code':
        execCommand('formatBlock', '<pre>');
        break;
      case 'quote':
        execCommand('formatBlock', '<blockquote>');
        break;
      case 'ul':
        execCommand('insertUnorderedList');
        break;
      case 'ol':
        execCommand('insertOrderedList');
        break;
      case 'link':
        saveSelection();
        setLinkUrlDraft('');
        setLinkOpen(true);
        setTimeout(() => linkInputRef.current?.focus(), 0);
        break;
    }
  };

  const handleContentChange = useCallback(() => {
    if (editorRef.current && note) {
      const html = editorRef.current.innerHTML;
      const { title, content } = extractTitleAndContent(html);
      const text = editorRef.current.innerText || '';
      const tagsFromContent = [...new Set((text.match(/#[\w-]+/g) || []).map(m => m.slice(1)))];
      const mergedTags = [...new Set([...(note.tags || []), ...tagsFromContent])];
      if (onNoteBatchUpdate) {
        onNoteBatchUpdate(note.id, { title, content, tags: mergedTags });
      } else {
        onTitleChange(title);
        onContentChange(content);
        if (onNoteTagsChange) onNoteTagsChange(note.id, mergedTags);
      }
      updateCounts();
      setShowPlaceholder(!title || title.trim().length === 0);
      setIsSaving(true);
      setShowSaved(false);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        setIsSaving(false);
        setShowSaved(true);
        savedTimeoutRef.current = setTimeout(() => setShowSaved(false), SAVED_SHOW_MS);
      }, SAVE_IDLE_MS);
    }
  }, [note, onContentChange, onTitleChange, onNoteTagsChange, onNoteBatchUpdate]);

  contentSyncRef.current = handleContentChange;

  useEffect(() => () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    if (toastRef.current) clearTimeout(toastRef.current);
  }, []);

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            const r = new FileReader();
            r.onload = () => {
              const data = r.result as string;
              editorRef.current?.focus();
              document.execCommand('insertHTML', false, `<img src="${data}" alt="pasted" style="max-width:100%;height:auto;border-radius:8px;" />`);
              contentSyncRef.current();
            };
            r.readAsDataURL(file);
          }
          return;
        }
      }
    }
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  const handleFocus = () => {
    setShowPlaceholder(false);
  };

  const handleBlur = () => {
    if (editorRef.current) {
      const text = editorRef.current.innerText || '';
      setShowPlaceholder(!text.trim());
    }
    setAcSuggestions([]);
    setAcCaretRect(null);
  };

  const updateAutocomplete = useCallback(() => {
    const el = editorRef.current;
    if (!el || !note) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0).cloneRange();
    range.collapse(true);
    range.setStart(el, 0);
    const textBefore = range.toString();
    const match = textBefore.match(/\w+$/);
    const prefix = match ? match[0] : '';
    if (prefix.length < 2) {
      setAcSuggestions([]);
      setAcPrefix('');
      setAcCaretRect(null);
      return;
    }
    const fullText = (note.title || '') + '\n' + (el.innerText || '');
    const words = [...new Set(fullText.split(/\W+/).filter(w => w.length >= 2))];
    const lower = prefix.toLowerCase();
    const sugs = words.filter(w => w.toLowerCase().startsWith(lower) && w !== prefix).slice(0, 8);
    setAcPrefix(prefix);
    setAcSuggestions(sugs);
    setAcIndex(0);
    const r = sel.getRangeAt(0).cloneRange();
    r.collapse(true);
    const rect = r.getBoundingClientRect();
    setAcCaretRect({ top: rect.bottom, left: rect.left });
  }, [note]);

  const applyAutocomplete = useCallback((suggestion: string) => {
    const el = editorRef.current;
    if (!el || !suggestion) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0).cloneRange();
    const prefix = acPrefixRef.current;
    if (!prefix) return;
    range.collapse(true);
    try {
      range.moveStart('character', -prefix.length);
    } catch {
      return;
    }
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand('insertText', false, suggestion);
    contentSyncRef.current();
    setAcSuggestions([]);
    setAcPrefix('');
    setAcIndex(0);
    setAcCaretRect(null);
  }, []);

  const handleEditorInput = useCallback(() => {
    if (acTimeoutRef.current) clearTimeout(acTimeoutRef.current);
    acTimeoutRef.current = setTimeout(() => {
      updateAutocomplete();
      acTimeoutRef.current = null;
    }, 50);
    handleContentChange();
  }, [handleContentChange, updateAutocomplete]);

  const handleEditorKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (acSuggestionsRef.current.length === 0) return;
    if (e.key === 'Tab') {
      e.preventDefault();
      const sel = acSuggestionsRef.current[acIndexRef.current];
      if (sel) applyAutocomplete(sel);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAcIndex(i => Math.min(i + 1, acSuggestionsRef.current.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAcIndex(i => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Escape') {
      setAcSuggestions([]);
      setAcCaretRect(null);
    }
  }, [applyAutocomplete]);

  if (!note) {
    return (
      <div className="flex-1 h-full bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-500 text-lg">Select a note to view</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full bg-black flex flex-col min-w-0" ref={containerRef}>
      {/* Top Toolbar */}
      <div className="border-b border-zinc-800/50 bg-black shrink-0 relative">
        <div className="flex items-center justify-between px-2 md:px-4 py-2 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {isElectron && onToggleMiddlePanel && (
              <button onClick={onToggleMiddlePanel} className="p-2 hover:bg-zinc-700/50 rounded-full transition-colors" title={middlePanelOpen ? 'Hide notes list' : 'Show notes list'}>
                {middlePanelOpen ? <PanelLeftClose size={16} className="text-zinc-400" /> : <PanelLeftOpen size={16} className="text-zinc-400" />}
              </button>
            )}
            {onStarChange && note && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onStarChange(note.id, !note.starred);
                }}
                className={`p-2 rounded-full transition-colors ${note.starred ? 'text-amber-400 hover:bg-amber-900/30' : 'hover:bg-zinc-700/50'}`}
                title={note.starred ? 'Unstar' : 'Star'}
              >
                <Star size={16} className={note.starred ? 'fill-amber-400' : ''} />
              </button>
            )}
            <div className="flex items-center gap-1 bg-zinc-900/50 rounded-full p-1 relative">
              <button onClick={() => { setTagPopoverOpen(v => !v); if (!tagPopoverOpen) { setTagInputValue(''); setTimeout(() => tagInputRef.current?.focus(), 0); } }} className="p-2 hover:bg-red-900/50 rounded-full transition-colors" title="Add tag">
                <Hash size={16} className="text-red-800" />
              </button>
              {tagPopoverOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setTagPopoverOpen(false)} aria-hidden />
                  <div className="absolute left-0 top-full mt-1 py-2 px-3 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-20 min-w-[200px]">
                    <div className="flex gap-2">
                      <input
                        id="editor-tag-input"
                        name="editor-tag-input"
                        ref={tagInputRef}
                        value={tagInputValue}
                        onChange={e => setTagInputValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const t = tagInputValue.trim().replace(/\s+/g, ''); if (t) { insertTextAtCursor(' #' + t); onNoteTagsChange?.(note!.id, [...new Set([...(note!.tags || []), t])]); setTagPopoverOpen(false); setTagInputValue(''); } } }}
                        placeholder="Tag name"
                        className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-500 outline-none focus:ring-1 focus:ring-zinc-600"
                      />
                      <button type="button" onClick={() => { const t = tagInputValue.trim().replace(/\s+/g, ''); if (t) { insertTextAtCursor(' #' + t); onNoteTagsChange?.(note!.id, [...new Set([...(note!.tags || []), t])]); setTagPopoverOpen(false); setTagInputValue(''); } }} className="px-2.5 py-1.5 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded shrink-0">Add</button>
                    </div>
                    {(note?.tags?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(note!.tags!).map(t => (
                          <button key={t} type="button" onClick={() => { insertTextAtCursor(' #' + t); setTagPopoverOpen(false); setTagInputValue(''); }} className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700">#{t}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
              <button onClick={() => execCommand('formatBlock', '<p>')} className="p-2 hover:bg-zinc-700/50 rounded-full transition-colors" title="Paragraph">
                <Type size={16} className="text-zinc-400" />
              </button>
            </div>
            <div className="flex items-center gap-1 bg-zinc-900/50 rounded-full p-1">
              <button onClick={() => fileInputRef.current?.click()} className="p-2 hover:bg-zinc-700/50 rounded-full transition-colors" title="Attach file">
                <Paperclip size={16} className="text-zinc-400" />
              </button>
              <button onClick={() => setIsRecording(!isRecording)} className={`p-2 rounded-full transition-colors hidden sm:block ${isRecording ? 'bg-red-900/80' : 'hover:bg-zinc-700/50'}`} title={isRecording ? 'Stop recording' : 'Voice input'}>
                <Mic size={16} className={isRecording ? 'text-red-200' : 'text-zinc-400'} />
              </button>
              <button onClick={() => fetchGroqSuggestion()} disabled={aiLoading} className="p-2 hover:bg-zinc-700/50 rounded-full transition-colors hidden sm:block disabled:opacity-50" title="AI suggestion">
                <Sparkles size={16} className={aiLoading ? 'text-amber-400 animate-pulse' : 'text-zinc-400'} />
              </button>
              <div className="relative hidden sm:block">
                <button onClick={() => { setVideoOpen(v => !v); if (!videoOpen) { setVideoUrlDraft(''); setTimeout(() => videoInputRef.current?.focus(), 0); } }} className="p-2 hover:bg-zinc-700/50 rounded-full transition-colors" title="Insert video link">
                  <Video size={16} className="text-zinc-400" />
                </button>
                {videoOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setVideoOpen(false)} aria-hidden />
                    <div className="absolute left-0 top-full mt-1 py-2 px-3 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-20 min-w-[260px]">
                      <p className="text-xs text-zinc-500 mb-2">Video or link URL</p>
                      <input
                        id="editor-video-url"
                        name="editor-video-url"
                        ref={videoInputRef}
                        value={videoUrlDraft}
                        onChange={e => setVideoUrlDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { if (videoUrlDraft.trim()) { editorRef.current?.focus(); execCommand('createLink', videoUrlDraft.trim()); setVideoOpen(false); setVideoUrlDraft(''); showToast('Link inserted'); } } }}
                        placeholder="https://..."
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-500 outline-none focus:ring-1 focus:ring-zinc-600"
                      />
                      <div className="flex gap-2 mt-2">
                        <button type="button" onClick={() => { if (videoUrlDraft.trim()) { editorRef.current?.focus(); execCommand('createLink', videoUrlDraft.trim()); setVideoOpen(false); setVideoUrlDraft(''); showToast('Link inserted'); } }} className="flex-1 px-2 py-1.5 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded">Insert</button>
                        <button type="button" onClick={() => setVideoOpen(false)} className="px-2 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 rounded">Cancel</button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsRecording(!isRecording)}
            className={`flex items-center gap-2 px-4 md:px-6 py-2 rounded-full transition-all shrink-0 ${isRecording ? 'bg-red-900 hover:bg-red-800' : 'bg-red-900/80 hover:bg-red-900'}`}
            title={isRecording ? 'Stop recording' : 'Record'}
          >
            <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-white animate-pulse' : 'bg-white'}`} />
            <span className="text-white font-medium text-sm hidden sm:inline">Record</span>
          </button>
          <div className="flex items-center gap-1 bg-zinc-900/50 rounded-full p-1 relative">
            <div className="relative">
              <button onClick={() => { setReminderOpen(v => !v); if (!reminderOpen) { if (note?.reminderAt) { const d = new Date(note.reminderAt); setReminderDraft(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`); } else { const n = new Date(); n.setHours(n.getHours() + 1, 0, 0, 0); setReminderDraft(`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}T${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`); } } }} className={`p-2 rounded-full transition-colors ${note?.reminderAt ? 'text-amber-400 hover:bg-amber-900/30' : 'hover:bg-zinc-700/50'}`} title={note?.reminderAt ? `Reminder ${new Date(note.reminderAt).toLocaleString()}` : 'Set reminder'}>
                <Bell size={16} className={note?.reminderAt ? 'text-amber-400' : 'text-zinc-400'} />
              </button>
              {reminderOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setReminderOpen(false)} aria-hidden />
                  <div className="absolute right-0 top-full mt-1 py-3 px-3 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-20 w-[260px] max-w-[calc(100vw-2rem)]" style={{ left: 'auto' }}>
                    <p className="text-xs text-zinc-500 mb-2">Remind me</p>
                    <div className="flex gap-2 mb-2">
                      <input
                        id="reminder-date"
                        name="reminder-date"
                        type="date"
                        value={reminderDraft.slice(0, 10)}
                        onChange={e => setReminderDraft(prev => e.target.value + prev.slice(10))}
                        min={new Date().toISOString().slice(0, 10)}
                        className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-sm text-zinc-200 outline-none focus:ring-1 focus:ring-zinc-600 [color-scheme:dark]"
                      />
                      <input
                        id="reminder-time"
                        name="reminder-time"
                        type="time"
                        value={reminderDraft.slice(11, 16)}
                        onChange={e => setReminderDraft(prev => prev.slice(0, 11) + e.target.value)}
                        className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-sm text-zinc-200 outline-none focus:ring-1 focus:ring-zinc-600 [color-scheme:dark]"
                      />
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button type="button" onClick={() => { const hasDate = reminderDraft.length >= 10; const v = hasDate ? new Date(reminderDraft.slice(0,10) + 'T' + (reminderDraft.slice(11,16) || '12:00')).toISOString() : null; if (note && onReminderChange) onReminderChange(note.id, v); setReminderOpen(false); showToast(hasDate ? 'Reminder set' : 'Reminder cleared'); }} className="flex-1 px-2 py-1.5 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded">
                        {reminderDraft ? 'Set' : 'Clear'}
                      </button>
                      <button type="button" onClick={() => setReminderOpen(false)} className="px-2 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 rounded">Cancel</button>
                    </div>
                    {note?.reminderAt && (
                      <button type="button" onClick={() => { if (note && onReminderChange) onReminderChange(note.id, null); setReminderOpen(false); showToast('Reminder cleared'); }} className="w-full mt-2 px-2 py-1.5 text-xs text-red-400 hover:bg-red-900/20 rounded">Clear reminder</button>
                    )}
                  </div>
                </>
              )}
            </div>
            <button onClick={() => { if (note) { const text = (note.title || '') + '\n\n' + (editorRef.current?.innerText ?? ''); navigator.clipboard.writeText(text); showToast('Copied to clipboard'); } }} className="p-2 hover:bg-zinc-700/50 rounded-full transition-colors hidden sm:block" title="Share / Copy">
              <Share2 size={16} className="text-zinc-400" />
            </button>
            <button onClick={() => setMoreOpen(v => !v)} className="p-2 hover:bg-zinc-700/50 rounded-full transition-colors" title="More">
              <MoreHorizontal size={16} className="text-zinc-400" />
            </button>
            {moreOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => { setMoreOpen(false); setTemplateMenuOpen(false); }} aria-hidden />
                <div className="absolute right-0 top-full mt-1 py-1 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-20 min-w-[180px] max-h-[70vh] overflow-y-auto">
                  <button onClick={() => { if (note) { navigator.clipboard.writeText((note.title || '') + '\n\n' + (editorRef.current?.innerText ?? '')); showToast('Copied'); setMoreOpen(false); } }} className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800">Copy note</button>
                  <button onClick={() => { if (note) { const text = (note.title || '') + '\n\n' + (editorRef.current?.innerText ?? ''); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); a.download = (note.title || 'note') + '.txt'; a.click(); URL.revokeObjectURL(a.href); showToast('Exported'); setMoreOpen(false); } }} className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800">Export as .txt</button>
                  <div className="border-t border-zinc-800 my-1" />
                  <button onClick={() => { if (note) { exportNoteAsMarkdown(note.title, note.content); showToast('Exported .md'); setMoreOpen(false); } }} className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800">Export as Markdown</button>
                  <button onClick={() => { if (note) { exportNoteAsHTML(note.title, note.content); showToast('Exported .html'); setMoreOpen(false); } }} className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800">Export as HTML</button>
                  <button onClick={() => { if (note) { exportNoteAsPDF(note.title, note.content); showToast('Print / Save as PDF'); setMoreOpen(false); } }} className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800">Export as PDF</button>
                  <div className="border-t border-zinc-800 my-1" />
                  <button onClick={() => { if (note) { setEditTagsValue((note.tags || []).join(', ')); setEditTagsOpen(true); setMoreOpen(false); setTimeout(() => editTagsInputRef.current?.focus(), 0); } }} className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800">Edit tags</button>
                  <button onClick={() => { if (note && onSaveAsTemplate) { setSaveTemplateName(note.title || 'Untitled'); setSaveTemplateOpen(true); setMoreOpen(false); setTimeout(() => saveTemplateInputRef.current?.focus(), 0); } }} className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800">Save as template</button>
                  <div className="relative">
                    <button onClick={() => setTemplateMenuOpen(!templateMenuOpen)} className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 flex items-center justify-between">New from template</button>
                    {templateMenuOpen && templates.length > 0 && (
                      <div className="absolute left-0 top-full mt-0.5 py-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-30 min-w-[160px] max-h-48 overflow-y-auto">
                        {templates.map((t) => (
                          <button key={t.id} onClick={() => { onCreateFromTemplate?.(t); showToast('Created from template'); setMoreOpen(false); setTemplateMenuOpen(false); }} className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700 truncate">{t.name}</button>
                        ))}
                      </div>
                    )}
                    {templateMenuOpen && templates.length === 0 && (
                      <div className="absolute left-0 top-full mt-0.5 py-2 px-3 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-30 text-xs text-zinc-500">No templates yet. Save a note as template first.</div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        <input
          id="editor-file-attach"
          name="editor-file-attach"
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={async (e) => {
            const files = e.target.files;
            if (!files?.length || !note || !onAttachmentsChange) return;
            const prev = note.attachments ?? [];
            const newAttachments: { name: string; data: string }[] = [];
            for (let i = 0; i < files.length; i++) {
              const f = files[i];
              const data = await new Promise<string>((res, rej) => {
                const r = new FileReader();
                r.onload = () => res((r.result as string) || '');
                r.onerror = rej;
                r.readAsDataURL(f);
              });
              newAttachments.push({ name: f.name, data });
            }
            onAttachmentsChange(note.id, [...prev, ...newAttachments]);
            showToast(`Attached ${files.length} file(s)`);
            e.target.value = '';
          }}
        />
        {toast && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full py-1 px-3 bg-zinc-800 text-zinc-200 text-xs rounded shadow-lg animate-in fade-in">{toast}</div>}
      </div>

      {/* Edit tags modal */}
      {editTagsOpen && note && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200" role="dialog" aria-modal="true">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full mx-4 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold text-zinc-100 mb-3">Edit tags</h3>
            <input
              id="edit-tags-input"
              name="edit-tags-input"
              ref={editTagsInputRef}
              type="text"
              value={editTagsValue}
              onChange={e => setEditTagsValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { onNoteTagsChange?.(note.id, editTagsValue.split(',').map(t => t.trim()).filter(Boolean)); setEditTagsOpen(false); showToast('Tags updated'); } if (e.key === 'Escape') setEditTagsOpen(false); }}
              placeholder="Tags (comma-separated)"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-500 outline-none focus:ring-1 focus:ring-zinc-600 mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setEditTagsOpen(false)} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-colors">Cancel</button>
              <button onClick={() => { onNoteTagsChange?.(note.id, editTagsValue.split(',').map(t => t.trim()).filter(Boolean)); setEditTagsOpen(false); showToast('Tags updated'); }} className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-lg transition-colors">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Save as template modal */}
      {saveTemplateOpen && note && onSaveAsTemplate && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200" role="dialog" aria-modal="true">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full mx-4 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold text-zinc-100 mb-3">Save as template</h3>
            <input
              id="save-template-name"
              name="save-template-name"
              ref={saveTemplateInputRef}
              type="text"
              value={saveTemplateName}
              onChange={e => setSaveTemplateName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && saveTemplateName.trim()) { onSaveAsTemplate(saveTemplateName.trim(), note.title, note.content); setSaveTemplateOpen(false); showToast('Saved as template'); } if (e.key === 'Escape') setSaveTemplateOpen(false); }}
              placeholder="Template name"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-500 outline-none focus:ring-1 focus:ring-zinc-600 mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setSaveTemplateOpen(false)} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-colors">Cancel</button>
              <button onClick={() => { if (saveTemplateName.trim()) { onSaveAsTemplate(saveTemplateName.trim(), note.title, note.content); setSaveTemplateOpen(false); showToast('Saved as template'); } }} disabled={!saveTemplateName.trim()} className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-lg transition-colors disabled:opacity-50 disabled:pointer-events-none">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Editor Content - hug left, no center shift when window expands */}
      <div className="flex-1 overflow-y-auto relative">
        <div className="w-full max-w-3xl pl-6 md:pl-8 pr-6 md:pr-12 py-4 pb-32">
          {/* Word counter - top right */}
          <div className="absolute top-8 right-6 md:right-12 flex items-start gap-2 pointer-events-none z-10">
            <div className="bg-zinc-900/60 backdrop-blur-sm border border-zinc-800/30 rounded-md px-2.5 py-1.5 flex items-center gap-2">
            <div className="text-[10px]">
              <span className="text-white font-medium">{wordCount}</span>
              <span className="text-zinc-500 ml-1">words</span>
            </div>
            <div className="w-px h-3 bg-zinc-700"></div>
            <div className="text-[10px]">
              <span className="text-white font-medium">{charCount}</span>
              <span className="text-zinc-500 ml-1">characters</span>
            </div>
            </div>
          </div>

          {/* Placeholder */}
          {showPlaceholder && (
            <div className="absolute pointer-events-none text-zinc-700 text-xs mt-1">
              Start title here
            </div>
          )}
          
          {/* Unified Content Editor */}
          <div
            ref={editorRef}
            contentEditable
            role="textbox"
            aria-label="Note content"
            onInput={handleEditorInput}
            onKeyDown={handleEditorKeyDown}
            onPaste={handlePaste}
            onFocus={handleFocus}
            onBlur={handleBlur}
            spellCheck={false}
            className="min-h-[400px] outline-none text-zinc-300 text-left font-light tracking-tight leading-[1.8]
              prose prose-invert max-w-none text-left
              prose-headings:text-zinc-100 prose-headings:font-semibold prose-headings:text-left
              prose-h1:text-3xl prose-h1:mt-0 prose-h1:mb-4 prose-h1:text-left
              prose-h2:text-2xl prose-h2:mt-6 prose-h2:mb-3 prose-h2:text-left
              prose-h3:text-xl prose-h3:mt-4 prose-h3:mb-2 prose-h3:text-left
              prose-p:text-zinc-300 prose-p:font-light prose-p:leading-[1.8] prose-p:tracking-tight prose-p:my-3 prose-p:text-left
              prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
              prose-strong:text-zinc-100 prose-strong:font-semibold
              prose-code:text-zinc-200 prose-code:bg-zinc-900 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-left
              prose-pre:bg-zinc-900 prose-pre:text-zinc-200 prose-pre:p-4 prose-pre:rounded-lg prose-pre:text-left
              prose-blockquote:border-l-4 prose-blockquote:border-zinc-700 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-zinc-400 prose-blockquote:text-left
              prose-ul:text-zinc-300 prose-ol:text-zinc-300 prose-ul:text-left prose-ol:text-left
              prose-li:text-zinc-300 prose-li:my-1 prose-li:text-left
              focus:outline-none
              select-text cursor-text
              [&>*:first-child]:mt-0
              [&>*:last-child]:mb-0
            "
            style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
            suppressContentEditableWarning
          >
          </div>
          {/* Attachments */}
          {(note?.attachments?.length ?? 0) > 0 && onAttachmentsChange && (
            <div className="mt-4 flex flex-wrap gap-2">
              {note!.attachments!.map((att, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 bg-zinc-900/80 border border-zinc-800 rounded-lg text-sm">
                  <Paperclip size={14} className="text-zinc-500 shrink-0" />
                  <a href={att.data} download={att.name} className="text-zinc-300 hover:text-zinc-100 truncate max-w-[180px]">{att.name}</a>
                  <button onClick={() => onAttachmentsChange(note!.id, note!.attachments!.filter((_, j) => j !== i))} className="p-1 hover:bg-zinc-700 rounded" title="Remove"><X size={14} className="text-zinc-500" /></button>
                </div>
              ))}
            </div>
          )}
          {/* Autocomplete dropdown */}
          {acSuggestions.length > 0 && acCaretRect && (
            <div
              className="fixed z-50 py-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl min-w-[120px] max-h-[200px] overflow-y-auto"
              style={{ top: acCaretRect.top + 4, left: acCaretRect.left }}
            >
              <p className="text-[10px] px-2 py-1 text-zinc-500 border-b border-zinc-800">Tab to insert</p>
              {acSuggestions.map((s, i) => (
                <button
                  key={`${s}-${i}`}
                  type="button"
                  className={`w-full px-3 py-1.5 text-left text-sm ${i === acIndex ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-300 hover:bg-zinc-800'}`}
                  onMouseDown={(e) => { e.preventDefault(); applyAutocomplete(s); }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Toolbar - Centered; autosave dot aligned right in same container */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-center items-center pb-6 pointer-events-none gap-4">
          <div className="flex items-center gap-1 bg-zinc-900/95 backdrop-blur-sm border border-zinc-800/50 rounded-full px-3 py-2.5 pointer-events-auto shadow-2xl max-w-[90%] overflow-x-auto">
            <div className="flex items-center gap-0.5 bg-zinc-900/30 rounded-lg p-0.5">
              <button onMouseDown={(e) => { e.preventDefault(); editorRef.current?.focus(); execCommand('justifyLeft'); }} className="p-1.5 hover:bg-zinc-700/50 rounded transition-colors" title="Align left">
                <AlignLeft size={14} className="text-zinc-400" />
              </button>
            </div>
            <div className="flex items-center gap-0.5 bg-zinc-900/30 rounded-lg p-0.5">
              <button onMouseDown={(e) => handleFormatClick(e, 'h1')} className="p-1.5 hover:bg-zinc-700/50 rounded transition-colors" title="Heading 1">
                <Heading1 size={14} className="text-zinc-400" />
              </button>
              <button onMouseDown={(e) => handleFormatClick(e, 'h2')} className="p-1.5 hover:bg-zinc-700/50 rounded transition-colors" title="Heading 2">
                <Heading2 size={14} className="text-zinc-400" />
              </button>
              <button onMouseDown={(e) => handleFormatClick(e, 'h3')} className="p-1.5 hover:bg-zinc-700/50 rounded transition-colors" title="Heading 3">
                <Heading3 size={14} className="text-zinc-400" />
              </button>
              <button onMouseDown={(e) => handleFormatClick(e, 'p')} className="p-1.5 hover:bg-zinc-700/50 rounded transition-colors" title="Paragraph">
                <Type size={14} className="text-zinc-400" />
              </button>
            </div>

            {/* Text Formatting */}
            <div className="flex items-center gap-0.5 bg-zinc-900/30 rounded-lg p-0.5">
              <button 
                onMouseDown={(e) => handleFormatClick(e, 'bold')}
                className="p-1.5 hover:bg-zinc-700/50 rounded transition-colors"
                title="Bold"
              >
                <Bold size={14} className="text-zinc-400" />
              </button>
              <button 
                onMouseDown={(e) => handleFormatClick(e, 'italic')}
                className="p-1.5 hover:bg-zinc-700/50 rounded transition-colors"
                title="Italic"
              >
                <Italic size={14} className="text-zinc-400" />
              </button>
              <button 
                onMouseDown={(e) => handleFormatClick(e, 'underline')}
                className="p-1.5 hover:bg-zinc-700/50 rounded transition-colors"
                title="Underline"
              >
                <Underline size={14} className="text-zinc-400" />
              </button>
              <button 
                onMouseDown={(e) => handleFormatClick(e, 'strikethrough')}
                className="p-1.5 hover:bg-zinc-700/50 rounded transition-colors"
                title="Strikethrough"
              >
                <Strikethrough size={14} className="text-zinc-400" />
              </button>
            </div>

            {/* Lists and Blocks */}
            <div className="flex items-center gap-0.5 bg-zinc-900/30 rounded-lg p-0.5">
              <button 
                onMouseDown={(e) => handleFormatClick(e, 'ul')}
                className="p-1.5 hover:bg-zinc-700/50 rounded transition-colors"
                title="Bullet List"
              >
                <List size={14} className="text-zinc-400" />
              </button>
              <button 
                onMouseDown={(e) => handleFormatClick(e, 'ol')}
                className="p-1.5 hover:bg-zinc-700/50 rounded transition-colors"
                title="Numbered List"
              >
                <ListOrdered size={14} className="text-zinc-400" />
              </button>
              <button 
                onMouseDown={(e) => handleFormatClick(e, 'quote')}
                className="p-1.5 hover:bg-zinc-700/50 rounded transition-colors"
                title="Quote"
              >
                <Quote size={14} className="text-zinc-400" />
              </button>
              <button 
                onMouseDown={(e) => handleFormatClick(e, 'code')}
                className="p-1.5 hover:bg-zinc-700/50 rounded transition-colors"
                title="Code Block"
              >
                <Code size={14} className="text-zinc-400" />
              </button>
            </div>

            {/* Link */}
            <div className="flex items-center gap-0.5 bg-zinc-900/30 rounded-lg p-0.5 relative">
              <button 
                onMouseDown={(e) => handleFormatClick(e, 'link')}
                className="p-1.5 hover:bg-zinc-700/50 rounded transition-colors"
                title="Insert Link"
              >
                <LinkIcon size={14} className="text-zinc-400" />
              </button>
              {linkOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setLinkOpen(false)} aria-hidden />
                  <div className="absolute left-0 bottom-full mb-1 py-2 px-3 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-20 w-[260px]">
                    <p className="text-xs text-zinc-500 mb-2">Link URL</p>
                    <input
                      id="editor-link-url"
                      name="editor-link-url"
                      ref={linkInputRef}
                      value={linkUrlDraft}
                      onChange={e => setLinkUrlDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { if (linkUrlDraft.trim()) { editorRef.current?.focus(); restoreSelection(); execCommand('createLink', linkUrlDraft.trim()); setLinkOpen(false); setLinkUrlDraft(''); showToast('Link inserted'); } } }}
                      placeholder="https://..."
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-500 outline-none focus:ring-1 focus:ring-zinc-600 mb-2"
                    />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { if (linkUrlDraft.trim()) { editorRef.current?.focus(); restoreSelection(); execCommand('createLink', linkUrlDraft.trim()); setLinkOpen(false); setLinkUrlDraft(''); showToast('Link inserted'); } }} className="flex-1 px-2 py-1.5 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded">Insert</button>
                      <button type="button" onClick={() => setLinkOpen(false)} className="px-2 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 rounded">Cancel</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          {(isSaving || showSaved) && (
            <div className="absolute right-6 md:right-12 flex items-center pointer-events-none" title={isSaving ? 'Saving…' : 'Saved'}>
              <div className={`w-1.5 h-1.5 rounded-full bg-red-500/90 ${isSaving ? 'autosave-breathe' : 'opacity-50'}`} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}