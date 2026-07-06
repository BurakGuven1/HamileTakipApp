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
          avatar_url: string | null;
          is_pregnant: boolean;
          due_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          forum_nickname?: string | null;
          avatar_url?: string | null;
          is_pregnant?: boolean;
          due_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string | null;
          forum_nickname?: string | null;
          avatar_url?: string | null;
          is_pregnant?: boolean;
          due_date?: string | null;
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
          created_at: string;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          target_type: "post" | "comment";
          target_id: string;
          reason: string;
          status?: "pending" | "reviewed" | "dismissed";
          created_at?: string;
        };
        Update: {
          reason?: string;
          status?: "pending" | "reviewed" | "dismissed";
        };
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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          expo_push_token: string;
          device_type?: "ios" | "android" | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          expo_push_token?: string;
          device_type?: "ios" | "android" | null;
          updated_at?: string;
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
          title: string;
          content: string;
          created_at: string;
          updated_at: string;
          comment_count: number;
        };
        Relationships: [];
      };
      forum_comments_public: {
        Row: {
          id: string;
          post_id: string;
          forum_nickname: string;
          content: string;
          created_at: string;
        };
        Relationships: [];
      };
    };
    Functions: {
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
