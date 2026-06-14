export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      ai_stack_items: {
        Row: {
          created_at: string;
          id: string;
          profile_id: string;
          skill_level: number;
          sort_order: number;
          tool_name: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          profile_id: string;
          skill_level: number;
          sort_order?: number;
          tool_name: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          profile_id?: string;
          skill_level?: number;
          sort_order?: number;
          tool_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_stack_items_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profession_members: {
        Row: {
          joined_at: string;
          profession_id: string;
          profile_id: string;
          role: Database["public"]["Enums"]["profession_role"];
        };
        Insert: {
          joined_at?: string;
          profession_id: string;
          profile_id: string;
          role?: Database["public"]["Enums"]["profession_role"];
        };
        Update: {
          joined_at?: string;
          profession_id?: string;
          profile_id?: string;
          role?: Database["public"]["Enums"]["profession_role"];
        };
        Relationships: [
          {
            foreignKeyName: "profession_members_profession_id_fkey";
            columns: ["profession_id"];
            isOneToOne: false;
            referencedRelation: "professions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profession_members_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      professions: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          member_count: number;
          name: string;
          rules: Json;
          slug: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          member_count?: number;
          name: string;
          rules?: Json;
          slug: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          member_count?: number;
          name?: string;
          rules?: Json;
          slug?: string;
        };
        Relationships: [];
      };
      profile_badges: {
        Row: {
          awarded_at: string;
          badge_type: string;
          id: string;
          profile_id: string;
        };
        Insert: {
          awarded_at?: string;
          badge_type: string;
          id?: string;
          profile_id: string;
        };
        Update: {
          awarded_at?: string;
          badge_type?: string;
          id?: string;
          profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_badges_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          display_name: string | null;
          handle: string;
          hire_me_url: string | null;
          hire_me_visible: boolean;
          id: string;
          primary_profession_id: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string | null;
          handle: string;
          hire_me_url?: string | null;
          hire_me_visible?: boolean;
          id: string;
          primary_profession_id?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string | null;
          handle?: string;
          hire_me_url?: string | null;
          hire_me_visible?: boolean;
          id?: string;
          primary_profession_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_primary_profession_fk";
            columns: ["primary_profession_id"];
            isOneToOne: false;
            referencedRelation: "professions";
            referencedColumns: ["id"];
          },
        ];
      };
      workflows: {
        Row: {
          author_id: string;
          created_at: string;
          fork_count: number;
          id: string;
          last_verified_at: string | null;
          parent_id: string | null;
          profession_id: string;
          published_at: string | null;
          status: Database["public"]["Enums"]["workflow_status"];
          summary: string | null;
          title: string;
          tried_count: number;
          updated_at: string;
          worked_score: number;
        };
        Insert: {
          author_id: string;
          created_at?: string;
          fork_count?: number;
          id?: string;
          last_verified_at?: string | null;
          parent_id?: string | null;
          profession_id: string;
          published_at?: string | null;
          status?: Database["public"]["Enums"]["workflow_status"];
          summary?: string | null;
          title: string;
          tried_count?: number;
          updated_at?: string;
          worked_score?: number;
        };
        Update: {
          author_id?: string;
          created_at?: string;
          fork_count?: number;
          id?: string;
          last_verified_at?: string | null;
          parent_id?: string | null;
          profession_id?: string;
          published_at?: string | null;
          status?: Database["public"]["Enums"]["workflow_status"];
          summary?: string | null;
          title?: string;
          tried_count?: number;
          updated_at?: string;
          worked_score?: number;
        };
        Relationships: [
          {
            foreignKeyName: "workflows_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflows_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "workflows";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflows_profession_id_fkey";
            columns: ["profession_id"];
            isOneToOne: false;
            referencedRelation: "professions";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      generate_unique_handle: { Args: { seed: string }; Returns: string };
      is_profession_moderator: {
        Args: { prof_id: string; uid: string };
        Returns: boolean;
      };
      replace_ai_stack: { Args: { items: Json }; Returns: undefined };
    };
    Enums: {
      profession_role: "member" | "verified_pro" | "moderator";
      workflow_status: "draft" | "published";
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
    Enums: {
      profession_role: ["member", "verified_pro", "moderator"],
      workflow_status: ["draft", "published"],
    },
  },
} as const;
