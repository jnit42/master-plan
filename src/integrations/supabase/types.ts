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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      decisions: {
        Row: {
          created_at: string
          decision_type: string
          description: string | null
          evidence: Json | null
          id: string
          line_id_a: string | null
          line_id_b: string | null
          project_id: string
          quote_id_a: string | null
          quote_id_b: string | null
          resolution: string | null
          resolved: boolean | null
          resolved_at: string | null
          title: string
        }
        Insert: {
          created_at?: string
          decision_type: string
          description?: string | null
          evidence?: Json | null
          id?: string
          line_id_a?: string | null
          line_id_b?: string | null
          project_id: string
          quote_id_a?: string | null
          quote_id_b?: string | null
          resolution?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          title: string
        }
        Update: {
          created_at?: string
          decision_type?: string
          description?: string | null
          evidence?: Json | null
          id?: string
          line_id_a?: string | null
          line_id_b?: string | null
          project_id?: string
          quote_id_a?: string | null
          quote_id_b?: string | null
          resolution?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "decisions_line_id_a_fkey"
            columns: ["line_id_a"]
            isOneToOne: false
            referencedRelation: "lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_line_id_b_fkey"
            columns: ["line_id_b"]
            isOneToOne: false
            referencedRelation: "lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_quote_id_a_fkey"
            columns: ["quote_id_a"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_quote_id_b_fkey"
            columns: ["quote_id_b"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      gaps: {
        Row: {
          confidence: Database["public"]["Enums"]["confidence_level"] | null
          created_at: string
          description: string
          estimated_high: number | null
          estimated_low: number | null
          estimated_mid: number | null
          id: string
          project_id: string
          rate_source: string | null
          resolved: boolean | null
          resolved_by_quote_id: string | null
          scope_tag: string
          source: string | null
          updated_at: string
        }
        Insert: {
          confidence?: Database["public"]["Enums"]["confidence_level"] | null
          created_at?: string
          description: string
          estimated_high?: number | null
          estimated_low?: number | null
          estimated_mid?: number | null
          id?: string
          project_id: string
          rate_source?: string | null
          resolved?: boolean | null
          resolved_by_quote_id?: string | null
          scope_tag: string
          source?: string | null
          updated_at?: string
        }
        Update: {
          confidence?: Database["public"]["Enums"]["confidence_level"] | null
          created_at?: string
          description?: string
          estimated_high?: number | null
          estimated_low?: number | null
          estimated_mid?: number | null
          id?: string
          project_id?: string
          rate_source?: string | null
          resolved?: boolean | null
          resolved_by_quote_id?: string | null
          scope_tag?: string
          source?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gaps_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gaps_resolved_by_quote_id_fkey"
            columns: ["resolved_by_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      lines: {
        Row: {
          amount: number | null
          created_at: string
          description: string
          id: string
          line_type: Database["public"]["Enums"]["line_type"] | null
          match_confidence: number | null
          match_evidence: string | null
          matched_line_id: string | null
          notes: string | null
          quantity: number | null
          quote_id: string
          scope_tag: string | null
          status: Database["public"]["Enums"]["quote_status"] | null
          unit: string | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          description: string
          id?: string
          line_type?: Database["public"]["Enums"]["line_type"] | null
          match_confidence?: number | null
          match_evidence?: string | null
          matched_line_id?: string | null
          notes?: string | null
          quantity?: number | null
          quote_id: string
          scope_tag?: string | null
          status?: Database["public"]["Enums"]["quote_status"] | null
          unit?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          description?: string
          id?: string
          line_type?: Database["public"]["Enums"]["line_type"] | null
          match_confidence?: number | null
          match_evidence?: string | null
          matched_line_id?: string | null
          notes?: string | null
          quantity?: number | null
          quote_id?: string
          scope_tag?: string | null
          status?: Database["public"]["Enums"]["quote_status"] | null
          unit?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lines_matched_line_id_fkey"
            columns: ["matched_line_id"]
            isOneToOne: false
            referencedRelation: "lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lines_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          confidence: Database["public"]["Enums"]["confidence_level"] | null
          created_at: string
          freight: number | null
          id: string
          is_wrapper: boolean | null
          linked_quote_evidence: string | null
          linked_vendor_evidence: string | null
          notes: string | null
          parent_quote_id: string | null
          project_id: string
          quote_date: string | null
          quote_number: string | null
          raw_text: string | null
          reconciliation_rule:
            | Database["public"]["Enums"]["reconciliation_rule"]
            | null
          status: Database["public"]["Enums"]["quote_status"] | null
          subtotal: number | null
          tax: number | null
          total: number | null
          updated_at: string
          vendor_name: string
        }
        Insert: {
          confidence?: Database["public"]["Enums"]["confidence_level"] | null
          created_at?: string
          freight?: number | null
          id?: string
          is_wrapper?: boolean | null
          linked_quote_evidence?: string | null
          linked_vendor_evidence?: string | null
          notes?: string | null
          parent_quote_id?: string | null
          project_id: string
          quote_date?: string | null
          quote_number?: string | null
          raw_text?: string | null
          reconciliation_rule?:
            | Database["public"]["Enums"]["reconciliation_rule"]
            | null
          status?: Database["public"]["Enums"]["quote_status"] | null
          subtotal?: number | null
          tax?: number | null
          total?: number | null
          updated_at?: string
          vendor_name: string
        }
        Update: {
          confidence?: Database["public"]["Enums"]["confidence_level"] | null
          created_at?: string
          freight?: number | null
          id?: string
          is_wrapper?: boolean | null
          linked_quote_evidence?: string | null
          linked_vendor_evidence?: string | null
          notes?: string | null
          parent_quote_id?: string | null
          project_id?: string
          quote_date?: string | null
          quote_number?: string | null
          raw_text?: string | null
          reconciliation_rule?:
            | Database["public"]["Enums"]["reconciliation_rule"]
            | null
          status?: Database["public"]["Enums"]["quote_status"] | null
          subtotal?: number | null
          tax?: number | null
          total?: number | null
          updated_at?: string
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_parent_quote_id_fkey"
            columns: ["parent_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ratebook: {
        Row: {
          created_at: string
          description: string | null
          id: string
          last_updated: string | null
          rate_high: number | null
          rate_low: number | null
          rate_mid: number | null
          region: string | null
          scope_tag: string
          source: string | null
          unit: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          last_updated?: string | null
          rate_high?: number | null
          rate_low?: number | null
          rate_mid?: number | null
          region?: string | null
          scope_tag: string
          source?: string | null
          unit?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          last_updated?: string | null
          rate_high?: number | null
          rate_low?: number | null
          rate_mid?: number | null
          region?: string | null
          scope_tag?: string
          source?: string | null
          unit?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      confidence_level: "HIGH" | "MEDIUM" | "LOW"
      line_type: "MATERIAL" | "LABOR" | "MATERIAL_AND_LABOR" | "OTHER"
      quote_status:
        | "VERIFIED"
        | "PENDING"
        | "POTENTIAL_DUPLICATE"
        | "DECISION_REQUIRED"
        | "ESTIMATE"
        | "GAP"
      reconciliation_rule: "AUTHORITATIVE" | "ADDITIVE" | "REFERENCE_ONLY"
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
      confidence_level: ["HIGH", "MEDIUM", "LOW"],
      line_type: ["MATERIAL", "LABOR", "MATERIAL_AND_LABOR", "OTHER"],
      quote_status: [
        "VERIFIED",
        "PENDING",
        "POTENTIAL_DUPLICATE",
        "DECISION_REQUIRED",
        "ESTIMATE",
        "GAP",
      ],
      reconciliation_rule: ["AUTHORITATIVE", "ADDITIVE", "REFERENCE_ONLY"],
    },
  },
} as const
