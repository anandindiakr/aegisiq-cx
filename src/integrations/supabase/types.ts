export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alert_events: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          alert_id: string
          company_id: string
          created_at: string
          from_status: Database["public"]["Enums"]["alert_status"] | null
          id: string
          note: string | null
          to_status: Database["public"]["Enums"]["alert_status"]
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          alert_id: string
          company_id: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["alert_status"] | null
          id?: string
          note?: string | null
          to_status: Database["public"]["Enums"]["alert_status"]
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          alert_id?: string
          company_id?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["alert_status"] | null
          id?: string
          note?: string | null
          to_status?: Database["public"]["Enums"]["alert_status"]
        }
        Relationships: [
          {
            foreignKeyName: "alert_events_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_reads: {
        Row: {
          alert_id: string
          company_id: string
          created_at: string
          id: string
          read_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_id: string
          company_id: string
          created_at?: string
          id?: string
          read_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_id?: string
          company_id?: string
          created_at?: string
          id?: string
          read_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_reads_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          category: string
          company_id: string
          conversation_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          outlet_id: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          status: Database["public"]["Enums"]["alert_status"]
          title: string
          triggered_at: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          category?: string
          company_id: string
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          outlet_id?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          status?: Database["public"]["Enums"]["alert_status"]
          title: string
          triggered_at?: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          category?: string
          company_id?: string
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          outlet_id?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          status?: Database["public"]["Enums"]["alert_status"]
          title?: string
          triggered_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          company_id: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          company_id: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          company_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cameras: {
        Row: {
          audio_enabled: boolean
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          firmware: string | null
          id: string
          last_seen_at: string | null
          location: string | null
          name: string
          outlet_id: string | null
          rtsp_url: string | null
          status: Database["public"]["Enums"]["camera_status"]
          updated_at: string
        }
        Insert: {
          audio_enabled?: boolean
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          firmware?: string | null
          id?: string
          last_seen_at?: string | null
          location?: string | null
          name: string
          outlet_id?: string | null
          rtsp_url?: string | null
          status?: Database["public"]["Enums"]["camera_status"]
          updated_at?: string
        }
        Update: {
          audio_enabled?: boolean
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          firmware?: string | null
          id?: string
          last_seen_at?: string | null
          location?: string | null
          name?: string
          outlet_id?: string | null
          rtsp_url?: string | null
          status?: Database["public"]["Enums"]["camera_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cameras_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cameras_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
        ]
      }
      command_filter_presets: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          filters: Json
          id: string
          is_default: boolean
          is_shared: boolean
          name: string
          outlet_id: string | null
          scope: string
          scope_roles: Database["public"]["Enums"]["app_role"][]
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          filters?: Json
          id?: string
          is_default?: boolean
          is_shared?: boolean
          name: string
          outlet_id?: string | null
          scope?: string
          scope_roles?: Database["public"]["Enums"]["app_role"][]
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          filters?: Json
          id?: string
          is_default?: boolean
          is_shared?: boolean
          name?: string
          outlet_id?: string | null
          scope?: string
          scope_roles?: Database["public"]["Enums"]["app_role"][]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "command_filter_presets_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          active_role_template_id: string | null
          address: string | null
          brand_primary_color: string
          brand_tagline: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          industry: string
          legal_name: string | null
          logo_url: string | null
          name: string
          preferred_languages: string[]
          redaction_export_mode: string
          status: Database["public"]["Enums"]["entity_status"]
          subscription_plan: string
          timezone: string
          updated_at: string
        }
        Insert: {
          active_role_template_id?: string | null
          address?: string | null
          brand_primary_color?: string
          brand_tagline?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          industry?: string
          legal_name?: string | null
          logo_url?: string | null
          name: string
          preferred_languages?: string[]
          redaction_export_mode?: string
          status?: Database["public"]["Enums"]["entity_status"]
          subscription_plan?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          active_role_template_id?: string | null
          address?: string | null
          brand_primary_color?: string
          brand_tagline?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          industry?: string
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          preferred_languages?: string[]
          redaction_export_mode?: string
          status?: Database["public"]["Enums"]["entity_status"]
          subscription_plan?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_active_role_template_id_fkey"
            columns: ["active_role_template_id"]
            isOneToOne: false
            referencedRelation: "role_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_events: {
        Row: {
          company_id: string
          conversation_id: string
          created_at: string
          detail: string | null
          id: string
          label: string
          offset_ms: number
          sequence: number
          updated_at: string
        }
        Insert: {
          company_id: string
          conversation_id: string
          created_at?: string
          detail?: string | null
          id?: string
          label: string
          offset_ms?: number
          sequence?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          conversation_id?: string
          created_at?: string
          detail?: string | null
          id?: string
          label?: string
          offset_ms?: number
          sequence?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_keywords: {
        Row: {
          category: string
          company_id: string
          confidence: number
          conversation_id: string
          created_at: string
          id: string
          keyword: string
          updated_at: string
        }
        Insert: {
          category?: string
          company_id: string
          confidence?: number
          conversation_id: string
          created_at?: string
          id?: string
          keyword: string
          updated_at?: string
        }
        Update: {
          category?: string
          company_id?: string
          confidence?: number
          conversation_id?: string
          created_at?: string
          id?: string
          keyword?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_keywords_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_keywords_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_notes: {
        Row: {
          author_id: string | null
          author_name: string | null
          body: string
          company_id: string
          conversation_id: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          body: string
          company_id: string
          conversation_id: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          body?: string
          company_id?: string
          conversation_id?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_notes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_tags: {
        Row: {
          company_id: string
          conversation_id: string
          created_at: string
          created_by: string | null
          id: string
          tag: string
          updated_at: string
        }
        Insert: {
          company_id: string
          conversation_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          tag: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          conversation_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          tag?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_tags_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_tags_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          agent_name: string | null
          camera_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          customer_type: string | null
          deleted_at: string | null
          duration_seconds: number
          emotion: Database["public"]["Enums"]["emotion_label"]
          ended_at: string | null
          escalated: boolean
          id: string
          language_code: string
          language_confidence: number
          outlet_id: string | null
          reference: string
          risk_level: Database["public"]["Enums"]["risk_level"]
          secondary_language_code: string | null
          sentiment: Database["public"]["Enums"]["sentiment_label"]
          sentiment_score: number
          started_at: string
          status: Database["public"]["Enums"]["conversation_status"]
          topic: string | null
          updated_at: string
        }
        Insert: {
          agent_name?: string | null
          camera_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_type?: string | null
          deleted_at?: string | null
          duration_seconds?: number
          emotion?: Database["public"]["Enums"]["emotion_label"]
          ended_at?: string | null
          escalated?: boolean
          id?: string
          language_code?: string
          language_confidence?: number
          outlet_id?: string | null
          reference: string
          risk_level?: Database["public"]["Enums"]["risk_level"]
          secondary_language_code?: string | null
          sentiment?: Database["public"]["Enums"]["sentiment_label"]
          sentiment_score?: number
          started_at?: string
          status?: Database["public"]["Enums"]["conversation_status"]
          topic?: string | null
          updated_at?: string
        }
        Update: {
          agent_name?: string | null
          camera_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_type?: string | null
          deleted_at?: string | null
          duration_seconds?: number
          emotion?: Database["public"]["Enums"]["emotion_label"]
          ended_at?: string | null
          escalated?: boolean
          id?: string
          language_code?: string
          language_confidence?: number
          outlet_id?: string | null
          reference?: string
          risk_level?: Database["public"]["Enums"]["risk_level"]
          secondary_language_code?: string | null
          sentiment?: Database["public"]["Enums"]["sentiment_label"]
          sentiment_score?: number
          started_at?: string
          status?: Database["public"]["Enums"]["conversation_status"]
          topic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_camera_id_fkey"
            columns: ["camera_id"]
            isOneToOne: false
            referencedRelation: "cameras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_audit_events: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          command: string
          company_id: string
          created_at: string
          denied_reason: string | null
          duration_ms: number | null
          id: string
          input_mode: string
          intent: string
          outcome: string
          resolved_entities: Json
          route: string | null
          surface: string
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          command: string
          company_id?: string
          created_at?: string
          denied_reason?: string | null
          duration_ms?: number | null
          id?: string
          input_mode?: string
          intent?: string
          outcome?: string
          resolved_entities?: Json
          route?: string | null
          surface?: string
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          command?: string
          company_id?: string
          created_at?: string
          denied_reason?: string | null
          duration_ms?: number | null
          id?: string
          input_mode?: string
          intent?: string
          outcome?: string
          resolved_entities?: Json
          route?: string | null
          surface?: string
        }
        Relationships: []
      }
      copilot_preferences: {
        Row: {
          company_id: string
          created_at: string
          default_language: string
          favorite_commands: string[]
          favorite_outlet_id: string | null
          favorite_reports: string[]
          id: string
          pinned_dashboards: string[]
          recent_searches: string[]
          speech_rate: number
          updated_at: string
          user_id: string
          voice_enabled: boolean
        }
        Insert: {
          company_id?: string
          created_at?: string
          default_language?: string
          favorite_commands?: string[]
          favorite_outlet_id?: string | null
          favorite_reports?: string[]
          id?: string
          pinned_dashboards?: string[]
          recent_searches?: string[]
          speech_rate?: number
          updated_at?: string
          user_id?: string
          voice_enabled?: boolean
        }
        Update: {
          company_id?: string
          created_at?: string
          default_language?: string
          favorite_commands?: string[]
          favorite_outlet_id?: string | null
          favorite_reports?: string[]
          id?: string
          pinned_dashboards?: string[]
          recent_searches?: string[]
          speech_rate?: number
          updated_at?: string
          user_id?: string
          voice_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "copilot_preferences_favorite_outlet_id_fkey"
            columns: ["favorite_outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_report_runs: {
        Row: {
          command: string
          company_id: string
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          filters: Json
          id: string
          input_mode: string
          intent: string
          partial: Json
          range_label: string | null
          response: Json | null
          sections: Json
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          command: string
          company_id: string
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          filters?: Json
          id?: string
          input_mode?: string
          intent?: string
          partial?: Json
          range_label?: string | null
          response?: Json | null
          sections?: Json
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          command?: string
          company_id?: string
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          filters?: Json
          id?: string
          input_mode?: string
          intent?: string
          partial?: Json
          range_label?: string | null
          response?: Json | null
          sections?: Json
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dashboard_audit_events: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          after_state: Json
          before_state: Json
          changed_fields: string[]
          company_id: string
          created_at: string
          dashboard_key: string
          entity_id: string | null
          entity_type: string
          id: string
          summary: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          after_state?: Json
          before_state?: Json
          changed_fields?: string[]
          company_id: string
          created_at?: string
          dashboard_key?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          summary: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          after_state?: Json
          before_state?: Json
          changed_fields?: string[]
          company_id?: string
          created_at?: string
          dashboard_key?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          summary?: string
        }
        Relationships: []
      }
      dashboard_layouts: {
        Row: {
          auto_refresh: boolean
          company_id: string
          created_at: string
          dashboard_key: string
          hidden_widgets: string[]
          id: string
          refresh_interval_seconds: number
          updated_at: string
          user_id: string
          widget_order: string[]
        }
        Insert: {
          auto_refresh?: boolean
          company_id: string
          created_at?: string
          dashboard_key?: string
          hidden_widgets?: string[]
          id?: string
          refresh_interval_seconds?: number
          updated_at?: string
          user_id: string
          widget_order?: string[]
        }
        Update: {
          auto_refresh?: boolean
          company_id?: string
          created_at?: string
          dashboard_key?: string
          hidden_widgets?: string[]
          id?: string
          refresh_interval_seconds?: number
          updated_at?: string
          user_id?: string
          widget_order?: string[]
        }
        Relationships: []
      }
      executive_report_schedules: {
        Row: {
          auto_retry: boolean
          company_id: string
          consecutive_failures: number
          created_at: string
          created_by: string | null
          format: string
          frequency: string
          id: string
          is_active: boolean
          last_error: string | null
          last_sent_at: string | null
          last_status: string | null
          max_retries: number
          name: string
          recipients: string[]
          send_hour: number
          updated_at: string
        }
        Insert: {
          auto_retry?: boolean
          company_id: string
          consecutive_failures?: number
          created_at?: string
          created_by?: string | null
          format?: string
          frequency?: string
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_sent_at?: string | null
          last_status?: string | null
          max_retries?: number
          name: string
          recipients?: string[]
          send_hour?: number
          updated_at?: string
        }
        Update: {
          auto_retry?: boolean
          company_id?: string
          consecutive_failures?: number
          created_at?: string
          created_by?: string | null
          format?: string
          frequency?: string
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_sent_at?: string | null
          last_status?: string | null
          max_retries?: number
          name?: string
          recipients?: string[]
          send_hour?: number
          updated_at?: string
        }
        Relationships: []
      }
      export_action_events: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          company_id: string
          created_at: string
          detail: string | null
          format: string | null
          id: string
          metadata: Json
          outcome: string
          recipients: string[]
          run_id: string | null
          schedule_id: string | null
          sections: string[]
          surface: string
          template_name: string | null
          template_version: number | null
          widget_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          company_id: string
          created_at?: string
          detail?: string | null
          format?: string | null
          id?: string
          metadata?: Json
          outcome?: string
          recipients?: string[]
          run_id?: string | null
          schedule_id?: string | null
          sections?: string[]
          surface?: string
          template_name?: string | null
          template_version?: number | null
          widget_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          company_id?: string
          created_at?: string
          detail?: string | null
          format?: string | null
          id?: string
          metadata?: Json
          outcome?: string
          recipients?: string[]
          run_id?: string | null
          schedule_id?: string | null
          sections?: string[]
          surface?: string
          template_name?: string | null
          template_version?: number | null
          widget_id?: string | null
        }
        Relationships: []
      }
      export_audit_events: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          attempt: number
          auto_retry: boolean
          company_id: string
          created_at: string
          duration_ms: number | null
          error_message: string | null
          filters: Json
          format: string
          id: string
          kind: string
          recipients: string[]
          retry_of_id: string | null
          schedule_id: string | null
          sections: string[]
          status: string
          template_id: string | null
          template_name: string | null
          template_version: number | null
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          attempt?: number
          auto_retry?: boolean
          company_id: string
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          filters?: Json
          format: string
          id?: string
          kind?: string
          recipients?: string[]
          retry_of_id?: string | null
          schedule_id?: string | null
          sections?: string[]
          status?: string
          template_id?: string | null
          template_name?: string | null
          template_version?: number | null
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          attempt?: number
          auto_retry?: boolean
          company_id?: string
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          filters?: Json
          format?: string
          id?: string
          kind?: string
          recipients?: string[]
          retry_of_id?: string | null
          schedule_id?: string | null
          sections?: string[]
          status?: string
          template_id?: string | null
          template_name?: string | null
          template_version?: number | null
        }
        Relationships: []
      }
      keywords: {
        Row: {
          category: string
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          term: string
          updated_at: string
          weight: number
        }
        Insert: {
          category?: string
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          term: string
          updated_at?: string
          weight?: number
        }
        Update: {
          category?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          term?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "keywords_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      languages: {
        Row: {
          code: string
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          detection_confidence: number
          id: string
          is_active: boolean
          name: string
          native_name: string | null
          updated_at: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          detection_confidence?: number
          id?: string
          is_active?: boolean
          name: string
          native_name?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          detection_confidence?: number
          id?: string
          is_active?: boolean
          name?: string
          native_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "languages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          attempt: number
          channel: string
          company_id: string
          created_at: string
          destination: string
          duration_ms: number | null
          endpoint_id: string | null
          error_message: string | null
          event_id: string
          event_type: string
          id: string
          payload: Json
          response_status: number | null
          rule_id: string | null
          status: string
          target_label: string | null
        }
        Insert: {
          attempt?: number
          channel: string
          company_id: string
          created_at?: string
          destination: string
          duration_ms?: number | null
          endpoint_id?: string | null
          error_message?: string | null
          event_id: string
          event_type: string
          id?: string
          payload?: Json
          response_status?: number | null
          rule_id?: string | null
          status: string
          target_label?: string | null
        }
        Update: {
          attempt?: number
          channel?: string
          company_id?: string
          created_at?: string
          destination?: string
          duration_ms?: number | null
          endpoint_id?: string | null
          error_message?: string | null
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          response_status?: number | null
          rule_id?: string | null
          status?: string
          target_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "notification_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          company_id: string
          created_at: string
          digest_email: string | null
          email_alerts: boolean
          id: string
          in_app_alerts: boolean
          quiet_hours_end: number | null
          quiet_hours_start: number | null
          sla_email: boolean
          sla_frequency: string
          sla_in_app: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          digest_email?: string | null
          email_alerts?: boolean
          id?: string
          in_app_alerts?: boolean
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          sla_email?: boolean
          sla_frequency?: string
          sla_in_app?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          digest_email?: string | null
          email_alerts?: boolean
          id?: string
          in_app_alerts?: boolean
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          sla_email?: boolean
          sla_frequency?: string
          sla_in_app?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_rules: {
        Row: {
          active: boolean
          channel: string
          company_id: string
          created_at: string
          created_by: string | null
          destination: string
          events: string[]
          id: string
          name: string
          recipient_user_ids: string[]
          updated_at: string
        }
        Insert: {
          active?: boolean
          channel: string
          company_id: string
          created_at?: string
          created_by?: string | null
          destination: string
          events?: string[]
          id?: string
          name: string
          recipient_user_ids?: string[]
          updated_at?: string
        }
        Update: {
          active?: boolean
          channel?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          destination?: string
          events?: string[]
          id?: string
          name?: string
          recipient_user_ids?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      outlets: {
        Row: {
          address: string | null
          city: string | null
          code: string
          company_id: string
          country: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          latitude: number | null
          longitude: number | null
          manager_email: string | null
          manager_name: string | null
          name: string
          opened_at: string | null
          region: string | null
          status: Database["public"]["Enums"]["entity_status"]
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          code: string
          company_id: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          manager_email?: string | null
          manager_name?: string | null
          name: string
          opened_at?: string | null
          region?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string
          company_id?: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          manager_email?: string | null
          manager_name?: string | null
          name?: string
          opened_at?: string | null
          region?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outlets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      preset_share_links: {
        Row: {
          allowed_roles: Database["public"]["Enums"]["app_role"][]
          company_id: string
          created_at: string
          created_by: string | null
          created_by_name: string | null
          expires_at: string
          id: string
          label: string | null
          last_viewed_at: string | null
          preset_id: string
          revoked_at: string | null
          token: string
          updated_at: string
          view_count: number
        }
        Insert: {
          allowed_roles?: Database["public"]["Enums"]["app_role"][]
          company_id: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          expires_at?: string
          id?: string
          label?: string | null
          last_viewed_at?: string | null
          preset_id: string
          revoked_at?: string | null
          token?: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          allowed_roles?: Database["public"]["Enums"]["app_role"][]
          company_id?: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          expires_at?: string
          id?: string
          label?: string | null
          last_viewed_at?: string | null
          preset_id?: string
          revoked_at?: string | null
          token?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "preset_share_links_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "command_filter_presets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          directory_role: Database["public"]["Enums"]["app_role"]
          email: string
          full_name: string
          id: string
          job_title: string | null
          last_active_at: string | null
          outlet_id: string | null
          phone: string | null
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          directory_role?: Database["public"]["Enums"]["app_role"]
          email: string
          full_name: string
          id?: string
          job_title?: string | null
          last_active_at?: string | null
          outlet_id?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          directory_role?: Database["public"]["Enums"]["app_role"]
          email?: string
          full_name?: string
          id?: string
          job_title?: string | null
          last_active_at?: string | null
          outlet_id?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
        ]
      }
      report_template_versions: {
        Row: {
          author_name: string | null
          change_summary: string | null
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          formats: string[]
          id: string
          name: string
          sections: string[]
          template_id: string
          version: number
        }
        Insert: {
          author_name?: string | null
          change_summary?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          formats?: string[]
          id?: string
          name: string
          sections?: string[]
          template_id: string
          version: number
        }
        Update: {
          author_name?: string | null
          change_summary?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          formats?: string[]
          id?: string
          name?: string
          sections?: string[]
          template_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "report_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "report_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      report_templates: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          formats: string[]
          id: string
          is_default: boolean
          name: string
          sections: string[]
          updated_at: string
          version: number
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          formats?: string[]
          id?: string
          is_default?: boolean
          name: string
          sections?: string[]
          updated_at?: string
          version?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          formats?: string[]
          id?: string
          is_default?: boolean
          name?: string
          sections?: string[]
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      review_assignments: {
        Row: {
          alert_id: string | null
          assignee_id: string | null
          assignee_name: string | null
          company_id: string
          completed_at: string | null
          conversation_id: string | null
          created_at: string
          created_by: string | null
          due_at: string
          id: string
          notes: string | null
          priority: Database["public"]["Enums"]["review_priority"]
          sla_minutes: number
          started_at: string | null
          status: Database["public"]["Enums"]["review_queue_status"]
          title: string
          updated_at: string
        }
        Insert: {
          alert_id?: string | null
          assignee_id?: string | null
          assignee_name?: string | null
          company_id: string
          completed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string
          id?: string
          notes?: string | null
          priority?: Database["public"]["Enums"]["review_priority"]
          sla_minutes?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["review_queue_status"]
          title: string
          updated_at?: string
        }
        Update: {
          alert_id?: string | null
          assignee_id?: string | null
          assignee_name?: string | null
          company_id?: string
          completed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string
          id?: string
          notes?: string | null
          priority?: Database["public"]["Enums"]["review_priority"]
          sla_minutes?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["review_queue_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_assignments_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_assignments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      review_audit_events: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          after_state: Json
          assignment_id: string | null
          before_state: Json
          changed_fields: string[]
          company_id: string
          conversation_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          after_state?: Json
          assignment_id?: string | null
          before_state?: Json
          changed_fields?: string[]
          company_id: string
          conversation_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          after_state?: Json
          assignment_id?: string | null
          before_state?: Json
          changed_fields?: string[]
          company_id?: string
          conversation_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      role_templates: {
        Row: {
          capabilities: Json
          company_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_shared: boolean
          name: string
          roles: Database["public"]["Enums"]["app_role"][]
          updated_at: string
        }
        Insert: {
          capabilities?: Json
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_shared?: boolean
          name: string
          roles?: Database["public"]["Enums"]["app_role"][]
          updated_at?: string
        }
        Update: {
          capabilities?: Json
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_shared?: boolean
          name?: string
          roles?: Database["public"]["Enums"]["app_role"][]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_escalation_steps: {
        Row: {
          action: string
          company_id: string
          created_at: string
          delay_minutes: number
          id: string
          is_active: boolean
          note: string | null
          notify_email: string | null
          notify_role: Database["public"]["Enums"]["app_role"] | null
          policy_id: string
          step_order: number
          updated_at: string
        }
        Insert: {
          action?: string
          company_id: string
          created_at?: string
          delay_minutes?: number
          id?: string
          is_active?: boolean
          note?: string | null
          notify_email?: string | null
          notify_role?: Database["public"]["Enums"]["app_role"] | null
          policy_id: string
          step_order?: number
          updated_at?: string
        }
        Update: {
          action?: string
          company_id?: string
          created_at?: string
          delay_minutes?: number
          id?: string
          is_active?: boolean
          note?: string | null
          notify_email?: string | null
          notify_role?: Database["public"]["Enums"]["app_role"] | null
          policy_id?: string
          step_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sla_escalation_steps_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "sla_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_policies: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          priority: Database["public"]["Enums"]["review_priority"]
          target_minutes: number
          updated_at: string
          warning_percent: number
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          priority?: Database["public"]["Enums"]["review_priority"]
          target_minutes?: number
          updated_at?: string
          warning_percent?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          priority?: Database["public"]["Enums"]["review_priority"]
          target_minutes?: number
          updated_at?: string
          warning_percent?: number
        }
        Relationships: []
      }
      sso_role_mappings: {
        Row: {
          claim_key: string
          claim_value: string
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          outlet_id: string | null
          priority: number
          provider: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          claim_key: string
          claim_value: string
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          outlet_id?: string | null
          priority?: number
          provider?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          claim_key?: string
          claim_value?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          outlet_id?: string | null
          priority?: number
          provider?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sso_role_mappings_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
        ]
      }
      summaries: {
        Row: {
          company_id: string
          conversation_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          intent: string | null
          key_points: string[]
          model: string
          resolution_status: string
          summary: string
          updated_at: string
        }
        Insert: {
          company_id: string
          conversation_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          intent?: string | null
          key_points?: string[]
          model?: string
          resolution_status?: string
          summary: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          conversation_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          intent?: string | null
          key_points?: string[]
          model?: string
          resolution_status?: string
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "summaries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "summaries_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      transcript_anchors: {
        Row: {
          author_name: string | null
          company_id: string
          conversation_id: string
          created_at: string
          created_by: string | null
          end_ms: number
          id: string
          labels: string[]
          note: string | null
          quote: string
          speaker: string
          start_ms: number
          transcript_id: string | null
          updated_at: string
        }
        Insert: {
          author_name?: string | null
          company_id: string
          conversation_id: string
          created_at?: string
          created_by?: string | null
          end_ms?: number
          id?: string
          labels?: string[]
          note?: string | null
          quote: string
          speaker?: string
          start_ms?: number
          transcript_id?: string | null
          updated_at?: string
        }
        Update: {
          author_name?: string | null
          company_id?: string
          conversation_id?: string
          created_at?: string
          created_by?: string | null
          end_ms?: number
          id?: string
          labels?: string[]
          note?: string | null
          quote?: string
          speaker?: string
          start_ms?: number
          transcript_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcript_anchors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transcript_anchors_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transcript_anchors_transcript_id_fkey"
            columns: ["transcript_id"]
            isOneToOne: false
            referencedRelation: "transcripts"
            referencedColumns: ["id"]
          },
        ]
      }
      transcript_redactions: {
        Row: {
          author_name: string | null
          category: string
          company_id: string
          conversation_id: string
          created_at: string
          created_by: string | null
          end_offset: number
          id: string
          label: string
          original_snippet: string | null
          reason: string | null
          start_offset: number
          transcript_id: string | null
          updated_at: string
        }
        Insert: {
          author_name?: string | null
          category?: string
          company_id: string
          conversation_id: string
          created_at?: string
          created_by?: string | null
          end_offset?: number
          id?: string
          label?: string
          original_snippet?: string | null
          reason?: string | null
          start_offset?: number
          transcript_id?: string | null
          updated_at?: string
        }
        Update: {
          author_name?: string | null
          category?: string
          company_id?: string
          conversation_id?: string
          created_at?: string
          created_by?: string | null
          end_offset?: number
          id?: string
          label?: string
          original_snippet?: string | null
          reason?: string | null
          start_offset?: number
          transcript_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      transcripts: {
        Row: {
          company_id: string
          confidence: number
          content: string
          conversation_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          end_ms: number
          id: string
          language_code: string
          sequence: number
          speaker: string
          start_ms: number
          updated_at: string
        }
        Insert: {
          company_id: string
          confidence?: number
          content: string
          conversation_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          end_ms?: number
          id?: string
          language_code?: string
          sequence?: number
          speaker: string
          start_ms?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          confidence?: number
          content?: string
          conversation_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          end_ms?: number
          id?: string
          language_code?: string
          sequence?: number
          speaker?: string
          start_ms?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcripts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transcripts_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          events: string[]
          id: string
          last_delivery_at: string | null
          last_error: string | null
          last_status: number | null
          name: string
          secret: string
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          events?: string[]
          id?: string
          last_delivery_at?: string | null
          last_error?: string | null
          last_status?: number | null
          name: string
          secret: string
          updated_at?: string
          url: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          events?: string[]
          id?: string
          last_delivery_at?: string | null
          last_error?: string | null
          last_status?: number | null
          name?: string
          secret?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      widget_access_requests: {
        Row: {
          access_expires_at: string | null
          company_id: string
          context: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decided_by_name: string | null
          decision_note: string | null
          due_at: string | null
          expires_at: string | null
          id: string
          reason: string | null
          requester_email: string | null
          requester_id: string
          requester_name: string | null
          sla_minutes: number
          status: string
          updated_at: string
          widget_id: string
        }
        Insert: {
          access_expires_at?: string | null
          company_id: string
          context?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decided_by_name?: string | null
          decision_note?: string | null
          due_at?: string | null
          expires_at?: string | null
          id?: string
          reason?: string | null
          requester_email?: string | null
          requester_id: string
          requester_name?: string | null
          sla_minutes?: number
          status?: string
          updated_at?: string
          widget_id: string
        }
        Update: {
          access_expires_at?: string | null
          company_id?: string
          context?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decided_by_name?: string | null
          decision_note?: string | null
          due_at?: string | null
          expires_at?: string | null
          id?: string
          reason?: string | null
          requester_email?: string | null
          requester_id?: string
          requester_name?: string | null
          sla_minutes?: number
          status?: string
          updated_at?: string
          widget_id?: string
        }
        Relationships: []
      }
      widget_access_rules: {
        Row: {
          company_id: string
          created_at: string
          id: string
          roles: Database["public"]["Enums"]["app_role"][]
          updated_at: string
          widget_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          roles?: Database["public"]["Enums"]["app_role"][]
          updated_at?: string
          widget_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          roles?: Database["public"]["Enums"]["app_role"][]
          updated_at?: string
          widget_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      actor_display_name: { Args: never; Returns: string }
      allowed_widgets: { Args: never; Returns: string[] }
      can_operate: { Args: never; Returns: boolean }
      can_view_widget: { Args: { _widget_id: string }; Returns: boolean }
      current_company_id: { Args: never; Returns: string }
      executive_overview: { Args: { p_filters?: Json }; Returns: Json }
      expire_widget_access_requests: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_admin: { Args: never; Returns: boolean }
      preset_by_share_token: { Args: { _token: string }; Returns: Json }
      tenant_branding: {
        Args: never
        Returns: {
          brand_primary_color: string
          brand_tagline: string
          logo_url: string
          name: string
        }[]
      }
    }
    Enums: {
      alert_severity: "critical" | "high" | "medium" | "low" | "info"
      alert_status: "open" | "acknowledged" | "resolved" | "dismissed"
      app_role:
        | "super_admin"
        | "tenant_admin"
        | "regional_manager"
        | "outlet_manager"
        | "supervisor"
        | "viewer"
      camera_status: "online" | "offline" | "degraded" | "maintenance"
      conversation_status:
        | "new"
        | "in_review"
        | "escalated"
        | "resolved"
        | "closed"
      emotion_label:
        | "satisfied"
        | "happy"
        | "confused"
        | "frustrated"
        | "angry"
        | "neutral"
      entity_status: "active" | "inactive" | "suspended" | "archived"
      review_priority: "low" | "normal" | "high" | "urgent"
      review_queue_status: "open" | "in_progress" | "done" | "cancelled"
      risk_level: "low" | "medium" | "high"
      sentiment_label:
        | "very_negative"
        | "negative"
        | "neutral"
        | "positive"
        | "very_positive"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      alert_severity: ["critical", "high", "medium", "low", "info"],
      alert_status: ["open", "acknowledged", "resolved", "dismissed"],
      app_role: [
        "super_admin",
        "tenant_admin",
        "regional_manager",
        "outlet_manager",
        "supervisor",
        "viewer",
      ],
      camera_status: ["online", "offline", "degraded", "maintenance"],
      conversation_status: [
        "new",
        "in_review",
        "escalated",
        "resolved",
        "closed",
      ],
      emotion_label: [
        "satisfied",
        "happy",
        "confused",
        "frustrated",
        "angry",
        "neutral",
      ],
      entity_status: ["active", "inactive", "suspended", "archived"],
      review_priority: ["low", "normal", "high", "urgent"],
      review_queue_status: ["open", "in_progress", "done", "cancelled"],
      risk_level: ["low", "medium", "high"],
      sentiment_label: [
        "very_negative",
        "negative",
        "neutral",
        "positive",
        "very_positive",
      ],
    },
  },
} as const
