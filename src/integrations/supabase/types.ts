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
      admin_settings: {
        Row: {
          company_id: string
          created_at: string
          id: string
          section: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          company_id?: string
          created_at?: string
          id?: string
          section: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          section?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      ai_engines: {
        Row: {
          api_configured: boolean
          capability: string
          company_id: string
          config: Json
          created_at: string
          created_by: string | null
          enabled: boolean
          endpoint: string | null
          health: string
          id: string
          last_tested_at: string | null
          latency_ms: number
          name: string
          notes: string | null
          provider: string
          region: string | null
          status: string
          updated_at: string
          version: string
        }
        Insert: {
          api_configured?: boolean
          capability?: string
          company_id: string
          config?: Json
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          endpoint?: string | null
          health?: string
          id?: string
          last_tested_at?: string | null
          latency_ms?: number
          name: string
          notes?: string | null
          provider: string
          region?: string | null
          status?: string
          updated_at?: string
          version?: string
        }
        Update: {
          api_configured?: boolean
          capability?: string
          company_id?: string
          config?: Json
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          endpoint?: string | null
          health?: string
          id?: string
          last_tested_at?: string | null
          latency_ms?: number
          name?: string
          notes?: string | null
          provider?: string
          region?: string | null
          status?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      alert_escalations: {
        Row: {
          alert_id: string
          company_id: string
          created_at: string
          from_user_id: string | null
          id: string
          level: number
          minutes_overdue: number
          reason: string
          to_role: Database["public"]["Enums"]["app_role"] | null
          to_user_id: string | null
          to_user_name: string | null
        }
        Insert: {
          alert_id: string
          company_id: string
          created_at?: string
          from_user_id?: string | null
          id?: string
          level?: number
          minutes_overdue?: number
          reason: string
          to_role?: Database["public"]["Enums"]["app_role"] | null
          to_user_id?: string | null
          to_user_name?: string | null
        }
        Update: {
          alert_id?: string
          company_id?: string
          created_at?: string
          from_user_id?: string | null
          id?: string
          level?: number
          minutes_overdue?: number
          reason?: string
          to_role?: Database["public"]["Enums"]["app_role"] | null
          to_user_id?: string | null
          to_user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alert_escalations_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
        ]
      }
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
      alert_notes: {
        Row: {
          alert_id: string
          author_name: string | null
          body: string
          company_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          alert_id: string
          author_name?: string | null
          body: string
          company_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Update: {
          alert_id?: string
          author_name?: string | null
          body?: string
          company_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_notes_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
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
      alert_sla_policies: {
        Row: {
          ack_minutes: number
          backup_role: Database["public"]["Enums"]["app_role"] | null
          backup_user_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          escalate_after_minutes: number
          id: string
          is_active: boolean
          resolve_minutes: number
          severity: Database["public"]["Enums"]["alert_severity"]
          updated_at: string
        }
        Insert: {
          ack_minutes?: number
          backup_role?: Database["public"]["Enums"]["app_role"] | null
          backup_user_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          escalate_after_minutes?: number
          id?: string
          is_active?: boolean
          resolve_minutes?: number
          severity: Database["public"]["Enums"]["alert_severity"]
          updated_at?: string
        }
        Update: {
          ack_minutes?: number
          backup_role?: Database["public"]["Enums"]["app_role"] | null
          backup_user_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          escalate_after_minutes?: number
          id?: string
          is_active?: boolean
          resolve_minutes?: number
          severity?: Database["public"]["Enums"]["alert_severity"]
          updated_at?: string
        }
        Relationships: []
      }
      alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          assigned_at: string | null
          assigned_to: string | null
          category: string
          company_id: string
          conversation_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          escalated_at: string | null
          escalation_level: number
          id: string
          outlet_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          sla_breached: boolean
          sla_due_at: string | null
          status: Database["public"]["Enums"]["alert_status"]
          title: string
          triggered_at: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          category?: string
          company_id: string
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          escalated_at?: string | null
          escalation_level?: number
          id?: string
          outlet_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          sla_breached?: boolean
          sla_due_at?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
          title: string
          triggered_at?: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          category?: string
          company_id?: string
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          escalated_at?: string | null
          escalation_level?: number
          id?: string
          outlet_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          sla_breached?: boolean
          sla_due_at?: string | null
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
      api_credentials: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          hint: string | null
          id: string
          label: string | null
          last_revealed_at: string | null
          last_revealed_by: string | null
          provider: string
          rotated_at: string
          secret_cipher: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          hint?: string | null
          id?: string
          label?: string | null
          last_revealed_at?: string | null
          last_revealed_by?: string | null
          provider: string
          rotated_at?: string
          secret_cipher?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          hint?: string | null
          id?: string
          label?: string | null
          last_revealed_at?: string | null
          last_revealed_by?: string | null
          provider?: string
          rotated_at?: string
          secret_cipher?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      audio_streams: {
        Row: {
          bitrate_kbps: number
          camera_id: string
          channels: number
          codec: string
          company_id: string
          created_at: string
          id: string
          latency_ms: number
          noise_floor_db: number
          packet_loss: number
          sampling_rate: number
          signal_quality: number
          status: string
          updated_at: string
        }
        Insert: {
          bitrate_kbps?: number
          camera_id: string
          channels?: number
          codec?: string
          company_id: string
          created_at?: string
          id?: string
          latency_ms?: number
          noise_floor_db?: number
          packet_loss?: number
          sampling_rate?: number
          signal_quality?: number
          status?: string
          updated_at?: string
        }
        Update: {
          bitrate_kbps?: number
          camera_id?: string
          channels?: number
          codec?: string
          company_id?: string
          created_at?: string
          id?: string
          latency_ms?: number
          noise_floor_db?: number
          packet_loss?: number
          sampling_rate?: number
          signal_quality?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
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
      backup_runs: {
        Row: {
          archive_location: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          retention_days: number
          scope: string
          size_mb: number
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          archive_location?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          retention_days?: number
          scope?: string
          size_mb?: number
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          archive_location?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          retention_days?: number
          scope?: string
          size_mb?: number
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      cameras: {
        Row: {
          audio_codec: string
          audio_enabled: boolean
          bitrate_kbps: number
          brand: string | null
          camera_code: string | null
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          echo_cancellation: boolean
          firmware: string | null
          fps: number
          gain: number
          gateway_id: string | null
          health_score: number
          health_state: string
          https_enabled: boolean
          id: string
          ip_address: string | null
          last_seen_at: string | null
          location: string | null
          mic_type: string
          model: string | null
          name: string
          noise_reduction: boolean
          onvif_enabled: boolean
          outlet_id: string | null
          port: number
          resolution: string
          rtsp_url: string | null
          sampling_rate: number
          status: Database["public"]["Enums"]["camera_status"]
          stream_username: string | null
          updated_at: string
          video_codec: string
          zone: string | null
        }
        Insert: {
          audio_codec?: string
          audio_enabled?: boolean
          bitrate_kbps?: number
          brand?: string | null
          camera_code?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          echo_cancellation?: boolean
          firmware?: string | null
          fps?: number
          gain?: number
          gateway_id?: string | null
          health_score?: number
          health_state?: string
          https_enabled?: boolean
          id?: string
          ip_address?: string | null
          last_seen_at?: string | null
          location?: string | null
          mic_type?: string
          model?: string | null
          name: string
          noise_reduction?: boolean
          onvif_enabled?: boolean
          outlet_id?: string | null
          port?: number
          resolution?: string
          rtsp_url?: string | null
          sampling_rate?: number
          status?: Database["public"]["Enums"]["camera_status"]
          stream_username?: string | null
          updated_at?: string
          video_codec?: string
          zone?: string | null
        }
        Update: {
          audio_codec?: string
          audio_enabled?: boolean
          bitrate_kbps?: number
          brand?: string | null
          camera_code?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          echo_cancellation?: boolean
          firmware?: string | null
          fps?: number
          gain?: number
          gateway_id?: string | null
          health_score?: number
          health_state?: string
          https_enabled?: boolean
          id?: string
          ip_address?: string | null
          last_seen_at?: string | null
          location?: string | null
          mic_type?: string
          model?: string | null
          name?: string
          noise_reduction?: boolean
          onvif_enabled?: boolean
          outlet_id?: string | null
          port?: number
          resolution?: string
          rtsp_url?: string | null
          sampling_rate?: number
          status?: Database["public"]["Enums"]["camera_status"]
          stream_username?: string | null
          updated_at?: string
          video_codec?: string
          zone?: string | null
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
      copilot_report_artifacts: {
        Row: {
          channel: string | null
          company_id: string
          created_at: string
          destination: string | null
          error_message: string | null
          filename: string | null
          format: string | null
          id: string
          kind: string
          metadata: Json
          run_id: string
          size_bytes: number | null
          status: string
          user_id: string
        }
        Insert: {
          channel?: string | null
          company_id: string
          created_at?: string
          destination?: string | null
          error_message?: string | null
          filename?: string | null
          format?: string | null
          id?: string
          kind?: string
          metadata?: Json
          run_id: string
          size_bytes?: number | null
          status?: string
          user_id: string
        }
        Update: {
          channel?: string | null
          company_id?: string
          created_at?: string
          destination?: string | null
          error_message?: string | null
          filename?: string | null
          format?: string | null
          id?: string
          kind?: string
          metadata?: Json
          run_id?: string
          size_bytes?: number | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "copilot_report_artifacts_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "copilot_report_runs"
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
      device_credentials: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          device_id: string
          device_type: string
          expires_at: string | null
          id: string
          label: string
          last_revealed_at: string | null
          last_revealed_by: string | null
          notes: string | null
          onvif_secret_cipher: string | null
          onvif_username: string | null
          rotated_at: string | null
          rotation_interval_days: number
          rotation_note: string | null
          rotation_requested_at: string | null
          rotation_requested_by: string | null
          rotation_status: string
          rtsp_url: string | null
          secret_cipher: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          device_id: string
          device_type: string
          expires_at?: string | null
          id?: string
          label?: string
          last_revealed_at?: string | null
          last_revealed_by?: string | null
          notes?: string | null
          onvif_secret_cipher?: string | null
          onvif_username?: string | null
          rotated_at?: string | null
          rotation_interval_days?: number
          rotation_note?: string | null
          rotation_requested_at?: string | null
          rotation_requested_by?: string | null
          rotation_status?: string
          rtsp_url?: string | null
          secret_cipher?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          device_id?: string
          device_type?: string
          expires_at?: string | null
          id?: string
          label?: string
          last_revealed_at?: string | null
          last_revealed_by?: string | null
          notes?: string | null
          onvif_secret_cipher?: string | null
          onvif_username?: string | null
          rotated_at?: string | null
          rotation_interval_days?: number
          rotation_note?: string | null
          rotation_requested_at?: string | null
          rotation_requested_by?: string | null
          rotation_status?: string
          rtsp_url?: string | null
          secret_cipher?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      edge_gateways: {
        Row: {
          agent_version: string
          company_id: string
          cpu_model: string
          cpu_usage: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          diarization_enabled: boolean
          disk_usage: number
          gpu_model: string
          gpu_usage: number
          id: string
          ingest_enabled: boolean
          ip_address: string | null
          last_heartbeat_at: string | null
          location: string | null
          memory_usage: number
          name: string
          notes: string | null
          operating_system: string
          outlet_ids: string[]
          ram_gb: number
          serial_number: string
          status: string
          storage_gb: number
          temperature_c: number
          transcription_enabled: boolean
          updated_at: string
        }
        Insert: {
          agent_version?: string
          company_id: string
          cpu_model?: string
          cpu_usage?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          diarization_enabled?: boolean
          disk_usage?: number
          gpu_model?: string
          gpu_usage?: number
          id?: string
          ingest_enabled?: boolean
          ip_address?: string | null
          last_heartbeat_at?: string | null
          location?: string | null
          memory_usage?: number
          name: string
          notes?: string | null
          operating_system?: string
          outlet_ids?: string[]
          ram_gb?: number
          serial_number: string
          status?: string
          storage_gb?: number
          temperature_c?: number
          transcription_enabled?: boolean
          updated_at?: string
        }
        Update: {
          agent_version?: string
          company_id?: string
          cpu_model?: string
          cpu_usage?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          diarization_enabled?: boolean
          disk_usage?: number
          gpu_model?: string
          gpu_usage?: number
          id?: string
          ingest_enabled?: boolean
          ip_address?: string | null
          last_heartbeat_at?: string | null
          location?: string | null
          memory_usage?: number
          name?: string
          notes?: string | null
          operating_system?: string
          outlet_ids?: string[]
          ram_gb?: number
          serial_number?: string
          status?: string
          storage_gb?: number
          temperature_c?: number
          transcription_enabled?: boolean
          updated_at?: string
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
      infra_audit_events: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          after_state: Json
          before_state: Json
          changed_fields: string[]
          company_id: string
          created_at: string
          entity_id: string | null
          entity_name: string | null
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
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
          summary?: string
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
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
          summary?: string
        }
        Relationships: []
      }
      infra_events: {
        Row: {
          company_id: string
          created_at: string
          device_id: string | null
          device_name: string | null
          device_type: string | null
          id: string
          level: string
          message: string
          metadata: Json
          source: string
        }
        Insert: {
          company_id: string
          created_at?: string
          device_id?: string | null
          device_name?: string | null
          device_type?: string | null
          id?: string
          level?: string
          message: string
          metadata?: Json
          source?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          device_id?: string | null
          device_name?: string | null
          device_type?: string | null
          id?: string
          level?: string
          message?: string
          metadata?: Json
          source?: string
        }
        Relationships: []
      }
      infra_health_thresholds: {
        Row: {
          company_id: string
          comparator: string
          created_at: string
          critical_value: number
          enabled: boolean
          id: string
          label: string
          metric: string
          unit: string
          updated_at: string
          warn_value: number
        }
        Insert: {
          company_id: string
          comparator?: string
          created_at?: string
          critical_value: number
          enabled?: boolean
          id?: string
          label: string
          metric: string
          unit?: string
          updated_at?: string
          warn_value: number
        }
        Update: {
          company_id?: string
          comparator?: string
          created_at?: string
          critical_value?: number
          enabled?: boolean
          id?: string
          label?: string
          metric?: string
          unit?: string
          updated_at?: string
          warn_value?: number
        }
        Relationships: []
      }
      integration_connections: {
        Row: {
          category: string
          company_id: string
          config: Json
          created_at: string
          enabled: boolean
          id: string
          last_tested_at: string | null
          provider: string
          status: string
          updated_at: string
        }
        Insert: {
          category?: string
          company_id?: string
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          last_tested_at?: string | null
          provider: string
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          company_id?: string
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          last_tested_at?: string | null
          provider?: string
          status?: string
          updated_at?: string
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
          keyword_dictionary: boolean
          name: string
          native_name: string | null
          sentiment: boolean
          speech_recognition: boolean
          tier: string
          translation: boolean
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
          keyword_dictionary?: boolean
          name: string
          native_name?: string | null
          sentiment?: boolean
          speech_recognition?: boolean
          tier?: string
          translation?: boolean
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
          keyword_dictionary?: boolean
          name?: string
          native_name?: string | null
          sentiment?: boolean
          speech_recognition?: boolean
          tier?: string
          translation?: boolean
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
          dedupe_key: string | null
          destination: string
          duration_ms: number | null
          endpoint_id: string | null
          error_message: string | null
          event_id: string
          event_type: string
          group_id: string | null
          id: string
          idempotency_key: string | null
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
          dedupe_key?: string | null
          destination: string
          duration_ms?: number | null
          endpoint_id?: string | null
          error_message?: string | null
          event_id: string
          event_type: string
          group_id?: string | null
          id?: string
          idempotency_key?: string | null
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
          dedupe_key?: string | null
          destination?: string
          duration_ms?: number | null
          endpoint_id?: string | null
          error_message?: string | null
          event_id?: string
          event_type?: string
          group_id?: string | null
          id?: string
          idempotency_key?: string | null
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
            foreignKeyName: "notification_deliveries_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "notification_groups"
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
      notification_groups: {
        Row: {
          active: boolean
          bypass_quiet_for_failures: boolean
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          events: string[]
          id: string
          members: Json
          name: string
          quiet_hours_end: number | null
          quiet_hours_start: number | null
          send_window_end: number
          send_window_start: number
          timezone: string
          updated_at: string
          window_days: number[]
        }
        Insert: {
          active?: boolean
          bypass_quiet_for_failures?: boolean
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          events?: string[]
          id?: string
          members?: Json
          name: string
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          send_window_end?: number
          send_window_start?: number
          timezone?: string
          updated_at?: string
          window_days?: number[]
        }
        Update: {
          active?: boolean
          bypass_quiet_for_failures?: boolean
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          events?: string[]
          id?: string
          members?: Json
          name?: string
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          send_window_end?: number
          send_window_start?: number
          timezone?: string
          updated_at?: string
          window_days?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "notification_groups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
      outlet_quotas: {
        Row: {
          audio_minutes_limit: number
          company_id: string
          created_at: string
          id: string
          notes: string | null
          outlet_id: string
          query_limit: number
          throttle_enabled: boolean
          updated_at: string
        }
        Insert: {
          audio_minutes_limit?: number
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          outlet_id: string
          query_limit?: number
          throttle_enabled?: boolean
          updated_at?: string
        }
        Update: {
          audio_minutes_limit?: number
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          outlet_id?: string
          query_limit?: number
          throttle_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outlet_quotas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outlet_quotas_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: true
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
        ]
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
      pricing_scenarios: {
        Row: {
          audio_hours_per_outlet: number
          cameras_per_outlet: number
          company_id: string
          cost_per_audio_hour: number
          cost_per_outlet: number
          cost_per_query: number
          created_at: string
          created_by: string | null
          currency: string
          id: string
          included_query_packs: number
          name: string
          notes: string | null
          outlets: number
          platform_fee: number
          price_per_audio_hour: number
          price_per_camera: number
          price_per_outlet: number
          price_per_query_pack: number
          queries_per_pack: number
          target_margin_pct: number
          updated_at: string
        }
        Insert: {
          audio_hours_per_outlet?: number
          cameras_per_outlet?: number
          company_id: string
          cost_per_audio_hour?: number
          cost_per_outlet?: number
          cost_per_query?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          included_query_packs?: number
          name: string
          notes?: string | null
          outlets?: number
          platform_fee?: number
          price_per_audio_hour?: number
          price_per_camera?: number
          price_per_outlet?: number
          price_per_query_pack?: number
          queries_per_pack?: number
          target_margin_pct?: number
          updated_at?: string
        }
        Update: {
          audio_hours_per_outlet?: number
          cameras_per_outlet?: number
          company_id?: string
          cost_per_audio_hour?: number
          cost_per_outlet?: number
          cost_per_query?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          included_query_packs?: number
          name?: string
          notes?: string | null
          outlets?: number
          platform_fee?: number
          price_per_audio_hour?: number
          price_per_camera?: number
          price_per_outlet?: number
          price_per_query_pack?: number
          queries_per_pack?: number
          target_margin_pct?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_scenarios_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
          delivery: Json
          description: string | null
          formats: string[]
          formatting: Json
          id: string
          language: string
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
          delivery?: Json
          description?: string | null
          formats?: string[]
          formatting?: Json
          id?: string
          language?: string
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
          delivery?: Json
          description?: string | null
          formats?: string[]
          formatting?: Json
          id?: string
          language?: string
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
          delivery: Json
          description: string | null
          formats: string[]
          formatting: Json
          id: string
          is_default: boolean
          language: string
          name: string
          sections: string[]
          updated_at: string
          version: number
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          delivery?: Json
          description?: string | null
          formats?: string[]
          formatting?: Json
          id?: string
          is_default?: boolean
          language?: string
          name: string
          sections?: string[]
          updated_at?: string
          version?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          delivery?: Json
          description?: string | null
          formats?: string[]
          formatting?: Json
          id?: string
          is_default?: boolean
          language?: string
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
      storage_pools: {
        Row: {
          archive_enabled: boolean
          archive_target: string | null
          capacity_gb: number
          company_id: string
          created_at: string
          id: string
          kind: string
          name: string
          retention_days: number
          tier: string
          updated_at: string
          used_gb: number
        }
        Insert: {
          archive_enabled?: boolean
          archive_target?: string | null
          capacity_gb?: number
          company_id: string
          created_at?: string
          id?: string
          kind?: string
          name: string
          retention_days?: number
          tier?: string
          updated_at?: string
          used_gb?: number
        }
        Update: {
          archive_enabled?: boolean
          archive_target?: string | null
          capacity_gb?: number
          company_id?: string
          created_at?: string
          id?: string
          kind?: string
          name?: string
          retention_days?: number
          tier?: string
          updated_at?: string
          used_gb?: number
        }
        Relationships: []
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
      usage_counters: {
        Row: {
          ai_tokens: number
          audio_minutes: number
          company_id: string
          copilot_queries: number
          created_at: string
          egress_gb: number
          id: string
          outlet_id: string | null
          period_month: string
          storage_gb: number
          updated_at: string
        }
        Insert: {
          ai_tokens?: number
          audio_minutes?: number
          company_id: string
          copilot_queries?: number
          created_at?: string
          egress_gb?: number
          id?: string
          outlet_id?: string | null
          period_month: string
          storage_gb?: number
          updated_at?: string
        }
        Update: {
          ai_tokens?: number
          audio_minutes?: number
          company_id?: string
          copilot_queries?: number
          created_at?: string
          egress_gb?: number
          id?: string
          outlet_id?: string | null
          period_month?: string
          storage_gb?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_counters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_counters_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_plans: {
        Row: {
          company_id: string
          created_at: string
          currency: string
          hard_budget_stop: boolean
          id: string
          included_audio_minutes: number
          included_egress_gb: number
          included_queries: number
          included_storage_gb: number
          monthly_budget: number
          overage_audio_minute_price: number
          overage_egress_gb_price: number
          overage_query_price: number
          overage_storage_gb_price: number
          plan_name: string
          throttle_mode: string
          throttle_threshold_pct: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          currency?: string
          hard_budget_stop?: boolean
          id?: string
          included_audio_minutes?: number
          included_egress_gb?: number
          included_queries?: number
          included_storage_gb?: number
          monthly_budget?: number
          overage_audio_minute_price?: number
          overage_egress_gb_price?: number
          overage_query_price?: number
          overage_storage_gb_price?: number
          plan_name?: string
          throttle_mode?: string
          throttle_threshold_pct?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          currency?: string
          hard_budget_stop?: boolean
          id?: string
          included_audio_minutes?: number
          included_egress_gb?: number
          included_queries?: number
          included_storage_gb?: number
          monthly_budget?: number
          overage_audio_minute_price?: number
          overage_egress_gb_price?: number
          overage_query_price?: number
          overage_storage_gb_price?: number
          plan_name?: string
          throttle_mode?: string
          throttle_threshold_pct?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
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
      can_triage_alert: { Args: { _outlet_id: string }; Returns: boolean }
      can_view_widget: { Args: { _widget_id: string }; Returns: boolean }
      check_copilot_quota: { Args: { _outlet_id?: string }; Returns: Json }
      current_company_id: { Args: never; Returns: string }
      escalate_overdue_alerts: { Args: never; Returns: number }
      evaluate_infra_health: { Args: never; Returns: number }
      executive_overview: { Args: { p_filters?: Json }; Returns: Json }
      expire_widget_access_requests: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      infra_can: { Args: { _action: string }; Returns: boolean }
      is_company_admin: { Args: never; Returns: boolean }
      preset_by_share_token: { Args: { _token: string }; Returns: Json }
      record_usage: {
        Args: { _metric: string; _outlet_id?: string; _quantity?: number }
        Returns: undefined
      }
      request_credential_rotation: {
        Args: { _id: string; _note?: string }
        Returns: undefined
      }
      reveal_api_credential: { Args: { _id: string }; Returns: Json }
      reveal_device_credential: { Args: { _id: string }; Returns: Json }
      save_api_credential: {
        Args: {
          _expires_at?: string
          _label: string
          _provider: string
          _secret: string
        }
        Returns: string
      }
      save_device_credential:
        | {
            Args: {
              _device_id: string
              _device_type: string
              _notes?: string
              _onvif_secret?: string
              _onvif_username?: string
              _rtsp_url?: string
              _secret: string
              _username: string
            }
            Returns: string
          }
        | {
            Args: {
              _device_id: string
              _device_type: string
              _notes?: string
              _onvif_secret?: string
              _onvif_username?: string
              _rotation_interval_days?: number
              _rtsp_url?: string
              _secret: string
              _username: string
            }
            Returns: string
          }
      tenant_branding: {
        Args: never
        Returns: {
          brand_primary_color: string
          brand_tagline: string
          logo_url: string
          name: string
        }[]
      }
      usage_overview: { Args: { _month?: string }; Returns: Json }
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
