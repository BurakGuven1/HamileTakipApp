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
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          forum_nickname: string | null;
          family_referral_code: string;
          theme_preference: "auto" | "sage" | "rose" | "blue" | "pink" | "lavender" | "dark";
          mother_name: string;
          father_name: string;
          avatar_url: string | null;
          is_pregnant: boolean;
          due_date: string | null;
          onboarding_completed: boolean;
          onboarding_step: string;
          notify_forum_comments: boolean;
          notify_forum_likes: boolean;
          notify_vaccine_reminders: boolean;
          notify_weekly_pregnancy_updates: boolean;
          notify_sleep_predictions: boolean;
          notify_medicine_safety: boolean;
          notify_development_periods: boolean;
          notify_milk_inventory: boolean;
          notify_daily_support: boolean;
          feeding_mode: "breastfeeding" | "pumping" | "mixed" | "formula";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          forum_nickname?: string | null;
          family_referral_code?: string;
          theme_preference?: "auto" | "sage" | "rose" | "blue" | "pink" | "lavender" | "dark";
          mother_name?: string;
          father_name?: string;
          avatar_url?: string | null;
          is_pregnant?: boolean;
          due_date?: string | null;
          onboarding_completed?: boolean;
          onboarding_step?: string;
          notify_forum_comments?: boolean;
          notify_forum_likes?: boolean;
          notify_vaccine_reminders?: boolean;
          notify_weekly_pregnancy_updates?: boolean;
          notify_sleep_predictions?: boolean;
          notify_medicine_safety?: boolean;
          notify_development_periods?: boolean;
          notify_milk_inventory?: boolean;
          notify_daily_support?: boolean;
          feeding_mode?: "breastfeeding" | "pumping" | "mixed" | "formula";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string | null;
          forum_nickname?: string | null;
          family_referral_code?: string;
          theme_preference?: "auto" | "sage" | "rose" | "blue" | "pink" | "lavender" | "dark";
          mother_name?: string;
          father_name?: string;
          avatar_url?: string | null;
          is_pregnant?: boolean;
          due_date?: string | null;
          onboarding_completed?: boolean;
          onboarding_step?: string;
          notify_forum_comments?: boolean;
          notify_forum_likes?: boolean;
          notify_vaccine_reminders?: boolean;
          notify_weekly_pregnancy_updates?: boolean;
          notify_sleep_predictions?: boolean;
          notify_medicine_safety?: boolean;
          notify_development_periods?: boolean;
          notify_milk_inventory?: boolean;
          notify_daily_support?: boolean;
          feeding_mode?: "breastfeeding" | "pumping" | "mixed" | "formula";
          updated_at?: string;
        };
        Relationships: [];
      };
      user_age_assurance: {
        Row: {
          user_id: string;
          birth_date: string | null;
          is_over_18_confirmed: boolean;
          assurance_version: string;
          last_context: "sign_up" | "sign_in" | "family_code";
          first_assured_at: string;
          last_assured_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          birth_date?: string | null;
          is_over_18_confirmed?: boolean;
          assurance_version: string;
          last_context: "sign_up" | "sign_in" | "family_code";
          first_assured_at?: string;
          last_assured_at?: string;
          updated_at?: string;
        };
        Update: {
          birth_date?: string | null;
          is_over_18_confirmed?: boolean;
          assurance_version?: string;
          last_context?: "sign_up" | "sign_in" | "family_code";
          last_assured_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      family_members: {
        Row: {
          id: string;
          owner_id: string;
          member_id: string;
          role: "father" | "caregiver";
          display_name: string;
          access_scope: "full_family" | "baby_care_only";
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          member_id: string;
          role?: "father" | "caregiver";
          display_name?: string;
          access_scope?: "full_family" | "baby_care_only";
          created_at?: string;
        };
        Update: {
          owner_id?: string;
          member_id?: string;
          role?: "father" | "caregiver";
          display_name?: string;
          access_scope?: "full_family" | "baby_care_only";
        };
        Relationships: [
          {
            foreignKeyName: "family_members_owner_id_fkey";
            columns: ["owner_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "family_members_member_id_fkey";
            columns: ["member_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      family_code_login_attempts: {
        Row: {
          key_hash: string;
          window_started_at: string;
          attempt_count: number;
          blocked_until: string | null;
          updated_at: string;
        };
        Insert: {
          key_hash: string;
          window_started_at?: string;
          attempt_count?: number;
          blocked_until?: string | null;
          updated_at?: string;
        };
        Update: {
          window_started_at?: string;
          attempt_count?: number;
          blocked_until?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      family_feature_credit_ledger: {
        Row: {
          id: string;
          owner_id: string;
          actor_id: string;
          feature_key: string;
          life_stage: "pregnancy" | "postpartum";
          operation_id: string;
          state: "reserved" | "committed" | "released";
          reserved_at: string;
          committed_at: string | null;
          released_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          actor_id: string;
          feature_key: string;
          life_stage: "pregnancy" | "postpartum";
          operation_id: string;
          state?: "reserved" | "committed" | "released";
          reserved_at?: string;
          committed_at?: string | null;
          released_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          actor_id?: string;
          feature_key?: string;
          life_stage?: "pregnancy" | "postpartum";
          state?: "reserved" | "committed" | "released";
          reserved_at?: string;
          committed_at?: string | null;
          released_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      family_premium_trials: {
        Row: {
          owner_id: string;
          activated_by: string | null;
          starts_at: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          owner_id: string;
          activated_by?: string | null;
          starts_at: string;
          expires_at: string;
          created_at?: string;
        };
        Update: {
          activated_by?: string | null;
          starts_at?: string;
          expires_at?: string;
        };
        Relationships: [];
      };
      pregnancy_weight_records: {
        Row: {
          id: string;
          profile_id: string;
          record_date: string;
          weight_kg: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          record_date?: string;
          weight_kg: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          profile_id?: string;
          record_date?: string;
          weight_kg?: number;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pregnancy_weight_records_profile_id_fkey";
            columns: ["profile_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      pregnancy_daily_counters: {
        Row: {
          id: string;
          profile_id: string;
          counter_date: string;
          kick_count: number;
          contraction_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          counter_date?: string;
          kick_count?: number;
          contraction_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          profile_id?: string;
          counter_date?: string;
          kick_count?: number;
          contraction_count?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pregnancy_daily_counters_profile_id_fkey";
            columns: ["profile_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      birth_preparation_items: {
        Row: {
          id: string;
          profile_id: string;
          kind: "bag" | "plan";
          category: string;
          template_key: string | null;
          title: string;
          description: string | null;
          is_custom: boolean;
          is_completed: boolean;
          completed_by: string | null;
          completed_by_name: string | null;
          completed_at: string | null;
          created_by: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          kind: "bag" | "plan";
          category: string;
          template_key?: string | null;
          title: string;
          description?: string | null;
          is_custom?: boolean;
          is_completed?: boolean;
          completed_by?: string | null;
          completed_by_name?: string | null;
          completed_at?: string | null;
          created_by: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          kind?: "bag" | "plan";
          category?: string;
          title?: string;
          description?: string | null;
          is_completed?: boolean;
          completed_by?: string | null;
          completed_by_name?: string | null;
          completed_at?: string | null;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      articles: {
        Row: {
          id: string;
          slug: string;
          title: string;
          period: string;
          category: "hafta" | "ay" | "bebek" | "ipuclari";
          excerpt: string;
          body: string;
          image_path: string | null;
          accent: string;
          sort_order: number;
          timeline_start_week: number | null;
          timeline_end_week: number | null;
          is_published: boolean;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          period: string;
          category: "hafta" | "ay" | "bebek" | "ipuclari";
          excerpt: string;
          body: string;
          image_path?: string | null;
          accent?: string;
          sort_order?: number;
          timeline_start_week?: number | null;
          timeline_end_week?: number | null;
          is_published?: boolean;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          slug?: string;
          title?: string;
          period?: string;
          category?: "hafta" | "ay" | "bebek" | "ipuclari";
          excerpt?: string;
          body?: string;
          image_path?: string | null;
          accent?: string;
          sort_order?: number;
          timeline_start_week?: number | null;
          timeline_end_week?: number | null;
          is_published?: boolean;
          published_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      babies: {
        Row: {
          id: string;
          parent_id: string;
          name: string;
          birth_date: string;
          gender: "kiz" | "erkek" | "belirtilmemis" | null;
          photo_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          parent_id: string;
          name: string;
          birth_date: string;
          gender?: "kiz" | "erkek" | "belirtilmemis" | null;
          photo_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          parent_id?: string;
          name?: string;
          birth_date?: string;
          gender?: "kiz" | "erkek" | "belirtilmemis" | null;
          photo_url?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "baby_vaccinations_baby_id_fkey";
            columns: ["baby_id"];
            isOneToOne: false;
            referencedRelation: "babies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "baby_vaccinations_vaccine_schedule_id_fkey";
            columns: ["vaccine_schedule_id"];
            isOneToOne: false;
            referencedRelation: "vaccine_schedule";
            referencedColumns: ["id"];
          }
        ];
      };
      care_journal_entries: {
        Row: {
          id: string;
          baby_id: string;
          created_by: string;
          caregiver_name: string | null;
          entry_type: "breastfeeding" | "bottle" | "sleep" | "diaper" | "pumping" | "medicine" | "solid_food" | "temperature";
          occurred_at: string;
          ended_at: string | null;
          amount_ml: number | null;
          feeding_content: "breast_milk" | "formula" | "water" | null;
          breast_side: "left" | "right" | "both" | null;
          diaper_type: "wet" | "dirty" | "both" | null;
          medicine_name: string | null;
          medicine_dose: string | null;
          food_name: string | null;
          food_amount: string | null;
          is_first_try: boolean;
          sleep_kind: "day" | "night" | null;
          notes: string | null;
          client_operation_id: string;
          created_device_id: string | null;
          created_device_label: string | null;
          updated_by: string | null;
          updated_by_name: string | null;
          updated_device_id: string | null;
          updated_device_label: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          deleted_by_name: string | null;
          deleted_device_id: string | null;
          deleted_device_label: string | null;
          version: number;
          temperature_c: number | null;
          temperature_site: "armpit" | "forehead" | "ear" | "oral" | "rectal" | "other" | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          baby_id: string;
          created_by?: string;
          caregiver_name?: string | null;
          entry_type: "breastfeeding" | "bottle" | "sleep" | "diaper" | "pumping" | "medicine" | "solid_food" | "temperature";
          occurred_at?: string;
          ended_at?: string | null;
          amount_ml?: number | null;
          feeding_content?: "breast_milk" | "formula" | "water" | null;
          breast_side?: "left" | "right" | "both" | null;
          diaper_type?: "wet" | "dirty" | "both" | null;
          medicine_name?: string | null;
          medicine_dose?: string | null;
          food_name?: string | null;
          food_amount?: string | null;
          is_first_try?: boolean;
          sleep_kind?: "day" | "night" | null;
          notes?: string | null;
          client_operation_id?: string;
          created_device_id?: string | null;
          created_device_label?: string | null;
          updated_by?: string | null;
          updated_by_name?: string | null;
          updated_device_id?: string | null;
          updated_device_label?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deleted_by_name?: string | null;
          deleted_device_id?: string | null;
          deleted_device_label?: string | null;
          version?: number;
          temperature_c?: number | null;
          temperature_site?: "armpit" | "forehead" | "ear" | "oral" | "rectal" | "other" | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          entry_type?: "breastfeeding" | "bottle" | "sleep" | "diaper" | "pumping" | "medicine" | "solid_food" | "temperature";
          caregiver_name?: string | null;
          occurred_at?: string;
          ended_at?: string | null;
          amount_ml?: number | null;
          feeding_content?: "breast_milk" | "formula" | "water" | null;
          breast_side?: "left" | "right" | "both" | null;
          diaper_type?: "wet" | "dirty" | "both" | null;
          medicine_name?: string | null;
          medicine_dose?: string | null;
          food_name?: string | null;
          food_amount?: string | null;
          is_first_try?: boolean;
          sleep_kind?: "day" | "night" | null;
          notes?: string | null;
          updated_by?: string | null;
          updated_by_name?: string | null;
          updated_device_id?: string | null;
          updated_device_label?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deleted_by_name?: string | null;
          deleted_device_id?: string | null;
          deleted_device_label?: string | null;
          version?: number;
          temperature_c?: number | null;
          temperature_site?: "armpit" | "forehead" | "ear" | "oral" | "rectal" | "other" | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      care_journal_entry_events: {
        Row: {
          id: number;
          entry_id: string;
          baby_id: string;
          operation_id: string | null;
          action: "created" | "updated" | "deleted" | "restored";
          actor_id: string | null;
          actor_name: string | null;
          device_id: string | null;
          device_label: string | null;
          entry_version: number;
          before_data: Json | null;
          after_data: Json | null;
          occurred_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      care_active_timers: {
        Row: {
          id: string;
          baby_id: string;
          timer_type: "breastfeeding" | "sleep" | "pumping";
          breast_side: "left" | "right" | "both" | null;
          sleep_kind: "day" | "night" | null;
          started_at: string;
          started_by: string;
          started_by_name: string | null;
          started_device_id: string;
          started_device_label: string | null;
          ended_at: string | null;
          ended_by: string | null;
          ended_by_name: string | null;
          ended_device_id: string | null;
          ended_device_label: string | null;
          journal_entry_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      care_handover_sessions: {
        Row: {
          id: string;
          baby_id: string;
          caregiver_id: string;
          caregiver_name: string;
          caregiver_role: string;
          started_at: string;
          ended_at: string | null;
          ended_reason: string | null;
          device_id: string;
          device_label: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      night_shift_sessions: {
        Row: {
          id: string;
          baby_id: string;
          caregiver_id: string;
          caregiver_name: string;
          started_at: string;
          planned_end_at: string;
          ended_at: string | null;
          ended_reason: "manual" | "planned" | "handed_over" | null;
          status: "active" | "completed";
          summary: Json | null;
          summary_notification_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      milk_inventory: {
        Row: { id: string; baby_id: string; amount_ml: number; movement_type: "stored" | "used"; occurred_at: string; notes: string | null; created_by: string; created_at: string };
        Insert: { id?: string; baby_id: string; amount_ml: number; movement_type: "stored" | "used"; occurred_at?: string; notes?: string | null; created_by?: string; created_at?: string };
        Update: { amount_ml?: number; movement_type?: "stored" | "used"; occurred_at?: string; notes?: string | null };
        Relationships: [];
      };
      milk_storage_containers: {
        Row: {
          id: string; baby_id: string; created_by: string; label: string;
          sequence_number: number; pumped_at: string; initial_amount_ml: number;
          remaining_amount_ml: number; storage_location: "refrigerator" | "freezer" | "thawed";
          expires_at: string; thawed_at: string | null; thaw_expires_at: string | null;
          status: "available" | "consumed" | "discarded" | "expired";
          notes: string | null; created_device_id: string | null; created_device_label: string | null;
          updated_by: string | null; updated_by_name: string | null; updated_device_id: string | null;
          updated_device_label: string | null; version: number; deleted_at: string | null;
          created_at: string; updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      milk_storage_events: {
        Row: {
          id: number; container_id: string; baby_id: string; operation_id: string;
          action: "stored" | "thawed" | "consumed" | "discarded" | "expired" | "restored";
          amount_ml: number | null; remaining_after_ml: number; actor_id: string | null;
          actor_name: string | null; device_id: string | null; device_label: string | null;
          metadata: Json; occurred_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      care_tasks: {
        Row: {
          id: string;
          profile_id: string;
          baby_id: string | null;
          life_stage: "pregnancy" | "postpartum";
          title: string;
          preset_key: string | null;
          notes: string | null;
          due_at: string | null;
          completed_at: string | null;
          completed_by: string | null;
          assigned_to_name: string | null;
          created_by: string;
          client_operation_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          baby_id?: string | null;
          life_stage?: "pregnancy" | "postpartum";
          title: string;
          preset_key?: string | null;
          notes?: string | null;
          due_at?: string | null;
          completed_at?: string | null;
          completed_by?: string | null;
          assigned_to_name?: string | null;
          created_by?: string;
          client_operation_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          baby_id?: string | null;
          life_stage?: "pregnancy" | "postpartum";
          title?: string;
          preset_key?: string | null;
          notes?: string | null;
          due_at?: string | null;
          completed_at?: string | null;
          completed_by?: string | null;
          assigned_to_name?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      care_task_assignments: {
        Row: {
          id: string;
          profile_id: string;
          task_id: string;
          user_id: string;
          role_snapshot: "mother" | "father" | "caregiver";
          display_name_snapshot: string;
          alarm_at: string | null;
          alarm_generation: number;
          alarm_status: "none" | "scheduled" | "sent" | "snoozed" | "dismissed" | "cancelled";
          alarm_sent_at: string | null;
          alarm_dismissed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          task_id: string;
          user_id: string;
          role_snapshot: "mother" | "father" | "caregiver";
          display_name_snapshot: string;
          alarm_at?: string | null;
          alarm_generation?: number;
          alarm_status?: "none" | "scheduled" | "sent" | "snoozed" | "dismissed" | "cancelled";
          alarm_sent_at?: string | null;
          alarm_dismissed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          alarm_at?: string | null;
          alarm_generation?: number;
          alarm_status?: "none" | "scheduled" | "sent" | "snoozed" | "dismissed" | "cancelled";
          alarm_sent_at?: string | null;
          alarm_dismissed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      pregnancy_support_sessions: {
        Row: {
          id: string;
          profile_id: string;
          caregiver_id: string;
          caregiver_name: string;
          caregiver_role: "mother" | "father" | "caregiver";
          started_at: string;
          ended_at: string | null;
          ended_reason: "handed_over" | "manual" | null;
          device_id: string;
          device_label: string | null;
          client_operation_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          caregiver_id: string;
          caregiver_name: string;
          caregiver_role: "mother" | "father" | "caregiver";
          started_at?: string;
          ended_at?: string | null;
          ended_reason?: "handed_over" | "manual" | null;
          device_id: string;
          device_label?: string | null;
          client_operation_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          ended_at?: string | null;
          ended_reason?: "handed_over" | "manual" | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      doctor_visit_items: {
        Row: {
          id: string;
          profile_id: string;
          baby_id: string | null;
          subject: "pregnancy" | "baby" | "postpartum_mother";
          item_type: "question" | "symptom" | "medication" | "note";
          title: string;
          details: string | null;
          severity: number | null;
          started_at: string | null;
          resolved_at: string | null;
          answer: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          baby_id?: string | null;
          subject: "pregnancy" | "baby" | "postpartum_mother";
          item_type: "question" | "symptom" | "medication" | "note";
          title: string;
          details?: string | null;
          severity?: number | null;
          started_at?: string | null;
          resolved_at?: string | null;
          answer?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          baby_id?: string | null;
          subject?: "pregnancy" | "baby" | "postpartum_mother";
          item_type?: "question" | "symptom" | "medication" | "note";
          title?: string;
          details?: string | null;
          severity?: number | null;
          started_at?: string | null;
          resolved_at?: string | null;
          answer?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      pregnancy_visit_measurements: {
        Row: {
          id: string;
          profile_id: string;
          measured_at: string;
          source: "self" | "health_team";
          systolic_bp: number | null;
          diastolic_bp: number | null;
          pulse_bpm: number | null;
          fundal_height_cm: number | null;
          fetal_heart_rate_bpm: number | null;
          notes: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          measured_at?: string;
          source?: "self" | "health_team";
          systolic_bp?: number | null;
          diastolic_bp?: number | null;
          pulse_bpm?: number | null;
          fundal_height_cm?: number | null;
          fetal_heart_rate_bpm?: number | null;
          notes?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          measured_at?: string;
          source?: "self" | "health_team";
          systolic_bp?: number | null;
          diastolic_bp?: number | null;
          pulse_bpm?: number | null;
          fundal_height_cm?: number | null;
          fetal_heart_rate_bpm?: number | null;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      mother_wellbeing_checkins: {
        Row: { id: string; profile_id: string; mood: number; rest: number; self_care_note: string | null; checkin_date: string; created_at: string };
        Insert: { id?: string; profile_id: string; mood: number; rest: number; self_care_note?: string | null; checkin_date?: string; created_at?: string };
        Update: { mood?: number; rest?: number; self_care_note?: string | null; checkin_date?: string };
        Relationships: [];
      };
      care_reminders: {
        Row: { id: string; baby_id: string; created_by: string; entry_type: "breastfeeding" | "bottle" | "sleep" | "diaper" | "pumping" | "medicine" | "solid_food" | "temperature"; scheduled_for: string; title: string; body: string; local_notification_id: string | null; creator_push_token: string | null; target_user_id: string | null; alarm_kind: "standard" | "night_shift" | "shift_summary"; snooze_minutes: number; night_shift_session_id: string | null; status: "scheduled" | "sent" | "cancelled"; sent_at: string | null; cancelled_at: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; baby_id: string; created_by?: string; entry_type: "breastfeeding" | "bottle" | "sleep" | "diaper" | "pumping" | "medicine" | "solid_food" | "temperature"; scheduled_for: string; title: string; body: string; local_notification_id?: string | null; creator_push_token?: string | null; target_user_id?: string | null; alarm_kind?: "standard" | "night_shift" | "shift_summary"; snooze_minutes?: number; night_shift_session_id?: string | null; status?: "scheduled" | "sent" | "cancelled"; sent_at?: string | null; cancelled_at?: string | null; created_at?: string; updated_at?: string };
        Update: { scheduled_for?: string; title?: string; body?: string; local_notification_id?: string | null; creator_push_token?: string | null; target_user_id?: string | null; alarm_kind?: "standard" | "night_shift" | "shift_summary"; snooze_minutes?: number; night_shift_session_id?: string | null; status?: "scheduled" | "sent" | "cancelled"; sent_at?: string | null; cancelled_at?: string | null; updated_at?: string };
        Relationships: [];
      };
      sleep_predictions: {
        Row: {
          baby_id: string;
          status: "insufficient" | "active" | "expired";
          last_sleep_entry_id: string | null;
          last_wake_at: string | null;
          predicted_sleep_at: string | null;
          window_start: string | null;
          window_end: string | null;
          notify_at: string | null;
          sample_count: number;
          confidence_score: number | null;
          predicted_wake_minutes: number | null;
          algorithm_version: string;
          calculated_at: string;
          updated_at: string;
        };
        Insert: {
          baby_id: string;
          status: "insufficient" | "active" | "expired";
          last_sleep_entry_id?: string | null;
          last_wake_at?: string | null;
          predicted_sleep_at?: string | null;
          window_start?: string | null;
          window_end?: string | null;
          notify_at?: string | null;
          sample_count?: number;
          confidence_score?: number | null;
          predicted_wake_minutes?: number | null;
          algorithm_version?: string;
          calculated_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: "insufficient" | "active" | "expired";
          last_sleep_entry_id?: string | null;
          last_wake_at?: string | null;
          predicted_sleep_at?: string | null;
          window_start?: string | null;
          window_end?: string | null;
          notify_at?: string | null;
          sample_count?: number;
          confidence_score?: number | null;
          predicted_wake_minutes?: number | null;
          algorithm_version?: string;
          calculated_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      vaccine_schedule: {
        Row: {
          id: string;
          vaccine_name: string;
          vaccine_code: string | null;
          recommended_age_days: number;
          dose_number: number;
          description: string | null;
          sort_order: number;
        };
        Insert: {
          id?: string;
          vaccine_name: string;
          vaccine_code?: string | null;
          recommended_age_days: number;
          dose_number?: number;
          description?: string | null;
          sort_order?: number;
        };
        Update: {
          vaccine_name?: string;
          vaccine_code?: string | null;
          recommended_age_days?: number;
          dose_number?: number;
          description?: string | null;
          sort_order?: number;
        };
        Relationships: [];
      };
      baby_vaccinations: {
        Row: {
          id: string;
          baby_id: string;
          vaccine_schedule_id: string;
          scheduled_date: string;
          completed: boolean;
          completed_date: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          baby_id: string;
          vaccine_schedule_id: string;
          scheduled_date: string;
          completed?: boolean;
          completed_date?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          scheduled_date?: string;
          completed?: boolean;
          completed_date?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      growth_records: {
        Row: {
          id: string;
          baby_id: string;
          record_date: string;
          weight_kg: number | null;
          height_cm: number | null;
          head_circumference_cm: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          baby_id: string;
          record_date?: string;
          weight_kg?: number | null;
          height_cm?: number | null;
          head_circumference_cm?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          record_date?: string;
          weight_kg?: number | null;
          height_cm?: number | null;
          head_circumference_cm?: number | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      baby_photos: {
        Row: {
          id: string;
          baby_id: string;
          storage_path: string;
          taken_at: string | null;
          caption: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          baby_id: string;
          storage_path: string;
          taken_at?: string | null;
          caption?: string | null;
          created_at?: string;
        };
        Update: {
          taken_at?: string | null;
          caption?: string | null;
        };
        Relationships: [];
      };
      baby_teeth: {
        Row: {
          id: string;
          baby_id: string;
          tooth_code: string;
          erupted_at: string;
          recorded_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          baby_id: string;
          tooth_code: string;
          erupted_at?: string;
          recorded_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          tooth_code?: string;
          erupted_at?: string;
          recorded_by?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      lullabies: {
        Row: {
          id: string;
          title: string;
          duration_minutes: 15 | 30 | 60;
          storage_path: string;
          cover_image_url: string | null;
          category: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          duration_minutes: 15 | 30 | 60;
          storage_path: string;
          cover_image_url?: string | null;
          category?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          title?: string;
          duration_minutes?: 15 | 30 | 60;
          storage_path?: string;
          cover_image_url?: string | null;
          category?: string | null;
          is_active?: boolean;
        };
        Relationships: [];
      };
      forum_categories: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          icon: string | null;
          sort_order: number;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          icon?: string | null;
          sort_order?: number;
        };
        Update: {
          name?: string;
          description?: string | null;
          icon?: string | null;
          sort_order?: number;
        };
        Relationships: [];
      };
      forum_posts: {
        Row: {
          id: string;
          category_id: string;
          author_id: string;
          forum_nickname: string;
          title: string;
          content: string;
          is_flagged: boolean;
          flagged_reason: string | null;
          is_hidden: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          author_id: string;
          forum_nickname: string;
          title: string;
          content: string;
          is_flagged?: boolean;
          flagged_reason?: string | null;
          is_hidden?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          category_id?: string;
          title?: string;
          content?: string;
          is_flagged?: boolean;
          flagged_reason?: string | null;
          is_hidden?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      forum_comments: {
        Row: {
          id: string;
          post_id: string;
          author_id: string;
          forum_nickname: string;
          content: string;
          is_flagged: boolean;
          flagged_reason: string | null;
          is_hidden: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          author_id: string;
          forum_nickname: string;
          content: string;
          is_flagged?: boolean;
          flagged_reason?: string | null;
          is_hidden?: boolean;
          created_at?: string;
        };
        Update: {
          content?: string;
          is_flagged?: boolean;
          flagged_reason?: string | null;
          is_hidden?: boolean;
        };
        Relationships: [];
      };
      forum_reports: {
        Row: {
          id: string;
          reporter_id: string;
          target_type: "post" | "comment";
          target_id: string;
          reason: string;
          status: "pending" | "reviewed" | "dismissed";
          reported_author_id: string | null;
          review_due_at: string;
          reviewed_at: string | null;
          moderation_action: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          target_type: "post" | "comment";
          target_id: string;
          reason: string;
          status?: "pending" | "reviewed" | "dismissed";
          reported_author_id?: string | null;
          review_due_at?: string;
          reviewed_at?: string | null;
          moderation_action?: string | null;
          created_at?: string;
        };
        Update: {
          reason?: string;
          status?: "pending" | "reviewed" | "dismissed";
          reported_author_id?: string | null;
          review_due_at?: string;
          reviewed_at?: string | null;
          moderation_action?: string | null;
        };
        Relationships: [];
      };
      forum_post_likes: {
        Row: {
          post_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          post_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      forum_comment_likes: {
        Row: {
          comment_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          comment_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          product_id: string | null;
          status: "active" | "expired" | "cancelled" | "grace_period";
          expires_at: string | null;
          is_lifetime: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          product_id?: string | null;
          status?: "active" | "expired" | "cancelled" | "grace_period";
          expires_at?: string | null;
          is_lifetime?: boolean;
          updated_at?: string;
        };
        Update: {
          product_id?: string | null;
          status?: "active" | "expired" | "cancelled" | "grace_period";
          expires_at?: string | null;
          is_lifetime?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      analytics_events: {
        Row: {
          id: string;
          user_id: string | null;
          event_name: string;
          event_properties: Json;
          session_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          event_name: string;
          event_properties?: Json;
          session_id?: string | null;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      push_tokens: {
        Row: {
          id: string;
          user_id: string;
          expo_push_token: string;
          device_type: "ios" | "android" | null;
          project_id: string | null;
          enabled: boolean;
          disabled_at: string | null;
          last_seen_at: string;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          expo_push_token: string;
          device_type?: "ios" | "android" | null;
          project_id?: string | null;
          enabled?: boolean;
          disabled_at?: string | null;
          last_seen_at?: string;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          expo_push_token?: string;
          device_type?: "ios" | "android" | null;
          project_id?: string | null;
          enabled?: boolean;
          disabled_at?: string | null;
          last_seen_at?: string;
          last_error?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      pregnancy_vaccinations: {
        Row: {
          id: string;
          profile_id: string;
          vaccine_code: string;
          vaccine_name: string;
          recommended_week_start: number;
          recommended_week_end: number;
          scheduled_date: string;
          completed: boolean;
          completed_date: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          vaccine_code: string;
          vaccine_name: string;
          recommended_week_start: number;
          recommended_week_end: number;
          scheduled_date: string;
          completed?: boolean;
          completed_date?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          vaccine_name?: string;
          recommended_week_start?: number;
          recommended_week_end?: number;
          scheduled_date?: string;
          completed?: boolean;
          completed_date?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      vaccine_reminder_dismissals: {
        Row: {
          id: string;
          user_id: string;
          reminder_key: string;
          scheduled_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          reminder_key: string;
          scheduled_date: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      notification_deliveries: {
        Row: {
          id: string;
          dedupe_key: string;
          user_id: string;
          push_token_id: string;
          kind: string;
          status: "pending" | "ticketed" | "delivered" | "failed";
          expo_ticket_id: string | null;
          error: string | null;
          attempts: number;
          created_at: string;
          updated_at: string;
          delivered_at: string | null;
        };
        Insert: {
          id?: string;
          dedupe_key: string;
          user_id: string;
          push_token_id: string;
          kind: string;
          status?: "pending" | "ticketed" | "delivered" | "failed";
          expo_ticket_id?: string | null;
          error?: string | null;
          attempts?: number;
          created_at?: string;
          updated_at?: string;
          delivered_at?: string | null;
        };
        Update: {
          status?: "pending" | "ticketed" | "delivered" | "failed";
          expo_ticket_id?: string | null;
          error?: string | null;
          attempts?: number;
          updated_at?: string;
          delivered_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      forum_posts_public: {
        Row: {
          id: string;
          category_id: string;
          forum_nickname: string;
          author_badge: string;
          title: string;
          content: string;
          created_at: string;
          updated_at: string;
          comment_count: number;
          like_count: number;
          liked_by_current_user: boolean;
        };
        Relationships: [];
      };
      forum_comments_public: {
        Row: {
          id: string;
          post_id: string;
          forum_nickname: string;
          author_badge: string;
          content: string;
          created_at: string;
          like_count: number;
          liked_by_current_user: boolean;
        };
        Relationships: [];
      };
    };
    Functions: {
      complete_pregnancy_with_birth: {
        Args: {
          p_baby_name: string;
          p_birth_date: string;
          p_gender?: "kiz" | "erkek" | "belirtilmemis";
          p_feeding_mode?: "breastfeeding" | "pumping" | "mixed" | "formula";
        };
        Returns: Json;
      };
      record_age_assurance: {
        Args: {
          p_birth_date?: string;
          p_context: "sign_up" | "sign_in" | "family_code";
          p_is_over_18: boolean;
          p_version: string;
        };
        Returns: Database["public"]["Tables"]["user_age_assurance"]["Row"];
      };
      has_legal_acceptance: {
        Args: {
          p_version: string;
        };
        Returns: boolean;
      };
      record_legal_acceptance: {
        Args: {
          p_source: "auth" | "forum";
          p_version: string;
        };
        Returns: string;
      };
      block_forum_author: {
        Args: {
          p_target_id: string;
          p_target_type: "post" | "comment";
        };
        Returns: string;
      };
      unblock_forum_author: {
        Args: {
          p_blocked_user_id: string;
        };
        Returns: boolean;
      };
      list_forum_blocks: {
        Args: Record<PropertyKey, never>;
        Returns: {
          blocked_user_id: string;
          forum_nickname: string;
          blocked_at: string;
        }[];
      };
      get_active_vaccine_reminders: {
        Args: {
          p_today?: string;
        };
        Returns: {
          reminder_key: string;
          source: "baby" | "pregnancy";
          vaccination_id: string;
          subject_name: string;
          vaccine_name: string;
          scheduled_date: string;
          recommended_week_start: number | null;
          recommended_week_end: number | null;
        }[];
      };
      add_pregnancy_counter_delta: {
        Args: {
          p_counter_date: string;
          p_kick_delta?: number;
          p_contraction_delta?: number;
        };
        Returns: Database["public"]["Tables"]["pregnancy_daily_counters"]["Row"];
      };
      can_access_baby: {
        Args: {
          p_baby_id: string;
        };
        Returns: boolean;
      };
      can_access_baby_path: {
        Args: {
          p_baby_id: string;
        };
        Returns: boolean;
      };
      can_access_profile: {
        Args: {
          p_profile_id: string;
        };
        Returns: boolean;
      };
      can_coordinate_profile: {
        Args: {
          p_profile_id: string;
        };
        Returns: boolean;
      };
      get_active_profile: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Tables"]["profiles"]["Row"];
      };
      get_active_profile_id: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      save_push_token_for_current_user: {
        Args: {
          p_device_type?: "ios" | "android" | null;
          p_expo_push_token: string;
          p_project_id?: string | null;
        };
        Returns: Database["public"]["Tables"]["push_tokens"]["Row"];
      };
      get_effective_premium_access: {
        Args: Record<PropertyKey, never>;
        Returns: {
          is_premium: boolean;
          access_source: string;
          access_expires_at: string | null;
          is_lifetime: boolean;
          family_trial_started_at: string | null;
          family_trial_expires_at: string | null;
        }[];
      };
      get_family_feature_access: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      consume_family_code_login_attempt: {
        Args: {
          p_key_hash: string;
          p_window_seconds?: number;
          p_max_attempts?: number;
          p_block_seconds?: number;
        };
        Returns: Json;
      };
      reserve_family_feature_credit: {
        Args: {
          p_feature_key: string;
          p_operation_id: string;
          p_life_stage: "pregnancy" | "postpartum";
        };
        Returns: Json;
      };
      commit_family_feature_credit: {
        Args: { p_operation_id: string };
        Returns: Json;
      };
      release_family_feature_credit: {
        Args: { p_operation_id: string };
        Returns: Json;
      };
      get_family_coordination_context: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      create_family_task: {
        Args: {
          p_operation_id: string;
          p_title: string;
          p_life_stage: "pregnancy" | "postpartum";
          p_assignee_scope: "mother" | "member" | "both";
          p_baby_id?: string | null;
          p_due_at?: string | null;
          p_alarm_at?: string | null;
          p_preset_key?: string | null;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      list_family_tasks: {
        Args: {
          p_life_stage: "pregnancy" | "postpartum";
          p_baby_id?: string | null;
          p_include_completed?: boolean;
        };
        Returns: Json;
      };
      complete_family_task: {
        Args: { p_task_id: string; p_completed?: boolean };
        Returns: Json;
      };
      snooze_family_task_alarm: {
        Args: { p_assignment_id: string; p_scheduled_for: string };
        Returns: Json;
      };
      cancel_family_task_alarm: {
        Args: { p_assignment_id: string };
        Returns: Json;
      };
      take_over_pregnancy_support: {
        Args: {
          p_operation_id: string;
          p_device_id: string;
          p_device_label?: string | null;
          p_caregiver_name?: string | null;
        };
        Returns: Json;
      };
      get_pregnancy_support_snapshot: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      get_doctor_visit_snapshot: {
        Args: {
          p_subject: "pregnancy" | "baby" | "postpartum_mother";
          p_baby_id?: string | null;
          p_days?: number;
        };
        Returns: Json;
      };
      has_effective_premium_access: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      ensure_birth_preparation_defaults: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      set_birth_preparation_item_completed: {
        Args: {
          p_item_id: string;
          p_completed: boolean;
        };
        Returns: Database["public"]["Tables"]["birth_preparation_items"]["Row"];
      };
      create_medicine_care_entry_safely: {
        Args: {
          p_baby_id: string;
          p_medicine_name: string;
          p_medicine_dose: string | null;
          p_notes: string | null;
          p_occurred_at: string;
          p_caregiver_name: string | null;
          p_override_recent?: boolean;
        };
        Returns: Database["public"]["Tables"]["care_journal_entries"]["Row"];
      };
      apply_care_sync_operation: {
        Args: {
          p_operation_id: string;
          p_device_id: string;
          p_device_label: string;
          p_action: string;
          p_entry_id: string;
          p_base_version?: number | null;
          p_payload?: Json;
          p_actor_name?: string | null;
        };
        Returns: Json;
      };
      undo_care_sync_operation: {
        Args: {
          p_original_operation_id: string;
          p_undo_operation_id: string;
          p_device_id: string;
          p_device_label: string;
          p_actor_name?: string | null;
        };
        Returns: Json;
      };
      start_shared_care_timer: {
        Args: {
          p_operation_id: string;
          p_timer_id: string;
          p_baby_id: string;
          p_timer_type: string;
          p_breast_side: string;
          p_sleep_kind: string;
          p_device_id: string;
          p_device_label: string;
          p_actor_name: string | null;
        };
        Returns: Json;
      };
      stop_shared_care_timer: {
        Args: {
          p_operation_id: string;
          p_timer_id: string;
          p_device_id: string;
          p_device_label: string;
          p_actor_name: string | null;
        };
        Returns: Json;
      };
      stop_shared_care_timer_v2: {
        Args: {
          p_operation_id: string;
          p_timer_id: string;
          p_device_id: string;
          p_device_label: string;
          p_actor_name: string | null;
          p_amount_ml?: number | null;
        };
        Returns: Json;
      };
      create_milk_storage_container: {
        Args: {
          p_operation_id: string; p_baby_id: string; p_amount_ml: number;
          p_storage_location: string; p_pumped_at: string; p_expires_at?: string | null;
          p_label?: string | null; p_notes?: string | null; p_device_id?: string | null;
          p_device_label?: string | null; p_actor_name?: string | null;
        };
        Returns: Json;
      };
      thaw_milk_storage_container: {
        Args: { p_operation_id: string; p_container_id: string; p_thawed_at?: string; p_device_id?: string | null; p_device_label?: string | null; p_actor_name?: string | null };
        Returns: Json;
      };
      consume_milk_stock: {
        Args: { p_operation_id: string; p_baby_id: string; p_amount_ml: number; p_container_id?: string | null; p_device_id?: string | null; p_device_label?: string | null; p_actor_name?: string | null };
        Returns: Json;
      };
      discard_milk_storage_container: {
        Args: { p_operation_id: string; p_container_id: string; p_device_id?: string | null; p_device_label?: string | null; p_actor_name?: string | null };
        Returns: Json;
      };
      get_milk_inventory_summary: {
        Args: { p_baby_id: string };
        Returns: Json;
      };
      take_over_baby_care: {
        Args: {
          p_operation_id: string;
          p_session_id: string;
          p_baby_id: string;
          p_caregiver_name: string;
          p_device_id: string;
          p_device_label: string;
        };
        Returns: Json;
      };
      get_care_handover_snapshot: {
        Args: { p_baby_id: string };
        Returns: Json;
      };
      start_night_shift: {
        Args: { p_baby_id: string; p_caregiver_name: string; p_planned_end_at: string; p_summary_notification_id: string | null };
        Returns: Database["public"]["Tables"]["night_shift_sessions"]["Row"];
      };
      finish_night_shift: {
        Args: { p_session_id: string };
        Returns: Database["public"]["Tables"]["night_shift_sessions"]["Row"];
      };
      get_recent_medicine_dose: {
        Args: {
          p_baby_id: string;
          p_medicine_name: string;
        };
        Returns: {
          entry_id: string;
          medicine_name: string;
          medicine_dose: string | null;
          caregiver_name: string | null;
          occurred_at: string;
        }[];
      };
      is_family_father: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_nickname_available: {
        Args: {
          nickname: string;
        };
        Returns: boolean;
      };
      redeem_family_referral_code: {
        Args: {
          p_code: string;
        };
        Returns: Database["public"]["Tables"]["profiles"]["Row"];
      };
      reconcile_subscription: {
        Args: {
          p_user_id: string;
          p_product_id: string;
          p_status: "active" | "expired" | "cancelled" | "grace_period";
          p_is_lifetime?: boolean;
          p_expires_at?: string | null;
        };
        Returns: Database["public"]["Tables"]["subscriptions"]["Row"];
      };
      is_day5_offer_eligible: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      has_active_family_premium: {
        Args: { p_baby_id: string };
        Returns: boolean;
      };
      has_active_profile_premium: {
        Args: { p_profile_id: string };
        Returns: boolean;
      };
      is_first_family_baby: {
        Args: { p_baby_id: string };
        Returns: boolean;
      };
      can_create_care_reminder: {
        Args: { p_baby_id: string };
        Returns: boolean;
      };
      get_upcoming_vaccinations: {
        Args: {
          days_ahead?: number;
        };
        Returns: {
          baby_id: string;
          parent_id: string;
          vaccine_name: string;
          scheduled_date: string;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<
  TableName extends keyof Database["public"]["Tables"]
> = Database["public"]["Tables"][TableName]["Row"];

export type TablesInsert<
  TableName extends keyof Database["public"]["Tables"]
> = Database["public"]["Tables"][TableName]["Insert"];

export type TablesUpdate<
  TableName extends keyof Database["public"]["Tables"]
> = Database["public"]["Tables"][TableName]["Update"];

export type Views<ViewName extends keyof Database["public"]["Views"]> =
  Database["public"]["Views"][ViewName]["Row"];
