import {
  BookOpen,
  Library,
  Code2,
  Calculator,
  Calendar,
  HardDrive,
  Globe,
  type LucideIcon,
} from "lucide-react";

export type ConnectionType = "url" | "apikey" | "oauth" | "stdio";

export interface McpCatalogEntry {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: LucideIcon;
  connectionType: ConnectionType;
  helpText: string;
  defaultUrl?: string;
  defaultCommand?: string;
  defaultArgs?: string[];
  comingSoon?: boolean;
}

export const MCP_CATALOG: McpCatalogEntry[] = [
  // Research & academic
  {
    id: "arxiv",
    name: "arXiv",
    category: "Research & academic",
    description: "Search, download, and read papers directly from arXiv.",
    icon: BookOpen,
    connectionType: "stdio",
    helpText: "Runs locally using npx.",
    defaultCommand: "npx",
    defaultArgs: ["-y", "@cyanheads/arxiv-mcp-server"],
  },
  {
    id: "paper-search",
    name: "Paper Search",
    category: "Research & academic",
    description: "Aggregates academic paper search across ~7-20 platforms beyond just arXiv.",
    icon: Library,
    connectionType: "stdio",
    helpText: "Runs locally using npx.",
    defaultCommand: "npx",
    defaultArgs: ["-y", "paper-search-mcp-nodejs"],
  },

  // Coding & docs
  {
    id: "context7",
    name: "Context7",
    category: "Coding & docs",
    description: "Pulls current, version-correct documentation for any library or framework.",
    icon: Code2,
    connectionType: "stdio",
    helpText: "Runs locally using npx.",
    defaultCommand: "npx",
    defaultArgs: ["-y", "@upstash/context7-mcp"],
  },
];
