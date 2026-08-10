import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Plug, CheckCircle2, Search, Zap, PowerOff, X, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import { MCP_CATALOG, type McpCatalogEntry } from "@/lib/mcp-catalog";
import { createMcpServer, deleteMcpServer, fetchMcpServers, updateMcpServer } from "@/lib/mcp";
import { PromptInputButton } from "@/components/ai-elements/prompt-input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function ConnectButton() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [expanding, setExpanding] = useState<string | null>(null);

  const [url, setUrl] = useState("");
  const [authHeader, setAuthHeader] = useState("");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");

  const { data: servers = [] } = useQuery({
    queryKey: ["mcp-servers"],
    queryFn: () => fetchMcpServers(supabase),
  });

  const enabledCount = useMemo(() => servers.filter((s) => s.enabled).length, [servers]);

  const addServer = useMutation({
    mutationFn: async (entry: McpCatalogEntry) => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Not logged in");

      if (entry.connectionType === "oauth") {
        // Mock oauth flow for Google providers by starting a supabase oauth signin
        // This will redirect, so we don't handle local state updates post-redirect here
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: window.location.origin,
            scopes:
              entry.id === "google-calendar"
                ? "https://www.googleapis.com/auth/calendar.readonly"
                : "https://www.googleapis.com/auth/drive.readonly",
          },
        });
        if (error) throw error;
        return;
      }

      // Ping to verify
      const { pingMcpServerFn } = await import("@/lib/mcp.functions");
      const result = await pingMcpServerFn({
        data: {
          transport: entry.connectionType === "stdio" ? "stdio" : "sse",
          url: entry.connectionType === "stdio" ? undefined : url,
          authHeader: entry.connectionType === "stdio" ? undefined : authHeader,
          command: entry.connectionType === "stdio" ? command : undefined,
          args: entry.connectionType === "stdio" ? args.split(" ").filter(Boolean) : undefined,
        },
      });

      if (!result.success) {
        throw new Error("Could not connect: " + result.error);
      }

      return createMcpServer(
        supabase,
        {
          name: entry.name,
          url: entry.connectionType === "stdio" ? null : url,
          transport: entry.connectionType === "stdio" ? "stdio" : "sse",
          command: entry.connectionType === "stdio" ? command : null,
          args: entry.connectionType === "stdio" ? args.split(" ").filter(Boolean) : null,
          env: null,
          auth_header_encrypted: authHeader || null,
          enabled: true,
          catalog_id: entry.id,
        },
        data.user.id,
      );
    },
    onSuccess: (res, entry) => {
      if (entry.connectionType === "oauth") return; // redirected
      void qc.invalidateQueries({ queryKey: ["mcp-servers"] });
      toast.success(`${entry.name} connected.`);
      setExpanding(null);
      setUrl("");
      setAuthHeader("");
      setCommand("");
      setArgs("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleServer = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      return updateMcpServer(supabase, id, { enabled });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mcp-servers"] });
    },
    onError: (err: Error) => toast.error("Failed to update: " + err.message),
  });

  const removeServer = useMutation({
    mutationFn: async (id: string) => {
      return deleteMcpServer(supabase, id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mcp-servers"] });
      toast.success("Disconnected.");
    },
    onError: (err: Error) => toast.error("Failed to disconnect: " + err.message),
  });

  const handleExpand = (entry: McpCatalogEntry) => {
    if (entry.connectionType === "oauth") {
      addServer.mutate(entry);
    } else {
      setExpanding(entry.id);
      if (entry.connectionType === "stdio") {
        setCommand(entry.defaultCommand || "");
        setArgs(entry.defaultArgs?.join(" ") || "");
        setUrl("");
      } else {
        setUrl(entry.defaultUrl || "");
        setCommand("");
        setArgs("");
      }
      setAuthHeader("");
    }
  };

  const categories = useMemo(() => {
    const cats = new Set(MCP_CATALOG.map((c) => c.category));
    return Array.from(cats);
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative inline-block">
          <PromptInputButton
            type="button"
            tooltip="Connect external tools"
            variant="ghost"
            size="icon-sm"
            className="rounded-xl p-2 text-muted-foreground hover:text-foreground relative"
          >
            <Plug className="size-6" />
          </PromptInputButton>
          {enabledCount > 0 && (
            <div className="pointer-events-none absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-sm">
              {enabledCount}
            </div>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={12}
        className="w-[420px] p-0 rounded-2xl overflow-hidden card-soft"
      >
        <Command className="bg-transparent">
          <CommandInput placeholder="Search tools and integrations..." className="h-11" />

          <CommandList className="max-h-[350px]">
            <CommandEmpty>No integrations found.</CommandEmpty>

            {servers.length === 0 && (
              <div className="px-4 py-3 text-xs text-muted-foreground border-b border-border">
                Connect tools so Remi can search papers, check docs, do math, or look at your
                calendar.
              </div>
            )}

            {categories.map((cat) => {
              const entries = MCP_CATALOG.filter((c) => c.category === cat);
              if (entries.length === 0) return null;

              return (
                <CommandGroup key={cat} heading={cat}>
                  {entries.map((entry) => {
                    const server = servers.find((s) => s.catalog_id === entry.id);
                    const isExpanding = expanding === entry.id;

                    return (
                      <CommandItem
                        key={entry.id}
                        value={entry.name + " " + entry.description}
                        onSelect={() => {
                          if (!server && !isExpanding) handleExpand(entry);
                        }}
                        className="flex-col items-stretch py-2"
                      >
                        <div className="flex items-start justify-between gap-3 w-full">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted border border-border/50">
                              <entry.icon className="size-4.5 text-foreground" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-medium text-sm text-foreground truncate">
                                {entry.name}
                              </span>
                              <span className="text-xs text-muted-foreground line-clamp-1">
                                {entry.description}
                              </span>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center">
                            {!server ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                className="h-7 px-3 text-xs rounded-full press"
                                disabled={entry.comingSoon}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!entry.comingSoon) handleExpand(entry);
                                }}
                              >
                                {entry.comingSoon ? "Coming soon" : "Connect"}
                              </Button>
                            ) : (
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted border border-border/50">
                                  <div
                                    className={`size-1.5 rounded-full ${server.enabled ? "bg-emerald-500" : "bg-muted-foreground"}`}
                                  />
                                  <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                                    {server.enabled ? "Connected" : "Off"}
                                  </span>
                                </div>
                                <Switch
                                  checked={server.enabled}
                                  onCheckedChange={(checked) =>
                                    toggleServer.mutate({ id: server.id, enabled: checked })
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="size-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeServer.mutate(server.id);
                                  }}
                                >
                                  <X className="size-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>

                        {isExpanding && !server && (
                          <div
                            className="mt-3 pl-11 pr-2 space-y-3 cursor-default"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <p className="text-xs text-muted-foreground">{entry.helpText}</p>

                            {entry.connectionType !== "oauth" &&
                              entry.connectionType !== "stdio" && (
                                <>
                                  <div className="space-y-1">
                                    <Label className="text-[10px] uppercase text-muted-foreground">
                                      Server URL
                                    </Label>
                                    <Input
                                      value={url}
                                      onChange={(e) => setUrl(e.target.value)}
                                      placeholder="https://"
                                      className="h-8 text-xs rounded-lg"
                                    />
                                  </div>

                                  {entry.connectionType === "apikey" && (
                                    <div className="space-y-1">
                                      <Label className="text-[10px] uppercase text-muted-foreground">
                                        API Key
                                      </Label>
                                      <Input
                                        type="password"
                                        value={authHeader}
                                        onChange={(e) => setAuthHeader(e.target.value)}
                                        placeholder="Bearer ..."
                                        className="h-8 text-xs rounded-lg"
                                      />
                                    </div>
                                  )}
                                </>
                              )}

                            {entry.connectionType === "stdio" && (
                              <>
                                <div className="space-y-1">
                                  <Label className="text-[10px] uppercase text-muted-foreground">
                                    Command
                                  </Label>
                                  <Input
                                    value={command}
                                    onChange={(e) => setCommand(e.target.value)}
                                    placeholder="e.g. npx"
                                    className="h-8 text-xs rounded-lg"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px] uppercase text-muted-foreground">
                                    Arguments
                                  </Label>
                                  <Input
                                    value={args}
                                    onChange={(e) => setArgs(e.target.value)}
                                    placeholder="Space-separated args"
                                    className="h-8 text-xs rounded-lg"
                                  />
                                </div>
                              </>
                            )}

                            <div className="flex items-center justify-end gap-2 pt-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs rounded-md"
                                onClick={() => setExpanding(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 text-xs rounded-md press"
                                disabled={
                                  addServer.isPending ||
                                  (entry.connectionType === "url" && !url) ||
                                  (entry.connectionType === "stdio" && !command)
                                }
                                onClick={() => addServer.mutate(entry)}
                              >
                                {addServer.isPending ? "Connecting..." : "Connect"}
                              </Button>
                            </div>
                          </div>
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              );
            })}
          </CommandList>

          <div className="p-2 border-t border-border bg-muted/30">
            <Button
              variant="ghost"
              className="w-full h-8 text-xs text-muted-foreground justify-between"
              asChild
            >
              <Link to="/settings">
                Manage all connections <ChevronRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
