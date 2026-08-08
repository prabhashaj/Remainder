import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Heading1, LayoutTemplate, ListTodo, Plus, Quote, Star, Text, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import "katex/dist/katex.min.css";

import { ExpandableImage } from "@/components/ui/expandable-image";
import { Button } from "@/components/ui/button";

const streamdownPlugins = { cjk, code, math, mermaid } as never;

function preprocessLatexText(text: string): string {
  if (typeof text !== "string") return "";
  let result = text;

  // Convert \( ... \) inline math to $ ... $
  result = result.replace(/\\\(([\s\S]*?)\\\)/g, " $1 ");

  // Convert \[ ... \] display math to \n$$\n$1\n$$\n
  result = result.replace(/\\\[([\s\S]*?)\\\]/g, "\n$$\n$1\n$$\n");

  // Convert inline $$ ... $$ inside sentences into $ ... $
  result = result.replace(/([^\n])\$\$([^\n\$\#]+?)\$\$/g, "$1$$2$");
  result = result.replace(/\$\$([^\n\$\#]+?)\$\$([^\n])/g, "$$1$$2");

  // Ensure block display math equations $$ ... $$ have newlines around them
  result = result.replace(/([^\n])\$\$([\s\S]+?)\$\$/g, "$1\n\n$$\n$2\n$$\n");
  result = result.replace(/\$\$([\s\S]+?)\$\$([^\n])/g, "\n$$\n$1\n$$\n$2");

  return result;
}
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  createBlock,
  createPage,
  deleteBlock,
  deletePage,
  fetchBlocks,
  fetchPage,
  updateBlock,
  updatePage,
  type Block,
} from "@/lib/db";

export const Route = createFileRoute("/_authenticated/page/$pageId")({
  head: () => ({
    meta: [
      { title: "Notebook — Remainder" },
      { name: "description", content: "Write, nest and check things off in your Remainder notebook." },
      { property: "og:title", content: "Notebook — Remainder" },
      { property: "og:description", content: "A soft, flexible notebook page in Remainder." },
    ],
  }),
  component: PageView,
});

const BLOCK_TYPES = [
  { type: "text", label: "Text", icon: Text },
  { type: "heading", label: "Heading", icon: Heading1 },
  { type: "todo", label: "To-do", icon: ListTodo },
  { type: "quote", label: "Quote", icon: Quote },
  { type: "divider", label: "Divider", icon: Plus },
] as const;

type TemplateDef = {
  id: string;
  name: string;
  icon: string;
  description: string;
  blocks: { type: string; content: string }[];
};

const PAGE_TEMPLATES: TemplateDef[] = [
  {
    id: "cornell",
    name: "Cornell Study Notes",
    icon: "📖",
    description: "Structured cue column, detailed notes, and core summary",
    blocks: [
      { type: "heading", content: "Cue Column & Questions" },
      { type: "todo", content: "What is the primary mechanism?" },
      { type: "todo", content: "What are key edge cases to remember?" },
      { type: "heading", content: "Detailed Class & Reading Notes" },
      { type: "text", content: "Write comprehensive notes, derivations, and explanations here..." },
      { type: "quote", content: "Core Takeaway: Summarize the single most essential concept." },
      { type: "divider", content: "" },
      { type: "heading", content: "Summary (3 Sentences)" },
      { type: "text", content: "1. Key concept 1\n2. Key concept 2\n3. Practical application" },
    ],
  },
  {
    id: "focus",
    name: "Daily Focus & Reflection",
    icon: "⚡",
    description: "Daily intention, top 3 priorities, and reflection",
    blocks: [
      { type: "quote", content: "Intention: What does done look like today?" },
      { type: "heading", content: "Top 3 Priorities" },
      { type: "todo", content: "High priority task 1" },
      { type: "todo", content: "High priority task 2" },
      { type: "todo", content: "High priority task 3" },
      { type: "heading", content: "Wins & Reflections" },
      { type: "text", content: "What went well today? What can be improved tomorrow?" },
    ],
  },
  {
    id: "exam",
    name: "Exam & Project Prep",
    icon: "🎯",
    description: "Topic checklist, practice problems, and formula references",
    blocks: [
      { type: "heading", content: "Core Topics to Master" },
      { type: "todo", content: "Review foundational concepts" },
      { type: "todo", content: "Complete practice problem set" },
      { type: "todo", content: "Self-test with flashcards" },
      { type: "quote", content: "Target Score / Mastery Goal: 90%+" },
    ],
  },
  {
    id: "code",
    name: "Engineering & Code Log",
    icon: "🧪",
    description: "Architecture design, edge cases, and safety checks",
    blocks: [
      { type: "heading", content: "System Goal & Architecture" },
      { type: "text", content: "Describe the component responsibility, API endpoints, or data structures..." },
      { type: "heading", content: "Edge Cases & Safety Checks" },
      { type: "todo", content: "Verify null / empty input payloads" },
      { type: "todo", content: "Check error boundaries and fallback handlers" },
    ],
  },
];

function PageView() {
  const { pageId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: page } = useQuery({ queryKey: ["page", pageId], queryFn: () => fetchPage(pageId) });
  const { data: blocks = [] } = useQuery({
    queryKey: ["blocks", pageId],
    queryFn: () => fetchBlocks(pageId),
  });

  const [title, setTitle] = useState("");
  useEffect(() => setTitle(page?.title ?? ""), [page?.title]);

  const refreshBlocks = () => void qc.invalidateQueries({ queryKey: ["blocks", pageId] });
  const refreshPages = () => {
    void qc.invalidateQueries({ queryKey: ["pages"] });
    void qc.invalidateQueries({ queryKey: ["page", pageId] });
  };

  const savePage = useMutation({
    mutationFn: (patch: Parameters<typeof updatePage>[1]) => updatePage(pageId, patch),
    onSuccess: refreshPages,
  });

  const addBlock = useMutation({
    mutationFn: (type: string) => createBlock({ page_id: pageId, type, position: blocks.length }),
    onSuccess: refreshBlocks,
  });

  const applyTemplate = useMutation({
    mutationFn: async (tpl: TemplateDef) => {
      // Update page icon and title if default
      if (!page?.title || page.title === "Untitled") {
        await updatePage(pageId, { title: tpl.name, icon: tpl.icon });
        setTitle(tpl.name);
      }
      // Insert template blocks sequentially
      let startPos = blocks.length;
      for (const b of tpl.blocks) {
        await createBlock({
          page_id: pageId,
          type: b.type,
          content: b.content,
          position: startPos++,
        });
      }
    },
    onSuccess: refreshPages,
  });

  const addSubpage = useMutation({
    mutationFn: () => createPage({ parent_id: pageId, title: "Untitled" }),
    onSuccess: (child) => {
      refreshPages();
      navigate({ to: "/page/$pageId", params: { pageId: child.id } });
    },
  });

  const removePage = useMutation({
    mutationFn: () => deletePage(pageId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["pages"] });
      navigate({ to: "/dashboard" });
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="mx-auto max-w-4xl px-6 py-12 sm:px-10"
    >
      {/* Notebook Header */}
      <div className="flex items-center gap-3 pb-4">
        <span className="text-4xl sm:text-5xl select-none transition-transform hover:scale-110">
          {page?.icon ?? "📄"}
        </span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== page?.title && savePage.mutate({ title: title || "Untitled" })}
          placeholder="Untitled"
          aria-label="Page title"
          className="min-w-0 flex-1 bg-transparent font-display text-3xl sm:text-4xl font-extrabold tracking-tight outline-none placeholder:text-muted-foreground/40 transition-colors focus:placeholder:text-muted-foreground/20"
        />
        <motion.div whileTap={{ scale: 1.25, rotate: 15 }}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Toggle favorite"
            onClick={() => savePage.mutate({ is_favorite: !page?.is_favorite })}
            className="mt-1 rounded-2xl hover:bg-accent/60"
          >
            <Star
              className={`size-5 transition-colors ${
                page?.is_favorite ? "fill-amber-500 text-amber-500" : "text-muted-foreground/60"
              }`}
            />
          </Button>
        </motion.div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Delete page"
          onClick={() => removePage.mutate()}
          className="mt-1 rounded-2xl text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="size-5" />
        </Button>
      </div>

      {/* Notebook Blocks */}
      <div className="mt-8 space-y-2">
        <AnimatePresence initial={false}>
          {blocks.map((block) => (
            <motion.div
              key={block.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <BlockRow block={block} onChanged={refreshBlocks} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Add Block Bar */}
      <div className="mt-8 flex flex-wrap items-center gap-3 pt-4 border-t border-border/40">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <motion.div whileTap={{ scale: 0.96 }}>
              <Button variant="secondary" className="press gap-2 rounded-2xl px-4 py-2.5 text-base font-semibold shadow-xs">
                <Plus className="size-4 text-primary" /> Add block
              </Button>
            </motion.div>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="rounded-2xl p-2 w-48 shadow-lg">
            {BLOCK_TYPES.map((b) => {
              const IconComp = b.icon;
              return (
                <DropdownMenuItem
                  key={b.type}
                  className="rounded-xl gap-2.5 px-3 py-2 text-base font-medium cursor-pointer transition-colors"
                  onClick={() => addBlock.mutate(b.type)}
                >
                  <IconComp className="size-4 text-muted-foreground" />
                  {b.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <motion.div whileTap={{ scale: 0.96 }}>
          <Button
            variant="ghost"
            onClick={() => addSubpage.mutate()}
            className="press gap-2 rounded-2xl px-4 py-2.5 text-base font-medium text-muted-foreground hover:text-foreground"
          >
            <Plus className="size-4" /> Sub-page
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}

function BlockRow({ block, onChanged }: { block: Block; onChanged: () => void }) {
  const [value, setValue] = useState(block.content);
  const [isEditing, setIsEditing] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setValue(block.content), [block.content]);
  useEffect(() => {
    if (isEditing && ref.current) {
      ref.current.focus();
      ref.current.style.height = "auto";
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    }
  }, [isEditing, value]);

  const save = useMutation({
    mutationFn: (patch: Parameters<typeof updateBlock>[1]) => updateBlock(block.id, patch),
    onSuccess: onChanged,
  });
  const remove = useMutation({ mutationFn: () => deleteBlock(block.id), onSuccess: onChanged });

  if (block.type === "divider") {
    return (
      <div className="group flex items-center gap-3 py-4">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
        <DeleteBlock onClick={() => remove.mutate()} />
      </div>
    );
  }

  const textClass =
    block.type === "heading"
      ? "font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-4 mb-1"
      : block.type === "quote"
        ? "border-l-4 border-amber-500/70 bg-amber-500/10 dark:bg-amber-500/15 p-4 rounded-r-2xl italic text-foreground font-medium text-[17px] sm:text-lg leading-relaxed shadow-2xs my-2"
        : "text-[17px] sm:text-lg leading-relaxed text-foreground/90 font-normal";

  return (
    <div className="group flex items-start gap-3 rounded-2xl px-3 py-1.5 transition-all duration-200 hover:bg-muted/40">
      {block.type === "todo" && (
        <Checkbox
          checked={block.checked}
          onCheckedChange={(v) => save.mutate({ checked: Boolean(v) })}
          className="mt-2 size-5 rounded-lg border-2 transition-transform active:scale-95"
        />
      )}
      {isEditing ? (
        <textarea
          ref={ref}
          value={value}
          rows={1}
          onChange={(e) => {
            setValue(e.target.value);
            if (ref.current) {
              ref.current.style.height = "auto";
              ref.current.style.height = `${ref.current.scrollHeight}px`;
            }
          }}
          onBlur={() => {
            setIsEditing(false);
            if (value !== block.content) {
              save.mutate({ content: value });
            }
          }}
          placeholder={block.type === "heading" ? "Heading" : "Write something…"}
          aria-label="Block content"
          className={`flex-1 resize-none bg-transparent py-1 outline-none placeholder:text-muted-foreground/40 ${textClass} ${
            block.type === "todo" && block.checked ? "text-muted-foreground line-through opacity-70" : ""
          }`}
        />
      ) : (
        <div
          onClick={() => setIsEditing(true)}
          className={`flex-1 cursor-text py-1 min-h-[36px] ${textClass} ${
            block.type === "todo" && block.checked ? "text-muted-foreground line-through opacity-70" : ""
          }`}
        >
          {value ? (
            <Streamdown
              plugins={streamdownPlugins}
              components={{
                img: ({ src, alt }) =>
                  src ? (
                    <ExpandableImage
                      src={typeof src === "string" ? src : ""}
                      alt={typeof alt === "string" ? alt : "Notebook diagram"}
                      containerClassName="my-3 max-w-2xl shadow-sm"
                      imageClassName="max-h-[500px] w-full object-contain"
                      showCaption={true}
                      caption={typeof alt === "string" && alt !== "image" ? alt : undefined}
                    />
                  ) : null,
              }}
              className="prose-base sm:prose-lg max-w-none text-inherit [&>p]:m-0 [&>p]:inline"
            >
              {preprocessLatexText(value)}
            </Streamdown>
          ) : (
            <span className="text-muted-foreground/40 italic font-normal">
              {block.type === "heading" ? "Heading" : "Write something…"}
            </span>
          )}
        </div>
      )}
      <DeleteBlock onClick={() => remove.mutate()} />
    </div>
  );
}

function DeleteBlock({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Delete block"
      onClick={onClick}
      className="mt-1 rounded-xl text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 opacity-0 transition-all group-hover:opacity-100"
    >
      <Trash2 className="size-4" />
    </Button>
  );
}
