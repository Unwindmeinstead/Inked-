export interface NoteAttachment {
  name: string;
  data: string; // base64
  mime?: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  notebookId: string;
  starred: boolean;
  tags?: string[];
  reminderAt?: string; // ISO date string
  deletedAt?: string; // ISO date string, set when moved to trash
  attachments?: NoteAttachment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface NoteTemplate {
  id: string;
  name: string;
  title: string;
  content: string;
}

export interface Notebook {
  id: string;
  name: string;
  icon?: string;
}
