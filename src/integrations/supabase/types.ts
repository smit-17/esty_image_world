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
      audit_logs: {
        Row: {
          action: string
          browser: string | null
          created_at: string
          description: string | null
          device: string | null
          entity_id: string | null
          entity_type: string | null
          failure_reason: string | null
          id: string
          ip_address: string | null
          module: string | null
          new_values: Json | null
          old_values: Json | null
          os: string | null
          request_url: string | null
          session_id: string | null
          success: boolean
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          browser?: string | null
          created_at?: string
          description?: string | null
          device?: string | null
          entity_id?: string | null
          entity_type?: string | null
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          module?: string | null
          new_values?: Json | null
          old_values?: Json | null
          os?: string | null
          request_url?: string | null
          session_id?: string | null
          success?: boolean
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          browser?: string | null
          created_at?: string
          description?: string | null
          device?: string | null
          entity_id?: string | null
          entity_type?: string | null
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          module?: string | null
          new_values?: Json | null
          old_values?: Json | null
          os?: string | null
          request_url?: string | null
          session_id?: string | null
          success?: boolean
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      etsy_accounts: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      finding_activity: {
        Row: {
          activity: string
          created_at: string
          finding_code: string | null
          finding_id: string | null
          id: string
          ip_address: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          activity: string
          created_at?: string
          finding_code?: string | null
          finding_id?: string | null
          id?: string
          ip_address?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          activity?: string
          created_at?: string
          finding_code?: string | null
          finding_id?: string | null
          id?: string
          ip_address?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finding_activity_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "findings"
            referencedColumns: ["id"]
          },
        ]
      }
      finding_options: {
        Row: {
          created_at: string
          id: string
          kind: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          value?: string
        }
        Relationships: []
      }
      finding_team_members: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      findings: {
        Row: {
          assigned_to: string | null
          brand: string | null
          category: string | null
          code: string
          created_at: string
          created_by: string | null
          extra: Json
          finding_by: string | null
          gender: string | null
          id: string
          image_path: string | null
          image_seeds: Json
          main_image: string | null
          note: string | null
          platform: string
          priority: string
          product_url: string | null
          source_sku: string | null
          status: string
          style: string | null
          thumb_path: string | null
          title: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assigned_to?: string | null
          brand?: string | null
          category?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          extra?: Json
          finding_by?: string | null
          gender?: string | null
          id?: string
          image_path?: string | null
          image_seeds?: Json
          main_image?: string | null
          note?: string | null
          platform?: string
          priority?: string
          product_url?: string | null
          source_sku?: string | null
          status?: string
          style?: string | null
          thumb_path?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assigned_to?: string | null
          brand?: string | null
          category?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          extra?: Json
          finding_by?: string | null
          gender?: string | null
          id?: string
          image_path?: string | null
          image_seeds?: Json
          main_image?: string | null
          note?: string | null
          platform?: string
          priority?: string
          product_url?: string | null
          source_sku?: string | null
          status?: string
          style?: string | null
          thumb_path?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      permissions: {
        Row: {
          action: string
          code: string
          created_at: string
          description: string | null
          id: string
          module: string
        }
        Insert: {
          action: string
          code: string
          created_at?: string
          description?: string | null
          id?: string
          module: string
        }
        Update: {
          action?: string
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          module?: string
        }
        Relationships: []
      }
      product_estimates: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          diamond_type: string | null
          diamonds: Json
          gold_weight: number
          id: string
          metal_colour: string | null
          metal_karat: string | null
          metal_type: string | null
          product_id: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          diamond_type?: string | null
          diamonds?: Json
          gold_weight?: number
          id?: string
          metal_colour?: string | null
          metal_karat?: string | null
          metal_type?: string | null
          product_id: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          diamond_type?: string | null
          diamonds?: Json
          gold_weight?: number
          id?: string
          metal_colour?: string | null
          metal_karat?: string | null
          metal_type?: string | null
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_estimates_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          created_at: string
          id: string
          kind: string
          path: string
          position: number
          product_id: string
          qc_by: string | null
          qc_note: string | null
          qc_reasons: string[]
          qc_status: string
          qc_updated_at: string | null
          size_bytes: number
          source_url: string | null
          thumb_path: string | null
          uploaded_by: string | null
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          path: string
          position?: number
          product_id: string
          qc_by?: string | null
          qc_note?: string | null
          qc_reasons?: string[]
          qc_status?: string
          qc_updated_at?: string | null
          size_bytes?: number
          source_url?: string | null
          thumb_path?: string | null
          uploaded_by?: string | null
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          path?: string
          position?: number
          product_id?: string
          qc_by?: string | null
          qc_note?: string | null
          qc_reasons?: string[]
          qc_status?: string
          qc_updated_at?: string | null
          size_bytes?: number
          source_url?: string | null
          thumb_path?: string | null
          uploaded_by?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          cover_url: string | null
          created_at: string
          created_by: string | null
          etsy_account: string | null
          etsy_listed: boolean
          etsy_listed_at: string | null
          etsy_listed_by: string | null
          etsy_status: string
          etsy_url: string | null
          finding_code: string | null
          finding_id: string | null
          id: string
          is_shared: boolean
          name: string
          notes: string | null
          product_type: string | null
          qc_by: string | null
          qc_status: string
          qc_updated_at: string | null
          reference_url: string | null
          sku: string | null
          source_assigned_to: string | null
          source_brand: string | null
          source_currency: string | null
          source_description: string | null
          source_details: Json
          source_found_by: string | null
          source_listing_id: string | null
          source_platform: string | null
          source_price: string | null
          source_priority: string | null
          source_seller: string | null
          source_sku: string | null
          source_tags: string[]
          source_type: string | null
          source_url: string | null
          subcategory: string | null
          team_member: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category: string
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          etsy_account?: string | null
          etsy_listed?: boolean
          etsy_listed_at?: string | null
          etsy_listed_by?: string | null
          etsy_status?: string
          etsy_url?: string | null
          finding_code?: string | null
          finding_id?: string | null
          id?: string
          is_shared?: boolean
          name: string
          notes?: string | null
          product_type?: string | null
          qc_by?: string | null
          qc_status?: string
          qc_updated_at?: string | null
          reference_url?: string | null
          sku?: string | null
          source_assigned_to?: string | null
          source_brand?: string | null
          source_currency?: string | null
          source_description?: string | null
          source_details?: Json
          source_found_by?: string | null
          source_listing_id?: string | null
          source_platform?: string | null
          source_price?: string | null
          source_priority?: string | null
          source_seller?: string | null
          source_sku?: string | null
          source_tags?: string[]
          source_type?: string | null
          source_url?: string | null
          subcategory?: string | null
          team_member: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          etsy_account?: string | null
          etsy_listed?: boolean
          etsy_listed_at?: string | null
          etsy_listed_by?: string | null
          etsy_status?: string
          etsy_url?: string | null
          finding_code?: string | null
          finding_id?: string | null
          id?: string
          is_shared?: boolean
          name?: string
          notes?: string | null
          product_type?: string | null
          qc_by?: string | null
          qc_status?: string
          qc_updated_at?: string | null
          reference_url?: string | null
          sku?: string | null
          source_assigned_to?: string | null
          source_brand?: string | null
          source_currency?: string | null
          source_description?: string | null
          source_details?: Json
          source_found_by?: string | null
          source_listing_id?: string | null
          source_platform?: string | null
          source_price?: string | null
          source_priority?: string | null
          source_seller?: string | null
          source_sku?: string | null
          source_tags?: string[]
          source_type?: string | null
          source_url?: string | null
          subcategory?: string | null
          team_member?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string | null
          id: string
          mobile: string | null
          status: string
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          mobile?: string | null
          status?: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          mobile?: string | null
          status?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_super_admin: boolean
          is_system: boolean
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_super_admin?: boolean
          is_system?: boolean
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_super_admin?: boolean
          is_system?: boolean
          name?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          allowed: boolean
          assigned_at: string
          assigned_by: string | null
          id: string
          permission_id: string
          user_id: string
        }
        Insert: {
          allowed?: boolean
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          permission_id: string
          user_id: string
        }
        Update: {
          allowed?: boolean
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          permission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          removed_at: string | null
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          removed_at?: string | null
          role_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          removed_at?: string | null
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          new_status: string
          old_status: string | null
          reason: string | null
          user_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status: string
          old_status?: string | null
          reason?: string | null
          user_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status?: string
          old_status?: string | null
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ensure_profile: {
        Args: { _full_name?: string; _mobile?: string; _username?: string }
        Returns: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string | null
          id: string
          mobile: string | null
          status: string
          updated_at: string
          username: string | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_permission: {
        Args: { _code: string; _uid: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _uid: string }; Returns: boolean }
      my_permission_codes: {
        Args: never
        Returns: {
          code: string
        }[]
      }
      set_user_status: {
        Args: { _reason?: string; _status: string; _user_id: string }
        Returns: undefined
      }
      user_is_active: { Args: { _uid: string }; Returns: boolean }
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
  public: {
    Enums: {},
  },
} as const
