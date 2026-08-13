# Remi Request Flow Architecture

```mermaid
flowchart TD
    User([User Request / Attachment]) --> RateLimit{Rate Limiting Gate}
    RateLimit -->|Allowed| Orchestrator[chat.ts Orchestrator]
    RateLimit -->|Denied| Error[429 Too Many Requests]

    Orchestrator --> Context[buildUserContext + router.server.ts]
    Context --> LLM[LLM Orchestrator]

    LLM --> Dispatcher{Tool Dispatcher (wrapTool)}

    %% Tool Groups
    Dispatcher -.->|Audit Trail (Fire & Forget)| AuditSink[(agent_actions)]

    Dispatcher --> Tasks[Tasks & Goals Tools]
    Dispatcher --> Roadmap[Roadmap Tools]
    Dispatcher --> Research[Research Tools]
    Dispatcher --> Documents[Document Tools]
    Dispatcher --> Notebook[Notebook Tools]
    Dispatcher --> System[System Tools]

    %% Specific Connections
    System -->|saveMemory| Memories[(agent_memories)]

    %% Database Links
    Tasks --> Supabase[(Supabase Tables)]
    Roadmap --> Supabase
    Research --> Supabase
    Documents --> Supabase
    Notebook --> Supabase
```
