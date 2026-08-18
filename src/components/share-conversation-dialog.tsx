import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Share2,
  Copy,
  Check,
  Globe,
  Lock,
  RefreshCw,
  Trash2,
  Loader2,
  ExternalLink,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  fetchThreadShare,
  createOrUpdateThreadShare,
  deleteThreadShare,
  type SharedConversation,
} from "@/lib/db";
import { useSession } from "@/hooks/use-session";

interface ShareConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threadId: string;
  threadTitle?: string;
  messages?: any[];
}

export function ShareConversationDialog({
  open,
  onOpenChange,
  threadId,
  threadTitle = "Conversation with Remi",
  messages = [],
}: ShareConversationDialogProps) {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const [copied, setCopied] = useState(false);
  const [customTitle, setCustomTitle] = useState(threadTitle);
  const [isAnonymous, setIsAnonymous] = useState(false);

  useEffect(() => {
    if (open) {
      setCustomTitle(threadTitle || "Conversation with Remi");
      setCopied(false);
    }
  }, [open, threadTitle]);

  // Query existing share for this thread
  const {
    data: shareData,
    isLoading: isCheckingShare,
    refetch,
  } = useQuery({
    queryKey: ["thread-share", threadId],
    queryFn: () => fetchThreadShare(threadId),
    enabled: open && !!threadId,
  });

  const shareToken = shareData?.token;
  const shareUrl =
    typeof window !== "undefined" && shareToken
      ? `${window.location.origin}/share/${shareToken}`
      : "";

  // Mutation: Create or Update share
  const shareMutation = useMutation({
    mutationFn: async () => {
      const userMeta = session?.user?.user_metadata as Record<string, any> | undefined;
      const userName = userMeta?.["full_name"] || session?.user?.email?.split("@")[0];
      return await createOrUpdateThreadShare({
        threadId,
        title: customTitle.trim() || threadTitle || "Shared Conversation",
        messages,
        isAnonymous,
        userName: isAnonymous ? undefined : userName,
      });
    },
    onSuccess: (newShare) => {
      void queryClient.invalidateQueries({ queryKey: ["thread-share", threadId] });
      void refetch();
      const url = `${window.location.origin}/share/${newShare.token}`;
      void navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 3000);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to create share link");
    },
  });

  // Mutation: Delete share (Revoke public link)
  const deleteMutation = useMutation({
    mutationFn: async () => {
      await deleteThreadShare(threadId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["thread-share", threadId] });
      void refetch();
      toast.success("Share link revoked. This conversation is now private.");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to revoke share link");
    },
  });

  async function handleCopy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  }

  const messageCount = messages.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-5 rounded-2xl border-border/70 p-6 shadow-2xl backdrop-blur-md">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Share2 className="size-4" />
            </div>
            <DialogTitle className="text-lg font-semibold tracking-tight text-foreground">
              Share link to Chat
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
            Messages you send after creating this link won't be shared. Anyone with the link will be able to view this conversation snapshot.
          </DialogDescription>
        </DialogHeader>

        {isCheckingShare ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p className="mt-2 text-xs">Checking share settings…</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Conversation Snapshot Card */}
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="share-title" className="text-xs font-semibold text-foreground">
                  Conversation Title
                </Label>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <MessageSquare className="size-3" />
                  {messageCount} {messageCount === 1 ? "message" : "messages"}
                </span>
              </div>
              <Input
                id="share-title"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Give this conversation a title..."
                className="h-8 rounded-lg text-xs"
                disabled={shareMutation.isPending}
              />
            </div>

            {/* Anonymous Toggle */}
            <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background/50 px-3.5 py-2.5">
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-foreground">Share anonymously</p>
                <p className="text-[11px] text-muted-foreground">
                  Hide your name and account info from the shared page
                </p>
              </div>
              <Switch
                checked={isAnonymous}
                onCheckedChange={setIsAnonymous}
                disabled={shareMutation.isPending}
              />
            </div>

            {/* If Already Shared: Show Live URL & Actions */}
            {shareToken && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <Globe className="size-3.5" /> Public link active
                  </span>
                  <a
                    href={shareUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    Open <ExternalLink className="size-3" />
                  </a>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={shareUrl}
                    className="h-9 rounded-xl font-mono text-xs text-muted-foreground bg-muted/40 selection:bg-primary/20"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <Button
                    size="sm"
                    onClick={() => void handleCopy()}
                    className="h-9 shrink-0 gap-1.5 rounded-xl px-3.5"
                  >
                    {copied ? <Check className="size-3.5 text-emerald-300" /> : <Copy className="size-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t border-border/60">
          {shareToken ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending || shareMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                Revoke link
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 rounded-xl text-xs"
                  onClick={() => shareMutation.mutate()}
                  disabled={shareMutation.isPending}
                >
                  {shareMutation.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3.5" />
                  )}
                  Update snapshot
                </Button>

                <Button
                  size="sm"
                  className="h-8 gap-1.5 rounded-xl text-xs"
                  onClick={() => void handleCopy()}
                >
                  {copied ? <Check className="size-3.5 text-emerald-300" /> : <Copy className="size-3.5" />}
                  {copied ? "Copied" : "Copy Link"}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex w-full justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-xl text-xs"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-8 gap-1.5 rounded-xl text-xs px-4"
                onClick={() => shareMutation.mutate()}
                disabled={shareMutation.isPending || messageCount === 0}
              >
                {shareMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                Create Link
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
