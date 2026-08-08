import { generateText } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createAiGatewayProvider, getAiModelName } from "@/lib/ai-gateway.server";
import type { Database } from "@/integrations/supabase/types";

type Supabase = SupabaseClient<Database>;

export type NotebookBlockInput = {
  type: "heading" | "text" | "todo" | "quote" | "divider";
  content: string;
  checked?: boolean;
};

export type NotebookOutput = {
  title: string;
  icon?: string;
  blocks: NotebookBlockInput[];
};

/**
 * Notebook Agent — A dedicated AI agent that reads source material
 * (transcripts, web research, topic explanations) and generates a
 * structured study notebook page made of native blocks (heading, text, todo, quote, divider).
 */
import { searchTopicPhotos } from "@/lib/tavily.server";

export async function runNotebookAgent(params: {
  pageId: string;
  sourceMaterial: string;
  topicTitle: string;
  apiKey: string;
  supabase: Supabase;
  userId: string;
  includeImages?: boolean;
}): Promise<{ success: boolean; blockCount: number; error?: string }> {
  const { pageId, sourceMaterial, topicTitle, apiKey, supabase, userId, includeImages } = params;

  const clippedMaterial =
    sourceMaterial.length > 25000
      ? `${sourceMaterial.slice(0, 25000)}\n\n[Material continues...]`
      : sourceMaterial;

  const gateway = createAiGatewayProvider(apiKey);
  const model = gateway(getAiModelName());

  const prompt = `You are an expert AI Study Notebook Agent inside Remainder. Your job is to transform learning source material (video transcripts and web research) into a comprehensive, beautifully structured study notebook page made of native blocks.

Topic Title: ${topicTitle}

Source Material:
${clippedMaterial}

Analyze the material and generate a complete study notebook as a JSON object matching this schema:

{
  "title": "${topicTitle} — Study Notebook",
  "icon": "📒",
  "blocks": [
    { "type": "heading", "content": "Overview" },
    { "type": "text", "content": "2-3 sentence overview explaining what this topic covers..." },
    { "type": "quote", "content": "Key definition or primary thesis statement." },
    { "type": "divider", "content": "" },
    { "type": "heading", "content": "1. Core Concept Title" },
    { "type": "text", "content": "Detailed explanation with **key terms** in bold and formulas in LaTeX $x^2$." },
    { "type": "quote", "content": "Important definition or formula callout." },
    { "type": "todo", "content": "Self-test question or concept check item", "checked": false },
    { "type": "divider", "content": "" },
    { "type": "heading", "content": "Actionable Study Tasks & Practice" },
    { "type": "todo", "content": "Review key concept A", "checked": false },
    { "type": "todo", "content": "Practice exercise B", "checked": false },
    { "type": "divider", "content": "" },
    { "type": "heading", "content": "Key Terms Glossary" },
    { "type": "quote", "content": "**Term**: Definition of key term." }
  ]
}

Block Type Rules:
- "heading": Used for section and subsection titles.
- "text": Used for paragraphs, detailed explanations, bullet points, and code examples.
- "quote": Used for callout definitions, key takeaways, and glossary entries.
- "todo": Used for interactive study tasks, self-test questions, and review items.
- "divider": Used to separate major sections.

Formatting Rules:
- Ground everything strictly in the supplied source material.
- Write mathematical and chemical concepts with strict standard LaTeX formatting. Use single dollar signs ($H_2O$ or $x^2$) for inline variables and chemical/math terms inside text paragraphs. Use double dollar signs ($$ ... $$) ONLY on dedicated block lines for standalone equations. Never use double dollar signs inline inside sentences.
- Return ONLY valid JSON. No markdown code blocks, no trailing commas.`;

  try {
    const result = await generateText({
      model,
      system: "You are a JSON notebook agent. Return strictly a valid JSON object matching the requested schema.",
      prompt,
    });

    const jsonStr = result.text.replace(/```json\n?|\n?```/g, "").trim();
    const parsed: NotebookOutput = JSON.parse(jsonStr);

    if (parsed && Array.isArray(parsed.blocks) && parsed.blocks.length > 0) {
      // 1. Update Page Title and Icon
      await supabase
        .from("pages")
        .update({
          title: parsed.title || `${topicTitle} — Study Notebook`,
          icon: parsed.icon || "📒",
        })
        .eq("id", pageId);

      // 2. Insert native blocks
      let position = 0;
      let insertedCount = 0;

      for (const block of parsed.blocks) {
        if (!block.type) continue;
        const validTypes = ["heading", "text", "todo", "quote", "divider"];
        const blockType = validTypes.includes(block.type) ? block.type : "text";

        const { error } = await supabase.from("blocks").insert({
          page_id: pageId,
          user_id: userId,
          type: blockType,
          content: block.content ?? "",
          checked: Boolean(block.checked),
          position: position++,
        });

        if (!error) insertedCount++;
      }

      // 3. If images were requested, search the web and append visual diagrams at the end
      if (includeImages) {
        const photos = await searchTopicPhotos(topicTitle);
        if (photos.length > 0) {
          await supabase.from("blocks").insert({
            page_id: pageId,
            user_id: userId,
            type: "divider",
            content: "",
            checked: false,
            position: position++,
          });
          insertedCount++;

          await supabase.from("blocks").insert({
            page_id: pageId,
            user_id: userId,
            type: "heading",
            content: `Visual Reference & Diagrams — ${topicTitle}`,
            checked: false,
            position: position++,
          });
          insertedCount++;

          for (const img of photos) {
            const caption = img.description || `${topicTitle} diagram`;
            await supabase.from("blocks").insert({
              page_id: pageId,
              user_id: userId,
              type: "text",
              content: `![${caption}](${img.url})`,
              checked: false,
              position: position++,
            });
            insertedCount++;
          }
        }
      }

      return { success: true, blockCount: insertedCount };
    }
  } catch (err) {
    console.error("[NotebookAgent Error]", err);
  }

  // Robust Fallback if AI JSON parsing failed
  await fallbackDefaultBlocks(pageId, topicTitle, clippedMaterial, supabase, userId);
  return { success: true, blockCount: 6 };
}

async function fallbackDefaultBlocks(
  pageId: string,
  topicTitle: string,
  material: string,
  supabase: Supabase,
  userId: string,
) {
  await supabase
    .from("pages")
    .update({ title: `${topicTitle} — Study Notebook`, icon: "📒" })
    .eq("id", pageId);

  const fallbackBlocks: NotebookBlockInput[] = [
    { type: "heading", content: "Overview" },
    { type: "text", content: `Study notebook generated for **${topicTitle}**.` },
    { type: "quote", content: "Key takeaways and concepts extracted from web research and materials." },
    { type: "divider", content: "" },
    { type: "heading", content: "Highlights" },
    { type: "text", content: material.slice(0, 800) },
    { type: "divider", content: "" },
    { type: "heading", content: "Action Items" },
    { type: "todo", content: "Review concepts covered in notebook", checked: false },
    { type: "todo", content: "Complete practice exercises", checked: false },
  ];

  let pos = 0;
  for (const b of fallbackBlocks) {
    await supabase.from("blocks").insert({
      page_id: pageId,
      user_id: userId,
      type: b.type,
      content: b.content,
      checked: Boolean(b.checked),
      position: pos++,
    });
  }
}
