'use client';

import React, { useRef, useEffect, useState } from 'react';

export interface DocNotesEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function DocNotesEditor({
  value,
  onChange,
  placeholder = 'Write terms, inspection instructions, or special notes here...',
  disabled = false,
  className = '',
  id = 'notes-editor',
}: DocNotesEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);
  const [activeStyles, setActiveStyles] = useState<{
    bold: boolean;
    italic: boolean;
    underline: boolean;
    unorderedList: boolean;
    orderedList: boolean;
  }>({
    bold: false,
    italic: false,
    underline: false,
    unorderedList: false,
    orderedList: false,
  });

  // Sync value from props to editor only if different
  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || '';
      }
    }
    isInternalChange.current = false;
  }, [value]);

  const updateActiveStates = () => {
    try {
      setActiveStyles({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        unorderedList: document.queryCommandState('insertUnorderedList'),
        orderedList: document.queryCommandState('insertOrderedList'),
      });
    } catch {
      // Ignored if queryCommandState is unavailable
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      isInternalChange.current = true;
      const html = editorRef.current.innerHTML;
      onChange(html);
      updateActiveStates();
    }
  };

  const executeCommand = (command: string, arg: string | undefined = undefined) => {
    if (disabled) return;
    editorRef.current?.focus();
    try {
      document.execCommand(command, false, arg);
      handleInput();
      updateActiveStates();
    } catch {
      // Fallback
    }
  };

  return (
    <div
      className={`w-full flex flex-col rounded-md border border-border bg-card focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all shadow-xs ${className}`}
    >
      {/* Rich Text Toolbar with Font Awesome icons */}
      <div className="flex flex-wrap items-center gap-1 px-2 py-1 border-b border-border bg-muted/40 text-muted-foreground select-none print:hidden">
        {/* Bold */}
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => executeCommand('bold')}
          title="Bold"
          className={`w-6 h-6 flex items-center justify-center rounded-sm text-xs transition-colors cursor-pointer disabled:opacity-40 ${
            activeStyles.bold
              ? 'bg-primary/15 text-primary font-bold'
              : 'hover:bg-muted hover:text-foreground text-foreground/80'
          }`}
        >
          <i className="fa-solid fa-bold text-[10px]" />
        </button>

        {/* Italic */}
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => executeCommand('italic')}
          title="Italic"
          className={`w-6 h-6 flex items-center justify-center rounded-sm text-xs transition-colors cursor-pointer disabled:opacity-40 ${
            activeStyles.italic
              ? 'bg-primary/15 text-primary font-bold'
              : 'hover:bg-muted hover:text-foreground text-foreground/80'
          }`}
        >
          <i className="fa-solid fa-italic text-[10px]" />
        </button>

        {/* Underline */}
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => executeCommand('underline')}
          title="Underline"
          className={`w-6 h-6 flex items-center justify-center rounded-sm text-xs transition-colors cursor-pointer disabled:opacity-40 ${
            activeStyles.underline
              ? 'bg-primary/15 text-primary font-bold'
              : 'hover:bg-muted hover:text-foreground text-foreground/80'
          }`}
        >
          <i className="fa-solid fa-underline text-[10px]" />
        </button>

        <div className="w-[1px] h-3 bg-border mx-0.5" />

        {/* Bullet List */}
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => executeCommand('insertUnorderedList')}
          title="Bullet List"
          className={`w-6 h-6 flex items-center justify-center rounded-sm text-xs transition-colors cursor-pointer disabled:opacity-40 ${
            activeStyles.unorderedList
              ? 'bg-primary/15 text-primary font-bold'
              : 'hover:bg-muted hover:text-foreground text-foreground/80'
          }`}
        >
          <i className="fa-solid fa-list-ul text-[10px]" />
        </button>

        {/* Numbered List */}
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => executeCommand('insertOrderedList')}
          title="Numbered List"
          className={`w-6 h-6 flex items-center justify-center rounded-sm text-xs transition-colors cursor-pointer disabled:opacity-40 ${
            activeStyles.orderedList
              ? 'bg-primary/15 text-primary font-bold'
              : 'hover:bg-muted hover:text-foreground text-foreground/80'
          }`}
        >
          <i className="fa-solid fa-list-ol text-[10px]" />
        </button>

        <div className="w-[1px] h-3 bg-border mx-0.5" />

        {/* Clear Formatting */}
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => executeCommand('removeFormat')}
          title="Clear Formatting"
          className="w-6 h-6 flex items-center justify-center rounded-sm text-xs hover:bg-muted hover:text-foreground text-muted-foreground transition-colors cursor-pointer disabled:opacity-40"
        >
          <i className="fa-solid fa-eraser text-[10px]" />
        </button>
      </div>

      {/* Content Editable Area */}
      <div className="relative min-h-[64px] p-2">
        <div
          ref={editorRef}
          id={id}
          contentEditable={!disabled}
          onInput={handleInput}
          onKeyUp={updateActiveStates}
          onMouseUp={updateActiveStates}
          role="textbox"
          aria-multiline="true"
          aria-label="Notes description"
          style={{ outline: 'none' }}
          className={`w-full min-h-[56px] text-[13px] text-foreground outline-none focus:outline-none focus-visible:outline-none leading-relaxed [&>p]:mb-1 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 ${
            disabled ? 'opacity-60 cursor-not-allowed' : ''
          }`}
          data-placeholder={placeholder}
        />
        {(!value || value === '<br>' || value === '' || value === '<p></p>') && (
          <div
            onClick={() => editorRef.current?.focus()}
            className="absolute top-2 left-2 text-muted-foreground/50 font-normal text-[13px] pointer-events-none select-none italic"
          >
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
}

export default DocNotesEditor;
