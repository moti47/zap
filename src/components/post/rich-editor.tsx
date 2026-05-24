"use client";

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
} from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle, Color } from "@tiptap/extension-text-style";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Code,
  Highlighter,
  Palette,
  Eraser,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface RichEditorHandle {
  focus: () => void;
  getHtml: () => string;
  getText: () => string;
  setHtml: (html: string) => void;
  clear: () => void;
  insertImage: (src: string) => void;
  insertText: (text: string) => void;
  /**
   * Phase 9 mention helper — replaces the partial `@xxx` token immediately
   * before the cursor with `@username ` (trailing space). No-op if the
   * cursor isn't sitting after an `@` token.
   */
  replaceMention: (username: string) => void;
}

interface RichEditorProps {
  placeholder?: string;
  onChange?: (html: string, text: string) => void;
  onKeyDownPublish?: () => void;
  maxLen?: number;
  initialHtml?: string;
}

const TEXT_COLORS = [
  "#FFFFFF",
  "#FFE600",
  "#00D982",
  "#FF4757",
  "#4DA3FF",
  "#A371F7",
  "#FF8A3D",
  "#8B92A8",
];

const HIGHLIGHT_COLORS = [
  null,
  "rgba(255,230,0,0.3)",
  "rgba(0,217,130,0.25)",
  "rgba(255,71,87,0.25)",
  "rgba(77,163,255,0.25)",
  "rgba(163,113,247,0.25)",
];

