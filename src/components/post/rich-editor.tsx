"use client";

import { forwardRef, useImperativeHandle, useRef, useEffect, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
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
  clear: () => void;
  insertImage: (src: string) => void;
}

interface RichEditorProps {
  placeholder?: string;
  onChange?: (html: string, text: string) => void;
  onKeyDownPublish?: () => void;
  maxLen?: number;
}

const TEXT_COLORS = [
  "#FFFFFF",
  "#FFE600", // brand yellow
  "#00D982", // YES green
  "#FF4757", // NO red
  "#4DA3FF",
  "#A371F7",
  "#FF8A3D",
  "#8B92A8",
];

const HIGHLIGHT_COLORS = [
  "transparent",
  "rgba(255,230,0,0.3)",
  "rgba(0,217,130,0.25)",
  "rgba(255,71,87,0.25)",
  "rgba(77,163,255,0.25)",
  "rgba(163,113,247,0.25)",
];

export const RichEditor = forwardRef<RichEditorHandle, RichEditorProps>(function RichEditor(
  { placeholder = "What's your call?", onChange, onKeyDownPublish, maxLen = 5000 },
  ref
) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [colorOpen, setColorOpen] = useState(false);
  const [hlOpen, setHlOpen] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => editorRef.current?.focus(),
      getHtml: () => editorRef.current?.innerHTML ?? "",
      getText: () => editorRef.current?.innerText ?? "",
      clear: () => {
        if (editorRef.current) {
          editorRef.current.innerHTML = "";
          setIsEmpty(true);
          onChange?.("", "");
        }
      },
      insertImage: (src: string) => {
        editorRef.current?.focus();
        document.execCommand("insertImage", false, src);
        notify();
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const notify = () => {
    const el = editorRef.current;
    if (!el) return;
    const text = el.innerText ?? "";
    setIsEmpty(text.trim().length === 0 && !el.querySelector("img"));
    onChange?.(el.innerHTML, text);
  };

  const exec = (cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    notify();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      onKeyDownPublish?.();
      return;
    }
    // soft length cap
    const text = editorRef.current?.innerText ?? "";
    const isNonContentKey =
      e.key === "Backspace" ||
      e.key === "Delete" ||
      e.key.startsWith("Arrow") ||
      (e.metaKey || e.ctrlKey);
    if (text.length >= maxLen && !isNonContentKey) {
      e.preventDefault();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    // paste as plain text to avoid junk from Word/Notion
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    notify();
  };

  const promptLink = () => {
    const url = window.prompt("Enter URL:");
    if (!url) return;
    exec("createLink", url);
  };

  return (
    <div className="w-full">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 flex-wrap pb-2 border-b border-[#2A2F3D] mb-2">
        <ToolBtn label="Bold" onClick={() => exec("bold")}><Bold className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn label="Italic" onClick={() => exec("italic")}><Italic className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn label="Underline" onClick={() => exec("underline")}><Underline className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn label="Strikethrough" onClick={() => exec("strikeThrough")}><Strikethrough className="h-3.5 w-3.5" /></ToolBtn>
        <Divider />
        <ToolBtn
          label="Heading"
          onClick={() => exec("formatBlock", "<H2>")}
        ><Heading2 className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn
          label="Quote"
          onClick={() => exec("formatBlock", "<BLOCKQUOTE>")}
        ><Quote className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn
          label="Bullets"
          onClick={() => exec("insertUnorderedList")}
        ><List className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn
          label="Numbered"
          onClick={() => exec("insertOrderedList")}
        ><ListOrdered className="h-3.5 w-3.5" /></ToolBtn>
        <Divider />
        <ToolBtn label="Link" onClick={promptLink}><LinkIcon className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn label="Inline code" onClick={() => exec("formatBlock", "<PRE>")}><Code className="h-3.5 w-3.5" /></ToolBtn>
        <Divider />
        <div className="relative">
          <ToolBtn label="Text color" onClick={() => { setColorOpen((v) => !v); setHlOpen(false); }}>
            <Palette className="h-3.5 w-3.5" />
          </ToolBtn>
          {colorOpen && (
            <div className="absolute top-full mt-1 left-0 z-30 rounded-md border border-[#2A2F3D] bg-[#1A1D26] p-1.5 flex gap-1 shadow-xl shadow-black/40">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c}
                  aria-label={`Color ${c}`}
                  onClick={() => {
                    exec("foreColor", c);
                    setColorOpen(false);
                  }}
                  className="h-5 w-5 rounded-sm border border-[#2A2F3D]"
                  style={{ background: c }}
                />
              ))}
            </div>
          )}
        </div>
        <div className="relative">
          <ToolBtn label="Highlight" onClick={() => { setHlOpen((v) => !v); setColorOpen(false); }}>
            <Highlighter className="h-3.5 w-3.5" />
          </ToolBtn>
          {hlOpen && (
            <div className="absolute top-full mt-1 left-0 z-30 rounded-md border border-[#2A2F3D] bg-[#1A1D26] p-1.5 flex gap-1 shadow-xl shadow-black/40">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c}
                  aria-label={`Highlight ${c}`}
                  onClick={() => {
                    exec("hiliteColor", c);
                    setHlOpen(false);
                  }}
                  className="h-5 w-5 rounded-sm border border-[#2A2F3D]"
                  style={{
                    background:
                      c === "transparent"
                        ? "repeating-linear-gradient(45deg,#2A2F3D 0,#2A2F3D 2px,transparent 2px,transparent 4px)"
                        : c,
                  }}
                />
              ))}
            </div>
          )}
        </div>
        <Divider />
        <ToolBtn label="Clear formatting" onClick={() => exec("removeFormat")}><Eraser className="h-3.5 w-3.5" /></ToolBtn>
      </div>

      <div className="relative">
        {isEmpty && (
          <div className="absolute top-2 left-0 text-[15px] text-[#5A6175] pointer-events-none">
            {placeholder} <span className="text-[10px] font-mono opacity-70">(⌘+Enter to publish)</span>
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline
          aria-label="Post body"
          onInput={notify}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          className={cn(
            "rich-editor outline-none min-h-[100px] py-2 text-[15px] leading-[1.55]",
            "[&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-1",
            "[&_blockquote]:border-l-2 [&_blockquote]:border-[#FFE600] [&_blockquote]:pl-3 [&_blockquote]:text-[#8B92A8]",
            "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
            "[&_a]:text-[#FFE600] [&_a]:underline",
            "[&_pre]:font-mono [&_pre]:bg-[#0E1016] [&_pre]:px-2 [&_pre]:py-1 [&_pre]:rounded",
            "[&_img]:max-h-[200px] [&_img]:rounded [&_img]:my-1 [&_img]:inline-block"
          )}
        />
      </div>
    </div>
  );
});

function ToolBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="h-7 w-7 inline-flex items-center justify-center rounded-sm text-[#8B92A8] hover:text-white hover:bg-[#20232E] transition-colors"
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-4 w-px bg-[#2A2F3D]" />;
}
