export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_events: {
        Row: {
          action: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          payload: Json
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          payload?: Json
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          payload?: Json
          user_id?: string
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          created_at: string
          description: string | null
          direction_id: string
          ends_on: string
          id: string
          name: string
          objective: string
          starts_on: string
          status: string
          success_criteria: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          direction_id: string
          ends_on: string
          id?: string
          name: string
          objective: string
          starts_on: string
          status?: string
          success_criteria?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          direction_id?: string
          ends_on?: string
          id?: string
          name?: string
          objective?: string
          starts_on?: string
          status?: string
          success_criteria?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_direction_same_owner"
            columns: ["direction_id", "user_id"]
            isOneToOne: false
            referencedRelation: "directions"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      curiosities: {
        Row: {
          area: string | null
          created_at: string
          description: string | null
          id: string
          potential: string | null
          promoted_mission_id: string | null
          reason: string | null
          state: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          area?: string | null
          created_at?: string
          description?: string | null
          id?: string
          potential?: string | null
          promoted_mission_id?: string | null
          reason?: string | null
          state?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          area?: string | null
          created_at?: string
          description?: string | null
          id?: string
          potential?: string | null
          promoted_mission_id?: string | null
          reason?: string | null
          state?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "curiosities_promoted_mission_same_owner"
            columns: ["promoted_mission_id", "user_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      cycles: {
        Row: {
          closed_at: string | null
          created_at: string
          ends_on: string
          id: string
          label: string
          starts_on: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          ends_on: string
          id?: string
          label: string
          starts_on: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          ends_on?: string
          id?: string
          label?: string
          starts_on?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      directions: {
        Row: {
          created_at: string
          ended_on: string | null
          id: string
          started_on: string
          statement: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ended_on?: string | null
          id?: string
          started_on?: string
          statement?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ended_on?: string | null
          id?: string
          started_on?: string
          statement?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      knowledge_links: {
        Row: {
          created_at: string
          from_note_id: string
          id: string
          relation: string
          to_note_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          from_note_id: string
          id?: string
          relation?: string
          to_note_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          from_note_id?: string
          id?: string
          relation?: string
          to_note_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_links_from_same_owner"
            columns: ["from_note_id", "user_id"]
            isOneToOne: false
            referencedRelation: "knowledge_notes"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "knowledge_links_to_same_owner"
            columns: ["to_note_id", "user_id"]
            isOneToOne: false
            referencedRelation: "knowledge_notes"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      knowledge_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          mission_id: string | null
          note_type: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          mission_id?: string | null
          note_type?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          mission_id?: string | null
          note_type?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_notes_mission_same_owner"
            columns: ["mission_id", "user_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      mission_dod_criteria: {
        Row: {
          created_at: string
          description: string
          id: string
          mission_id: string
          position: number
          satisfied_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          mission_id: string
          position?: number
          satisfied_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          mission_id?: string
          position?: number
          satisfied_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_dod_criteria_mission_same_owner"
            columns: ["mission_id", "user_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      mission_evidence: {
        Row: {
          created_at: string
          criterion_id: string | null
          description: string
          id: string
          mission_id: string
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          criterion_id?: string | null
          description: string
          id?: string
          mission_id: string
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          criterion_id?: string | null
          description?: string
          id?: string
          mission_id?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_evidence_criterion_same_mission"
            columns: ["criterion_id", "mission_id"]
            isOneToOne: false
            referencedRelation: "mission_dod_criteria"
            referencedColumns: ["id", "mission_id"]
          },
          {
            foreignKeyName: "mission_evidence_mission_same_owner"
            columns: ["mission_id", "user_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      mission_reviews: {
        Row: {
          created_at: string
          id: string
          justification: string
          mission_id: string
          outcome: string
          reason_category: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          justification: string
          mission_id: string
          outcome: string
          reason_category: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          justification?: string
          mission_id?: string
          outcome?: string
          reason_category?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_reviews_mission_same_owner"
            columns: ["mission_id", "user_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      mission_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          mission_id: string
          note: string | null
          source: string
          started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          mission_id: string
          note?: string | null
          source?: string
          started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          mission_id?: string
          note?: string | null
          source?: string
          started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_sessions_mission_same_owner"
            columns: ["mission_id", "user_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      missions: {
        Row: {
          activated_at: string | null
          campaign_id: string
          completed_at: string | null
          created_at: string
          cycle_id: string
          description: string | null
          id: string
          min_load_minutes: number
          priority: number
          reason: string
          status: string
          target_load_minutes: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          campaign_id: string
          completed_at?: string | null
          created_at?: string
          cycle_id: string
          description?: string | null
          id?: string
          min_load_minutes: number
          priority?: number
          reason: string
          status?: string
          target_load_minutes: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          campaign_id?: string
          completed_at?: string | null
          created_at?: string
          cycle_id?: string
          description?: string | null
          id?: string
          min_load_minutes?: number
          priority?: number
          reason?: string
          status?: string
          target_load_minutes?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "missions_campaign_same_owner"
            columns: ["campaign_id", "user_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "missions_cycle_same_owner"
            columns: ["cycle_id", "user_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      rule_events: {
        Row: {
          context: Json
          created_at: string
          id: string
          outcome: string
          rule_code: string
          user_id: string
        }
        Insert: {
          context?: Json
          created_at?: string
          id?: string
          outcome: string
          rule_code: string
          user_id: string
        }
        Update: {
          context?: Json
          created_at?: string
          id?: string
          outcome?: string
          rule_code?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rule_events_rule_code_fkey"
            columns: ["rule_code"]
            isOneToOne: false
            referencedRelation: "rules"
            referencedColumns: ["code"]
          },
        ]
      }
      rules: {
        Row: {
          active: boolean
          code: string
          enforcement: string
          position: number
          severity: string
        }
        Insert: {
          active?: boolean
          code: string
          enforcement: string
          position?: number
          severity: string
        }
        Update: {
          active?: boolean
          code?: string
          enforcement?: string
          position?: number
          severity?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_mission: {
        Args: { p_mission_id: string }
        Returns: {
          activated_at: string | null
          campaign_id: string
          completed_at: string | null
          created_at: string
          cycle_id: string
          description: string | null
          id: string
          min_load_minutes: number
          priority: number
          reason: string
          status: string
          target_load_minutes: number
          title: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "missions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      close_cycle: {
        Args: { p_cycle_id: string }
        Returns: {
          closed_at: string | null
          created_at: string
          ends_on: string
          id: string
          label: string
          starts_on: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "cycles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_mission: {
        Args: { p_mission_id: string }
        Returns: {
          activated_at: string | null
          campaign_id: string
          completed_at: string | null
          created_at: string
          cycle_id: string
          description: string | null
          id: string
          min_load_minutes: number
          priority: number
          reason: string
          status: string
          target_load_minutes: number
          title: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "missions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      promote_curiosity_to_mission: {
        Args: {
          p_campaign_id: string
          p_curiosity_id: string
          p_min_load_minutes: number
          p_reason: string
          p_target_load_minutes: number
          p_title: string
        }
        Returns: {
          activated_at: string | null
          campaign_id: string
          completed_at: string | null
          created_at: string
          cycle_id: string
          description: string | null
          id: string
          min_load_minutes: number
          priority: number
          reason: string
          status: string
          target_load_minutes: number
          title: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "missions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      raise_not_found: { Args: { p_message: string }; Returns: undefined }
      raise_rule_violation: {
        Args: { p_message: string; p_rule_code: string }
        Returns: undefined
      }
      review_mission: {
        Args: {
          p_justification: string
          p_mission_id: string
          p_outcome: string
          p_reason_category: string
        }
        Returns: {
          activated_at: string | null
          campaign_id: string
          completed_at: string | null
          created_at: string
          cycle_id: string
          description: string | null
          id: string
          min_load_minutes: number
          priority: number
          reason: string
          status: string
          target_load_minutes: number
          title: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "missions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_criterion_satisfied: {
        Args: { p_criterion_id: string; p_satisfied: boolean }
        Returns: {
          created_at: string
          description: string
          id: string
          mission_id: string
          position: number
          satisfied_at: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "mission_dod_criteria"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      stop_mission_session: {
        Args: { p_note?: string; p_session_id: string }
        Returns: {
          created_at: string
          ended_at: string | null
          id: string
          mission_id: string
          note: string | null
          source: string
          started_at: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "mission_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

