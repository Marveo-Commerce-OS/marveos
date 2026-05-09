'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Save, AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Code2, Heading1, Heading2, Heading3, Highlighter, ImageIcon, Italic, Link2, List, ListOrdered, Minus, Paintbrush, Quote, Strikethrough, Underline as UnderlineIcon, X } from 'lucide-react';
import { EditorContent, Extension, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import FontFamily from '@tiptap/extension-font-family';

interface BlogEditorProps {
  mode: 'create' | 'edit';
  initialPost?: {
    id: number;
    slug?: string;
    status?: string;
    featured_media?: number;
    title?: { rendered?: string };
    excerpt?: { rendered?: string };
    content?: { rendered?: string };
    meta?: {
      _yoast_wpseo_title?: string;
      _yoast_wpseo_metadesc?: string;
      _yoast_wpseo_focuskw?: string;
    };
  };
}

type RichTextEditorProps = {
  content: string;
  onChange: (html: string) => void;
};

const inputCls = 'w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all';
const areaCls = 'w-full p-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all resize-y';
const editorShellCls = 'rounded-xl border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-sky-500 transition-all bg-white';

const FONT_SIZE_VALUES = ['12px', '14px', '16px', '18px', '20px', '24px', '30px', '36px', '48px'] as const;
const FONT_FAMILY_OPTIONS = [
  { label: 'Inter', value: 'Inter, sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: 'Times New Roman, serif' },
  { label: 'Courier New', value: 'Courier New, monospace' },
];

const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return {
      types: ['textStyle'],
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => (element as HTMLElement).style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
});

function RichTextEditor({ content, onChange }: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextStyle,
      FontSize,
      FontFamily,
      Color,
      Highlight.configure({ multicolor: true }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder: 'Write your post content here...',
      }),
    ],
    content: content || '<p></p>',
    editorProps: {
      attributes: {
        class:
          'min-h-[560px] w-full cursor-text bg-white px-4 py-4 text-[16px] leading-7 text-gray-900 outline-none prose prose-slate max-w-none',
      },
    },
    onUpdate({ editor: currentEditor }) {
      onChange(currentEditor.getHTML());
    },
  });

  const currentFontSize = editor?.getAttributes('textStyle')?.fontSize || '16px';
  const currentFontFamily = editor?.getAttributes('textStyle')?.fontFamily || 'Inter, sans-serif';

  const toolbarButton = (active: boolean) =>
    `inline-flex h-9 w-9 items-center justify-center rounded-lg border text-sm transition-colors ${
      active ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
    }`;

  const promptLink = () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Enter link URL', previousUrl ?? 'https://');
    if (url === null) return;
    if (url.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim(), target: '_blank' }).run();
  };

  const promptImage = () => {
    if (!editor) return;
    const url = window.prompt('Enter image URL', 'https://');
    if (!url?.trim()) return;
    editor.chain().focus().setImage({ src: url.trim(), alt: 'Inserted image' }).run();
  };

  if (!editor) {
    return <div className="min-h-[560px] rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-400">Loading editor...</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2">
        <div className="flex flex-wrap items-center gap-1 border-r border-gray-200 pr-2">
          <button type="button" onClick={() => editor.chain().focus().undo().run()} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">Undo</button>
          <button type="button" onClick={() => editor.chain().focus().redo().run()} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">Redo</button>
        </div>

        <select
          className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-700"
          value={currentFontFamily}
          onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()}
        >
          {FONT_FAMILY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <select
          className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-700"
          value={currentFontSize}
          onChange={(e) => editor.chain().focus().setMark('textStyle', { fontSize: e.target.value }).run()}
        >
          {FONT_SIZE_VALUES.map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>

        <div className="flex items-center gap-1 border-l border-gray-200 pl-2">
          <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={toolbarButton(editor.isActive('bold'))} aria-label="Bold"><Bold size={15} /></button>
          <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={toolbarButton(editor.isActive('italic'))} aria-label="Italic"><Italic size={15} /></button>
          <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={toolbarButton(editor.isActive('underline'))} aria-label="Underline"><UnderlineIcon size={15} /></button>
          <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={toolbarButton(editor.isActive('strike'))} aria-label="Strikethrough"><Strikethrough size={15} /></button>
          <button type="button" onClick={() => editor.chain().focus().toggleHighlight().run()} className={toolbarButton(editor.isActive('highlight'))} aria-label="Highlight"><Highlighter size={15} /></button>
          <button type="button" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} className={toolbarButton(false)} aria-label="Clear formatting"><X size={15} /></button>
        </div>

        <div className="flex items-center gap-1 border-l border-gray-200 pl-2">
          <button type="button" onClick={() => editor.chain().focus().setHeading({ level: 1 }).run()} className={toolbarButton(editor.isActive('heading', { level: 1 }))} aria-label="Heading 1"><Heading1 size={15} /></button>
          <button type="button" onClick={() => editor.chain().focus().setHeading({ level: 2 }).run()} className={toolbarButton(editor.isActive('heading', { level: 2 }))} aria-label="Heading 2"><Heading2 size={15} /></button>
          <button type="button" onClick={() => editor.chain().focus().setHeading({ level: 3 }).run()} className={toolbarButton(editor.isActive('heading', { level: 3 }))} aria-label="Heading 3"><Heading3 size={15} /></button>
          <button type="button" onClick={() => editor.chain().focus().setParagraph().run()} className={toolbarButton(editor.isActive('paragraph'))} aria-label="Paragraph"><Minus size={15} /></button>
          <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={toolbarButton(editor.isActive('blockquote'))} aria-label="Blockquote"><Quote size={15} /></button>
          <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={toolbarButton(editor.isActive('codeBlock'))} aria-label="Code block"><Code2 size={15} /></button>
        </div>

        <div className="flex items-center gap-1 border-l border-gray-200 pl-2">
          <button type="button" onClick={() => editor.chain().focus().setTextAlign('left').run()} className={toolbarButton(editor.isActive({ textAlign: 'left' }))} aria-label="Align left"><AlignLeft size={15} /></button>
          <button type="button" onClick={() => editor.chain().focus().setTextAlign('center').run()} className={toolbarButton(editor.isActive({ textAlign: 'center' }))} aria-label="Align center"><AlignCenter size={15} /></button>
          <button type="button" onClick={() => editor.chain().focus().setTextAlign('right').run()} className={toolbarButton(editor.isActive({ textAlign: 'right' }))} aria-label="Align right"><AlignRight size={15} /></button>
          <button type="button" onClick={() => editor.chain().focus().setTextAlign('justify').run()} className={toolbarButton(editor.isActive({ textAlign: 'justify' }))} aria-label="Justify"><AlignJustify size={15} /></button>
        </div>

        <div className="flex items-center gap-1 border-l border-gray-200 pl-2">
          <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={toolbarButton(editor.isActive('bulletList'))} aria-label="Bullet list"><List size={15} /></button>
          <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={toolbarButton(editor.isActive('orderedList'))} aria-label="Ordered list"><ListOrdered size={15} /></button>
          <button type="button" onClick={promptLink} className={toolbarButton(editor.isActive('link'))} aria-label="Link"><Link2 size={15} /></button>
          <button type="button" onClick={promptImage} className={toolbarButton(false)} aria-label="Image"><ImageIcon size={15} /></button>
        </div>

        <div className="flex items-center gap-1 border-l border-gray-200 pl-2">
          <label className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700">
            <Paintbrush size={14} />
            <input
              type="color"
              className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
              onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
              aria-label="Text color"
            />
          </label>
          <button type="button" onClick={() => editor.chain().focus().unsetColor().run()} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">Reset color</button>
        </div>
      </div>

      <div className={editorShellCls}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export default function BlogEditor({ mode, initialPost }: BlogEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialPost?.title?.rendered ?? '');
  const [slug, setSlug] = useState(initialPost?.slug ?? '');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(!!initialPost?.slug);
  const [excerpt, setExcerpt] = useState(initialPost?.excerpt?.rendered?.replace(/<[^>]+>/g, '') ?? '');
  const [content, setContent] = useState(initialPost?.content?.rendered ?? '');
  const [status, setStatus] = useState(initialPost?.status ?? 'draft');
  const [featuredMedia, setFeaturedMedia] = useState<number>(initialPost?.featured_media ?? 0);

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!slugManuallyEdited) {
      setSlug(
        value
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .slice(0, 80)
      );
    }
  }

  const [seoTitle, setSeoTitle] = useState(initialPost?.meta?._yoast_wpseo_title ?? '');
  const [seoDescription, setSeoDescription] = useState(initialPost?.meta?._yoast_wpseo_metadesc ?? '');
  const [seoKeyphrase, setSeoKeyphrase] = useState(initialPost?.meta?._yoast_wpseo_focuskw ?? '');

  const [imageUploading, setImageUploading] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  async function uploadImage(file: File) {
    setImageUploading(true);
    const fd = new FormData();
    fd.append('file', file);

    const res = await fetch('/api/media/upload', {
      method: 'POST',
      body: fd,
    });

    setImageUploading(false);
    if (!res.ok) {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 2500);
      return;
    }

    const media = await res.json();
    setFeaturedMedia(media.id);
  }

  async function savePost() {
    if (!title.trim()) return;
    setSaveState('saving');
    const editId = initialPost?.id;

    const payload = {
      ...(mode === 'edit' && editId ? { id: editId } : {}),
      title,
      slug,
      excerpt,
      content,
      status,
      featured_media: featuredMedia,
      seo: {
        title: seoTitle,
        description: seoDescription,
        focusKeyphrase: seoKeyphrase,
      },
    };

    const res = await fetch('/api/posts', {
      method: mode === 'create' ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 2500);
      return;
    }

    const saved = await res.json();
    setSaveState('success');

    setTimeout(() => {
      setSaveState('idle');
      if (mode === 'create') {
        router.push(`/dashboard/blog/${saved.id}`);
        return;
      }
      router.refresh();
    }, 1000);
  }

  return (
    <div className="space-y-6">
      {saveState === 'success' && (
        <div className="flex items-center gap-2 rounded-xl border border-green-100 bg-green-50 p-3 text-sm text-green-700"><CheckCircle2 size={16} /> Saved successfully.</div>
      )}
      {saveState === 'error' && (
        <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-600"><AlertCircle size={16} /> Save failed.</div>
      )}

      <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-semibold text-gray-700">Post Title</label>
            <input className={inputCls} value={title} onChange={(e) => handleTitleChange(e.target.value)} placeholder="Blog title" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">Slug</label>
            <input
              className={inputCls}
              value={slug}
              onChange={(e) => { setSlug(e.target.value); setSlugManuallyEdited(true); }}
              placeholder="post-slug"
            />
            <p className="text-xs text-gray-400">Auto-generated from title. Edit to override.</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">Status</label>
            <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="draft">Draft</option>
              <option value="publish">Published</option>
              <option value="pending">Pending Review</option>
              <option value="private">Private</option>
            </select>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-semibold text-gray-700">Excerpt</label>
            <textarea className={areaCls} rows={3} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-semibold text-gray-700">Content</label>
            <RichTextEditor content={content} onChange={setContent} />
            <p className="text-xs text-gray-400">Free rich editor. Use it like a proper blog CMS now, and we can turn it into a reusable add-on later.</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Featured Image</h2>
        <input type="file" onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void uploadImage(file);
        }} className="h-11 rounded-xl border border-gray-200 px-3 text-sm" />
        <p className="text-xs text-gray-500">{imageUploading ? 'Uploading image...' : featuredMedia ? `Media ID: ${featuredMedia}` : 'No image uploaded yet.'}</p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-base font-semibold text-gray-900">SEO</h2>
        <div className="grid grid-cols-1 gap-3">
          <input className={inputCls} placeholder="SEO Title" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
          <textarea className={areaCls} rows={3} placeholder="SEO Description" value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} />
          <input className={inputCls} placeholder="Focus Keyphrase" value={seoKeyphrase} onChange={(e) => setSeoKeyphrase(e.target.value)} />
        </div>
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={savePost} disabled={saveState === 'saving'} className="inline-flex items-center gap-2 rounded-xl bg-sky-700 px-6 py-3 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60">
          <Save size={16} /> {saveState === 'saving' ? 'Saving...' : mode === 'create' ? 'Create Post' : 'Save Post'}
        </button>
      </div>
    </div>
  );
}
