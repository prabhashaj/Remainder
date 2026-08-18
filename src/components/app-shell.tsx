import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  ChevronRight,
  Compass,
  FileText,
  Folder,
  FolderOpen,
  LayoutDashboard,
  Library,
  ListChecks,
  LogOut,
  MessageCircle,
  MessagesSquare,
  Notebook,
  Plus,
  Search,
  Settings,
  Sparkle,
  Star,
  Target,
  Timer,
  Trash2,
  Share2,
  Activity,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import remiLogo from "@/assets/remi.png";
import { ShareConversationDialog } from "@/components/share-conversation-dialog";
import {
  FocusTimerButton,
  FocusTimerChip,
  FocusTimerProvider,
  useFocusTimer,
} from "@/components/focus-timer";
import { RemiDock } from "@/components/remi-dock";
import { TopicProvider } from "@/lib/topic-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import {
  createPage,
  createThread,
  deleteThread,
  fetchGoals,
  fetchPages,
  fetchProfile,
  fetchRoadmaps,
  fetchTasks,
  fetchThreads,
  fetchThreadMessages,
  type Page,
} from "@/lib/db";

const navItems = [
  { title: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { title: "Tasks", to: "/tasks", icon: ListChecks },
  { title: "Goals", to: "/goals", icon: Target },
  { title: "Roadmaps", to: "/roadmaps", icon: Compass },
  { title: "Library", to: "/library", icon: Library },
] as const;

const SIDEBAR_WIDTH_KEY = "remispace.sidebar.width";
const MIN_SIDEBAR = 190;
const MAX_SIDEBAR = 420;

export function AppShell({ children }: { children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(256);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(SIDEBAR_WIDTH_KEY));
    if (stored >= MIN_SIDEBAR && stored <= MAX_SIDEBAR) setSidebarWidth(stored);
  }, []);

  const persistWidth = useCallback((width: number) => {
    setSidebarWidth(width);
    window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <FocusTimerProvider>
      <TopicProvider>
        <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties}>
          <div className="flex min-h-screen w-full bg-background">
            <WorkspaceSidebar />
            <SidebarResizer width={sidebarWidth} onWidth={persistWidth} />
            <SidebarInset className="bg-background">
              <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border/70 bg-background/80 px-3 backdrop-blur">
                <SidebarTrigger className="size-10 rounded-xl [&>svg]:size-5" />
                <Button
                  variant="secondary"
                  onClick={() => setPaletteOpen(true)}
                  className="ml-1 h-10 gap-2 rounded-2xl px-3.5 text-muted-foreground"
                >
                  <Search className="size-5" />
                  <span className="hidden text-base sm:inline">Search</span>
                </Button>
                <div className="flex-1" />
                <Button
                  variant="secondary"
                  asChild
                  className="h-10 gap-2 rounded-2xl px-3.5 text-muted-foreground"
                >
                  <Link to="/study">
                    <BookOpen className="size-5" />
                    <span className="hidden text-base sm:inline">Study Place</span>
                  </Link>
                </Button>
                <FocusTimerButton />
                <AccountMenu />
              </header>
              <main className="flex-1 pb-24 md:pb-6">{children}</main>
            </SidebarInset>
          </div>
          <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
          <FocusTimerChip />
          <RemiDock />
          <MobileBottomNav />
        </SidebarProvider>
      </TopicProvider>
    </FocusTimerProvider>
  );
}

