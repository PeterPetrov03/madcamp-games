'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

type PlayerProfile = {
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

type PublicParticipant = {
  id: string
  name: string
  avatar_url: string | null
  total_points: number
}

type PointEvent = {
  id: string
  title: string
  points: number
  type: string
  note: string | null
  round_number: number | null
  created_at: string
  games?: { title: string } | { title: string }[] | null
}

type GameSummary = {
  title: string
  totalPoints: number
  rounds: number
  averagePerRound: number
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || '?'
}

function getGameTitle(event: PointEvent) {
  if (Array.isArray(event.games)) {
    return event.games[0]?.title || 'Игра'
  }

  return event.games?.title || 'Игра'
}

function eventLabel(event: PointEvent) {
  if (event.type === 'game') {
    const gameTitle = getGameTitle(event)
    const round = event.round_number ? ` · Рунд ${event.round_number}` : ''
    return `${gameTitle}${round}`
  }

  return event.title
}

function formatAverage(value: number) {
  if (!Number.isFinite(value)) return '0'
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export default function PlayerProfilePage() {
  const [pin, setPin] = useState('')
  const [player, setPlayer] = useState<PlayerProfile | null>(null)
  const [participants, setParticipants] = useState<PublicParticipant[]>([])
  const [events, setEvents] = useState<PointEvent[]>([])
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  const sortedParticipants = useMemo(
    () => [...participants].sort((a, b) => (b.total_points || 0) - (a.total_points || 0)),
    [participants]
  )

  const gameEvents = useMemo(
    () => events.filter(event => event.type === 'game'),
    [events]
  )

  const gameSummaries = useMemo(() => {
    const summaries = new Map<string, GameSummary>()

    gameEvents.forEach(event => {
      const title = getGameTitle(event)
      const current = summaries.get(title) || {
        title,
        totalPoints: 0,
        rounds: 0,
        averagePerRound: 0,
      }

      current.totalPoints += event.points
      current.rounds += 1
      current.averagePerRound = current.rounds ? current.totalPoints / current.rounds : 0

      summaries.set(title, current)
    })

    return Array.from(summaries.values()).sort((a, b) => b.totalPoints - a.totalPoints)
  }, [gameEvents])

  const playerRank = useMemo(() => {
    if (!player) return null
    const index = sortedParticipants.findIndex(participant => participant.id === player.id)
    return index >= 0 ? index + 1 : null
  }, [player, sortedParticipants])

  const roundsPlayed = gameEvents.length
  const gamesPlayed = gameSummaries.length
  const averagePointsPerGame = gamesPlayed ? player!.game_points / gamesPlayed : 0
  const averagePointsPerRound = roundsPlayed ? player!.game_points / roundsPlayed : 0
  const bestGame = gameSummaries[0]
  const bestRound = gameEvents.length
    ? [...gameEvents].sort((a, b) => b.points - a.points)[0]
    : null

  async function loadParticipants() {
    const res = await supabase
      .from('leaderboard')
      .select('id,name,avatar_url,total_points')
      .order('total_points', { ascending: false })

    if (!res.error) setParticipants((res.data || []) as PublicParticipant[])
  }

  async function loadProfileByPin(nextPin = pin) {
    const cleanPin = nextPin.trim()
    if (!cleanPin) return

    setError('')
    setStatus('')
    setLoading(true)
    setPlayer(null)
    setEvents([])

    const profileRes = await supabase
      .from('leaderboard')
      .select('id,name,pin,avatar_url,total_points,game_points,achievement_points,steps_points,heart_rate_points,bonus_points')
      .eq('pin', cleanPin)
      .maybeSingle()

    if (profileRes.error || !profileRes.data) {
      setError('Не намерих участник с този PIN код.')
      setLoading(false)
      return
    }

    setPlayer(profileRes.data as PlayerProfile)

    const eventsRes = await supabase
      .from('point_events')
      .select('id,title,points,type,note,round_number,created_at,games(title)')
      .eq('player_id', profileRes.data.id)
      .order('created_at', { ascending: false })

    if (!eventsRes.error) setEvents((eventsRes.data || []) as PointEvent[])

    setLoading(false)
  }

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault()
    await loadProfileByPin(pin)
  }

  async function uploadAvatar(file: File) {
    if (!player) return

    if (!file.type.startsWith('image/')) {
      setStatus('Моля избери снимка, не друг тип файл.')
      return
    }

    setUploading(true)
    setStatus('')

    const extension = file.name.split('.').pop() || 'jpg'
    const path = `${player.id}/avatar-${Date.now()}.${extension}`

    const uploadRes = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    if (uploadRes.error) {
      setStatus(uploadRes.error.message)
      setUploading(false)
      return
    }

    const publicUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl

    const updateRes = await supabase
      .from('players')
      .update({ avatar_url: publicUrl })
      .eq('id', player.id)

    if (updateRes.error) {
      setStatus(updateRes.error.message)
      setUploading(false)
      return
    }

    setPlayer({ ...player, avatar_url: publicUrl })
    setStatus('Профилната снимка е качена.')
    setUploading(false)
    await loadParticipants()
  }

  useEffect(() => {
    loadParticipants()

    const channel = supabase
      .channel('profile-page-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => {
        loadParticipants()
        if (pin.trim()) loadProfileByPin(pin)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'point_events' }, () => {
        loadParticipants()
        if (pin.trim()) loadProfileByPin(pin)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [pin])

  return (
    <main className="min-h-screen py-6 md:py-10">
      <div className="mad-shell max-w-6xl space-y-6">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="mad-kicker">MAD CAMP Games</p>
            <h1 className="text-3xl md:text-5xl font-black mt-2">Моят профил</h1>
            <p className="mad-muted mt-2">Тук виждаш своите точки, история и участниците в турнира.</p>
          </div>
          <Link href="/" className="mad-btn-secondary">Класация</Link>
        </header>

        {!player && (
          <section className="mad-card p-5 md:p-6 space-y-4 max-w-3xl">
            <p className="mad-muted">Въведи личния си PIN код, за да отвориш профила си.</p>
            <form onSubmit={handleLogin} className="grid md:grid-cols-[1fr_auto] gap-3">
              <input
                className="mad-input"
                placeholder="Твоят PIN код"
                type="password"
                value={pin}
                onChange={e => setPin(e.target.value)}
              />
              <button className="mad-btn" type="submit">Отвори</button>
            </form>
            {loading && <p className="mad-muted">Зареждане...</p>}
            {error && <p className="text-red-300">{error}</p>}
          </section>
        )}

        {player && (
          <>
            <section className="grid lg:grid-cols-[0.95fr_1.05fr] gap-6">
              <div className="mad-card p-5 md:p-6 space-y-5">
                <div className="flex items-center gap-4">
                  {player.avatar_url ? (
                    <img src={player.avatar_url} alt={player.name} className="mad-avatar-xl" />
                  ) : (
                    <div className="mad-avatar-xl mad-avatar-fallback">{initials(player.name)}</div>
                  )}

                  <div className="min-w-0">
                    <p className="mad-muted">Участник</p>
                    <h2 className="text-3xl font-black truncate">{player.name}</h2>
                    <p className="mad-muted mt-1">Твоят PIN: <span className="text-white font-bold">{player.pin}</span></p>
                  </div>
                </div>

                <div className="mad-card-solid p-4 flex items-center justify-between">
                  <div>
                    <p className="mad-muted">Общо точки</p>
                    <p className="text-sm mad-muted">Всичко, което си събрал досега</p>
                  </div>
                  <b className="text-5xl">{player.total_points}</b>
                </div>

                <label className="mad-card-solid p-4 block cursor-pointer hover:bg-slate-800/80 transition">
                  <p className="font-bold">Качи профилна снимка</p>
                  <p className="text-sm mad-muted mt-1">Избери снимка от телефона си.</p>
                  <input
                    className="hidden"
                    type="file"
                    accept="image/*"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) uploadAvatar(file)
                    }}
                  />
                </label>

                {uploading && <p className="mad-muted">Качване...</p>}
                {status && <p className="text-indigo-200">{status}</p>}

                <div className="grid grid-cols-2 gap-3">
                  <div className="mad-card-solid p-3"><p className="mad-muted text-sm">Игри</p><b>{player.game_points}</b></div>
                  <div className="mad-card-solid p-3"><p className="mad-muted text-sm">Achievements</p><b>{player.achievement_points}</b></div>
                  <div className="mad-card-solid p-3"><p className="mad-muted text-sm">Крачки</p><b>{player.steps_points}</b></div>
                  <div className="mad-card-solid p-3"><p className="mad-muted text-sm">Пулс</p><b>{player.heart_rate_points}</b></div>
                  <div className="mad-card-solid p-3 col-span-2"><p className="mad-muted text-sm">Бонус / наказание</p><b>{player.bonus_points}</b></div>
                </div>
              </div>

              <div className="mad-card p-5 md:p-6 space-y-5">
                <div>
                  <h2 className="text-2xl font-black">Статистика</h2>
                  <p className="mad-muted">Тук виждаш обобщение само на твоето представяне.</p>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="mad-card-solid p-4">
                    <p className="mad-muted text-sm">Място в класацията</p>
                    <b className="text-3xl">{playerRank ? `#${playerRank}` : '—'}</b>
                  </div>

                  <div className="mad-card-solid p-4">
                    <p className="mad-muted text-sm">Изиграни игри</p>
                    <b className="text-3xl">{gamesPlayed}</b>
                  </div>

                  <div className="mad-card-solid p-4">
                    <p className="mad-muted text-sm">Изиграни рундове</p>
                    <b className="text-3xl">{roundsPlayed}</b>
                  </div>

                  <div className="mad-card-solid p-4">
                    <p className="mad-muted text-sm">Средно точки на игра</p>
                    <b className="text-3xl">{formatAverage(averagePointsPerGame)}</b>
                  </div>

                  <div className="mad-card-solid p-4">
                    <p className="mad-muted text-sm">Средно точки на рунд</p>
                    <b className="text-3xl">{formatAverage(averagePointsPerRound)}</b>
                  </div>

                  <div className="mad-card-solid p-4">
                    <p className="mad-muted text-sm">Най-силен рунд</p>
                    <b className="text-3xl">{bestRound ? `+${bestRound.points}` : '—'}</b>
                    {bestRound && <p className="text-sm mad-muted mt-1">{eventLabel(bestRound)}</p>}
                  </div>
                </div>

                {bestGame && (
                  <div className="mad-card-solid p-4">
                    <p className="mad-muted text-sm">Най-силна игра</p>
                    <p className="font-black text-xl">{bestGame.title}</p>
                    <p className="mad-muted mt-1">{bestGame.totalPoints} точки от {bestGame.rounds} рунда</p>
                  </div>
                )}
              </div>
            </section>

            <section className="grid lg:grid-cols-[0.95fr_1.05fr] gap-6">
              <div className="mad-card p-5 md:p-6 space-y-3">
                <h2 className="text-2xl font-black">Точки по игри</h2>
                <p className="mad-muted">Обобщение на точките ти от всяка игра.</p>

                {gameSummaries.map(game => (
                  <div key={game.title} className="mad-card-solid p-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="font-bold">{game.title}</p>
                      <p className="text-sm mad-muted">
                        {game.rounds} {game.rounds === 1 ? 'рунд' : 'рунда'} · средно {formatAverage(game.averagePerRound)} точки на рунд
                      </p>
                    </div>
                    <b className="text-green-300 text-2xl">+{game.totalPoints}</b>
                  </div>
                ))}

                {!gameSummaries.length && <p className="mad-muted">Все още нямаш точки от игри.</p>}
              </div>

              <div className="mad-card p-5 md:p-6 space-y-3">
                <h2 className="text-2xl font-black">Моите точки</h2>
                <p className="mad-muted">Историята показва само твоите точки.</p>

                {events.map(event => (
                  <div key={event.id} className="mad-card-solid p-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="font-bold">{eventLabel(event)}</p>
                      <p className="text-sm mad-muted">
                        {event.type === 'game' ? 'Точки от игра' : 'Допълнителни точки'}
                      </p>
                      {event.note && <p className="text-sm mad-muted mt-1">{event.note}</p>}
                    </div>
                    <b className={event.points >= 0 ? 'text-green-300 text-2xl' : 'text-red-300 text-2xl'}>
                      {event.points > 0 ? '+' : ''}{event.points}
                    </b>
                  </div>
                ))}

                {!events.length && <p className="mad-muted">Все още нямаш записани точки.</p>}
              </div>
            </section>
          </>
        )}

        <section className="mad-card p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black">Участници</h2>
              <p className="mad-muted">Тук се вижда кой участва в турнира. PIN-овете на другите не се показват.</p>
            </div>
            <span className="mad-pill">{participants.length} човека</span>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sortedParticipants.map((participant, index) => (
              <div key={participant.id} className="mad-card-solid p-4 flex items-center gap-3">
                {participant.avatar_url ? (
                  <img src={participant.avatar_url} alt={participant.name} className="mad-avatar" />
                ) : (
                  <div className="mad-avatar mad-avatar-fallback">{initials(participant.name)}</div>
                )}
                <div className="min-w-0">
                  <p className="font-black truncate">{index + 1}. {participant.name}</p>
                  <p className="text-sm mad-muted">{participant.total_points || 0} точки</p>
                </div>
              </div>
            ))}

            {!participants.length && <p className="mad-muted">Все още няма добавени участници.</p>}
          </div>
        </section>
      </div>
    </main>
  )
}
