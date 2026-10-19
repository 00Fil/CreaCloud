/* Tipi generati dallo schema Supabase: npx supabase gen types typescript --local --schema public */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      ai_events: {
        Row: {
          chat_id: string | null;
          confidence: number | null;
          cost_micro_usd: number;
          created_at: string;
          id: string;
          input_tokens: number;
          intent: string | null;
          message_id: string | null;
          model: string;
          output: Json | null;
          output_tokens: number;
          tier: number;
        };
        ComputedFields: never;
        Insert: {
          chat_id?: string | null;
          confidence?: number | null;
          cost_micro_usd?: number;
          created_at?: string;
          id?: string;
          input_tokens?: number;
          intent?: string | null;
          message_id?: string | null;
          model: string;
          output?: Json | null;
          output_tokens?: number;
          tier: number;
        };
        Update: {
          chat_id?: string | null;
          confidence?: number | null;
          cost_micro_usd?: number;
          created_at?: string;
          id?: string;
          input_tokens?: number;
          intent?: string | null;
          message_id?: string | null;
          model?: string;
          output?: Json | null;
          output_tokens?: number;
          tier?: number;
        };
        Relationships: [
          {
            foreignKeyName: "ai_events_chat_id_fkey";
            columns: ["chat_id"];
            isOneToOne: false;
            referencedRelation: "chats";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_events_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          actor: string;
          created_at: string;
          details: NonNullable<Json>;
          entity: string;
          entity_id: string | null;
          id: number;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor: string;
          created_at?: string;
          details?: NonNullable<Json>;
          entity: string;
          entity_id?: string | null;
          id?: never;
        };
        Update: {
          action?: string;
          actor?: string;
          created_at?: string;
          details?: NonNullable<Json>;
          entity?: string;
          entity_id?: string | null;
          id?: never;
        };
        Relationships: [];
      };
      center_closures: {
        Row: {
          date: string;
          note: string;
        };
        ComputedFields: never;
        Insert: {
          date: string;
          note?: string;
        };
        Update: {
          date?: string;
          note?: string;
        };
        Relationships: [];
      };
      center_hours: {
        Row: {
          end_min: number;
          id: string;
          start_min: number;
          weekday: number;
        };
        ComputedFields: never;
        Insert: {
          end_min: number;
          id?: string;
          start_min: number;
          weekday: number;
        };
        Update: {
          end_min?: number;
          id?: string;
          start_min?: number;
          weekday?: number;
        };
        Relationships: [];
      };
      chats: {
        Row: {
          archived_at: string | null;
          avatar_checked_at: string | null;
          avatar_path: string | null;
          created_at: string;
          display_name: string;
          id: string;
          last_inbound_at: string | null;
          last_message_at: string | null;
          last_message_preview: string;
          mode: string;
          needs_attention: boolean;
          parent_id: string | null;
          phone: string;
          pinned_at: string | null;
          state: NonNullable<Json>;
          student_id: string | null;
          takeover_until: string | null;
          tutor_id: string | null;
          typing_at: string | null;
          typing_state: string | null;
          unread_count: number;
          wa_jid: string | null;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          avatar_checked_at?: string | null;
          avatar_path?: string | null;
          created_at?: string;
          display_name?: string;
          id?: string;
          last_inbound_at?: string | null;
          last_message_at?: string | null;
          last_message_preview?: string;
          mode?: string;
          needs_attention?: boolean;
          parent_id?: string | null;
          phone: string;
          pinned_at?: string | null;
          state?: NonNullable<Json>;
          student_id?: string | null;
          takeover_until?: string | null;
          tutor_id?: string | null;
          typing_at?: string | null;
          typing_state?: string | null;
          unread_count?: number;
          wa_jid?: string | null;
        };
        Update: {
          archived_at?: string | null;
          avatar_checked_at?: string | null;
          avatar_path?: string | null;
          created_at?: string;
          display_name?: string;
          id?: string;
          last_inbound_at?: string | null;
          last_message_at?: string | null;
          last_message_preview?: string;
          mode?: string;
          needs_attention?: boolean;
          parent_id?: string | null;
          phone?: string;
          pinned_at?: string | null;
          state?: NonNullable<Json>;
          student_id?: string | null;
          takeover_until?: string | null;
          tutor_id?: string | null;
          typing_at?: string | null;
          typing_state?: string | null;
          unread_count?: number;
          wa_jid?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "chats_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "parents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chats_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chats_tutor_id_fkey";
            columns: ["tutor_id"];
            isOneToOne: false;
            referencedRelation: "tutors";
            referencedColumns: ["id"];
          },
        ];
      };
      families: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          minors_contact_consent: boolean;
          name: string;
          notes: string;
          privacy_consent_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          minors_contact_consent?: boolean;
          name: string;
          notes?: string;
          privacy_consent_at?: string | null;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          minors_contact_consent?: boolean;
          name?: string;
          notes?: string;
          privacy_consent_at?: string | null;
        };
        Relationships: [];
      };
      family_payments: {
        Row: {
          amount_cents: number;
          created_at: string;
          family_id: string;
          id: string;
          note: string;
          paid_on: string;
          period_month: string | null;
          recorded_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          amount_cents: number;
          created_at?: string;
          family_id: string;
          id?: string;
          note?: string;
          paid_on?: string;
          period_month?: string | null;
          recorded_by?: string | null;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          family_id?: string;
          id?: string;
          note?: string;
          paid_on?: string;
          period_month?: string | null;
          recorded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "family_payments_family_id_fkey";
            columns: ["family_id"];
            isOneToOne: false;
            referencedRelation: "families";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "family_payments_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
        ];
      };
      lesson_request_students: {
        Row: {
          request_id: string;
          student_id: string;
        };
        ComputedFields: never;
        Insert: {
          request_id: string;
          student_id: string;
        };
        Update: {
          request_id?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lesson_request_students_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "lesson_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lesson_request_students_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      lesson_requests: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          created_at: string;
          duration_min: number;
          flexible_duration: boolean;
          id: string;
          kind: string;
          mode: string;
          notes: string;
          preferred_tutor_id: string | null;
          priority: number;
          sessions_per_week: number;
          source: string;
          status: string;
          subject_id: string;
          topic: string | null;
          valid_from: string;
          valid_to: string | null;
          window_from: string | null;
          window_to: string | null;
        };
        ComputedFields: never;
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          duration_min?: number;
          flexible_duration?: boolean;
          id?: string;
          kind?: string;
          mode?: string;
          notes?: string;
          preferred_tutor_id?: string | null;
          priority?: number;
          sessions_per_week?: number;
          source?: string;
          status?: string;
          subject_id: string;
          topic?: string | null;
          valid_from?: string;
          valid_to?: string | null;
          window_from?: string | null;
          window_to?: string | null;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          duration_min?: number;
          flexible_duration?: boolean;
          id?: string;
          kind?: string;
          mode?: string;
          notes?: string;
          preferred_tutor_id?: string | null;
          priority?: number;
          sessions_per_week?: number;
          source?: string;
          status?: string;
          subject_id?: string;
          topic?: string | null;
          valid_from?: string;
          valid_to?: string | null;
          window_from?: string | null;
          window_to?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "lesson_requests_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lesson_requests_preferred_tutor_id_fkey";
            columns: ["preferred_tutor_id"];
            isOneToOne: false;
            referencedRelation: "tutors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lesson_requests_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
        ];
      };
      lesson_students: {
        Row: {
          lesson_id: string;
          student_id: string;
        };
        ComputedFields: never;
        Insert: {
          lesson_id: string;
          student_id: string;
        };
        Update: {
          lesson_id?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lesson_students_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lesson_students_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      lessons: {
        Row: {
          cancellation_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          created_at: string;
          date: string;
          duration_changed: boolean;
          end_min: number;
          id: string;
          locked: boolean;
          mode: string;
          relocated: boolean;
          request_id: string | null;
          room_id: string | null;
          run_id: string | null;
          session_index: number;
          start_min: number;
          status: string;
          subject_id: string;
          tutor_id: string;
          violations: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          created_at?: string;
          date: string;
          duration_changed?: boolean;
          end_min: number;
          id?: string;
          locked?: boolean;
          mode: string;
          relocated?: boolean;
          request_id?: string | null;
          room_id?: string | null;
          run_id?: string | null;
          session_index?: number;
          start_min: number;
          status?: string;
          subject_id: string;
          tutor_id: string;
          violations?: NonNullable<Json>;
        };
        Update: {
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          created_at?: string;
          date?: string;
          duration_changed?: boolean;
          end_min?: number;
          id?: string;
          locked?: boolean;
          mode?: string;
          relocated?: boolean;
          request_id?: string | null;
          room_id?: string | null;
          run_id?: string | null;
          session_index?: number;
          start_min?: number;
          status?: string;
          subject_id?: string;
          tutor_id?: string;
          violations?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: "lessons_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "lesson_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lessons_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lessons_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "planning_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lessons_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lessons_tutor_id_fkey";
            columns: ["tutor_id"];
            isOneToOne: false;
            referencedRelation: "tutors";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          author: string;
          body: string;
          chat_id: string;
          contact: Json | null;
          created_at: string;
          deleted_at: string | null;
          direction: string;
          edited_at: string | null;
          error: string | null;
          id: string;
          kind: string;
          location: Json | null;
          media_duration: number | null;
          media_height: number | null;
          media_mime: string | null;
          media_name: string | null;
          media_path: string | null;
          media_ref: string | null;
          media_size: number | null;
          media_status: string | null;
          media_type: string | null;
          media_waveform: number[] | null;
          media_width: number | null;
          provider: string;
          provider_message_id: string | null;
          quoted_message_id: string | null;
          quoted_provider_id: string | null;
          reactions: NonNullable<Json>;
          sent_by: string | null;
          status: string;
          transcript: string | null;
        };
        ComputedFields: never;
        Insert: {
          author: string;
          body?: string;
          chat_id: string;
          contact?: Json | null;
          created_at?: string;
          deleted_at?: string | null;
          direction: string;
          edited_at?: string | null;
          error?: string | null;
          id?: string;
          kind?: string;
          location?: Json | null;
          media_duration?: number | null;
          media_height?: number | null;
          media_mime?: string | null;
          media_name?: string | null;
          media_path?: string | null;
          media_ref?: string | null;
          media_size?: number | null;
          media_status?: string | null;
          media_type?: string | null;
          media_waveform?: number[] | null;
          media_width?: number | null;
          provider: string;
          provider_message_id?: string | null;
          quoted_message_id?: string | null;
          quoted_provider_id?: string | null;
          reactions?: NonNullable<Json>;
          sent_by?: string | null;
          status?: string;
          transcript?: string | null;
        };
        Update: {
          author?: string;
          body?: string;
          chat_id?: string;
          contact?: Json | null;
          created_at?: string;
          deleted_at?: string | null;
          direction?: string;
          edited_at?: string | null;
          error?: string | null;
          id?: string;
          kind?: string;
          location?: Json | null;
          media_duration?: number | null;
          media_height?: number | null;
          media_mime?: string | null;
          media_name?: string | null;
          media_path?: string | null;
          media_ref?: string | null;
          media_size?: number | null;
          media_status?: string | null;
          media_type?: string | null;
          media_waveform?: number[] | null;
          media_width?: number | null;
          provider?: string;
          provider_message_id?: string | null;
          quoted_message_id?: string | null;
          quoted_provider_id?: string | null;
          reactions?: NonNullable<Json>;
          sent_by?: string | null;
          status?: string;
          transcript?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey";
            columns: ["chat_id"];
            isOneToOne: false;
            referencedRelation: "chats";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_quoted_message_id_fkey";
            columns: ["quoted_message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sent_by_fkey";
            columns: ["sent_by"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
        ];
      };
      parents: {
        Row: {
          created_at: string;
          email: string | null;
          family_id: string;
          first_name: string;
          id: string;
          is_primary: boolean;
          last_name: string;
          phone: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email?: string | null;
          family_id: string;
          first_name: string;
          id?: string;
          is_primary?: boolean;
          last_name?: string;
          phone?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          family_id?: string;
          first_name?: string;
          id?: string;
          is_primary?: boolean;
          last_name?: string;
          phone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "parents_family_id_fkey";
            columns: ["family_id"];
            isOneToOne: false;
            referencedRelation: "families";
            referencedColumns: ["id"];
          },
        ];
      };
      pending_actions: {
        Row: {
          chat_id: string | null;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          id: string;
          kind: string;
          payload: NonNullable<Json>;
          reason: string;
          source_message_id: string | null;
          status: string;
          summary: string;
        };
        ComputedFields: never;
        Insert: {
          chat_id?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          id?: string;
          kind: string;
          payload: NonNullable<Json>;
          reason?: string;
          source_message_id?: string | null;
          status?: string;
          summary: string;
        };
        Update: {
          chat_id?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          id?: string;
          kind?: string;
          payload?: NonNullable<Json>;
          reason?: string;
          source_message_id?: string | null;
          status?: string;
          summary?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pending_actions_chat_id_fkey";
            columns: ["chat_id"];
            isOneToOne: false;
            referencedRelation: "chats";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pending_actions_decided_by_fkey";
            columns: ["decided_by"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pending_actions_source_message_id_fkey";
            columns: ["source_message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
        ];
      };
      planning_runs: {
        Row: {
          confirmed_at: string | null;
          created_at: string;
          created_by: string | null;
          error: string | null;
          id: string;
          month: string;
          problem: Json | null;
          solution: Json | null;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          confirmed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          error?: string | null;
          id?: string;
          month: string;
          problem?: Json | null;
          solution?: Json | null;
          status?: string;
        };
        Update: {
          confirmed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          error?: string | null;
          id?: string;
          month?: string;
          problem?: Json | null;
          solution?: Json | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "planning_runs_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
        ];
      };
      rooms: {
        Row: {
          active: boolean;
          capacity: number;
          id: string;
          name: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          capacity?: number;
          id?: string;
          name: string;
        };
        Update: {
          active?: boolean;
          capacity?: number;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          key: string;
          updated_at: string;
          value: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          key: string;
          updated_at?: string;
          value: NonNullable<Json>;
        };
        Update: {
          key?: string;
          updated_at?: string;
          value?: NonNullable<Json>;
        };
        Relationships: [];
      };
      staff: {
        Row: {
          created_at: string;
          full_name: string;
          id: string;
          role: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          full_name: string;
          id: string;
          role?: string;
        };
        Update: {
          created_at?: string;
          full_name?: string;
          id?: string;
          role?: string;
        };
        Relationships: [];
      };
      student_constraints: {
        Row: {
          category: string;
          created_at: string;
          date: string | null;
          end_min: number;
          id: string;
          label: string;
          priority: number;
          priority_confirmed: boolean;
          source: string;
          start_min: number;
          student_id: string;
          valid_from: string | null;
          valid_to: string | null;
          weekday: number | null;
        };
        ComputedFields: never;
        Insert: {
          category?: string;
          created_at?: string;
          date?: string | null;
          end_min?: number;
          id?: string;
          label: string;
          priority: number;
          priority_confirmed?: boolean;
          source?: string;
          start_min?: number;
          student_id: string;
          valid_from?: string | null;
          valid_to?: string | null;
          weekday?: number | null;
        };
        Update: {
          category?: string;
          created_at?: string;
          date?: string | null;
          end_min?: number;
          id?: string;
          label?: string;
          priority?: number;
          priority_confirmed?: boolean;
          source?: string;
          start_min?: number;
          student_id?: string;
          valid_from?: string | null;
          valid_to?: string | null;
          weekday?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "student_constraints_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      students: {
        Row: {
          active: boolean;
          created_at: string;
          family_id: string;
          first_name: string;
          group_hourly_rate_cents: number | null;
          hourly_rate_cents: number | null;
          id: string;
          last_name: string;
          max_lessons_per_day: number | null;
          notes: string;
          phone: string | null;
          school_level: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          created_at?: string;
          family_id: string;
          first_name: string;
          group_hourly_rate_cents?: number | null;
          hourly_rate_cents?: number | null;
          id?: string;
          last_name?: string;
          max_lessons_per_day?: number | null;
          notes?: string;
          phone?: string | null;
          school_level?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          family_id?: string;
          first_name?: string;
          group_hourly_rate_cents?: number | null;
          hourly_rate_cents?: number | null;
          id?: string;
          last_name?: string;
          max_lessons_per_day?: number | null;
          notes?: string;
          phone?: string | null;
          school_level?: string;
        };
        Relationships: [
          {
            foreignKeyName: "students_family_id_fkey";
            columns: ["family_id"];
            isOneToOne: false;
            referencedRelation: "families";
            referencedColumns: ["id"];
          },
        ];
      };
      subjects: {
        Row: {
          created_at: string;
          id: string;
          name: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      tutor_absences: {
        Row: {
          created_at: string;
          date: string;
          end_min: number;
          id: string;
          note: string;
          source: string;
          start_min: number;
          tutor_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          date: string;
          end_min?: number;
          id?: string;
          note?: string;
          source?: string;
          start_min?: number;
          tutor_id: string;
        };
        Update: {
          created_at?: string;
          date?: string;
          end_min?: number;
          id?: string;
          note?: string;
          source?: string;
          start_min?: number;
          tutor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tutor_absences_tutor_id_fkey";
            columns: ["tutor_id"];
            isOneToOne: false;
            referencedRelation: "tutors";
            referencedColumns: ["id"];
          },
        ];
      };
      tutor_availability: {
        Row: {
          created_at: string;
          end_min: number;
          id: string;
          source: string;
          start_min: number;
          tutor_id: string;
          weekday: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          end_min: number;
          id?: string;
          source?: string;
          start_min: number;
          tutor_id: string;
          weekday: number;
        };
        Update: {
          created_at?: string;
          end_min?: number;
          id?: string;
          source?: string;
          start_min?: number;
          tutor_id?: string;
          weekday?: number;
        };
        Relationships: [
          {
            foreignKeyName: "tutor_availability_tutor_id_fkey";
            columns: ["tutor_id"];
            isOneToOne: false;
            referencedRelation: "tutors";
            referencedColumns: ["id"];
          },
        ];
      };
      tutor_payouts: {
        Row: {
          amount_cents: number;
          created_at: string;
          id: string;
          note: string;
          paid_on: string;
          period_month: string | null;
          recorded_by: string | null;
          tutor_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount_cents: number;
          created_at?: string;
          id?: string;
          note?: string;
          paid_on?: string;
          period_month?: string | null;
          recorded_by?: string | null;
          tutor_id: string;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          id?: string;
          note?: string;
          paid_on?: string;
          period_month?: string | null;
          recorded_by?: string | null;
          tutor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tutor_payouts_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tutor_payouts_tutor_id_fkey";
            columns: ["tutor_id"];
            isOneToOne: false;
            referencedRelation: "tutors";
            referencedColumns: ["id"];
          },
        ];
      };
      tutor_subjects: {
        Row: {
          levels: string[];
          subject_id: string;
          tutor_id: string;
        };
        ComputedFields: never;
        Insert: {
          levels?: string[];
          subject_id: string;
          tutor_id: string;
        };
        Update: {
          levels?: string[];
          subject_id?: string;
          tutor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tutor_subjects_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tutor_subjects_tutor_id_fkey";
            columns: ["tutor_id"];
            isOneToOne: false;
            referencedRelation: "tutors";
            referencedColumns: ["id"];
          },
        ];
      };
      tutors: {
        Row: {
          active: boolean;
          created_at: string;
          email: string | null;
          first_name: string;
          group_hourly_rate_cents: number | null;
          hourly_rate_cents: number;
          id: string;
          last_name: string;
          max_daily_minutes: number | null;
          max_weekly_minutes: number | null;
          modes: string[];
          phone: string | null;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          created_at?: string;
          email?: string | null;
          first_name: string;
          group_hourly_rate_cents?: number | null;
          hourly_rate_cents?: number;
          id?: string;
          last_name?: string;
          max_daily_minutes?: number | null;
          max_weekly_minutes?: number | null;
          modes?: string[];
          phone?: string | null;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          email?: string | null;
          first_name?: string;
          group_hourly_rate_cents?: number | null;
          hourly_rate_cents?: number;
          id?: string;
          last_name?: string;
          max_daily_minutes?: number | null;
          max_weekly_minutes?: number | null;
          modes?: string[];
          phone?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_staff: { Args: Record<PropertyKey, never>; Returns: boolean };
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

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
