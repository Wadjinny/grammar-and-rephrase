import { useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { fromDoc, type DocNode, type RichText } from "../lib/richText";

interface RichTextInputProps {
  /** Content set from outside (examples, history, clear); applied whenever `docVersion` changes */
  doc: DocNode;
  docVersion: number;
  placeholder: string;
  maxCharacters: number;
  onChange: (doc: DocNode, rich: RichText) => void;
}

/**
 * Input that keeps formatting pasted from mail or Teams: bold, italic, underline, strike, inline
 * code, links, headings, lists, quotes and line breaks. Anything else (fonts, colors, tables,
 * images) is dropped on paste by the editor schema.
 */
export default function RichTextInput({ doc, docVersion, placeholder, maxCharacters, onChange }: RichTextInputProps) {
  const placeholderRef = useRef(placeholder);
  placeholderRef.current = placeholder;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        horizontalRule: false,
        // An extra empty paragraph at the end would add a trailing line break to the checked text
        trailingNode: false,
        link: { openOnClick: false, autolink: true },
      }),
      Placeholder.configure({ placeholder: () => placeholderRef.current }),
      CharacterCount.configure({ limit: maxCharacters }),
    ],
    content: doc,
    autofocus: "end",
    editorProps: {
      attributes: {
        id: "input-text-area",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Your text",
        class:
          "rich-input w-full flex-1 p-5 text-sm md:text-[15px] leading-relaxed text-gray-700 focus:outline-none min-h-[180px]",
      },
    },
    onUpdate: ({ editor }) => {
      const json = editor.getJSON() as DocNode;
      onChangeRef.current(json, fromDoc(json));
    },
  });

  // Content replaced from outside; emitUpdate stays off so it doesn't echo back as a user edit
  useEffect(() => {
    if (editor && docVersion > 0) editor.commands.setContent(doc, { emitUpdate: false });
    // Only a version bump means new outside content; `doc` itself changes on every keystroke
  }, [editor, docVersion]);

  // The placeholder follows the selected language; an empty transaction redraws it
  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.view.dispatch(editor.state.tr);
  }, [editor, placeholder]);

  return <EditorContent editor={editor} className="flex-1 flex flex-col" />;
}