function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Today" },
    { to: "/tasks", icon: ListChecks, label: "Tasks" },
    { to: "/roadmaps", icon: Compass, label: "Roadmaps" },
    { to: "/goals", icon: Target, label: "Goals" },
    { to: "/study", icon: BookOpen, label: "Study" },
  ] as const;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 flex h-16 items-center justify-around border-t border-border/70 bg-background/95 px-2 backdrop-blur-md md:hidden">
      {items.map(({ to, icon: Icon, label }) => {
        const isActive = pathname === to || (to !== "/dashboard" && pathname.startsWith(to));
        return (
          <Link
            key={to}
            to={to}
            className={`press flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-1.5 transition-colors ${
              isActive
                ? "text-primary font-bold bg-primary/10"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="size-5" />
            <span className="text-[11px] leading-none">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function WorkspaceSidebar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: pages = [] } = useQuery({ queryKey: ["pages"], queryFn: fetchPages });

  const roots = useMemo(() => pages.filter((p) => !p.parent_id), [pages]);
  const favorites = useMemo(() => pages.filter((p) => p.is_favorite), [pages]);

  async function addPage(parentId: string | null) {
    const page = await createPage({ parent_id: parentId });
    await queryClient.invalidateQueries({ queryKey: ["pages"] });
    navigate({ to: "/page/$pageId", params: { pageId: page.id } });
  }

  const { data: subscription } = useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id;
      if (!userId) return null;
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      return sub;
    },
  });
  const isPremium =
    subscription &&
    subscription.status === "active" &&
    (subscription.tier === "weekly" || subscription.tier === "monthly");

  return (
    <Sidebar collapsible="icon" className="border-border/70">
      <SidebarHeader>
        <Link to="/dashboard" className="flex items-center gap-2 px-1 py-1.5">
          <img src={remiLogo} alt="" width={36} height={36} className="size-9 shrink-0" />
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
            <span className="font-display text-xl font-bold">Remispace</span>
            {isPremium ? (
              <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow-sm">
                Pro
              </span>
            ) : (
              <Link
                to="/pricing"
                className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary shadow-sm hover:bg-primary/20 transition-colors"
              >
                Upgrade
              </Link>
            )}
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.to}
                    tooltip={item.title}
                    className="h-10 rounded-xl text-[15px] [&>svg]:size-5"
                  >
                    <Link to={item.to}>
                      <item.icon className="size-5" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <ConversationsGroup />

        {favorites.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[13px]">Favorites</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {favorites.map((page) => (
                  <SidebarMenuItem key={page.id}>
                    <SidebarMenuButton
                      asChild
                      tooltip={page.title}
                      className="h-10 rounded-xl text-[15px] [&>svg]:size-5"
                    >
                      <Link to="/page/$pageId" params={{ pageId: page.id }}>
                        <Star className="size-4.5 text-primary" />
                        <span className="truncate">{page.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className="text-[13px]">Notebooks</SidebarGroupLabel>
          <SidebarGroupAction title="New page" onClick={() => void addPage(null)}>
            <Plus className="size-4" />
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              {roots.map((page) => (
                <PageTreeItem key={page.id} page={page} pages={pages} depth={0} />
              ))}
              {roots.length === 0 && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                  No pages yet — start one.
                </p>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="Settings"
              className="h-10 rounded-xl text-[15px] [&>svg]:size-5"
            >
              <Link to="/settings">
                <Settings className="size-5" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function PageTreeItem({ page, pages, depth }: { page: Page; pages: Page[]; depth: number }) {
  const children = pages.filter((p) => p.parent_id === page.id);
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = pathname === `/page/${page.id}`;

  return (
    <>
      <SidebarMenuItem>
        <div className="flex items-center">
          {children.length > 0 ? (
            <button
              type="button"
              aria-label={open ? "Collapse" : "Expand"}
              onClick={() => setOpen((v) => !v)}
              className="mr-0.5 rounded-md p-0.5 text-muted-foreground hover:bg-sidebar-accent group-data-[collapsible=icon]:hidden"
            >
              <ChevronRight
                className={`size-3.5 transition-transform ${open ? "rotate-90" : ""}`}
              />
            </button>
          ) : (
            <span className="mr-0.5 w-[18px] group-data-[collapsible=icon]:hidden" />
          )}
          <SidebarMenuButton
            asChild
            isActive={active}
            tooltip={page.title}
            className="h-10 rounded-xl text-[15px] [&>svg]:size-5"
            style={{ paddingLeft: depth ? 8 + depth * 8 : undefined }}
          >
            <Link to="/page/$pageId" params={{ pageId: page.id }}>
              {children.length > 0 ? (
                <Folder className="size-4 shrink-0 text-muted-foreground" />
              ) : page.icon && page.icon !== "📄" && page.icon !== "📁" ? (
                <span className="text-sm leading-none">{page.icon}</span>
              ) : (
                <FileText className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate">{page.title}</span>
            </Link>
          </SidebarMenuButton>
        </div>
      </SidebarMenuItem>
      {open &&
        children.map((child) => (
          <PageTreeItem key={child.id} page={child} pages={pages} depth={depth + 1} />
        ))}
    </>
  );
}

function AccountMenu() {
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: fetchProfile });

  const label = profile?.display_name || user?.email || "You";
  const initials = label.slice(0, 2).toUpperCase();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Signed out — see you soon.");
    navigate({ to: "/auth", search: { mode: "signin" }, replace: true });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <Avatar className="size-8">
            <AvatarFallback className="bg-accent text-xs text-accent-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-2xl">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
          {label}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="rounded-xl">
          <Link to="/activity">
            <Activity className="size-5" /> My Activity
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="rounded-xl">
          <Link to="/settings">
            <Settings className="size-5" /> Settings & themes
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void signOut()} className="rounded-xl">
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { start } = useFocusTimer();
  const { data: pages = [] } = useQuery({ queryKey: ["pages"], queryFn: fetchPages });
  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: fetchTasks,
    enabled: open,
  });
  const { data: goals = [] } = useQuery({
    queryKey: ["goals"],
    queryFn: fetchGoals,
    enabled: open,
  });
  const { data: roadmaps = [] } = useQuery({
    queryKey: ["roadmaps"],
    queryFn: fetchRoadmaps,
    enabled: open,
  });
  const { data: threads = [] } = useQuery({
    queryKey: ["threads"],
    queryFn: fetchThreads,
    enabled: open,
  });

  function go(fn: () => void) {
    onOpenChange(false);
    fn();
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search roadmaps, tasks, goals, notes, conversations…" />
      <CommandList className="max-h-[60vh]">
        <CommandEmpty>Nothing matched that.</CommandEmpty>

        <CommandGroup heading="Quick actions">
          <CommandItem
            value="start focus session timer study 25 minutes pomodoro"
            onSelect={() => go(() => start(25, "Focus session"))}
          >
            <Timer className="size-4" />
            Start a 25-minute focus session
          </CommandItem>
          <CommandItem
            value="new page note notebook write"
            onSelect={() =>
              go(() => {
                void createPage({}).then(async (page) => {
                  await queryClient.invalidateQueries({ queryKey: ["pages"] });
                  navigate({ to: "/page/$pageId", params: { pageId: page.id } });
                });
              })
            }
          >
            <Notebook className="size-4" />
            New note page
          </CommandItem>
          <CommandItem
            value="new conversation ask remi chat agent"
            onSelect={() =>
              go(() => {
                void createThread().then(async (thread) => {
                  await queryClient.invalidateQueries({ queryKey: ["threads"] });
                  navigate({
                    to: "/conversation/$threadId",
                    params: { threadId: thread.id },
                    search: {},
                  });
                });
              })
            }
          >
            <Sparkle className="size-4" />
            New conversation with Remi
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Go to">
          {navItems.map((item) => (
            <CommandItem
              key={item.to}
              value={item.title}
              onSelect={() => go(() => navigate({ to: item.to }))}
            >
              <item.icon className="size-5" />
              {item.title}
            </CommandItem>
          ))}
        </CommandGroup>

        {roadmaps.length > 0 && (
          <CommandGroup heading="Roadmaps">
            {roadmaps.map((roadmap) => (
              <CommandItem
                key={roadmap.id}
                value={`roadmap ${roadmap.topic} ${roadmap.summary ?? ""}`}
                onSelect={() =>
                  go(() =>
                    navigate({ to: "/roadmap/$roadmapId", params: { roadmapId: roadmap.id } }),
                  )
                }
              >
                <Compass className="size-4 text-primary" />
                <span className="truncate">{roadmap.topic}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {tasks.length > 0 && (
          <CommandGroup heading="Tasks">
            {tasks.slice(0, 40).map((task) => (
              <CommandItem
                key={task.id}
                value={`task ${task.title} ${task.notes ?? ""} ${task.tags.join(" ")}`}
                onSelect={() => go(() => navigate({ to: "/tasks" }))}
              >
                <ListChecks className="size-4" />
                <span
                  className={`truncate ${task.done ? "text-muted-foreground line-through" : ""}`}
                >
                  {task.title}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {goals.length > 0 && (
          <CommandGroup heading="Goals">
            {goals.map((goal) => (
              <CommandItem
                key={goal.id}
                value={`goal ${goal.title} ${goal.description ?? ""}`}
                onSelect={() => go(() => navigate({ to: "/goals" }))}
              >
                <Target className="size-4" />
                <span className="truncate">{goal.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {pages.length > 0 && (
          <CommandGroup heading="Notebook">
            {pages.map((page) => (
              <CommandItem
                key={page.id}
                value={`page note ${page.icon} ${page.title}`}
                onSelect={() =>
                  go(() => navigate({ to: "/page/$pageId", params: { pageId: page.id } }))
                }
              >
                <Notebook className="size-4" />
                <span className="truncate">{page.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {threads.length > 0 && (
          <CommandGroup heading="Conversations">
            {threads.map((thread) => (
              <CommandItem
                key={thread.id}
                value={`conversation chat ${thread.title}`}
                onSelect={() =>
                  go(() =>
                    navigate({
                      to: "/conversation/$threadId",
                      params: { threadId: thread.id },
                      search: {},
                    }),
                  )
                }
              >
                <MessageCircle className="size-4" />
                <span className="truncate">{thread.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

/** Thin vertical handle that lets the user drag the sidebar wider or narrower. */
function SidebarResizer({ width, onWidth }: { width: number; onWidth: (width: number) => void }) {
  const { open, setOpen, isMobile } = useSidebar();
  const dragging = useRef(false);

  useEffect(() => {
    function move(e: PointerEvent) {
      if (!dragging.current) return;
      e.preventDefault();
      const x = e.clientX;
      if (x < MIN_SIDEBAR - 60) {
        if (open) setOpen(false);
        return;
      }
      if (!open) setOpen(true);
      onWidth(Math.round(Math.min(MAX_SIDEBAR, Math.max(MIN_SIDEBAR, x))));
    }
    function up() {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.classList.remove("sidebar-resizing");
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [open, setOpen, onWidth]);

  if (isMobile) return null;

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      title="Drag to resize"
      onPointerDown={() => {
        dragging.current = true;
        document.body.classList.add("sidebar-resizing");
      }}
      onDoubleClick={() => onWidth(256)}
      className="group fixed inset-y-0 z-30 hidden w-2 cursor-col-resize md:block"
      style={{ left: open ? width - 4 : 44 }}
    >
      <span className="mx-auto block h-full w-[2px] bg-transparent transition-colors group-hover:bg-primary/40" />
    </div>
  );
}

function ConversationsGroup() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isConversationActive = pathname.startsWith("/conversation");
  const [open, setOpen] = useState(true);
  const [shareThread, setShareThread] = useState<{ id: string; title: string; messages: any[] } | null>(null);

  useEffect(() => {
    if (isConversationActive) {
      setOpen(true);
    }
  }, [isConversationActive]);

  const { data: threads = [] } = useQuery({
    queryKey: ["threads"],
    queryFn: fetchThreads,
    staleTime: 30000,
  });

  const deleteThreadMutation = useMutation({
    mutationFn: (id: string) => deleteThread(id),
    onSuccess: (_, deletedId) => {
      toast.success("Conversation deleted");
      void queryClient.invalidateQueries({ queryKey: ["threads"] });
      if (pathname === `/conversation/${deletedId}`) {
        navigate({ to: "/dashboard" });
      }
    },
  });

  async function handleOpenShare(threadId: string, title: string) {
    try {
      const rows = await fetchThreadMessages(threadId);
      const messages = (rows ?? [])
        .map((row) => row.message)
        .filter((m) => m && typeof m === "object");
      setShareThread({ id: threadId, title, messages });
    } catch (e) {
      toast.error("Failed to load conversation details");
    }
  }

  async function startNew() {
    const thread = await createThread();
    await queryClient.invalidateQueries({ queryKey: ["threads"] });
    navigate({
      to: "/conversation/$threadId",
      params: { threadId: thread.id },
      search: {},
    });
  }

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Conversations"
                isActive={pathname.startsWith("/conversation")}
                onClick={() => setOpen((v) => !v)}
                className="h-10 rounded-xl text-[15px] [&>svg]:size-5"
              >
                <MessagesSquare className="size-5" />
                <span>Conversations</span>
                <ChevronRight
                  className={`ml-auto size-4 transition-transform group-data-[collapsible=icon]:hidden ${
                    open ? "rotate-90" : ""
                  }`}
                />
              </SidebarMenuButton>
            </SidebarMenuItem>

            {open && (
              <>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => void startNew()}
                    tooltip="New conversation"
                    className="h-9 rounded-xl pl-6 text-[14px] text-muted-foreground [&>svg]:size-4"
                  >
                    <Plus className="size-4" />
                    <span>New conversation</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {threads.map((thread) => (
                  <SidebarMenuItem key={thread.id} className="group/item flex items-center pr-1">
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === `/conversation/${thread.id}`}
                      tooltip={thread.title}
                      className="h-9 min-w-0 flex-1 rounded-xl pl-6 text-[14px] [&>svg]:size-4"
                    >
                      <Link to="/conversation/$threadId" params={{ threadId: thread.id }} search={{}}>
                        <MessageCircle className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{thread.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    <div className="flex items-center opacity-0 transition-opacity group-hover/item:opacity-100 group-data-[collapsible=icon]:hidden">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Share conversation"
                        title="Share conversation"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          void handleOpenShare(thread.id, thread.title);
                        }}
                        className="size-7 shrink-0 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Share2 className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete conversation"
                        title="Delete conversation"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          deleteThreadMutation.mutate(thread.id);
                        }}
                        className="size-7 shrink-0 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </SidebarMenuItem>
                ))}
                {threads.length === 0 && (
                  <p className="px-6 py-1.5 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                    No conversations yet.
                  </p>
                )}
              </>
            )}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {shareThread && (
        <ShareConversationDialog
          open={!!shareThread}
          onOpenChange={(open) => {
            if (!open) setShareThread(null);
          }}
          threadId={shareThread.id}
          threadTitle={shareThread.title}
          messages={shareThread.messages}
        />
      )}
    </>
  );
}
