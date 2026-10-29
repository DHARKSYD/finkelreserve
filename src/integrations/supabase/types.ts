// Hand-maintained to match supabase/migrations/*.sql. Once you have your
// own Supabase project linked, regenerate this from the real schema with:
//   npx supabase gen types typescript --linked > src/integrations/supabase/types.ts
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      activity_log: {
        Row: {
          created_at: string;
          entity_id: string | null;
          entity_type: string | null;
          id: string;
          message: string;
          metadata: Json | null;
          type: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          message: string;
          metadata?: Json | null;
          type: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          message?: string;
          metadata?: Json | null;
          type?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      coupon_redemptions: {
        Row: {
          amount_off: number;
          coupon_id: string;
          created_at: string;
          customer_email: string;
          id: string;
          order_id: string;
        };
        Insert: {
          amount_off: number;
          coupon_id: string;
          created_at?: string;
          customer_email: string;
          id?: string;
          order_id: string;
        };
        Update: {
          amount_off?: number;
          coupon_id?: string;
          created_at?: string;
          customer_email?: string;
          id?: string;
          order_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey";
            columns: ["coupon_id"];
            isOneToOne: false;
            referencedRelation: "coupons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coupon_redemptions_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      coupons: {
        Row: {
          active: boolean;
          applicable_categories: string[] | null;
          applicable_product_ids: string[] | null;
          code: string;
          created_at: string;
          expires_at: string | null;
          first_order_only: boolean;
          free_shipping: boolean;
          id: string;
          max_discount_amount: number | null;
          min_order_amount: number | null;
          per_customer_limit: number | null;
          starts_at: string | null;
          type: string;
          updated_at: string;
          usage_count: number;
          usage_limit: number | null;
          value: number;
        };
        Insert: {
          active?: boolean;
          applicable_categories?: string[] | null;
          applicable_product_ids?: string[] | null;
          code: string;
          created_at?: string;
          expires_at?: string | null;
          first_order_only?: boolean;
          free_shipping?: boolean;
          id?: string;
          max_discount_amount?: number | null;
          min_order_amount?: number | null;
          per_customer_limit?: number | null;
          starts_at?: string | null;
          type: string;
          updated_at?: string;
          usage_count?: number;
          usage_limit?: number | null;
          value: number;
        };
        Update: {
          active?: boolean;
          applicable_categories?: string[] | null;
          applicable_product_ids?: string[] | null;
          code?: string;
          created_at?: string;
          expires_at?: string | null;
          first_order_only?: boolean;
          free_shipping?: boolean;
          id?: string;
          max_discount_amount?: number | null;
          min_order_amount?: number | null;
          per_customer_limit?: number | null;
          starts_at?: string | null;
          type?: string;
          updated_at?: string;
          usage_count?: number;
          usage_limit?: number | null;
          value?: number;
        };
        Relationships: [];
      };
      contact_messages: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          message: string;
          name: string;
          topic: string | null;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          message: string;
          name: string;
          topic?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          message?: string;
          name?: string;
          topic?: string | null;
        };
        Relationships: [];
      };
      newsletter_subscribers: {
        Row: {
          created_at: string;
          email: string;
          id: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          image: string | null;
          name: string;
          order_id: string;
          price: number;
          product_id: string | null;
          qty: number;
          size: string | null;
          bottles_per_unit: number;
          unit: string;
        };
        Insert: {
          id?: string;
          image?: string | null;
          name: string;
          order_id: string;
          price: number;
          product_id?: string | null;
          qty: number;
          size?: string | null;
          bottles_per_unit?: number;
          unit?: string;
        };
        Update: {
          id?: string;
          image?: string | null;
          name?: string;
          order_id?: string;
          price?: number;
          product_id?: string | null;
          qty?: number;
          size?: string | null;
          bottles_per_unit?: number;
          unit?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          created_at: string;
          customer_email: string;
          customer_name: string;
          customer_phone: string | null;
          discount: number;
          id: string;
          payment_method: Database["public"]["Enums"]["payment_method"];
          payment_reference: string | null;
          payment_status: Database["public"]["Enums"]["payment_status"];
          shipping: number;
          shipping_address: string;
          status: Database["public"]["Enums"]["order_status"];
          subtotal: number;
          total: number;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          customer_email: string;
          customer_name: string;
          customer_phone?: string | null;
          discount?: number;
          id?: string;
          payment_method?: Database["public"]["Enums"]["payment_method"];
          payment_reference?: string | null;
          payment_status?: Database["public"]["Enums"]["payment_status"];
          shipping?: number;
          shipping_address: string;
          status?: Database["public"]["Enums"]["order_status"];
          subtotal: number;
          total: number;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          customer_email?: string;
          customer_name?: string;
          customer_phone?: string | null;
          discount?: number;
          id?: string;
          payment_method?: Database["public"]["Enums"]["payment_method"];
          payment_reference?: string | null;
          payment_status?: Database["public"]["Enums"]["payment_status"];
          shipping?: number;
          shipping_address?: string;
          status?: Database["public"]["Enums"]["order_status"];
          subtotal?: number;
          total?: number;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      products: {
        Row: {
          bottles_per_box: number | null;
          box_discount_percent: number;
          abv: number | null;
          active: boolean;
          badge: string | null;
          bottle_sizes: string[];
          cost_price: number | null;
          country: string | null;
          created_at: string;
          description: string;
          details: string | null;
          featured: boolean;
          food_pairing: string | null;
          grape_variety: string[];
          highlights: string[] | null;
          id: string;
          images: string[];
          low_stock_threshold: number;
          name: string;
          old_price: number | null;
          price: number;
          producer: string;
          rating: number;
          region: string | null;
          reviews_count: number;
          seo_description: string | null;
          seo_title: string | null;
          sku: string | null;
          slug: string;
          stock: number;
          tags: string[];
          tasting_notes: string | null;
          appearance: string | null;
          nose: string | null;
          palate: string | null;
          finish: string | null;
          serving_notes: string | null;
          cellaring_notes: string | null;
          producer_notes: string | null;
          winemaking_notes: string | null;
          updated_at: string;
          vintage: number | null;
          wine_type: string;
        };
        Insert: {
          bottles_per_box?: number | null;
          box_discount_percent?: number;
          abv?: number | null;
          active?: boolean;
          badge?: string | null;
          bottle_sizes?: string[];
          cost_price?: number | null;
          country?: string | null;
          created_at?: string;
          description?: string;
          details?: string | null;
          featured?: boolean;
          food_pairing?: string | null;
          grape_variety?: string[];
          highlights?: string[] | null;
          id?: string;
          images?: string[];
          low_stock_threshold?: number;
          name: string;
          old_price?: number | null;
          price: number;
          producer: string;
          rating?: number;
          region?: string | null;
          reviews_count?: number;
          seo_description?: string | null;
          seo_title?: string | null;
          sku?: string | null;
          slug: string;
          stock?: number;
          tags?: string[];
          tasting_notes?: string | null;
          appearance?: string | null;
          nose?: string | null;
          palate?: string | null;
          finish?: string | null;
          serving_notes?: string | null;
          cellaring_notes?: string | null;
          producer_notes?: string | null;
          winemaking_notes?: string | null;
          updated_at?: string;
          vintage?: number | null;
          wine_type: string;
        };
        Update: {
          bottles_per_box?: number | null;
          box_discount_percent?: number;
          abv?: number | null;
          active?: boolean;
          badge?: string | null;
          bottle_sizes?: string[];
          cost_price?: number | null;
          country?: string | null;
          created_at?: string;
          description?: string;
          details?: string | null;
          featured?: boolean;
          food_pairing?: string | null;
          grape_variety?: string[];
          highlights?: string[] | null;
          id?: string;
          images?: string[];
          low_stock_threshold?: number;
          name?: string;
          old_price?: number | null;
          price?: number;
          producer?: string;
          rating?: number;
          region?: string | null;
          reviews_count?: number;
          seo_description?: string | null;
          seo_title?: string | null;
          sku?: string | null;
          slug?: string;
          stock?: number;
          tags?: string[];
          tasting_notes?: string | null;
          appearance?: string | null;
          nose?: string | null;
          palate?: string | null;
          finish?: string | null;
          serving_notes?: string | null;
          cellaring_notes?: string | null;
          producer_notes?: string | null;
          winemaking_notes?: string | null;
          updated_at?: string;
          vintage?: number | null;
          wine_type?: string;
        };
        Relationships: [];
      };
      product_variants: {
        Row: {
          created_at: string;
          id: string;
          image: string | null;
          price_override: number | null;
          product_id: string;
          size: string;
          sku: string | null;
          stock: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          image?: string | null;
          price_override?: number | null;
          product_id: string;
          size: string;
          sku?: string | null;
          stock?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          image?: string | null;
          price_override?: number | null;
          product_id?: string;
          size?: string;
          sku?: string | null;
          stock?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_movements: {
        Row: {
          actor_id: string | null;
          created_at: string;
          delta: number;
          id: string;
          import_batch_id: string | null;
          new_stock: number;
          previous_stock: number;
          product_id: string | null;
          reason: string | null;
          source: string;
          variant_id: string | null;
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          delta: number;
          id?: string;
          import_batch_id?: string | null;
          new_stock: number;
          previous_stock: number;
          product_id?: string | null;
          reason?: string | null;
          source: string;
          variant_id?: string | null;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          delta?: number;
          id?: string;
          import_batch_id?: string | null;
          new_stock?: number;
          previous_stock?: number;
          product_id?: string | null;
          reason?: string | null;
          source?: string;
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_movements_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      refunds: {
        Row: {
          actor_id: string | null;
          amount: number;
          created_at: string;
          gateway_reference: string | null;
          gateway_status: string | null;
          id: string;
          method: string;
          order_id: string;
          reason: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          actor_id?: string | null;
          amount: number;
          created_at?: string;
          gateway_reference?: string | null;
          gateway_status?: string | null;
          id?: string;
          method: string;
          order_id: string;
          reason?: string | null;
          status: string;
          updated_at?: string;
        };
        Update: {
          actor_id?: string | null;
          amount?: number;
          created_at?: string;
          gateway_reference?: string | null;
          gateway_status?: string | null;
          id?: string;
          method?: string;
          order_id?: string;
          reason?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "refunds_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          created_at: string;
          id: string;
          product_id: string;
          rating: number;
          text: string;
          title: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          product_id: string;
          rating: number;
          text: string;
          title?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          product_id?: string;
          rating?: number;
          text?: string;
          title?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      adjust_product_stock: {
        Args: {
          p_product_id: string;
          p_delta: number;
        };
        Returns: number | null;
      };
      adjust_variant_stock: {
        Args: {
          p_variant_id: string;
          p_delta: number;
        };
        Returns: number | null;
      };
      cancel_order_atomic: {
        Args: {
          p_order_id: string;
          p_actor_id: string;
        };
        Returns: {
          ok: boolean;
          error_message: string | null;
        }[];
      };
      log_admin_activity: {
        Args: {
          p_type: string;
          p_message: string;
          p_entity_type?: string | null;
          p_entity_id?: string | null;
          p_metadata?: Json | null;
          p_actor_id?: string | null;
        };
        Returns: undefined;
      };
      set_variant_stock: {
        Args: {
          p_variant_id: string;
          p_new_stock: number;
          p_actor_id: string;
          p_reason?: string | null;
        };
        Returns: {
          ok: boolean;
          error_message: string | null;
          new_stock: number | null;
        }[];
      };
      apply_inventory_import: {
        Args: {
          p_mode: string;
          p_rows: Json;
          p_actor_id: string;
          p_filename?: string | null;
        };
        Returns: {
          batch_id: string;
          rows_updated: number;
        }[];
      };
      record_refund: {
        Args: {
          p_order_id: string;
          p_amount: number;
          p_reason: string | null;
          p_method: string;
          p_gateway_reference: string | null;
          p_gateway_status: string | null;
          p_status: string;
          p_actor_id: string;
        };
        Returns: {
          refund_id: string;
          order_fully_refunded: boolean;
        }[];
      };
      record_coupon_redemption: {
        Args: {
          p_coupon_id: string;
          p_order_id: string;
          p_customer_email: string;
          p_amount_off: number;
        };
        Returns: boolean;
      };
      update_refund_status: {
        Args: {
          p_gateway_reference: string;
          p_status: string;
          p_gateway_status?: string | null;
        };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: "admin" | "moderator" | "user";
      order_status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
      payment_method: "delivery" | "paystack";
      payment_status: "pending" | "paid" | "failed" | "refunded";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "moderator", "user"],
      order_status: ["pending", "processing", "shipped", "delivered", "cancelled"],
      payment_method: ["delivery", "paystack"],
      payment_status: ["pending", "paid", "failed", "refunded"],
    },
  },
} as const;
