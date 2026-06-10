import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Player = {
  id: string
  name: string
  pin: string
  avatar_url: string | null
  total_points: number
  game_points: number
  achievement_points: number
  steps_points: number
  heart_rate_points: number
  bonus_points: number
}

export type Game = {
  id: string
  title: string
  created_at: string
}

export type GameRound = {
  id: string
  game_id: string
  round_number: number
  place_1_points: number
  place_2_points: number
  place_3_points: number
  place_4_points: number
  place_5_points: number
  place_6_points: number
  place_7_points: number
  place_8_points: number
}
