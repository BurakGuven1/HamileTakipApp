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
          full_name: string | null;
          forum_nickname: string | null;
          is_onboarding_complete: boolean;
          pregnancy_due_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          forum_nickname?: string | null;
          is_onboarding_complete?: boolean;
          pregnancy_due_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string | null;
          forum_nickname?: string | null;
          is_onboarding_complete?: boolean;
          pregnancy_due_date?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      babies: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          birth_date: string | null;
          due_date: string | null;
          gender: "female" | "male" | "unknown" | null;
          photo_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          birth_date?: string | null;
          due_date?: string | null;
          gender?: "female" | "male" | "unknown" | null;
          photo_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          birth_date?: string | null;
          due_date?: string | null;
          gender?: "female" | "male" | "unknown" | null;
          photo_path?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      vaccine_schedule: {
        Row: {
          id: string;
          vaccine_name: string;
          dose_label: string;
          due_offset_days: number;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          vaccine_name: string;
          dose_label: string;
          due_offset_days: number;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          vaccine_name?: string;
          dose_label?: string;
          due_offset_days?: number;
          description?: string | null;
        };
        Relationships: [];
      };
      baby_vaccinations: {
        Row: {
          id: string;
          baby_id: string;
          vaccine_schedule_id: string;
          due_date: string;
          completed_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          baby_id: string;
          vaccine_schedule_id: string;
          due_date: string;
          completed_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          due_date?: string;
          completed_at?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      growth_records: {
        Row: {
          id: string;
          baby_id: string;
          measured_at: string;
          weight_grams: number | null;
          height_cm: number | null;
          head_circumference_cm: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          baby_id: string;
          measured_at: string;
          weight_grams?: number | null;
          height_cm?: number | null;
          head_circumference_cm?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          measured_at?: string;
          weight_grams?: number | null;
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
          thumbnail_path: string | null;
          taken_at: string | null;
          caption: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          baby_id: string;
          storage_path: string;
          thumbnail_path?: string | null;
          taken_at?: string | null;
          caption?: string | null;
          created_at?: string;
        };
        Update: {
          thumbnail_path?: string | null;
          taken_at?: string | null;
          caption?: string | null;
        };
        Relationships: [];
      };
      lullabies: {
        Row: {
          id: string;
          title: string;
          duration_minutes: 15 | 30 | 60;
          storage_path: string;
          is_premium: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          duration_minutes: 15 | 30 | 60;
          storage_path: string;
          is_premium?: boolean;
          created_at?: string;
        };
        Update: {
          title?: string;
          duration_minutes?: 15 | 30 | 60;
          storage_path?: string;
          is_premium?: boolean;
        };
        Relationships: [];
      };
      forum_categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      forum_posts: {
        Row: {
          id: string;
          category_id: string;
          author_id: string;
          title: string;
          body: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          author_id: string;
          title: string;
          body: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          body?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      forum_comments: {
        Row: {
          id: string;
          post_id: string;
          author_id: string;
          body: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          author_id: string;
          body: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      forum_reports: {
        Row: {
          id: string;
          post_id: string | null;
          comment_id: string | null;
          reporter_id: string;
          reason: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id?: string | null;
          comment_id?: string | null;
          reporter_id: string;
          reason: string;
          created_at?: string;
        };
        Update: {
          reason?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          entitlement_id: string;
          product_id: string;
          status: "active" | "expired" | "cancelled";
          expires_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          entitlement_id: string;
          product_id: string;
          status: "active" | "expired" | "cancelled";
          expires_at?: string | null;
          updated_at?: string;
        };
        Update: {
          entitlement_id?: string;
          product_id?: string;
          status?: "active" | "expired" | "cancelled";
          expires_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      analytics_events: {
        Row: {
          id: string;
          user_id: string | null;
          event_name: string;
          properties: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          event_name: string;
          properties?: Json;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      forum_posts_public: {
        Row: {
          id: string;
          category_id: string;
          title: string;
          body: string;
          forum_nickname: string | null;
          comment_count: number;
          created_at: string;
          updated_at: string;
        };
        Relationships: [];
      };
      forum_comments_public: {
        Row: {
          id: string;
          post_id: string;
          body: string;
          forum_nickname: string | null;
          created_at: string;
          updated_at: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      create_baby_vaccination_schedule: {
        Args: {
          baby_id: string;
        };
        Returns: void;
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
