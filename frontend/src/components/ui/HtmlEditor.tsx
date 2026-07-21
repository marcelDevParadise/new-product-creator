import { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Braces, Code2,
  Italic, Link as LinkIcon, List, ListOrdered, Minus, Pilcrow, Quote,
  Redo, RemoveFormatting, Strikethrough, Underline as UnderlineIcon, Undo,
} from 'lucide-react';

interface Props {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

function ToolbarButton({ onClick, active, disabled, title, children }: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex h-8 w-8 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
        active
          ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
          : 'border-transparent text-gray-600 hover:border-gray-200 hover:bg-white dark:text-gray-300 dark:hover:border-gray-700 dark:hover:bg-gray-800'
      }`}
    >
      {children}
    </button>
  );
}

function characterCount(html: string): number {
  const element = document.createElement('div');
  element.innerHTML = html;
  return (element.textContent || '').trim().length;
}

export function HtmlEditor({ content, onChange, placeholder = 'Inhalt eingeben…', minHeight = '200px' }: Props) {
  const [sourceMode, setSourceMode] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer nofollow' } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor: currentEditor }) => onChange(currentEditor.getHTML()),
  });

  useEffect(() => {
    if (editor && editor.getHTML() !== content) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  if (!editor) return null;

  const addLink = () => {
    const previousUrl = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL eingeben:', previousUrl || 'https://');
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };

  const blockType = editor.isActive('heading', { level: 2 })
    ? 'h2'
    : editor.isActive('heading', { level: 3 })
      ? 'h3'
      : 'paragraph';

  const setBlockType = (value: string) => {
    if (value === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run();
    else if (value === 'h3') editor.chain().focus().toggleHeading({ level: 3 }).run();
    else editor.chain().focus().setParagraph().run();
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-300 bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950">
      <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 px-2 py-1.5 dark:border-gray-700 dark:bg-gray-900">
        <select
          value={blockType}
          onChange={(event) => setBlockType(event.target.value)}
          disabled={sourceMode}
          className="h-8 min-w-28 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-700 outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          aria-label="Absatzformat"
        >
          <option value="paragraph">Absatz</option>
          <option value="h2">Überschrift 2</option>
          <option value="h3">Überschrift 3</option>
        </select>

        <div className="h-6 w-px bg-gray-300 dark:bg-gray-700" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} disabled={sourceMode} title="Fett"><Bold className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} disabled={sourceMode} title="Kursiv"><Italic className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} disabled={sourceMode} title="Unterstrichen"><UnderlineIcon className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} disabled={sourceMode} title="Durchgestrichen"><Strikethrough className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} disabled={sourceMode} title="Formatierung entfernen"><RemoveFormatting className="h-4 w-4" /></ToolbarButton>

        <div className="h-6 w-px bg-gray-300 dark:bg-gray-700" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} disabled={sourceMode} title="Aufzählung"><List className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} disabled={sourceMode} title="Nummerierte Liste"><ListOrdered className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} disabled={sourceMode} title="Zitat"><Quote className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} disabled={sourceMode} title="Code-Block"><Code2 className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} disabled={sourceMode} title="Trennlinie"><Minus className="h-4 w-4" /></ToolbarButton>

        <div className="h-6 w-px bg-gray-300 dark:bg-gray-700" />
        <ToolbarButton onClick={addLink} active={editor.isActive('link')} disabled={sourceMode} title="Link"><LinkIcon className="h-4 w-4" /></ToolbarButton>

        <div className="h-6 w-px bg-gray-300 dark:bg-gray-700" />
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} disabled={sourceMode} title="Linksbündig"><AlignLeft className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} disabled={sourceMode} title="Zentriert"><AlignCenter className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} disabled={sourceMode} title="Rechtsbündig"><AlignRight className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} disabled={sourceMode} title="Blocksatz"><AlignJustify className="h-4 w-4" /></ToolbarButton>

        <div className="h-6 w-px bg-gray-300 dark:bg-gray-700" />
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={sourceMode || !editor.can().undo()} title="Rückgängig"><Undo className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={sourceMode || !editor.can().redo()} title="Wiederholen"><Redo className="h-4 w-4" /></ToolbarButton>

        <button
          type="button"
          onClick={() => setSourceMode((value) => !value)}
          className={`ml-auto inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors ${
            sourceMode
              ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
              : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
          }`}
        >
          {sourceMode ? <Pilcrow className="h-3.5 w-3.5" /> : <Braces className="h-3.5 w-3.5" />}
          {sourceMode ? 'Visuell' : 'HTML'}
        </button>
      </div>

      {sourceMode ? (
        <textarea
          className="w-full resize-y bg-white px-4 py-3 font-mono text-sm text-gray-800 outline-none dark:bg-gray-950 dark:text-gray-100"
          style={{ minHeight }}
          value={content}
          onChange={(event) => onChange(event.target.value)}
          placeholder="<p>HTML-Quelltext eingeben…</p>"
        />
      ) : (
        <EditorContent editor={editor} className="prose prose-sm max-w-none px-4 py-3 dark:prose-invert" style={{ minHeight }} />
      )}

      <div className="flex items-center justify-between border-t border-gray-100 px-2.5 py-1 text-[10px] text-gray-400 dark:border-gray-800">
        <span>{sourceMode ? 'HTML-Quelltext' : 'Visuelle Bearbeitung'}</span>
        <span>{characterCount(content)} Zeichen</span>
      </div>
    </div>
  );
}
