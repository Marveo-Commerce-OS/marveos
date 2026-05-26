'use client';

import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Link2, Eraser } from 'lucide-react';
import { richTextToPlainText } from '@/lib/tickets/richText';

interface RichTextEditorProps {
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  minHeightClassName?: string;
  onChange: (payload: { html: string; text: string }) => void;
}

function ToolbarButton({
  active,
  disabled,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
        active
          ? 'border-slate-300 bg-slate-900 text-white'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({
  value,
  placeholder = 'Write your message...',
  disabled = false,
  minHeightClassName = 'min-h-[180px]',
  onChange,
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '<p></p>',
    editorProps: {
      attributes: {
        class: `${minHeightClassName} w-full cursor-text rounded-b-xl bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none`,
      },
    },
    onUpdate({ editor: currentEditor }) {
      const html = currentEditor.getHTML();
      onChange({ html, text: richTextToPlainText(html) });
    },
  });

  useEffect(() => {
    if (!editor) return;
    const next = value || '<p></p>';
    if (editor.getHTML() !== next) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [editor, value]);

  const promptLink = () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href as string | undefined;
    const input = window.prompt('Enter link URL', previousUrl ?? 'https://');
    if (input === null) return;

    const url = input.trim();
    if (!url) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  if (!editor) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        Loading editor...
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <ToolbarButton
          active={editor.isActive('bold')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBold().run()}
          label="Bold"
        >
          <Bold size={15} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('italic')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          label="Italic"
        >
          <Italic size={15} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('underline')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          label="Underline"
        >
          <UnderlineIcon size={15} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('bulletList')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          label="Bullet list"
        >
          <List size={15} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('orderedList')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          label="Numbered list"
        >
          <ListOrdered size={15} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('link')}
          disabled={disabled}
          onClick={promptLink}
          label="Insert link"
        >
          <Link2 size={15} />
        </ToolbarButton>
        <ToolbarButton
          disabled={disabled}
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          label="Clear formatting"
        >
          <Eraser size={15} />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
