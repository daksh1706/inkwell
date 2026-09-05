import { useEffect, useRef } from 'react';
import { actions } from '@/lib/store';
import {
  Bold, Italic, Underline, Heading1, Heading2, Heading3,
  List, ListOrdered, Code, Quote, CheckSquare, Link as LinkIcon, Strikethrough,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const cmd = (c, v) => document.execCommand(c, false, v);

export default function NotesEditor({ page, fullWidth }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (page.notes || '')) {
      ref.current.innerHTML = page.notes || '';
    }
  }, [page.id]); // eslint-disable-line

  const onInput = () => {
    if (!ref.current) return;
    actions.updatePage(page.id, { notes: ref.current.innerHTML });
  };

  const apply = (c, v) => {
    ref.current?.focus();
    cmd(c, v);
    onInput();
  };

  const insertCheckbox = () => {
    ref.current?.focus();
    cmd('insertHTML', '<label style="display:flex;align-items:center;gap:6px"><input type="checkbox"> Task</label><br>');
    onInput();
  };

  const insertLink = () => {
    const url = window.prompt('Enter URL:');
    if (url) apply('createLink', url);
  };

  return (
    <div className={cn('h-full flex flex-col', fullWidth && 'items-center')}>
      {/* Sticky formatting toolbar */}
      <div className={cn('sticky top-0 z-10 bg-background/85 backdrop-blur-xl border-b border-border w-full', fullWidth && 'px-8')}>
        <div
          className={cn('flex flex-wrap items-center gap-0.5 py-2 px-2', fullWidth && 'max-w-3xl mx-auto')}
          data-testid="notes-toolbar"
        >
          <Btn onClick={() => apply('formatBlock', 'H1')} icon={<Heading1 className="w-4 h-4" />} title="Heading 1" t="notes-h1" />
          <Btn onClick={() => apply('formatBlock', 'H2')} icon={<Heading2 className="w-4 h-4" />} title="Heading 2" t="notes-h2" />
          <Btn onClick={() => apply('formatBlock', 'H3')} icon={<Heading3 className="w-4 h-4" />} title="Heading 3" t="notes-h3" />
          <Divider />
          <Btn onClick={() => apply('bold')}          icon={<Bold          className="w-4 h-4" />} title="Bold"          t="notes-bold"   />
          <Btn onClick={() => apply('italic')}        icon={<Italic        className="w-4 h-4" />} title="Italic"        t="notes-italic" />
          <Btn onClick={() => apply('underline')}     icon={<Underline     className="w-4 h-4" />} title="Underline"     t="notes-underline" />
          <Btn onClick={() => apply('strikeThrough')} icon={<Strikethrough className="w-4 h-4" />} title="Strikethrough" t="notes-strike" />
          <Divider />
          <Btn onClick={() => apply('insertUnorderedList')} icon={<List        className="w-4 h-4" />} title="Bullet list"    t="notes-ul"    />
          <Btn onClick={() => apply('insertOrderedList')}   icon={<ListOrdered className="w-4 h-4" />} title="Numbered list"  t="notes-ol"    />
          <Btn onClick={insertCheckbox}                     icon={<CheckSquare className="w-4 h-4" />} title="Checklist"      t="notes-check" />
          <Divider />
          <Btn onClick={() => apply('formatBlock', 'BLOCKQUOTE')} icon={<Quote className="w-4 h-4" />} title="Blockquote"  t="notes-quote" />
          <Btn onClick={() => apply('formatBlock', 'PRE')}         icon={<Code  className="w-4 h-4" />} title="Code block"  t="notes-code"  />
          <Btn onClick={insertLink}                                 icon={<LinkIcon className="w-4 h-4" />} title="Link"    t="notes-link"  />
        </div>
      </div>

      {/* Content-editable area */}
      <div className={cn('flex-1 w-full overflow-auto scrollbar-thin', fullWidth && 'px-8 py-6')}>
        <div
          ref={ref}
          data-testid="notes-editor"
          contentEditable
          suppressContentEditableWarning
          onInput={onInput}
          data-placeholder="Start writing your notes… try heading, lists, or code blocks."
          className={cn(
            'prose-note outline-none w-full min-h-[70vh]',
            fullWidth ? 'max-w-3xl mx-auto py-8' : 'px-6 py-6'
          )}
        />
      </div>
    </div>
  );
}

function Btn({ onClick, icon, title, t }) {
  return (
    <button data-testid={t} title={title} onClick={onClick} className="tool-btn">
      {icon}
    </button>
  );
}
function Divider() {
  return <div className="w-px h-5 bg-border mx-1 flex-shrink-0" />;
}