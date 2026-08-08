import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";

import { writeLesson } from "@/lib/agents/curriculum.server";
import { runNotebookAgent } from "@/lib/agents/notebook-agent.server";
import { runPlanner } from "@/lib/agents/planner.server";
import { runResearch } from "@/lib/agents/research.server";
import { classifyQueryRouting } from "@/lib/agents/router.server";
import { createAiGatewayProvider, getAiApiKey, getAiModelName } from "@/lib/ai-gateway.server";
import { fetchYoutubeTranscript } from "@/lib/transcript.server";
import { searchTopicPhotos, tavilySearch, youtubeIdFromUrl } from "@/lib/tavily.server";
import type { Database } from "@/integrations/supabase/types";

const SYSTEM_PROMPT = `You are Remi, the warm, encouraging coach inside Remainder — a calm workspace for notes, habits, goals and learning.
Voice: personal, kind, concrete. Short paragraphs. Never guilt-trip the user about missed days; help them restart small.

You help with: planning learning roadmaps, breaking goals into milestones, suggesting tasks and habits, reflecting on the user's week, and explaining topics simply with clear text, photos, diagrams, and video resources.

You have access to the user's current workspace state and long-term memories (shown below). Use this context to give personalized, relevant coaching — reference their actual tasks, streaks, and goals when relevant.

You delegate to specialists ONLY when the user explicitly requests workspace actions:
- delegateToPlanner: Use ONLY when the user explicitly asks to create or build roadmaps, goals, tasks, or habits in their workspace.
- researchResources: Use ONLY when the user explicitly asks to search for and save learning resources or videos to a roadmap.
- webSearch: Use whenever answering factual questions that benefit from current web search results.
- searchPhotos: Use ONLY when the user explicitly asks for photos, images, visual diagrams, or illustrations. NEVER call this tool unless the user explicitly requests an image or diagram.
- writeLessonForSubtopic: Use ONLY when the user asks to write or expand a specific roadmap subtopic lesson.
- generateNotebook: Use ONLY when the user explicitly requests to generate, create, or build a notebook, notes, or structured workspace page. Do NOT call this tool for normal conversational questions or topic discussions unless the user explicitly asks to create or generate a notebook page.
- editNotebook: Use when the user asks to edit a notebook page, append content, or search the web and add visual diagrams/images to the end of a notebook.
- saveMemory: Use when learning a durable fact, preference, or goal context about the user.

When you delegate, briefly tell the user what you're doing, then summarize what the specialist accomplished. When you propose a plan without tools, format it as clear markdown with phases and short bullet steps, and end with one gentle next action the user could take today.

Formatting rules (always follow):
- Use markdown headings and short paragraphs; keep lines readable.
- **Bold** the key term the first time it appears — never bold whole sentences.
- Include markdown images ONLY when the user explicitly asks for photos, images, or diagrams in their prompt. Otherwise, do NOT output markdown images.
- Format all math, chemistry, variables, and formulas in strict LaTeX: inline using single dollar signs $x^2$ or $H_2O$, block equations on dedicated lines with double dollar signs $$E = mc^2$$. Always use explicit operators (\times, \cdot, \frac{a}{b}), never plain-text math, ASCII operators, or bracket delimiters \(...\)/\[...\].
- Use fenced code blocks with a language tag for code.
- Use \`inline code\` for identifiers, commands, and file names.`;

