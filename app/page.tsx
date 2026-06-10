'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

type PublicPlayer = {
  id: string
  name: string
  total_points: number
  game_points: number
  achievement_points: number
  steps_points: number
  heart_rate_points: number
  bonus_points: number
}

type Game = {
  id: string
  title: string
  created_at: string
}

type Round = {
  id: string
  game_id: string
  round_number: number
}

export default function PublicHomePage() {
  const [players, setPlayers] = useState<PublicPlayer[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [loading, setLoading] = useState(true)

  const topPlayers = useMemo(() => players.slice(0, 8), [players])
  const totalRounds = rounds.length

  async function loadPublicData() {
    setLoading(true)

    const [leaderboardRes, gamesRes, roundsRes] = await Promise.all([
      supabase
        .from('leaderboard')
        .select('id,name,total_points,game_points,achievement_points,steps_points,heart_rate_points,bonus_points')
        .order('total_points', { ascending: false }),
      supabase.from('games').select('id,title,created_at').order('created_at', { ascending: true }),
      supabase.from('game_rounds').select('id,game_id,round_number').order('round_number', { ascending: true }),
    ])

    if (!leaderboardRes.error) setPlayers((leaderboardRes.data || []) as PublicPlayer[])
    if (!gamesRes.error) setGames((gamesRes.data || []) as Game[])
    if (!roundsRes.error) setRounds((roundsRes.data || []) as Round[])

    setLoading(false)
  }

  useEffect(() => {
    loadPublicData()

    const channel = supabase
      .channel('public-home-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, loadPublicData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, loadPublicData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_rounds' }, loadPublicData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'point_events' }, loadPublicData)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <main className="min-h-screen py-6 md:py-10">
      <div className="mad-shell space-y-6">
        <header className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
          <div>
            <p className="mad-kicker">MAD CAMP Games</p>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight mt-2">Лагерен турнир</h1>
            <p className="mad-muted mt-3 max-w-2xl">
              Публична класация в реално време. Тук няма PIN кодове, лични бележки или история защо някой е получил точки.
            </p>
          </div>

          <nav className="flex gap-3">
            <Link href="/profile" className="mad-btn-secondary">Моят профил</Link>
            <Link href="/login" className="mad-btn">Admin</Link>
          </nav>
        </header>

        <section className="grid md:grid-cols-4 gap-4">
          <div className="mad-card p-5">
            <p className="mad-muted">Участници</p>
            <b className="text-4xl">{players.length}</b>
          </div>
          <div className="mad-card p-5">
            <p className="mad-muted">Игри</p>
            <b className="text-4xl">{games.length}</b>
          </div>
          <div className="mad-card p-5">
            <p className="mad-muted">Рундове</p>
            <b className="text-4xl">{totalRounds}</b>
          </div>
          <div className="mad-card p-5">
            <p className="mad-muted">Лидер</p>
            <b className="text-2xl">{topPlayers[0]?.name || '—'}</b>
          </div>
        </section>

        <section className="grid lg:grid-cols-[1.25fr_0.75fr] gap-6">
          <div className="mad-card p-5 md:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-black">Класация</h2>
              {loading && <span className="text-sm mad-muted">Обновяване...</span>}
            </div>

            <div className="space-y-3">
              {topPlayers.map((player, index) => {
                const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : ''

                return (
                  <div key={player.id} className="mad-card-solid p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`mad-rank-badge ${rankClass}`}>{index + 1}</div>
                      <div>
                        <p className="font-black text-lg">{player.name}</p>
                        <p className="text-sm mad-muted">Общо точки</p>
                      </div>
                    </div>
                    <b className="text-3xl">{player.total_points || 0}</b>
                  </div>
                )
              })}

              {!players.length && (
                <div className="mad-card-solid p-5 text-center mad-muted">
                  Все още няма участници или точки.
                </div>
              )}
            </div>
          </div>

          <div className="mad-card p-5 md:p-6 space-y-4">
            <h2 className="text-2xl font-black">Игри</h2>
            <div className="space-y-3">
              {games.map(game => {
                const gameRounds = rounds.filter(round => round.game_id === game.id)
                return (
                  <div key={game.id} className="mad-card-solid p-4">
                    <p className="font-black">{game.title}</p>
                    <p className="text-sm mad-muted">{gameRounds.length} рунда</p>
                  </div>
                )
              })}
              {!games.length && <p className="mad-muted">Все още няма добавени игри.</p>}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