export const RichEditor = forwardRef<RichEditorHandle, RichEditorProps>(
  function RichEditor(
    {
      placeholder = "What's your call?",
      onChange,
      onKeyDownPublish,
      maxLen = 5000,
      initialHtml,
    },
    ref,
  ) {
    const [colorOpen, setColorOpen] = useState(false);
    const [hlOpen, setHlOpen] = useState(false);
    const onChangeRef = useRef(onChange);
    const onPublishRef = useRef(onKeyDownPublish);
    onChangeRef.current = onChange;
    onPublishRef.current = onKeyDownPublish;

    const editor = useEditor({
      // Avoid the SSR hydration warning recommended by Tiptap docs.
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          // we add Link + Underline explicitly
          link: false,
          heading: { levels: [2, 3] },
        }),
        Placeholder.configure({
          placeholder,
          emptyEditorClass:
            "before:content-[attr(data-placeholder)] before:text-[#5A6175] before:float-left before:pointer-events-none before:h-0",
        }),
        Underline,
        Link.configure({
          openOnClick: false,
          HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
        }),
        Image.configure({
          inline: true,
          allowBase64: true,
          HTMLAttributes: { class: "rounded my-1 max-h-[260px] inline-block" },
        }),
        Highlight.configure({ multicolor: true }),
        TextStyle,
        Color,
      ],
      content: initialHtml ?? "",
      editorProps: {
        attributes: {
          role: "textbox",
          "aria-multiline": "true",
          "aria-label": "Post body",
          class:
            "rich-editor outline-none min-h-[100px] py-2 text-[15px] leading-[1.55]",
        },
        handleKeyDown(view, event) {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            onPublishRef.current?.();
            return true;
          }
          const text = view.state.doc.textContent;
          const isNav =
            event.key === "Backspace" ||
            event.key === "Delete" ||
            event.key.startsWith("Arrow") ||
            event.metaKey ||
            event.ctrlKey;
          if (text.length >= maxLen && !isNav) {
            event.preventDefault();
            return true;
          }
          return false;
        },
      },
      onUpdate({ editor: ed }) {
        const html = ed.isEmpty ? "" : ed.getHTML();
        onChangeRef.current?.(html, ed.getText());
      },
    });

    // Apply initialHtml when it changes (draft load).
    useEffect(() => {
      if (!editor) return;
      if (initialHtml === undefined) return;
      const current = editor.getHTML();
      if (initialHtml === current) return;
      editor.commands.setContent(initialHtml || "", { emitUpdate: false });
    }, [editor, initialHtml]);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => editor?.commands.focus(),
        getHtml: () => (editor?.isEmpty ? "" : editor?.getHTML() ?? ""),
        getText: () => editor?.getText() ?? "",
        setHtml: (html: string) => {
          editor?.commands.setContent(html, { emitUpdate: false });
        },
        clear: () => {
          editor?.commands.clearContent(true);
          onChangeRef.current?.("", "");
        },
        insertImage: (src: string) => {
          editor?.chain().focus().setImage({ src }).run();
        },
        insertText: (text: string) => {
          editor?.chain().focus().insertContent(text).run();
        },
        replaceMention: (username: string) => {
          if (!editor) return;
          const { state } = editor;
          const { from } = state.selection;
          // Look backwards from the cursor for the `@` that started the token.
          const lineStart = Math.max(
            0,
            state.doc.resolve(from).start(),
          );
          const slice = state.doc.textBetween(lineStart, from, " ", " ");
          const m = slice.match(/@([a-z0-9_]*)$/i);
          if (!m) {
            editor.chain().focus().insertContent(`@${username} `).run();
            return;
          }
          const tokenLen = m[0].length;
          editor
            .chain()
            .focus()
            .deleteRange({ from: from - tokenLen, to: from })
            .insertContent(`@${username} `)
            .run();
        },
      }),
      [editor],
    );

    const promptLink = () => {
      const prev = editor?.getAttributes("link").href as string | undefined;
      const url = window.prompt("Link URL:", prev ?? "https://");
      if (url === null) return;
      if (url === "") {
        editor?.chain().focus().extendMarkRange("link").unsetLink().run();
        return;
      }
      editor
        ?.chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url })
        .run();
    };

    if (!editor) {
      return (
        <div className="w-full">
          <div className="h-9 border-b border-[#2A2F3D] mb-2" />
          <div className="min-h-[100px] py-2 text-[15px] text-[#5A6175]">
            {placeholder}
          </div>
        </div>
      );
    }

    return (
      <div className="w-full">
        <div className="flex items-center gap-0.5 flex-wrap pb-2 border-b border-[#2A2F3D] mb-2">
          <ToolBtn
            label="Bold"
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn
            label="Italic"
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn
            label="Underline"
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn
            label="Strikethrough"
            active={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <Strikethrough className="h-3.5 w-3.5" />
          </ToolBtn>
          <Divider />
          <ToolBtn
            label="Heading"
            active={editor.isActive("heading", { level: 2 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            <Heading2 className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn
            label="Quote"
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <Quote className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn
            label="Bullets"
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn
            label="Numbered"
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </ToolBtn>
          <Divider />
          <ToolBtn
            label="Link"
            active={editor.isActive("link")}
            onClick={promptLink}
          >
            <LinkIcon className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn
            label="Code block"
            active={editor.isActive("codeBlock")}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          >
            <Code className="h-3.5 w-3.5" />
          </ToolBtn>
          <Divider />
          <ColorPicker
            label="Text color"
            open={colorOpen}
            setOpen={(v) => {
              setColorOpen(v);
              if (v) setHlOpen(false);
            }}
            colors={TEXT_COLORS}
            onPick={(c) => {
              editor.chain().focus().setColor(c).run();
              setColorOpen(false);
            }}
            onClear={() => editor.chain().focus().unsetColor().run()}
          >
            <Palette className="h-3.5 w-3.5" />
          </ColorPicker>
          <ColorPicker
            label="Highlight"
            open={hlOpen}
            setOpen={(v) => {
              setHlOpen(v);
              if (v) setColorOpen(false);
            }}
            colors={HIGHLIGHT_COLORS}
            onPick={(c) => {
              if (c === null) editor.chain().focus().unsetHighlight().run();
              else editor.chain().focus().setHighlight({ color: c }).run();
              setHlOpen(false);
            }}
            onClear={() => editor.chain().focus().unsetHighlight().run()}
          >
            <Highlighter className="h-3.5 w-3.5" />
          </ColorPicker>
          <Divider />
          <ToolBtn
            label="Clear formatting"
            onClick={() =>
              editor.chain().focus().unsetAllMarks().clearNodes().run()
            }
          >
            <Eraser className="h-3.5 w-3.5" />
          </ToolBtn>
          <div className="flex-1" />
          <span className="text-[10px] font-mono text-[#5A6175] tabular-nums px-1">
            {editor.storage.characterCount?.characters?.() ??
              editor.getText().length}
            /{maxLen}
          </span>
        </div>

        <EditorContent
          editor={editor}
          className={cn(
            "[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[100px] [&_.ProseMirror]:py-2 [&_.ProseMirror]:text-[15px] [&_.ProseMirror]:leading-[1.55]",
            "[&_.ProseMirror_h2]:text-xl [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:mt-3 [&_.ProseMirror_h2]:mb-1",
            "[&_.ProseMirror_h3]:text-lg [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:mt-2",
            "[&_.ProseMirror_blockquote]:border-l-2 [&_.ProseMirror_blockquote]:border-[#FFE600] [&_.ProseMirror_blockquote]:pl-3 [&_.ProseMirror_blockquote]:text-[#8B92A8]",
            "[&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5",
            "[&_.ProseMirror_a]:text-[#FFE600] [&_.ProseMirror_a]:underline",
            "[&_.ProseMirror_pre]:font-mono [&_.ProseMirror_pre]:bg-[#0E1016] [&_.ProseMirror_pre]:px-2 [&_.ProseMirror_pre]:py-1 [&_.ProseMirror_pre]:rounded",
            "[&_.ProseMirror_img]:max-h-[260px] [&_.ProseMirror_img]:rounded [&_.ProseMirror_img]:my-1",
            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-[#5A6175]",
            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left",
            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none",
            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0",
          )}
        />
      </div>
    );
  },
);

function ToolBtn({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "h-7 w-7 inline-flex items-center justify-center rounded-sm transition-colors",
        active
          ? "text-[#FFE600] bg-[#FFE600]/10"
          : "text-[#8B92A8] hover:text-white hover:bg-[#20232E]",
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-4 w-px bg-[#2A2F3D]" />;
}

function ColorPicker({
  label,
  open,
  setOpen,
  colors,
  onPick,
  onClear,
  children,
}: {
  label: string;
  open: boolean;
  setOpen: (v: boolean) => void;
  colors: (string | null)[];
  onPick: (c: string | null) => void;
  onClear: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <ToolBtn label={label} onClick={() => setOpen(!open)}>
        {children}
      </ToolBtn>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-30 rounded-md border border-[#2A2F3D] bg-[#1A1D26] p-1.5 flex gap-1 shadow-xl shadow-black/40">
          {colors.map((c, i) => (
            <button
              key={c ?? `clear-${i}`}
              type="button"
              aria-label={c ? `${label} ${c}` : `Clear ${label.toLowerCase()}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => (c === null ? onClear() : onPick(c))}
              className="h-5 w-5 rounded-sm border border-[#2A2F3D]"
              style={{
                background:
                  c === null
                    ? "repeating-linear-gradient(45deg,#2A2F3D 0,#2A2F3D 2px,transparent 2px,transparent 4px)"
                    : c,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
