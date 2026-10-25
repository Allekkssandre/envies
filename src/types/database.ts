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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          id: string
          list_id: string
          name: string
          name_key: string
          position: string
          ref: string
        }
        Insert: {
          created_at?: string
          id?: string
          list_id: string
          name: string
          name_key?: string
          position: string
          ref?: string
        }
        Update: {
          created_at?: string
          id?: string
          list_id?: string
          name?: string
          name_key?: string
          position?: string
          ref?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "list_summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      item_tags: {
        Row: {
          item_id: string
          tag_id: string
        }
        Insert: {
          item_id: string
          tag_id: string
        }
        Update: {
          item_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_tags_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          category_id: string | null
          created_at: string
          currency: string | null
          deleted_at: string | null
          description: string | null
          domain: string | null
          fetch_attempts: number
          fetch_error: string | null
          fetch_started_at: string | null
          fetch_status: Database["public"]["Enums"]["fetch_status"]
          fetched_at: string | null
          id: string
          image_candidates: Json
          image_height: number | null
          image_path: string | null
          image_source_url: string | null
          image_width: number | null
          is_favorite: boolean
          list_id: string
          meta: Json
          note: string | null
          position: string
          price_cents: number | null
          price_checked_at: string | null
          price_source: Database["public"]["Enums"]["price_source"] | null
          ref: string
          sorted_at: string | null
          suggested_category_id: string | null
          title: string | null
          updated_at: string
          url: string | null
          url_key: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          currency?: string | null
          deleted_at?: string | null
          description?: string | null
          domain?: string | null
          fetch_attempts?: number
          fetch_error?: string | null
          fetch_started_at?: string | null
          fetch_status?: Database["public"]["Enums"]["fetch_status"]
          fetched_at?: string | null
          id?: string
          image_candidates?: Json
          image_height?: number | null
          image_path?: string | null
          image_source_url?: string | null
          image_width?: number | null
          is_favorite?: boolean
          list_id: string
          meta?: Json
          note?: string | null
          position: string
          price_cents?: number | null
          price_checked_at?: string | null
          price_source?: Database["public"]["Enums"]["price_source"] | null
          ref?: string
          sorted_at?: string | null
          suggested_category_id?: string | null
          title?: string | null
          updated_at?: string
          url?: string | null
          url_key?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          currency?: string | null
          deleted_at?: string | null
          description?: string | null
          domain?: string | null
          fetch_attempts?: number
          fetch_error?: string | null
          fetch_started_at?: string | null
          fetch_status?: Database["public"]["Enums"]["fetch_status"]
          fetched_at?: string | null
          id?: string
          image_candidates?: Json
          image_height?: number | null
          image_path?: string | null
          image_source_url?: string | null
          image_width?: number | null
          is_favorite?: boolean
          list_id?: string
          meta?: Json
          note?: string | null
          position?: string
          price_cents?: number | null
          price_checked_at?: string | null
          price_source?: Database["public"]["Enums"]["price_source"] | null
          ref?: string
          sorted_at?: string | null
          suggested_category_id?: string | null
          title?: string | null
          updated_at?: string
          url?: string | null
          url_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "list_summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_suggested_category_id_fkey"
            columns: ["suggested_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      list_redirects: {
        Row: {
          created_at: string
          list_id: string
          old_slug: string
        }
        Insert: {
          created_at?: string
          list_id: string
          old_slug: string
        }
        Update: {
          created_at?: string
          list_id?: string
          old_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_redirects_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "list_summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_redirects_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      list_secrets: {
        Row: {
          auth_version: number
          edit_key: string
          list_id: string
          password_hash: string
          updated_at: string
        }
        Insert: {
          auth_version?: number
          edit_key: string
          list_id: string
          password_hash: string
          updated_at?: string
        }
        Update: {
          auth_version?: number
          edit_key?: string
          list_id?: string
          password_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_secrets_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: true
            referencedRelation: "list_summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_secrets_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: true
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      lists: {
        Row: {
          ambiance: Database["public"]["Enums"]["ambiance"]
          content_updated_at: string
          created_at: string
          currency: string
          deleted_at: string | null
          description: string | null
          id: string
          owner_name: string
          search_key: string
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          ambiance?: Database["public"]["Enums"]["ambiance"]
          content_updated_at?: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          owner_name: string
          search_key?: string
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          ambiance?: Database["public"]["Enums"]["ambiance"]
          content_updated_at?: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          owner_name?: string
          search_key?: string
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          bucket: string
          count: number
          reset_at: string
        }
        Insert: {
          bucket: string
          count: number
          reset_at: string
        }
        Update: {
          bucket?: string
          count?: number
          reset_at?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: Database["public"]["Enums"]["tag_color"]
          created_at: string
          id: string
          list_id: string
          name: string
          name_key: string
          position: string
        }
        Insert: {
          color?: Database["public"]["Enums"]["tag_color"]
          created_at?: string
          id?: string
          list_id: string
          name: string
          name_key?: string
          position: string
        }
        Update: {
          color?: Database["public"]["Enums"]["tag_color"]
          created_at?: string
          id?: string
          list_id?: string
          name?: string
          name_key?: string
          position?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "list_summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tags_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      list_summaries: {
        Row: {
          ambiance: Database["public"]["Enums"]["ambiance"] | null
          content_updated_at: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          favorite_count: number | null
          id: string | null
          item_count: number | null
          missing_prices: number | null
          owner_name: string | null
          search_key: string | null
          slug: string | null
          thumbs: Json | null
          title: string | null
          total_cents: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      hit_rate_limit: {
        Args: { p_bucket: string; p_max: number; p_window_seconds: number }
        Returns: boolean
      }
      normalize_key: { Args: { p: string }; Returns: string }
      short_ref: { Args: never; Returns: string }
    }
    Enums: {
      ambiance: "feuillage" | "ciel" | "ambre"
      fetch_status: "none" | "pending" | "ok" | "partial" | "failed"
      price_source: "page" | "manual" | "import"
      tag_color:
        | "rouille"
        | "ocre"
        | "miel"
        | "olive"
        | "sauge"
        | "ardoise"
        | "prune"
        | "sable"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      ambiance: ["feuillage", "ciel", "ambre"],
      fetch_status: ["none", "pending", "ok", "partial", "failed"],
      price_source: ["page", "manual", "import"],
      tag_color: [
        "rouille",
        "ocre",
        "miel",
        "olive",
        "sauge",
        "ardoise",
        "prune",
        "sable",
      ],
    },
  },
} as const
