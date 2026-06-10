'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

type PublicPlayer = {
  id: string
  name: string
  total_points: number
}

type Game = {
  id: string
  title: string
}

type Round = {
  id: string
  game_id: string
  round_number: number
}

type FeedEvent = {
  id: string
  type: 'game' | 'achievement' | 'steps' | 'heart_rate' | 'bonus' | 'penalty'
  title: string
  points: number
  round_number: number | null
  created_at: string
  players?: { name: string } | null
  games?: { title: string } | null
}

function feedLabel(event: FeedEvent) {
  if (event.type === 'game') {
    return `${event.games?.title || 'Игра'}${event.round_number ? ` · Рунд ${event.round_number}` : ''}`
  }

  if (event.type === 'achievement') return `Achievement · ${event.title}`
  if (event.type === 'steps') return `Крачки · ${event.title}`
  if (event.type === 'heart_rate') return `Пулс · ${event.title}`
  if (event.type === 'bonus') return `Бонус · ${event.title}`
  if (event.type === 'penalty') return `Промяна в точки`

  return event.title
}

export default function PublicHomePage() {
  const [players, setPlayers] = useState<PublicPlayer[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [feed, setFeed] = useState<FeedEvent[]>([])
  const [loading, setLoading] = useState(true)

  const topPlayers = useMemo(() => players.slice(0, 8), [players])
  const finalists = useMemo(() => players.slice(0, 4), [players])
  const nextChallenger = players[4]
  const fourthPlace = players[3]
  const totalRounds = rounds.length

  const cutLineDifference =
    fourthPlace && nextChallenger
      ? Math.max((fourthPlace.total_points || 0) - (nextChallenger.total_points || 0), 0)
      : null

  async function loadPublicData() {
    setLoading(true)

    const [leaderboardRes, gamesRes, roundsRes, feedRes] = await Promise.all([
      supabase
        .from('leaderboard')
        .select('id,name,total_points')
        .order('total_points', { ascending: false }),

      supabase
        .from('games')
        .select('id,title')
        .order('created_at', { ascending: true }),

      supabase
        .from('game_rounds')
        .select('id,game_id,round_number')
        .order('round_number', { ascending: true }),

      supabase
        .from('point_events')
        .select('id,type,title,points,round_number,created_at,players(name),games(title)')
        .neq('type', 'penalty')
        .order('created_at', { ascending: false })
        .limit(15),
    ])

    if (!leaderboardRes.error) setPlayers((leaderboardRes.data || []) as PublicPlayer[])
    if (!gamesRes.error) setGames((gamesRes.data || []) as Game[])
    if (!roundsRes.error) setRounds((roundsRes.data || []) as Round[])
    if (!feedRes.error) setFeed((feedRes.data || []) as FeedEvent[])

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
    <main className="min-h-screen p-4 max-w-7xl mx-auto space-y-6">
      <header className="py-6 flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
        <div>
          <p className="text-sm text-indigo-300 uppercase tracking-[0.25em]">MAD CAMP Games</p>
          <h1 className="text-4xl font-black">Лагерен турнир</h1>
          <p className="text-slate-400 max-w-2xl">
            Публична класация в реално време. Тук няма PIN кодове, лични бележки или лична история на участниците.
          </p>
        </div>

        <div className="flex gap-3">
          <Link href="/profile" className="btn-secondary">Моят профил</Link>
          <Link href="/login" className="btn-secondary">Admin</Link>
        </div>
      </header>

      <section className="grid md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-slate-400">Участници</p>
          <b className="text-3xl">{players.length}</b>
        </div>

        <div className="card">
          <p className="text-slate-400">Игри</p>
          <b className="text-3xl">{games.length}</b>
        </div>

        <div className="card">
          <p className="text-slate-400">Рундове</p>
          <b className="text-3xl">{totalRounds}</b>
        </div>

        <div className="card">
          <p className="text-slate-400">Лидер</p>
          <b className="text-3xl">{topPlayers[0]?.name || '—'}</b>
        </div>
      </section>

      <section className="card space-y-4 border-yellow-500/40">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-yellow-300 uppercase tracking-[0.25em]">Final Zone</p>
            <h2 className="text-2xl font-black">Топ 4 финалисти към момента</h2>
          </div>
          {loading && <span className="text-sm text-slate-400">Обновяване...</span>}
        </div>

        <div className="grid md:grid-cols-4 gap-3">
          {finalists.map((player, index) => (
            <div key={player.id} className="rounded-2xl bg-slate-800/80 border border-slate-700 p-4">
              <p className="text-sm text-slate-400">{index + 1}. място</p>
              <h3 className="text-xl font-black">{player.name}</h3>
              <p className="text-yellow-300 font-bold">{player.total_points || 0} точки</p>
            </div>
          ))}

          {!finalists.length && (
            <p className="text-slate-400">Все още няма достатъчно точки за финалисти.</p>
          )}
        </div>

        {nextChallenger && fourthPlace && cutLineDifference !== null && (
          <div className="rounded-2xl bg-slate-950/70 border border-slate-700 p-4">
            <p className="text-slate-300">
              <b>{nextChallenger.name}</b> е първи извън финала и е само на{' '}
              <b className="text-yellow-300">{cutLineDifference}</b> точки от Топ 4.
            </p>
          </div>
        )}
      </section>

      <section className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
        <div className="card space-y-4">
          <h2 className="text-xl font-black">Класация</h2>

          <div className="space-y-2">
            {topPlayers.map((player, index) => {
              const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : ''

              return (
                <div key={player.id} className="flex items-center justify-between rounded-xl bg-slate-800/70 p-3">
                  <div className="flex items-center gap-3">
                    <div className={`rank ${rankClass}`}>{index + 1}</div>
                    <div>
                      <p className="font-bold">{player.name}</p>
                      <p className="text-sm text-slate-400">Общо точки</p>
                    </div>
                  </div>

                  <b className="text-2xl">{player.total_points || 0}</b>
                </div>
              )
            })}

            {!players.length && (
              <p className="text-slate-400">Все още няма участници или точки.</p>
            )}
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="text-xl font-black">Последни 15 събития</h2>

          <div className="space-y-2">
            {feed.map(event => (
              <div key={event.id} className="rounded-xl bg-slate-800/70 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{event.players?.name || 'Участник'}</p>
                    <p className="text-sm text-slate-400">{feedLabel(event)}</p>
                  </div>

                  <b className={event.points >= 0 ? 'text-green-300' : 'text-red-300'}>
                    {event.points > 0 ? '+' : ''}
                    {event.points}
                  </b>
                </div>
              </div>
            ))}

            {!feed.length && (
              <p className="text-slate-400">Все още няма събития.</p>
            )}
          </div>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="text-xl font-black">Игри</h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {games.map(game => {
            const gameRounds = rounds.filter(round => round.game_id === game.id)

            return (
              <div key={game.id} className="rounded-xl bg-slate-800/70 p-3">
                <p className="font-bold">{game.title}</p>
                <p className="text-sm text-slate-400">{gameRounds.length} рунда</p>
              </div>
            )
          })}

          {!games.length && <p className="text-slate-400">Все още няма добавени игри.</p>}
        </div>
      </section>
    </main>
  )
}