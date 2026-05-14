"use client";

import { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";

type Props = {
  name: string;
  defaultValue?: string | null;
};

export default function RichTextEditor({ name, defaultValue = "" }: Props) {
  const [html, setHtml] = useState(defaultValue || "");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content: defaultValue || "",
    onUpdate({ editor }) {
      setHtml(editor.getHTML());
    },
  });

  useEffect(() => {
    setHtml(defaultValue || "");
  }, [defaultValue]);

  if (!editor) {
    return (
      <input
        type="hidden"
        name={name}
        value={html}
        readOnly
      />
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950">
      <input type="hidden" name={name} value={html} readOnly />

      <div className="flex flex-wrap gap-2 border-b border-white/10 p-3">
        <ToolbarButton
          label="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />

        <ToolbarButton
          label="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />

        <ToolbarButton
          label="Underline"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        />

        <ToolbarButton
          label="Heading"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        />

        <ToolbarButton
          label="Bullet List"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />

        <ToolbarButton
          label="Number List"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />

        <ToolbarButton
          label="Left"
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        />

        <ToolbarButton
          label="Center"
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        />

        <ToolbarButton
          label="Right"
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        />

        <ToolbarButton
          label="Clear"
          active={false}
          onClick={() => {
            editor.chain().focus().clearNodes().unsetAllMarks().run();
            setHtml(editor.getHTML());
          }}
        />
      </div>

      <EditorContent
        editor={editor}
        className="min-h-[220px] px-4 py-3 text-white outline-none [&_.ProseMirror]:min-h-[220px] [&_.ProseMirror]:outline-none [&_.ProseMirror_p]:my-2 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6"
      />
    </div>
  );
}

function ToolbarButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-slate-950"
          : "rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800"
      }
    >
      {label}
    </button>
  );
}