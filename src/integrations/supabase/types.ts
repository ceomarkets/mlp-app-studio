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
      order_items: {
        Row: {
          affiliate_amount: number
          affiliate_id: string | null
          created_at: string
          delivered_at: string | null
          fulfillment: string
          id: string
          order_id: string
          paid_at: string | null
          platform_amount: number
          product_emoji: string
          product_id: string | null
          product_image: string | null
          product_name: string
          qty: number
          seller_amount: number
          store_id: string
          subtotal: number
          tracking: string | null
          unit_price: number
        }
        Insert: {
          affiliate_amount?: number
          affiliate_id?: string | null
          created_at?: string
          delivered_at?: string | null
          fulfillment?: string
          id?: string
          order_id: string
          paid_at?: string | null
          platform_amount: number
          product_emoji?: string
          product_id?: string | null
          product_image?: string | null
          product_name: string
          qty: number
          seller_amount: number
          store_id: string
          subtotal: number
          tracking?: string | null
          unit_price: number
        }
        Update: {
          affiliate_amount?: number
          affiliate_id?: string | null
          created_at?: string
          delivered_at?: string | null
          fulfillment?: string
          id?: string
          order_id?: string
          paid_at?: string | null
          platform_amount?: number
          product_emoji?: string
          product_id?: string | null
          product_image?: string | null
          product_name?: string
          qty?: number
          seller_amount?: number
          store_id?: string
          subtotal?: number
          tracking?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          affiliate_id: string | null
          buyer_id: string
          created_at: string
          id: string
          paid_at: string | null
          reference: string
          shipping: Json
          status: string
          total: number
          wompi_transaction_id: string | null
        }
        Insert: {
          affiliate_id?: string | null
          buyer_id: string
          created_at?: string
          id?: string
          paid_at?: string | null
          reference: string
          shipping: Json
          status?: string
          total: number
          wompi_transaction_id?: string | null
        }
        Update: {
          affiliate_id?: string | null
          buyer_id?: string
          created_at?: string
          id?: string
          paid_at?: string | null
          reference?: string
          shipping?: Json
          status?: string
          total?: number
          wompi_transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          category: string
          commission: number
          created_at: string
          description: string
          emoji: string
          id: string
          images: string[]
          name: string
          price: number
          rating: number
          rating_count: number
          sold_count: number
          stock: number
          store_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: string
          commission?: number
          created_at?: string
          description?: string
          emoji?: string
          id?: string
          images?: string[]
          name: string
          price: number
          rating?: number
          rating_count?: number
          sold_count?: number
          stock?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          commission?: number
          created_at?: string
          description?: string
          emoji?: string
          id?: string
          images?: string[]
          name?: string
          price?: number
          rating?: number
          rating_count?: number
          sold_count?: number
          stock?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          phone: string | null
          username: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          username?: string | null
        }
        Relationships: []
      }
      referral_clicks: {
        Row: {
          affiliate_id: string
          created_at: string
          id: number
          product_id: string | null
        }
        Insert: {
          affiliate_id: string
          created_at?: string
          id?: number
          product_id?: string | null
        }
        Update: {
          affiliate_id?: string
          created_at?: string
          id?: number
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_clicks_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_clicks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          author: string
          comment: string
          created_at: string
          id: string
          product_id: string
          rating: number
          user_id: string
        }
        Insert: {
          author?: string
          comment?: string
          created_at?: string
          id?: string
          product_id: string
          rating: number
          user_id: string
        }
        Update: {
          author?: string
          comment?: string
          created_at?: string
          id?: string
          product_id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          active: boolean
          city: string
          created_at: string
          emoji: string
          id: string
          name: string
          owner_id: string
          slug: string
          tagline: string
          whatsapp: string | null
        }
        Insert: {
          active?: boolean
          city?: string
          created_at?: string
          emoji?: string
          id?: string
          name: string
          owner_id: string
          slug: string
          tagline?: string
          whatsapp?: string | null
        }
        Update: {
          active?: boolean
          city?: string
          created_at?: string
          emoji?: string
          id?: string
          name?: string
          owner_id?: string
          slug?: string
          tagline?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stores_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawals: {
        Row: {
          account: string
          amount: number
          created_at: string
          id: string
          method: string
          status: string
          user_id: string
        }
        Insert: {
          account: string
          amount: number
          created_at?: string
          id?: string
          method: string
          status?: string
          user_id: string
        }
        Update: {
          account?: string
          amount?: number
          created_at?: string
          id?: string
          method?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      affiliate_max: { Args: never; Returns: number }
      affiliate_min: { Args: never; Returns: number }
      create_order: {
        Args: { p_items: Json; p_ref: string; p_shipping: Json }
        Returns: {
          order_id: string
          reference: string
          total: number
        }[]
      }
      hold_days: { Args: never; Returns: number }
      is_order_buyer: { Args: { p_order_id: string }; Returns: boolean }
      is_order_seller: { Args: { p_order_id: string }; Returns: boolean }
      mark_order_failed: {
        Args: { p_reference: string; p_transaction_id: string }
        Returns: string
      }
      mark_order_paid: {
        Args: {
          p_amount_in_cents: number
          p_reference: string
          p_transaction_id: string
        }
        Returns: string
      }
      min_withdrawal: { Args: never; Returns: number }
      my_wallet: {
        Args: never
        Returns: {
          available: number
          pending: number
          withdrawn: number
        }[]
      }
      platform_rate: { Args: never; Returns: number }
      request_withdrawal: {
        Args: { p_account: string; p_amount: number; p_method: string }
        Returns: string
      }
      set_fulfillment: {
        Args: { p_item_id: string; p_status: string; p_tracking?: string }
        Returns: undefined
      }
      track_click: {
        Args: { p_product_id: string; p_username: string }
        Returns: boolean
      }
      username_available: { Args: { p_username: string }; Returns: boolean }
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
