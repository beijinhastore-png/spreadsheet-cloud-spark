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
      auditoria: {
        Row: {
          acao: string
          criado_em: string
          detalhes: Json
          id: number
          usuario_email: string | null
          usuario_id: string
        }
        Insert: {
          acao: string
          criado_em?: string
          detalhes?: Json
          id?: number
          usuario_email?: string | null
          usuario_id?: string
        }
        Update: {
          acao?: string
          criado_em?: string
          detalhes?: Json
          id?: number
          usuario_email?: string | null
          usuario_id?: string
        }
        Relationships: []
      }
      cards_liberar: {
        Row: {
          categoria: string | null
          cliente: string | null
          contrato: string | null
          id: number
          plataforma: string | null
          produto: string | null
          valor: number
        }
        Insert: {
          categoria?: string | null
          cliente?: string | null
          contrato?: string | null
          id?: number
          plataforma?: string | null
          produto?: string | null
          valor?: number
        }
        Update: {
          categoria?: string | null
          cliente?: string | null
          contrato?: string | null
          id?: number
          plataforma?: string | null
          produto?: string | null
          valor?: number
        }
        Relationships: []
      }
      clientes_dim: {
        Row: {
          ativo: boolean
          categoria: string | null
          nome: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          nome: string
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          nome?: string
        }
        Relationships: []
      }
      controles_planilha: {
        Row: {
          bloco: string | null
          descricao: string | null
          id: number
          mes: string | null
          valor_planilha: number | null
        }
        Insert: {
          bloco?: string | null
          descricao?: string | null
          id?: number
          mes?: string | null
          valor_planilha?: number | null
        }
        Update: {
          bloco?: string | null
          descricao?: string | null
          id?: number
          mes?: string | null
          valor_planilha?: number | null
        }
        Relationships: []
      }
      fato_mensal: {
        Row: {
          anterior: boolean
          bloco: string
          bu: string | null
          categoria: string | null
          cliente: string | null
          contrato: string | null
          id: number
          item_cobranca: string | null
          mes: string
          nivel: string
          plataforma: string | null
          produto: string | null
          valor: number
        }
        Insert: {
          anterior?: boolean
          bloco: string
          bu?: string | null
          categoria?: string | null
          cliente?: string | null
          contrato?: string | null
          id?: number
          item_cobranca?: string | null
          mes: string
          nivel: string
          plataforma?: string | null
          produto?: string | null
          valor?: number
        }
        Update: {
          anterior?: boolean
          bloco?: string
          bu?: string | null
          categoria?: string | null
          cliente?: string | null
          contrato?: string | null
          id?: number
          item_cobranca?: string | null
          mes?: string
          nivel?: string
          plataforma?: string | null
          produto?: string | null
          valor?: number
        }
        Relationships: []
      }
      importacoes: {
        Row: {
          avisos: Json
          criado_em: string
          erros: Json
          hash_sha256: string | null
          id: number
          nome_arquivo: string | null
          qtd_fatos: number | null
          qtd_negocios: number | null
          qtd_nfs: number | null
          total_faturado: number | null
          usuario_id: string | null
        }
        Insert: {
          avisos?: Json
          criado_em?: string
          erros?: Json
          hash_sha256?: string | null
          id?: number
          nome_arquivo?: string | null
          qtd_fatos?: number | null
          qtd_negocios?: number | null
          qtd_nfs?: number | null
          total_faturado?: number | null
          usuario_id?: string | null
        }
        Update: {
          avisos?: Json
          criado_em?: string
          erros?: Json
          hash_sha256?: string | null
          id?: number
          nome_arquivo?: string | null
          qtd_fatos?: number | null
          qtd_negocios?: number | null
          qtd_nfs?: number | null
          total_faturado?: number | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      negocios: {
        Row: {
          autorizada: boolean | null
          bu: string | null
          cliente: string | null
          codigo: string | null
          criado_em: string
          data_competencia: string | null
          ganho_em: string | null
          id_pipe: string
          plataforma: string | null
          razao_social: string | null
          status: string | null
          tipo_contrato: string | null
          titulo: string | null
          valor: number | null
        }
        Insert: {
          autorizada?: boolean | null
          bu?: string | null
          cliente?: string | null
          codigo?: string | null
          criado_em?: string
          data_competencia?: string | null
          ganho_em?: string | null
          id_pipe: string
          plataforma?: string | null
          razao_social?: string | null
          status?: string | null
          tipo_contrato?: string | null
          titulo?: string | null
          valor?: number | null
        }
        Update: {
          autorizada?: boolean | null
          bu?: string | null
          cliente?: string | null
          codigo?: string | null
          criado_em?: string
          data_competencia?: string | null
          ganho_em?: string | null
          id_pipe?: string
          plataforma?: string | null
          razao_social?: string | null
          status?: string | null
          tipo_contrato?: string | null
          titulo?: string | null
          valor?: number | null
        }
        Relationships: []
      }
      notas_fiscais: {
        Row: {
          bu: string | null
          card: string | null
          cliente: string | null
          cliente_inferido: boolean
          codigo: string | null
          criado_em: string
          data_competencia: string | null
          data_emissao: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          id_pipe: string | null
          link_nf: string | null
          link_pipe: string | null
          numero_nf: string
          plataforma: string | null
          razao_social: string | null
          regime: string | null
          status: string | null
          tipo_contrato: string | null
          valor: number | null
        }
        Insert: {
          bu?: string | null
          card?: string | null
          cliente?: string | null
          cliente_inferido?: boolean
          codigo?: string | null
          criado_em?: string
          data_competencia?: string | null
          data_emissao?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          id_pipe?: string | null
          link_nf?: string | null
          link_pipe?: string | null
          numero_nf: string
          plataforma?: string | null
          razao_social?: string | null
          regime?: string | null
          status?: string | null
          tipo_contrato?: string | null
          valor?: number | null
        }
        Update: {
          bu?: string | null
          card?: string | null
          cliente?: string | null
          cliente_inferido?: boolean
          codigo?: string | null
          criado_em?: string
          data_competencia?: string | null
          data_emissao?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          id_pipe?: string | null
          link_nf?: string | null
          link_pipe?: string | null
          numero_nf?: string
          plataforma?: string | null
          razao_social?: string | null
          regime?: string | null
          status?: string | null
          tipo_contrato?: string | null
          valor?: number | null
        }
        Relationships: []
      }
      perfis: {
        Row: {
          criado_em: string
          email: string | null
          nome: string | null
          papel: Database["public"]["Enums"]["papel_app"]
          user_id: string
        }
        Insert: {
          criado_em?: string
          email?: string | null
          nome?: string | null
          papel?: Database["public"]["Enums"]["papel_app"]
          user_id: string
        }
        Update: {
          criado_em?: string
          email?: string | null
          nome?: string | null
          papel?: Database["public"]["Enums"]["papel_app"]
          user_id?: string
        }
        Relationships: []
      }
      probe_negocios: {
        Row: {
          id: number
        }
        Insert: {
          id: number
        }
        Update: {
          id?: number
        }
        Relationships: []
      }
      valores_agregados: {
        Row: {
          bu: string | null
          categoria: string | null
          id: number
          mes: string | null
          produto: string | null
          tipo: string
          valor: number
        }
        Insert: {
          bu?: string | null
          categoria?: string | null
          id?: number
          mes?: string | null
          produto?: string | null
          tipo: string
          valor?: number
        }
        Update: {
          bu?: string | null
          categoria?: string | null
          id?: number
          mes?: string | null
          produto?: string | null
          tipo?: string
          valor?: number
        }
        Relationships: []
      }
      visoes_salvas: {
        Row: {
          compartilhada: boolean
          configuracao: Json
          criado_em: string
          filtros: Json
          id: string
          nome: string
          usuario_id: string
        }
        Insert: {
          compartilhada?: boolean
          configuracao?: Json
          criado_em?: string
          filtros?: Json
          id?: string
          nome: string
          usuario_id?: string
        }
        Update: {
          compartilhada?: boolean
          configuracao?: Json
          criado_em?: string
          filtros?: Json
          id?: string
          nome?: string
          usuario_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      pode_escrever: { Args: { _user_id: string }; Returns: boolean }
      substituir_planilha: {
        Args: { p_agregados: Json; p_negocios: Json; p_notas: Json }
        Returns: undefined
      }
      substituir_planilha_v2: {
        Args: {
          p_cards: Json
          p_clientes: Json
          p_controles: Json
          p_fatos: Json
          p_meta: Json
          p_negocios: Json
          p_notas: Json
        }
        Returns: number
      }
      tem_papel: {
        Args: {
          _papel: Database["public"]["Enums"]["papel_app"]
          _user_id: string
        }
        Returns: boolean
      }
      tem_perfil: { Args: { _user_id: string }; Returns: boolean }
      to_data: { Args: { p: string }; Returns: string }
    }
    Enums: {
      papel_app: "admin" | "controladoria" | "leitor"
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
      papel_app: ["admin", "controladoria", "leitor"],
    },
  },
} as const