type ChatBody = {
  messages?: unknown;
  threadId?: unknown;
  topicItemId?: unknown;
  activePageId?: unknown;
};

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function buildUserContext(
  supabase: ReturnType<typeof createClient<Database>>,
): Promise<string> {
  const now = new Date();
  const todayStr = fmtDate(now);
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    { data: tasks },
    { data: habits },
    { data: habitLogs },
    { data: goals },
    { data: roadmaps },
    { data: moods },
    { data: focusSessions },
    { data: memories },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("title,due_date,done")
      .eq("done", false)
      .order("due_date", { nullsFirst: false })
      .limit(5),
    supabase.from("habits").select("id,title,icon").eq("archived", false).limit(6),
    supabase
      .from("habit_logs")
      .select("habit_id,day")
      .gte("day", fmtDate(thirtyDaysAgo)),
    supabase.from("goals").select("title,progress").eq("status", "active").limit(4),
    supabase
      .from("roadmaps")
      .select("id,topic,summary")
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("journal_entries")
      .select("mood,day")
      .order("day", { ascending: false })
      .limit(7),
    supabase
      .from("focus_sessions")
      .select("minutes")
      .gte("created_at", weekAgo.toISOString()),
    supabase
      .from("agent_memories")
      .select("content,category")
      .order("importance", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const lines: string[] = [];

  if (memories && memories.length > 0) {
    lines.push("## What I know about this person");
    for (const m of memories) {
      lines.push(`- ${m.content}`);
    }
    lines.push("");
  }

  lines.push("## Their workspace right now");

  const openTasks = tasks ?? [];
  if (openTasks.length > 0) {
    const taskStr = openTasks
      .map((t) => `"${t.title}"${t.due_date ? ` (due ${t.due_date})` : ""}`)
      .join(", ");
    lines.push(`- ${openTasks.length} open task(s): ${taskStr}`);
  } else {
    lines.push("- No open tasks");
  }

  const habitsList = habits ?? [];
  if (habitsList.length > 0) {
    const habitStrs = habitsList.map((h) => {
      const doneToday = (habitLogs ?? []).some(
        (l) => l.habit_id === h.id && l.day === todayStr,
      );
      const days = new Set(
        (habitLogs ?? []).filter((l) => l.habit_id === h.id).map((l) => l.day),
      );
      let streak = 0;
      for (let i = 0; i < 365; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        if (days.has(fmtDate(d))) streak++;
        else if (i > 0) break;
      }
      return `${h.title} (${streak}-day streak${doneToday ? ", done today" : ""})`;
    });
    lines.push(`- Habits: ${habitStrs.join(", ")}`);
  } else {
    lines.push("- No habits set up");
  }

  const goalsList = goals ?? [];
  if (goalsList.length > 0) {
    lines.push(
      `- Goals: ${goalsList.map((g) => `${g.title} at ${g.progress}%`).join(", ")}`,
    );
  }

  const roadmapsList = roadmaps ?? [];
  if (roadmapsList.length > 0) {
    lines.push(
      `- Roadmaps: ${roadmapsList.map((r) => r.topic).join(", ")}`,
    );
  }

  const moodStr = (moods ?? []).map((m) => m.mood ?? "—").join(" ");
  if (moodStr.trim()) {
    lines.push(`- Mood this week: ${moodStr}`);
  }

  const focusMin = (focusSessions ?? []).reduce(
    (sum, s) => sum + (s.minutes ?? 0),
    0,
  );
  lines.push(`- Focus: ${focusMin} min this week`);

  return lines.join("\n");
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as ChatBody;
        const messages = body.messages;
        const threadId =
          typeof body.threadId === "string" ? body.threadId : null;
        if (!Array.isArray(messages) || !threadId) {
          return new Response("messages and threadId are required", {
            status: 400,
          });
        }

        const token = request.headers
          .get("authorization")
          ?.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supabase = createClient<Database>(
          process.env["SUPABASE_URL"]!,
          process.env["SUPABASE_PUBLISHABLE_KEY"]!,
          {
            auth: { persistSession: false, autoRefreshToken: false },
            global: { headers: { Authorization: `Bearer ${token}` } },
          },
        );
        const { data: userData, error: userError } =
          await supabase.auth.getUser(token);
        if (userError || !userData.user)
          return new Response("Unauthorized", { status: 401 });
        const userId = userData.user.id;

        const { data: thread } = await supabase
          .from("chat_threads")
          .select("id")
          .eq("id", threadId)
          .maybeSingle();
        if (!thread) {
          // The client may hold a thread id that no longer exists (cleared data,
          // new device). Recreate it instead of failing the conversation.
          const { error: threadError } = await supabase
            .from("chat_threads")
            .insert({ id: threadId, user_id: userId, title: "New conversation" });
          if (threadError)
            return new Response("Thread not found", { status: 404 });
        }


        const key = getAiApiKey();
        if (!key) return new Response("Missing AI API Key (please set MISTRAL_API_KEY, OPENAI_API_KEY, or OPENROUTER_API_KEY)", { status: 500 });

        const uiMessages = messages as UIMessage[];
        const last = uiMessages[uiMessages.length - 1];
        if (last && last.role === "user") {
          const { error } = await supabase.from("chat_messages").insert({
            thread_id: threadId,
            user_id: userId,
            role: "user",
            message: last as never,
            client_id: last.id,
          });
          if (error)
            console.error("Failed to persist user message", error.message);
        }

        const userContext = await buildUserContext(supabase);

        // When the learner asks a doubt from a lesson page, give Remi that lesson.
        let topicBlock = "";
        const topicItemId =
          typeof body.topicItemId === "string" ? body.topicItemId : null;
        if (topicItemId) {
          const { data: item } = await supabase
            .from("roadmap_items")
            .select("title, detail, phase, content, roadmap_id, parent_id")
            .eq("id", topicItemId)
            .maybeSingle();
          if (item) {
            const [{ data: roadmap }, { data: parent }] = await Promise.all([
              supabase
                .from("roadmaps")
                .select("topic")
                .eq("id", item.roadmap_id)
                .maybeSingle(),
              item.parent_id
                ? supabase
                    .from("roadmap_items")
                    .select("title")
                    .eq("id", item.parent_id)
                    .maybeSingle()
                : Promise.resolve({ data: null as { title: string } | null }),
            ]);
            topicBlock = `\n\n## The topic they are reading right now
Subject: ${roadmap?.topic ?? "—"}
Topic: ${parent?.title ?? item.phase}
Sub-topic: ${item.title}${item.detail ? `\nIntent: ${item.detail}` : ""}

Lesson text they can see (answer their doubts against this, and go deeper when asked; web-search if the lesson doesn't cover it):
${(item.content ?? "No lesson written yet.").slice(0, 6000)}`;
          }
        }

        let activePageBlock = "";
        const activePageId =
          typeof body.activePageId === "string" ? body.activePageId : null;
        if (activePageId) {
          const { data: curPage } = await supabase
            .from("pages")
            .select("id, title")
            .eq("id", activePageId)
            .maybeSingle();
          if (curPage) {
            activePageBlock = `\n\n## Notebook Page Currently Open on User's Screen:
Page ID: ${curPage.id}
Title: "${curPage.title}"
(If asked to edit or add images to the notebook page, call editNotebook with page_id: "${curPage.id}")`;
          }
        }

        // --- Search-Routing: classify query before streaming ---
        let preSearchBlock = "";
        const lastUserMsg = uiMessages
          .filter((m) => m.role === "user")
          .at(-1);
        const lastUserText =
          lastUserMsg?.parts
            ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
            .map((p) => p.text)
            .join(" ")
            .trim() ?? "";

        if (lastUserText) {
          // Build conversation context from recent messages for disambiguation
          const recentMessages = uiMessages.slice(-10).map((m) => {
            const text = m.parts
              ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
              .map((p) => p.text)
              .join(" ")
              .trim();
            return `${m.role}: ${(text ?? "").slice(0, 200)}`;
          }).filter(Boolean).join("\n");

          try {
            const routing = await classifyQueryRouting({
              query: lastUserText,
              apiKey: key,
              ...(recentMessages ? { conversationContext: recentMessages } : {}),
            });

            if (routing.search_required) {
              const searchRes = await tavilySearch(lastUserText, {
                maxResults: 5,
                depth: "advanced",
              });
              if (searchRes.results.length > 0 || searchRes.answer) {
                const resultStr = searchRes.results
                  .map((r) => `### ${r.title}\nURL: ${r.url}\n${r.content}`)
                  .join("\n\n");
                preSearchBlock = `\n\n## Web Search Results (auto-retrieved because this query requires current information)\n${searchRes.answer ? `**Summary**: ${searchRes.answer}\n\n` : ""}${resultStr}`;
              }
            }
          } catch (routingErr) {
            // Router failure is non-fatal — the LLM can still use the webSearch tool
            console.error("Query routing failed, falling back to tool-based search", routingErr);
          }
        }

        const systemPrompt = `${SYSTEM_PROMPT}\n\n${userContext}${topicBlock}${activePageBlock}${preSearchBlock}`;

        const tools = {
          delegateToPlanner: tool({
            description:
              "Delegate to the planning specialist to create roadmaps, goals, tasks, or habits in the user's workspace. The planner will actually build them.",
            inputSchema: z.object({
              instruction: z
                .string()
                .describe("What the planner should create, with all necessary details"),
            }),
            execute: async ({ instruction }: { instruction: string }) => {
              return runPlanner({
                instruction,
                apiKey: key,
                supabase,
                userId,
              });
            },
          }),

          researchResources: tool({
            description:
              "Find tutorials, videos, and courses for a learning topic using web search. Saves results to the user's roadmap.",
            inputSchema: z.object({
              topic: z
                .string()
                .describe("The topic to find learning resources for"),
              roadmap_id: z
                .string()
                .nullable()
                .describe("ID of the roadmap to attach resources to, or null"),
            }),
            execute: async ({
              topic,
              roadmap_id,
            }: {
              topic: string;
              roadmap_id: string | null;
            }) => {
              return runResearch({
                topic,
                roadmapId: roadmap_id,
                apiKey: key,
                supabase,
                userId,
              });
            },
          }),

          saveMemory: tool({
            description:
              "Save a durable fact or preference about the user for future conversations.",
            inputSchema: z.object({
              content: z
                .string()
                .describe("The fact or preference to remember"),
              category: z
                .enum(["fact", "preference", "goal_context", "learning_style"])
                .nullable()
                .describe("Category of memory, or null"),
            }),
            execute: async ({
              content,
              category,
            }: {
              content: string;
              category: string | null;
            }) => {
              const { data, error } = await supabase
                .from("agent_memories")
                .insert({
                  user_id: userId,
                  content,
                  category: category ?? "fact",
                })
                .select("id")
                .single();
              if (error) return { success: false, error: error.message };
              return { success: true, id: data.id };
            },
          }),

          webSearch: tool({
            description:
              "Search the web for current information. Use whenever the answer depends on recent facts, versions, prices, news, or anything you are unsure about.",
            inputSchema: z.object({
              query: z.string().describe("The search query"),
            }),
            execute: async ({ query }: { query: string }) => {
              const res = await tavilySearch(query, {
                maxResults: 5,
                depth: "advanced",
              });
              return {
                answer: res.answer,
                results: res.results.map((r) => ({
                  title: r.title,
                  url: r.url,
                  content: r.content.slice(0, 500),
                })),
                error: res.error ?? null,
              };
            },
          }),

          searchPhotos: tool({
            description:
              "Search for high-quality photos, illustrations, visual diagrams, and images for a topic. Use ONLY when the user explicitly asks for an image, photo, or diagram in their prompt.",
            inputSchema: z.object({
              query: z.string().describe("The visual topic or image search query"),
            }),
            execute: async ({ query }: { query: string }) => {
              const res = await searchTopicPhotos(query);
              const photos = res.map((img) => ({
                url: img.url,
                caption: img.description ?? query,
              }));

              return {
                query,
                photos,
              };
            },
          }),

          writeLessonForSubtopic: tool({
            description:
              "Research and write the full lesson (markdown content, images, and videos) for one roadmap sub-topic, given its id.",
            inputSchema: z.object({
              item_id: z.string().describe("The roadmap sub-topic id"),
            }),
            execute: async ({ item_id }: { item_id: string }) => {
              return writeLesson({
                itemId: item_id,
                apiKey: key,
                supabase,
                userId,
              });
            },
          }),

          generateNotebook: tool({
            description:
              "Generate a structured study notebook page in the workspace with native blocks (headings, text, quote callouts, checkable to-dos, dividers). Call this tool ONLY when the user explicitly asks to generate, create, or build a notebook or notes page.",
            inputSchema: z.object({
              topicOrUrl: z
                .string()
                .describe("Topic name OR YouTube video URL / ID to build the notebook from"),
              title: z
                .string()
                .describe("Optional title for the notebook page"),
            }),
            execute: async ({
              topicOrUrl,
              title,
            }: {
              topicOrUrl: string;
              title: string;
            }) => {
              const raw = topicOrUrl.trim();
              const directVideoId =
                youtubeIdFromUrl(raw) ??
                (raw.length === 11 && !raw.includes(" ") ? raw : null);
              const notebookTitle = title ?? raw;

              let sourceMaterial = "";

              if (directVideoId) {
                // 1. Direct YouTube video provided
                const res = await fetchYoutubeTranscript(directVideoId);
                if (res.fullText) {
                  sourceMaterial = `Source Video Transcript:\n${res.fullText}`;
                }
              }

              if (!sourceMaterial) {
                // 2. Search YouTube & Web via Tavily search API automatically!
                const [videoSearch, webSearch] = await Promise.all([
                  tavilySearch(`${raw} youtube tutorial video`, { maxResults: 5 }),
                  tavilySearch(`${raw} comprehensive explanation overview guide`, {
                    maxResults: 5,
                  }),
                ]);

                // Try extracting transcript from top video result
                const videoResult = videoSearch.results.find((r) =>
                  youtubeIdFromUrl(r.url),
                );
                if (videoResult) {
                  const vid = youtubeIdFromUrl(videoResult.url);
                  if (vid) {
                    const res = await fetchYoutubeTranscript(vid);
                    if (res.fullText) {
                      sourceMaterial = `Source Video: ${videoResult.title} (${videoResult.url})\n\nVideo Transcript:\n${res.fullText}\n\n`;
                    }
                  }
                }

                // Compile web research context
                const researchContext = [
                  videoSearch.answer ? `Search Answer: ${videoSearch.answer}` : "",
                  webSearch.answer ? `Summary: ${webSearch.answer}` : "",
                  ...webSearch.results.map(
                    (r) => `### ${r.title}\nURL: ${r.url}\n${r.content}`,
                  ),
                ]
                  .filter(Boolean)
                  .join("\n\n");

                sourceMaterial += `Research Context on "${raw}":\n${researchContext}`;
              }

              const { data: page, error: pageErr } = await supabase
                .from("pages")
                .insert({
                  user_id: userId,
                  title: `${notebookTitle} — Notebook`,
                  icon: "📒",
                })
                .select("id")
                .single();

              if (pageErr || !page) {
                return {
                  success: false,
                  error: pageErr?.message ?? "Failed to create page.",
                };
              }

              const agentResult = await runNotebookAgent({
                pageId: page.id,
                sourceMaterial,
                topicTitle: notebookTitle,
                apiKey: key,
                supabase,
                userId,
                includeImages: true,
              });

              return {
                success: true,
                pageId: page.id,
                blockCount: agentResult.blockCount,
                message: `Successfully generated study notebook page for "${notebookTitle}" with ${agentResult.blockCount} native blocks! Page ID: ${page.id}`,
              };
            },
          }),

          editNotebook: tool({
            description:
              "Edit an existing notebook page, append content, or search the web and add visual diagrams/images to the end of the notebook. Call this tool whenever the user asks to add images to a notebook, edit notes, or append sections to a notebook page.",
            inputSchema: z.object({
              page_id: z
                .string()
                .optional()
                .describe(
                  "The notebook page ID to edit. If omitted, automatically targets the user's most recent notebook page.",
                ),
              topic_or_query: z
                .string()
                .describe(
                  "The topic name or visual query to search images/diagrams for (e.g., 'photosynthesis diagram')",
                ),
              action: z
                .enum(["add_images", "append_content", "add_section"])
                .default("add_images")
                .describe("The notebook edit action to perform"),
              content: z
                .string()
                .optional()
                .describe("Optional text content to append if adding a text section"),
            }),
            execute: async ({
              page_id,
              topic_or_query,
              action,
              content,
            }: {
              page_id?: string | undefined;
              topic_or_query: string;
              action: "add_images" | "append_content" | "add_section";
              content?: string | undefined;
            }) => {
              let targetPageId = page_id || (activePageId ? activePageId : undefined);

              if (!targetPageId && topic_or_query) {
                // 1. First try matching page by exact or fuzzy title
                const cleanTopic = topic_or_query
                  .replace(/diagrams?|workflows?|images?|photos?|notebook/gi, "")
                  .trim();
                const { data: titleMatches } = await supabase
                  .from("pages")
                  .select("id, title")
                  .eq("user_id", userId)
                  .ilike("title", `%${cleanTopic || topic_or_query}%`)
                  .order("updated_at", { ascending: false })
                  .limit(1);

                if (titleMatches && titleMatches.length > 0 && titleMatches[0]?.id) {
                  targetPageId = titleMatches[0].id;
                }
              }

              if (!targetPageId) {
                // 2. Fallback to user's most recently updated notebook page
                const { data: pages } = await supabase
                  .from("pages")
                  .select("id, title")
                  .eq("user_id", userId)
                  .order("updated_at", { ascending: false })
                  .limit(1);

                if (pages && pages.length > 0 && pages[0]?.id) {
                  targetPageId = pages[0].id;
                }
              }

              if (!targetPageId) {
                // 3. Create notebook page if none exists
                const { data: newPage, error: createErr } = await supabase
                  .from("pages")
                  .insert({
                    user_id: userId,
                    title: `${topic_or_query} — Notebook`,
                    icon: "📒",
                  })
                  .select("id")
                  .single();

                if (createErr || !newPage) {
                  return { success: false, error: "No notebook page found to edit." };
                }
                targetPageId = newPage.id;
              }

              const { data: existingBlocks } = await supabase
                .from("blocks")
                .select("position")
                .eq("page_id", targetPageId)
                .order("position", { ascending: false })
                .limit(1);

              const lastPos =
                existingBlocks && existingBlocks.length > 0
                  ? (existingBlocks[0]?.position ?? -1)
                  : -1;
              let nextPos = lastPos + 1;
              let addedCount = 0;

              if (action === "add_images" || topic_or_query) {
                const photos = await searchTopicPhotos(topic_or_query);

                await supabase.from("blocks").insert({
                  page_id: targetPageId,
                  user_id: userId,
                  type: "divider",
                  content: "",
                  checked: false,
                  position: nextPos++,
                });
                addedCount++;

                await supabase.from("blocks").insert({
                  page_id: targetPageId,
                  user_id: userId,
                  type: "heading",
                  content: `Visual Reference & Diagrams — ${topic_or_query}`,
                  checked: false,
                  position: nextPos++,
                });
                addedCount++;

                for (const img of photos) {
                  const caption = img.description || `${topic_or_query} diagram`;
                  await supabase.from("blocks").insert({
                    page_id: targetPageId,
                    user_id: userId,
                    type: "text",
                    content: `![${caption}](${img.url})`,
                    checked: false,
                    position: nextPos++,
                  });
                  addedCount++;
                }
              }

              if (content) {
                await supabase.from("blocks").insert({
                  page_id: targetPageId,
                  user_id: userId,
                  type: "text",
                  content,
                  checked: false,
                  position: nextPos++,
                });
                addedCount++;
              }

              await supabase
                .from("pages")
                .update({ updated_at: new Date().toISOString() })
                .eq("id", targetPageId);

              return {
                success: true,
                pageId: targetPageId,
                blocksAdded: addedCount,
                message: `Successfully edited notebook page (ID: ${targetPageId}) and added ${addedCount} blocks (including visual diagrams at the end).`,
              };
            },
          }),
        };

        const gateway = createAiGatewayProvider(key);
        const result = streamText({
          model: gateway(getAiModelName()),
          system: systemPrompt,
          messages: await convertToModelMessages(uiMessages),
          tools,
          stopWhen: stepCountIs(50),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: uiMessages,
          onFinish: async ({ responseMessage }) => {
            const { error } = await supabase.from("chat_messages").insert({
              thread_id: threadId,
              user_id: userId,
              role: "assistant",
              message: responseMessage as never,
              client_id: responseMessage.id,
            });
            if (error)
              console.error(
                "Failed to persist assistant message",
                error.message,
              );
            await supabase
              .from("chat_threads")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", threadId);
          },
        });
      },
    },
  },
});
