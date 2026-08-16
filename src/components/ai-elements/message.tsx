"use client";

import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import { ExpandableImage } from "@/components/ui/expandable-image";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { cjk } from "@streamdown/cjk";
import { createMathPlugin } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
} from "./code-block";

import type { UIMessage } from "ai";
import { ChevronLeftIcon, ChevronRightIcon, ExternalLink } from "lucide-react";
import type { ComponentProps, HTMLAttributes, ReactElement } from "react";
import { createContext, memo, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Streamdown } from "streamdown";

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage["role"];
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex w-full max-w-[95%] flex-col gap-2",
      from === "user" ? "is-user ml-auto justify-end" : "is-assistant",
      className,
    )}
    {...props}
  />
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageContent = ({ children, className, ...props }: MessageContentProps) => (
  <div
    className={cn(
      "is-user:dark flex w-fit min-w-0 max-w-full flex-col gap-2 overflow-hidden text-base sm:text-[17px] leading-relaxed",
      "group-[.is-user]:ml-auto group-[.is-user]:rounded-2xl group-[.is-user]:bg-secondary group-[.is-user]:px-5 group-[.is-user]:py-3.5 group-[.is-user]:text-foreground group-[.is-user]:font-medium",
      "group-[.is-assistant]:text-foreground",
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

export type MessageActionsProps = ComponentProps<"div">;

export const MessageActions = ({ className, children, ...props }: MessageActionsProps) => (
  <div className={cn("flex items-center gap-1", className)} {...props}>
    {children}
  </div>
);

export type MessageActionProps = ComponentProps<typeof Button> & {
  tooltip?: string;
  label?: string;
};

export const MessageAction = ({
  tooltip,
  children,
  label,
  variant = "ghost",
  size = "icon-sm",
  ...props
}: MessageActionProps) => {
  const button = (
    <Button size={size} type="button" variant={variant} {...props}>
      {children}
      <span className="sr-only">{label || tooltip}</span>
    </Button>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
};

interface MessageBranchContextType {
  currentBranch: number;
  totalBranches: number;
  goToPrevious: () => void;
  goToNext: () => void;
  branches: ReactElement[];
  setBranches: (branches: ReactElement[]) => void;
}

const MessageBranchContext = createContext<MessageBranchContextType | null>(null);

const useMessageBranch = () => {
  const context = useContext(MessageBranchContext);

  if (!context) {
    throw new Error("MessageBranch components must be used within MessageBranch");
  }

  return context;
};

export type MessageBranchProps = HTMLAttributes<HTMLDivElement> & {
  defaultBranch?: number;
  onBranchChange?: (branchIndex: number) => void;
};

export const MessageBranch = ({
  defaultBranch = 0,
  onBranchChange,
  className,
  ...props
}: MessageBranchProps) => {
  const [currentBranch, setCurrentBranch] = useState(defaultBranch);
  const [branches, setBranches] = useState<ReactElement[]>([]);

  const handleBranchChange = useCallback(
    (newBranch: number) => {
      setCurrentBranch(newBranch);
      onBranchChange?.(newBranch);
    },
    [onBranchChange],
  );

  const goToPrevious = useCallback(() => {
    const newBranch = currentBranch > 0 ? currentBranch - 1 : branches.length - 1;
    handleBranchChange(newBranch);
  }, [currentBranch, branches.length, handleBranchChange]);

  const goToNext = useCallback(() => {
    const newBranch = currentBranch < branches.length - 1 ? currentBranch + 1 : 0;
    handleBranchChange(newBranch);
  }, [currentBranch, branches.length, handleBranchChange]);

  const contextValue = useMemo<MessageBranchContextType>(
    () => ({
      branches,
      currentBranch,
      goToNext,
      goToPrevious,
      setBranches,
      totalBranches: branches.length,
    }),
    [branches, currentBranch, goToNext, goToPrevious],
  );

  return (
    <MessageBranchContext.Provider value={contextValue}>
      <div className={cn("grid w-full gap-2 [&>div]:pb-0", className)} {...props} />
    </MessageBranchContext.Provider>
  );
};

export type MessageBranchContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageBranchContent = ({ children, ...props }: MessageBranchContentProps) => {
  const { currentBranch, setBranches, branches } = useMessageBranch();
  const childrenArray = useMemo(
    () => (Array.isArray(children) ? children : [children]),
    [children],
  );

  // Use useEffect to update branches when they change
  useEffect(() => {
    if (branches.length !== childrenArray.length) {
      setBranches(childrenArray);
    }
  }, [childrenArray, branches, setBranches]);

  return childrenArray.map((branch, index) => (
    <div
      className={cn(
        "grid gap-2 overflow-hidden [&>div]:pb-0",
        index === currentBranch ? "block" : "hidden",
      )}
      key={branch.key}
      {...props}
    >
      {branch}
    </div>
  ));
};

export type MessageBranchSelectorProps = ComponentProps<typeof ButtonGroup>;

export const MessageBranchSelector = ({ className, ...props }: MessageBranchSelectorProps) => {
  const { totalBranches } = useMessageBranch();

  // Don't render if there's only one branch
  if (totalBranches <= 1) {
    return null;
  }

  return (
    <ButtonGroup
      className={cn(
        "[&>*:not(:first-child)]:rounded-l-md [&>*:not(:last-child)]:rounded-r-md",
        className,
      )}
      orientation="horizontal"
      {...props}
    />
  );
};

export type MessageBranchPreviousProps = ComponentProps<typeof Button>;

export const MessageBranchPrevious = ({ children, ...props }: MessageBranchPreviousProps) => {
  const { goToPrevious, totalBranches } = useMessageBranch();

  return (
    <Button
      aria-label="Previous branch"
      disabled={totalBranches <= 1}
      onClick={goToPrevious}
      size="icon-sm"
      type="button"
      variant="ghost"
      {...props}
    >
      {children ?? <ChevronLeftIcon size={14} />}
    </Button>
  );
};

export type MessageBranchNextProps = ComponentProps<typeof Button>;

export const MessageBranchNext = ({ children, ...props }: MessageBranchNextProps) => {
  const { goToNext, totalBranches } = useMessageBranch();

  return (
    <Button
      aria-label="Next branch"
      disabled={totalBranches <= 1}
      onClick={goToNext}
      size="icon-sm"
      type="button"
      variant="ghost"
      {...props}
    >
      {children ?? <ChevronRightIcon size={14} />}
    </Button>
  );
};

export type MessageBranchPageProps = HTMLAttributes<HTMLSpanElement>;

export const MessageBranchPage = ({ className, ...props }: MessageBranchPageProps) => {
  const { currentBranch, totalBranches } = useMessageBranch();

  return (
    <ButtonGroupText
      className={cn("border-none bg-transparent text-muted-foreground shadow-none", className)}
      {...props}
    >
      {currentBranch + 1} of {totalBranches}
    </ButtonGroupText>
  );
};

export type MessageResponseProps = ComponentProps<typeof Streamdown>;

const mathPlugin = createMathPlugin({ singleDollarTextMath: true });
const streamdownPlugins = { cjk, math: mathPlugin, mermaid } as never;

import "katex/dist/katex.min.css";

function preprocessMarkdown(children?: React.ReactNode): string {
  if (typeof children !== "string") return "";
  let text = children;

  // 1. Force fenced code blocks with language tags to start on a new line
  text = text.replace(/([^\s])([ \t]*)(```[a-zA-Z]+)/g, "$1\n\n$2$3");
  text = text.replace(/(```)(?![a-zA-Z])([ \t]*)([^\s])/g, "$1\n\n$2$4");

  // 2. Fix rogue $ at the start of a line
  text = text.replace(/(^|\n)\$\s+/g, "$1\\$ ");

  // 3. Convert \( ... \) inline math to $ ... $
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, " $1 ");

  // 4. Convert \[ ... \] display math to \n$$\n...\n$$\n
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, p1) => `\n$$\n${p1}\n$$\n`);

  // 5. Clean up $$ blocks. We iterate through all $$ pairs.
  const parts = text.split("$$");
  for (let i = 1; i < parts.length; i += 2) {
    if (i + 1 >= parts.length) break;

    const before = parts[i - 1]!;
    const mathContent = parts[i]!;
    const after = parts[i + 1]!;

    const isInline =
      !mathContent.includes("\n") && (/[^\s\r\n]$/.test(before) || /^[^\s\r\n]/.test(after));

    if (isInline) {
      parts[i - 1] = before + " $";
      parts[i] = mathContent.trim();
      parts[i + 1] = "$ " + after;
    } else {
      parts[i - 1] = before.replace(/[ \t]*\r?\n?[ \t]*$/, "") + "\n\n$$\n";
      parts[i] = mathContent.trim();
      parts[i + 1] = "\n$$\n\n" + after.replace(/^[ \t]*\r?\n?[ \t]*/, "");
    }
  }

  text = parts[0] || "";
  for (let i = 1; i < parts.length; i += 2) {
    if (i + 1 < parts.length) {
      text += (parts[i] || "") + (parts[i + 1] || "");
    } else {
      text += "$$" + (parts[i] || "");
    }
  }

  // ROBUST FIX: Prevent $ from spanning code blocks or double newlines.
  const blocks: string[] = [];
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (match) => {
    blocks.push(match);
    return `__MATH_BLOCK_${blocks.length - 1}__`;
  });

  const inlines: string[] = [];
  // Reject match if it contains ``` or \n\n
  text = text.replace(/\$((?:(?!\n\n|```)[\s\S])+?)\$/g, (match) => {
    inlines.push(match);
    return `__MATH_INLINE_${inlines.length - 1}__`;
  });

  // Escape any remaining unpaired/rogue $
  text = text.replace(/\$/g, "\\$");

  text = text.replace(/__MATH_INLINE_(\d+)__/g, (_, i) => inlines[Number(i)] || "");
  text = text.replace(/__MATH_BLOCK_(\d+)__/g, (_, i) => blocks[Number(i)] || "");

  return text;
}

export const MessageResponse = memo(
  ({ className, components, children, ...props }: MessageResponseProps) => (
    <Streamdown
      className={cn(
        "size-full text-base sm:text-[17px] leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className,
      )}
      plugins={streamdownPlugins}
      components={{
        img: ({ src, alt }) =>
          src ? (
            <ExpandableImage
              src={typeof src === "string" ? src : ""}
              alt={typeof alt === "string" ? alt : "Markdown image"}
              containerClassName="my-4 max-w-2xl shadow-sm"
              imageClassName="max-h-[500px] w-full object-contain"
              showCaption={true}
              caption={typeof alt === "string" && alt !== "image" ? alt : undefined}
            />
          ) : null,
        code: ({ className, children, ...props }) => {
          const match = /language-(\w+)/.exec(className || "");
          if (match && match[1]) {
            const lang = match[1];
            const codeText = String(children).replace(/\n$/, "");

            return (
              <CodeBlock
                code={codeText}
                language={lang as never}
                className="my-4 shadow-sm"
                showLineNumbers
              >
                <CodeBlockHeader>
                  <CodeBlockTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                    {lang}
                  </CodeBlockTitle>
                  <CodeBlockActions>
                    <CodeBlockCopyButton />
                  </CodeBlockActions>
                </CodeBlockHeader>
              </CodeBlock>
            );
          }
          return (
            <code
              className={cn("bg-muted px-1.5 py-0.5 rounded-md font-mono text-[13.5px]", className)}
              {...props}
            >
              {children}
            </code>
          );
        },
        pre: ({ children }) => <>{children}</>,
        a: ({ href, children, ...props }) => {
          const isExternal =
            typeof href === "string" && (href.startsWith("http://") || href.startsWith("https://"));
          const text = typeof children === "string" ? children.trim() : "";
          const isNumericBadge = /^\[?\d+\]?$/.test(text);

          if (isNumericBadge) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-full bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-[11px] px-1.5 py-0.5 mx-0.5 align-super no-underline border border-primary/20 transition-colors shadow-xs"
                title={href}
                {...props}
              >
                {children}
              </a>
            );
          }

          if (isExternal) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline underline-offset-4 decoration-primary/50 transition-colors"
                {...props}
              >
                <span>{children}</span>
                <ExternalLink className="inline-block size-3.5 shrink-0 opacity-70" />
              </a>
            );
          }

          return (
            <a
              href={href}
              className="font-medium text-primary hover:underline underline-offset-4 decoration-primary/50 transition-colors"
              {...props}
            >
              {children}
            </a>
          );
        },
        ...components,
      }}
      {...props}
    >
      {preprocessMarkdown(children)}
    </Streamdown>
  ),
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children && nextProps.isAnimating === prevProps.isAnimating,
);

MessageResponse.displayName = "MessageResponse";

export type MessageToolbarProps = ComponentProps<"div">;

export const MessageToolbar = ({ className, children, ...props }: MessageToolbarProps) => (
  <div className={cn("mt-4 flex w-full items-center justify-between gap-4", className)} {...props}>
    {children}
  </div>
);
