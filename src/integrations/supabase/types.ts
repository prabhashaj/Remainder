export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      agent_memories: {
        Row: {
          category: string;
          content: string;
          created_at: string;
          id: string;
          importance: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          category?: string;
          content: string;
          created_at?: string;
          id?: string;
          importance?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          category?: string;
          content?: string;
          created_at?: string;
          id?: string;
          importance?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      agent_actions: {
        Row: {
          id: string;
          user_id: string;
          trace_id: string;
          thread_id: string | null;
          tool_name: string;
          input: Json;
          output: Json | null;
          status: string;
          error_message: string | null;
          duration_ms: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          trace_id: string;
          thread_id?: string | null;
          tool_name: string;
          input?: Json;
          output?: Json | null;
          status?: string;
          error_message?: string | null;
          duration_ms?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          trace_id?: string;
          thread_id?: string | null;
          tool_name?: string;
          input?: Json;
          output?: Json | null;
          status?: string;
          error_message?: string | null;
          duration_ms?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      background_jobs: {
        Row: {
          id: string;
          user_id: string;
          job_type: string;
          resource_id: string | null;
          status: string;
          error_message: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          job_type: string;
          resource_id?: string | null;
          status?: string;
          error_message?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          job_type?: string;
          resource_id?: string | null;
          status?: string;
          error_message?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      code_snippets: {
        Row: {
          id: string;
          user_id: string;
          roadmap_item_id: string | null;
          title: string;
          code: string;
          language: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          roadmap_item_id?: string | null;
          title: string;
          code: string;
          language?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          roadmap_item_id?: string | null;
          title?: string;
          code?: string;
          language?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "code_snippets_roadmap_item_id_fkey";
            columns: ["roadmap_item_id"];
            isOneToOne: false;
            referencedRelation: "roadmap_items";
            referencedColumns: ["id"];
          },
        ];
      };
      blocks: {
        Row: {
          checked: boolean;
          content: string;
          created_at: string;
          id: string;
          page_id: string;
          position: number;
          props: Json;
          type: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          checked?: boolean;
          content?: string;
          created_at?: string;
          id?: string;
          page_id: string;
          position?: number;
          props?: Json;
          type?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          checked?: boolean;
          content?: string;
          created_at?: string;
          id?: string;
          page_id?: string;
          position?: number;
          props?: Json;
          type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "blocks_page_id_fkey";
            columns: ["page_id"];
            isOneToOne: false;
            referencedRelation: "pages";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_messages: {
        Row: {
          client_id: string | null;
          created_at: string;
          id: string;
          message: Json;
          role: string;
          thread_id: string;
          user_id: string;
        };
        Insert: {
          client_id?: string | null;
          created_at?: string;
          id?: string;
          message: Json;
          role: string;
          thread_id: string;
          user_id: string;
        };
        Update: {
          client_id?: string | null;
          created_at?: string;
          id?: string;
          message?: Json;
          role?: string;
          thread_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "chat_threads";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_threads: {
        Row: {
          created_at: string;
          id: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          title?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      focus_sessions: {
        Row: {
          break_minutes: number;
          created_at: string;
          ended_at: string | null;
          id: string;
          intention: string | null;
          minutes: number;
          counted_minutes: number | null;
          notes: string | null;
          reflection: string | null;
          resource_kind: string;
          resource_url: string | null;
          roadmap_item_id: string | null;
          session_type: string;
          stayed_on_task: boolean | null;
          tab_away_count: number;
          tab_away_seconds: number;
          title: string;
          updated_at: string;
          user_id: string;
          work_minutes: number;
        };
        Insert: {
          break_minutes?: number;
          created_at?: string;
          ended_at?: string | null;
          id?: string;
          intention?: string | null;
          minutes?: number;
          counted_minutes?: number | null;
          notes?: string | null;
          reflection?: string | null;
          resource_kind?: string;
          resource_url?: string | null;
          roadmap_item_id?: string | null;
          session_type?: string;
          stayed_on_task?: boolean | null;
          tab_away_count?: number;
          tab_away_seconds?: number;
          title: string;
          updated_at?: string;
          user_id: string;
          work_minutes?: number;
        };
        Update: {
          break_minutes?: number;
          created_at?: string;
          ended_at?: string | null;
          id?: string;
          intention?: string | null;
          minutes?: number;
          counted_minutes?: number | null;
          notes?: string | null;
          reflection?: string | null;
          resource_kind?: string;
          resource_url?: string | null;
          roadmap_item_id?: string | null;
          session_type?: string;
          stayed_on_task?: boolean | null;
          tab_away_count?: number;
          tab_away_seconds?: number;
          title?: string;
          updated_at?: string;
          user_id?: string;
          work_minutes?: number;
        };
        Relationships: [
          {
            foreignKeyName: "focus_sessions_roadmap_item_id_fkey";
            columns: ["roadmap_item_id"];
            isOneToOne: false;
            referencedRelation: "roadmap_items";
            referencedColumns: ["id"];
          },
        ];
      };
      flashcards: {
        Row: {
          back: string;
          created_at: string;
          due_date: string;
          ease: number;
          front: string;
          id: string;
          interval_days: number;
          repetitions: number;
          roadmap_item_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          back: string;
          created_at?: string;
          due_date?: string;
          ease?: number;
          front: string;
          id?: string;
          interval_days?: number;
          repetitions?: number;
          roadmap_item_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          back?: string;
          created_at?: string;
          due_date?: string;
          ease?: number;
          front?: string;
          id?: string;
          interval_days?: number;
          repetitions?: number;
          roadmap_item_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "flashcards_roadmap_item_id_fkey";
            columns: ["roadmap_item_id"];
            isOneToOne: false;
            referencedRelation: "roadmap_items";
            referencedColumns: ["id"];
          },
        ];
      };
      goals: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          progress: number;
          status: string;
          target_date: string | null;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          progress?: number;
          status?: string;
          target_date?: string | null;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          progress?: number;
          status?: string;
          target_date?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      habit_logs: {
        Row: {
          created_at: string;
          day: string;
          habit_id: string;
          id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          day?: string;
          habit_id: string;
          id?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          day?: string;
          habit_id?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey";
            columns: ["habit_id"];
            isOneToOne: false;
            referencedRelation: "habits";
            referencedColumns: ["id"];
          },
        ];
      };
      habits: {
        Row: {
          archived: boolean;
          color: string;
          created_at: string;
          emoji: string;
          icon: string;
          id: string;
          target_per_week: number;
          title: string;
          user_id: string;
        };
        Insert: {
          archived?: boolean;
          color?: string;
          created_at?: string;
          emoji?: string;
          icon?: string;
          id?: string;
          target_per_week?: number;
          title: string;
          user_id: string;
        };
        Update: {
          archived?: boolean;
          color?: string;
          created_at?: string;
          emoji?: string;
          icon?: string;
          id?: string;
          target_per_week?: number;
          title?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      journal_entries: {
        Row: {
          created_at: string;
          day: string;
          id: string;
          mood: string | null;
          note: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          day?: string;
          id?: string;
          mood?: string | null;
          note?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          day?: string;
          id?: string;
          mood?: string | null;
          note?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      milestones: {
        Row: {
          created_at: string;
          done: boolean;
          goal_id: string;
          id: string;
          position: number;
          title: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          done?: boolean;
          goal_id: string;
          id?: string;
          position?: number;
          title: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          done?: boolean;
          goal_id?: string;
          id?: string;
          position?: number;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "milestones_goal_id_fkey";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id"];
          },
        ];
      };
      pages: {
        Row: {
          created_at: string;
          icon: string;
          id: string;
          is_favorite: boolean;
          kind: string;
          parent_id: string | null;
          position: number;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          icon?: string;
          id?: string;
          is_favorite?: boolean;
          kind?: string;
          parent_id?: string | null;
          position?: number;
          title?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          icon?: string;
          id?: string;
          is_favorite?: boolean;
          kind?: string;
          parent_id?: string | null;
          position?: number;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pages_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "pages";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          notify_celebrations: boolean;
          notify_daily: boolean;
          onboarded: boolean;
          theme: string;
          font: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id: string;
          notify_celebrations?: boolean;
          notify_daily?: boolean;
          onboarded?: boolean;
          theme?: string;
          font?: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          notify_celebrations?: boolean;
          notify_daily?: boolean;
          onboarded?: boolean;
          theme?: string;
          font?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      quiz_attempts: {
        Row: {
          created_at: string;
          id: string;
          questions: Json;
          roadmap_item_id: string | null;
          score: number;
          total: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          questions?: Json;
          roadmap_item_id?: string | null;
          score?: number;
          total?: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          questions?: Json;
          roadmap_item_id?: string | null;
          score?: number;
          total?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_roadmap_item_id_fkey";
            columns: ["roadmap_item_id"];
            isOneToOne: false;
            referencedRelation: "roadmap_items";
            referencedColumns: ["id"];
          },
        ];
      };
      resource_highlights: {
        Row: {
          color: string;
          created_at: string;
          id: string;
          note: string | null;
          page: number;
          quote: string;
          resource_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          color?: string;
          created_at?: string;
          id?: string;
          note?: string | null;
          page?: number;
          quote: string;
          resource_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          id?: string;
          note?: string | null;
          page?: number;
          quote?: string;
          resource_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "resource_highlights_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "study_resources";
            referencedColumns: ["id"];
          },
        ];
      };
      roadmap_items: {
        Row: {
          content: string | null;
          content_status: string;
          created_at: string;
          detail: string | null;
          done: boolean;
          estimated_minutes: number | null;
          id: string;
          images: Json;
          parent_id: string | null;
          phase: string;
          position: number;
          resource_kind: string | null;
          resource_url: string | null;
          roadmap_id: string;
          title: string;
          updated_at: string;
          user_id: string;
          video_links: Json;
        };
        Insert: {
          content?: string | null;
          content_status?: string;
          created_at?: string;
          detail?: string | null;
          done?: boolean;
          estimated_minutes?: number | null;
          id?: string;
          images?: Json;
          parent_id?: string | null;
          phase?: string;
          position?: number;
          resource_kind?: string | null;
          resource_url?: string | null;
          roadmap_id: string;
          title: string;
          updated_at?: string;
          user_id: string;
          video_links?: Json;
        };
        Update: {
          content?: string | null;
          content_status?: string;
          created_at?: string;
          detail?: string | null;
          done?: boolean;
          estimated_minutes?: number | null;
          id?: string;
          images?: Json;
          parent_id?: string | null;
          phase?: string;
          position?: number;
          resource_kind?: string | null;
          resource_url?: string | null;
          roadmap_id?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
          video_links?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "roadmap_items_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "roadmap_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "roadmap_items_roadmap_id_fkey";
            columns: ["roadmap_id"];
            isOneToOne: false;
            referencedRelation: "roadmaps";
            referencedColumns: ["id"];
          },
        ];
      };
      roadmap_resources: {
        Row: {
          created_at: string;
          duration_text: string | null;
          id: string;
          kind: string;
          roadmap_id: string | null;
          roadmap_item_id: string | null;
          thumbnail: string | null;
          title: string;
          url: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          duration_text?: string | null;
          id?: string;
          kind?: string;
          roadmap_id?: string | null;
          roadmap_item_id?: string | null;
          thumbnail?: string | null;
          title: string;
          url: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          duration_text?: string | null;
          id?: string;
          kind?: string;
          roadmap_id?: string | null;
          roadmap_item_id?: string | null;
          thumbnail?: string | null;
          title?: string;
          url?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "roadmap_resources_roadmap_id_fkey";
            columns: ["roadmap_id"];
            isOneToOne: false;
            referencedRelation: "roadmaps";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "roadmap_resources_roadmap_item_id_fkey";
            columns: ["roadmap_item_id"];
            isOneToOne: false;
            referencedRelation: "roadmap_items";
            referencedColumns: ["id"];
          },
        ];
      };
      roadmaps: {
        Row: {
          created_at: string;
          goal_id: string | null;
          id: string;
          status: string;
          summary: string | null;
          topic: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          goal_id?: string | null;
          id?: string;
          status?: string;
          summary?: string | null;
          topic: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          goal_id?: string | null;
          id?: string;
          status?: string;
          summary?: string | null;
          topic?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "roadmaps_goal_id_fkey";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id"];
          },
        ];
      };
      study_resources: {
        Row: {
          created_at: string;
          extracted_text: string | null;
          id: string;
          key_points: Json;
          kind: string;
          mime_type: string | null;
          page_count: number | null;
          roadmap_id: string | null;
          roadmap_item_id: string | null;
          status: string;
          storage_path: string | null;
          summary: string | null;
          title: string;
          transcript: string | null;
          updated_at: string;
          url: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          extracted_text?: string | null;
          id?: string;
          key_points?: Json;
          kind?: string;
          mime_type?: string | null;
          page_count?: number | null;
          roadmap_id?: string | null;
          roadmap_item_id?: string | null;
          status?: string;
          storage_path?: string | null;
          summary?: string | null;
          title: string;
          transcript?: string | null;
          updated_at?: string;
          url?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          extracted_text?: string | null;
          id?: string;
          key_points?: Json;
          kind?: string;
          mime_type?: string | null;
          page_count?: number | null;
          roadmap_id?: string | null;
          roadmap_item_id?: string | null;
          status?: string;
          storage_path?: string | null;
          summary?: string | null;
          title?: string;
          transcript?: string | null;
          updated_at?: string;
          url?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "study_resources_roadmap_id_fkey";
            columns: ["roadmap_id"];
            isOneToOne: false;
            referencedRelation: "roadmaps";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "study_resources_roadmap_item_id_fkey";
            columns: ["roadmap_item_id"];
            isOneToOne: false;
            referencedRelation: "roadmap_items";
            referencedColumns: ["id"];
          },
        ];
      };
      mcp_servers: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          url: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          url: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          url?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      plans: {
        Row: {
          id: string;
          name: string;
          razorpay_plan_id: string;
          price_inr: number;
          billing_interval: string;
          daily_message_limit: number;
          monthly_message_limit: number;
          features: any;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          razorpay_plan_id: string;
          price_inr: number;
          billing_interval: string;
          daily_message_limit: number;
          monthly_message_limit: number;
          features?: any;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          razorpay_plan_id?: string;
          price_inr?: number;
          billing_interval?: string;
          daily_message_limit?: number;
          monthly_message_limit?: number;
          features?: any;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      processed_webhook_events: {
        Row: { razorpay_event_id: string; processed_at: string };
        Insert: { razorpay_event_id: string; processed_at?: string };
        Update: { razorpay_event_id?: string; processed_at?: string };
        Relationships: [];
      };
      rate_limit_events: {
        Row: { id: string; user_id: string; event_type: string; created_at: string };
        Insert: { id?: string; user_id: string; event_type: string; created_at?: string };
        Update: { id?: string; user_id?: string; event_type?: string; created_at?: string };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          razorpay_subscription_id: string | null;
          plan_id: string | null;
          razorpay_customer_id: string | null;
          tier: string;
          status: string;
          current_period_end: string | null;
          trial_ends_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          razorpay_subscription_id?: string | null;
          plan_id?: string | null;
          razorpay_customer_id?: string | null;
          tier?: string;
          status?: string;
          current_period_end?: string | null;
          trial_ends_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          razorpay_subscription_id?: string | null;
          plan_id?: string | null;
          razorpay_customer_id?: string | null;
          tier?: string;
          status?: string;
          current_period_end?: string | null;
          trial_ends_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
      };
      usage_logs: {
        Row: {
          id: string;
          user_id: string;
          week_start_date: string;
          roadmaps_generated: number;
          notebooks_created: number;
          deep_research_used: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          week_start_date: string;
          roadmaps_generated?: number;
          notebooks_created?: number;
          deep_research_used?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          week_start_date?: string;
          roadmaps_generated?: number;
          notebooks_created?: number;
          deep_research_used?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          created_at: string;
          done: boolean;
          due_date: string | null;
          goal_id: string | null;
          id: string;
          notes: string | null;
          page_id: string | null;
          position: number;
          priority: string;
          roadmap_id: string | null;
          source: string;
          status: string;
          tags: string[];
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          done?: boolean;
          due_date?: string | null;
          goal_id?: string | null;
          id?: string;
          notes?: string | null;
          page_id?: string | null;
          position?: number;
          priority?: string;
          roadmap_id?: string | null;
          source?: string;
          status?: string;
          tags?: string[];
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          done?: boolean;
          due_date?: string | null;
          goal_id?: string | null;
          id?: string;
          notes?: string | null;
          page_id?: string | null;
          position?: number;
          priority?: string;
          roadmap_id?: string | null;
          source?: string;
          status?: string;
          tags?: string[];
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_goal_id_fkey";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_page_id_fkey";
            columns: ["page_id"];
            isOneToOne: false;
            referencedRelation: "pages";
            referencedColumns: ["id"];
          },
        ];
      };
      video_notes: {
        Row: {
          created_at: string;
          id: string;
          note: string;
          resource_id: string;
          seconds: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          note: string;
          resource_id: string;
          seconds?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          note?: string;
          resource_id?: string;
          seconds?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "video_notes_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "study_resources";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
