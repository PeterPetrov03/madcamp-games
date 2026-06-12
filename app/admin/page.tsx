'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { isLoggedIn, logout } from '../../lib/auth'

type Player = {
  id: string
  name: string
  pin: string
  total_points?: number
  game_points?: number
  achievement_points?: number
  steps_points?: number
  heart_rate_points?: number
  bonus_points?: number
}

type Game = {
  id: string
  title: string
  created_at: string
}

type GameRound = {
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

type PointEvent = {
  id: string
  player_id: string
  game_id: string | null
  game_round_id: string | null
  round_number: number | null
  type: 'game' | 'achievement' | 'steps' | 'heart_rate' | 'bonus' | 'penalty'
  title: string
  points: number
  note: string | null
  created_at: string
  players?: { name: string; pin: string } | null
  games?: { title: string } | null
}

const pointTypes = [
  ['achievement', 'Achievement'],
  ['steps', 'Крачки'],
  ['heart_rate', 'Пулс'],
  ['bonus', 'Бонус'],
  ['penalty', 'Наказание'],
] as const

const defaultRoundPoints = {
  place_1_points: 100,
  place_2_points: 80,
  place_3_points: 60,
  place_4_points: 50,
  place_5_points: 40,
  place_6_points: 30,
  place_7_points: 20,
  place_8_points: 10,
}

function getPlaceLabel(place: number) {
  if (place === 1) return '1во място'
  if (place === 2) return '2ро място'
  return `${place}то място`
}

function getRoundPointsByPlace(round: GameRound, place: number) {
  const key = `place_${place}_points` as keyof GameRound
  return Number(round[key] || 0)
}

function normalize(value: string) {
  return value.trim().toLowerCase()
}

export default function AdminPage() {
  const router = useRouter()
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')

  const [players, setPlayers] = useState<Player[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [rounds, setRounds] = useState<GameRound[]>([])
  const [events, setEvents] = useState<PointEvent[]>([])

  const [newPlayer, setNewPlayer] = useState({ name: '', pin: '' })
  const [newGame, setNewGame] = useState({ title: '', roundsCount: 1, ...defaultRoundPoints })

  const [pointForm, setPointForm] = useState({
    player_id: '',
    type: 'achievement',
    title: '',
    points: 10,
    note: '',
  })

  const [rankingForm, setRankingForm] = useState({
    game_id: '',
    game_round_id: '',
    place_1: '',
    place_2: '',
    place_3: '',
    place_4: '',
    place_5: '',
    place_6: '',
    place_7: '',
    place_8: '',
  })

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => (b.total_points || 0) - (a.total_points || 0)),
    [players]
  )

  const selectedGameRounds = useMemo(
    () => rounds.filter(round => round.game_id === rankingForm.game_id).sort((a, b) => a.round_number - b.round_number),
    [rounds, rankingForm.game_id]
  )

  async function loadData() {
    setLoading(true)

    const [leaderboardRes, gamesRes, roundsRes, eventsRes] = await Promise.all([
      supabase.from('leaderboard').select('*').order('total_points', { ascending: false }),
      supabase.from('games').select('*').order('created_at', { ascending: true }),
      supabase.from('game_rounds').select('*').order('round_number', { ascending: true }),
      supabase
        .from('point_events')
        .select('*, players(name,pin), games(title)')
        .order('created_at', { ascending: false })
        .limit(150),
    ])

    if (leaderboardRes.error || gamesRes.error || roundsRes.error || eventsRes.error) {
      setStatus('Има проблем с четенето от Supabase. Провери .env.local и пусни новия schema.sql.')
    } else {
      setStatus('')
      setPlayers(leaderboardRes.data || [])
      setGames(gamesRes.data || [])
      setRounds(roundsRes.data || [])
      setEvents((eventsRes.data || []) as PointEvent[])
    }

    setLoading(false)
  }

  function findPlayerByNameOrPin(input: string) {
    const value = normalize(input)
    if (!value) return { player: null, error: '' }

    const byPin = players.find(player => normalize(player.pin) === value)
    if (byPin) return { player: byPin, error: '' }

    const byName = players.filter(player => normalize(player.name) === value)
    if (byName.length === 1) return { player: byName[0], error: '' }
    if (byName.length > 1) return { player: null, error: `Има повече от един участник с име "${input}". Използвай PIN код.` }

    return { player: null, error: `Не намерих участник: ${input}` }
  }

  async function addPlayer() {
    if (!newPlayer.name.trim() || !newPlayer.pin.trim()) {
      return setStatus('Име и PIN код са задължителни.')
    }

    const { error } = await supabase.from('players').insert({
      name: newPlayer.name.trim(),
      pin: newPlayer.pin.trim(),
    })

    if (error) return setStatus(error.message)

    setNewPlayer({ name: '', pin: '' })
    setStatus('Участникът е записан в базата.')
    await loadData()
  }

  async function updatePlayer(player: Player, field: keyof Pick<Player, 'name' | 'pin'>, value: string) {
    setPlayers(prev => prev.map(p => (p.id === player.id ? { ...p, [field]: value } : p)))

    const { error } = await supabase.from('players').update({ [field]: value }).eq('id', player.id)
    if (error) setStatus(error.message)
  }

  async function deletePlayer(id: string) {
    if (!confirm('Сигурен ли си? Това ще изтрие участника и всички негови точки.')) return

    const { error } = await supabase.from('players').delete().eq('id', id)
    if (error) return setStatus(error.message)

    await loadData()
  }

  async function addGame() {
    if (!newGame.title.trim()) return setStatus('Име на играта е задължително.')
    if (Number(newGame.roundsCount) < 1) return setStatus('Играта трябва да има поне 1 рунд.')

    const { data: game, error: gameError } = await supabase
      .from('games')
      .insert({ title: newGame.title.trim() })
      .select('*')
      .single()

    if (gameError || !game) return setStatus(gameError?.message || 'Не успях да създам играта.')

    const roundRows = Array.from({ length: Number(newGame.roundsCount) }, (_, index) => ({
      game_id: game.id,
      round_number: index + 1,
      place_1_points: Number(newGame.place_1_points),
      place_2_points: Number(newGame.place_2_points),
      place_3_points: Number(newGame.place_3_points),
      place_4_points: Number(newGame.place_4_points),
      place_5_points: Number(newGame.place_5_points),
      place_6_points: Number(newGame.place_6_points),
      place_7_points: Number(newGame.place_7_points),
      place_8_points: Number(newGame.place_8_points),
    }))

    const { error: roundsError } = await supabase.from('game_rounds').insert(roundRows)
    if (roundsError) return setStatus(roundsError.message)

    setNewGame({ title: '', roundsCount: 1, ...defaultRoundPoints })
    setStatus('Играта и рундовете са записани в базата.')
    await loadData()
  }

  async function updateGame(game: Game, value: string) {
    setGames(prev => prev.map(g => (g.id === game.id ? { ...g, title: value } : g)))

    const { error } = await supabase.from('games').update({ title: value }).eq('id', game.id)
    if (error) setStatus(error.message)
  }

  async function deleteGame(id: string) {
    if (!confirm('Сигурен ли си? Това ще изтрие играта, рундовете ѝ и ще развърже старите точки от играта.')) return

    const { error } = await supabase.from('games').delete().eq('id', id)
    if (error) return setStatus(error.message)

    await loadData()
  }

  async function addRound(gameId: string) {
    const gameRounds = rounds.filter(round => round.game_id === gameId)
    const nextRoundNumber = gameRounds.length ? Math.max(...gameRounds.map(round => round.round_number)) + 1 : 1

    const { error } = await supabase.from('game_rounds').insert({
      game_id: gameId,
      round_number: nextRoundNumber,
      ...defaultRoundPoints,
    })

    if (error) return setStatus(error.message)

    setStatus('Добавен е нов рунд.')
    await loadData()
  }

  async function updateRound(round: GameRound, field: keyof GameRound, value: string | number) {
    setRounds(prev => prev.map(r => (r.id === round.id ? { ...r, [field]: value } : r)))

    const { error } = await supabase.from('game_rounds').update({ [field]: value }).eq('id', round.id)
    if (error) setStatus(error.message)
  }

  async function deleteRound(id: string) {
    if (!confirm('Да изтрия ли този рунд? Старите точки ще останат, но няма да са вързани към рунда.')) return

    const { error } = await supabase.from('game_rounds').delete().eq('id', id)
    if (error) return setStatus(error.message)

    await loadData()
  }

  async function addManualPoints() {
    if (!pointForm.player_id || !pointForm.title.trim()) {
      return setStatus('Избери участник и въведи причина за точките.')
    }

    const { error } = await supabase.from('point_events').insert({
      player_id: pointForm.player_id,
      game_id: null,
      game_round_id: null,
      round_number: null,
      type: pointForm.type,
      title: pointForm.title.trim(),
      points: Number(pointForm.points),
      note: pointForm.note.trim() || null,
    })

    if (error) return setStatus(error.message)

    setPointForm({ ...pointForm, title: '', points: 10, note: '' })
    setStatus('Точките са записани в базата.')
    await loadData()
  }

  async function addRoundRanking() {
    if (!rankingForm.game_id) return setStatus('Избери игра.')
    if (!rankingForm.game_round_id) return setStatus('Избери рунд.')

    const game = games.find(g => g.id === rankingForm.game_id)
    const round = rounds.find(r => r.id === rankingForm.game_round_id)
    if (!game || !round) return setStatus('Не намирам избраната игра или рунд.')

    const entries = [
      rankingForm.place_1,
      rankingForm.place_2,
      rankingForm.place_3,
      rankingForm.place_4,
      rankingForm.place_5,
      rankingForm.place_6,
      rankingForm.place_7,
      rankingForm.place_8,
    ]

    const usedPlayerIds = new Set<string>()
    const rows = []

    for (let index = 0; index < entries.length; index++) {
      const input = entries[index].trim()
      if (!input) continue

      const place = index + 1
      const result = findPlayerByNameOrPin(input)
      if (result.error) return setStatus(result.error)
      if (!result.player) continue
      if (usedPlayerIds.has(result.player.id)) return setStatus(`Участникът ${result.player.name} е въведен повече от веднъж.`)

      usedPlayerIds.add(result.player.id)

      rows.push({
        player_id: result.player.id,
        game_id: game.id,
        game_round_id: round.id,
        round_number: round.round_number,
        type: 'game' as const,
        title: `${game.title} — Рунд ${round.round_number} — ${getPlaceLabel(place)}`,
        points: getRoundPointsByPlace(round, place),
        note: `Въведено чрез класиране: ${getPlaceLabel(place)}.`,
      })
    }

    if (!rows.length) return setStatus('Въведи поне един участник в класирането.')

    const { error } = await supabase.from('point_events').insert(rows)
    if (error) return setStatus(error.message)

    setRankingForm({
      ...rankingForm,
      place_1: '',
      place_2: '',
      place_3: '',
      place_4: '',
      place_5: '',
      place_6: '',
      place_7: '',
      place_8: '',
    })

    setStatus('Резултатът от рунда е записан в базата.')
    await loadData()
  }

  async function deleteEvent(id: string) {
    if (!confirm('Да изтрия ли този запис с точки?')) return

    const { error } = await supabase.from('point_events').delete().eq('id', id)
    if (error) return setStatus(error.message)

    await loadData()
  }

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login')
      return
    }

    setCheckingAuth(false)
    loadData()

    const channel = supabase
      .channel('admin-live-data')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_rounds' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'point_events' }, loadData)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [router])

  if (checkingAuth) {
    return <main className="min-h-screen p-4 flex items-center justify-center text-slate-300">Проверка на достъпа...</main>
  }

  return (
    <main className="min-h-screen py-6 md:py-8">
      <div className="mad-shell space-y-6">
        <header className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between py-2">
          <div>
            <p className="mad-kicker">MAD CAMP Games</p>
            <h1 className="text-3xl md:text-5xl font-black mt-1">Админ панел</h1>
            <p className="mad-muted mt-2">Управляваш участници, игри, рундове и точки директно в Supabase.</p>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <Link href="/" className="mad-btn-secondary">Публична страница</Link>
            <Link href="/profile" className="mad-btn-secondary">Профил</Link>
            <button onClick={loadData} className="mad-btn-secondary">Refresh</button>
            <button onClick={logout} className="mad-btn-secondary">Изход</button>
          </div>
        </header>

        {status && <div className="mad-card p-4 border-indigo-500/50 text-indigo-100">{status}</div>}
        {loading && <p className="mad-muted">Обновяване...</p>}

        <section className="grid md:grid-cols-4 gap-4">
          <div className="mad-card p-5"><p className="mad-muted">Участници</p><b className="text-4xl">{players.length}</b></div>
          <div className="mad-card p-5"><p className="mad-muted">Игри</p><b className="text-4xl">{games.length}</b></div>
          <div className="mad-card p-5"><p className="mad-muted">Рундове</p><b className="text-4xl">{rounds.length}</b></div>
          <div className="mad-card p-5"><p className="mad-muted">Записи с точки</p><b className="text-4xl">{events.length}</b></div>
        </section>

        <section className="grid lg:grid-cols-2 gap-6">
          <div className="mad-card p-5 space-y-4">
            <h2 className="text-2xl font-black">Участници</h2>

            <div className="grid md:grid-cols-2 gap-3">
              <input className="mad-input" placeholder="Име" value={newPlayer.name} onChange={e => setNewPlayer({ ...newPlayer, name: e.target.value })} />
              <input className="mad-input" placeholder="PIN код" value={newPlayer.pin} onChange={e => setNewPlayer({ ...newPlayer, pin: e.target.value })} />
            </div>

            <button onClick={addPlayer} className="mad-btn">Добави участник</button>

            <div className="space-y-2">
              {players.map(player => (
                <div key={player.id} className="grid md:grid-cols-[1fr_160px_auto] gap-2 items-center mad-card-solid p-3">
                  <input className="mad-input" value={player.name} onChange={e => updatePlayer(player, 'name', e.target.value)} />
                  <input className="mad-input" value={player.pin} onChange={e => updatePlayer(player, 'pin', e.target.value)} />
                  <button onClick={() => deletePlayer(player.id)} className="mad-btn-secondary">Изтрий</button>
                </div>
              ))}
            </div>
          </div>

          <div className="mad-card p-5 space-y-4">
            <h2 className="text-2xl font-black">Класация</h2>
            <div className="space-y-2">
              {sortedPlayers.map((player, index) => {
                const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : ''
                return (
                  <div key={player.id} className="flex items-center justify-between gap-4 mad-card-solid p-3">
                    <div className="flex items-center gap-3">
                      <div className={`mad-rank-badge ${rankClass}`}>{index + 1}</div>
                      <div>
                        <p className="font-black">{player.name}</p>
                        <p className="text-sm mad-muted">PIN: {player.pin}</p>
                      </div>
                    </div>
                    <b className="text-3xl">{player.total_points || 0}</b>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="mad-card p-5 space-y-5">
          <h2 className="text-2xl font-black">Добави игра</h2>

          <div className="grid md:grid-cols-2 gap-3">
            <input className="mad-input" placeholder="Име на играта" value={newGame.title} onChange={e => setNewGame({ ...newGame, title: e.target.value })} />
            <input className="mad-input" type="number" min={1} placeholder="Брой рундове" value={newGame.roundsCount} onChange={e => setNewGame({ ...newGame, roundsCount: Number(e.target.value) })} />
          </div>

          <div>
            <p className="text-sm mad-muted mb-2">Начални точки за всеки нов рунд. После можеш да редактираш отделните рундове.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(place => {
                const key = `place_${place}_points` as keyof typeof newGame
                return (
                  <label key={place} className="space-y-1">
                    <span className="text-sm mad-muted">{getPlaceLabel(place)}</span>
                    <input className="mad-input" type="number" value={newGame[key]} onChange={e => setNewGame({ ...newGame, [key]: Number(e.target.value) })} />
                  </label>
                )
              })}
            </div>
          </div>

          <button onClick={addGame} className="mad-btn">Добави игра и рундове</button>
        </section>

        <section className="mad-card p-5 space-y-5">
          <h2 className="text-2xl font-black">Игри и рундове</h2>

          <div className="space-y-4">
            {games.map(game => {
              const gameRounds = rounds.filter(round => round.game_id === game.id).sort((a, b) => a.round_number - b.round_number)

              return (
                <div key={game.id} className="mad-card-solid p-4 space-y-4">
                  <div className="grid md:grid-cols-[1fr_auto_auto] gap-2 items-center">
                    <input className="mad-input" value={game.title} onChange={e => updateGame(game, e.target.value)} />
                    <button onClick={() => addRound(game.id)} className="mad-btn-secondary">+ Рунд</button>
                    <button onClick={() => deleteGame(game.id)} className="mad-btn-secondary">Изтрий игра</button>
                  </div>

                  <div className="space-y-3">
                    {gameRounds.map(round => (
                      <div key={round.id} className="rounded-2xl bg-slate-950/40 border border-slate-700 p-3 space-y-3">
                        <div className="grid md:grid-cols-[160px_auto] gap-2 items-center">
                          <label>
                            <span className="text-sm mad-muted">Рунд номер</span>
                            <input className="mad-input" type="number" min={1} value={round.round_number} onChange={e => updateRound(round, 'round_number', Number(e.target.value))} />
                          </label>
                          <div className="md:text-right">
                            <button onClick={() => deleteRound(round.id)} className="mad-btn-secondary">Изтрий рунд</button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {[1, 2, 3, 4, 5, 6, 7, 8].map(place => {
                            const key = `place_${place}_points` as keyof GameRound
                            return (
                              <label key={place} className="space-y-1">
                                <span className="text-xs mad-muted">{getPlaceLabel(place)}</span>
                                <input className="mad-input" type="number" value={round[key] as number} onChange={e => updateRound(round, key, Number(e.target.value))} />
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="mad-card p-5 space-y-4">
          <h2 className="text-2xl font-black">Запиши резултат от рунд</h2>
          <p className="mad-muted">Избираш игра и рунд. Въвеждаш участниците по класиране — може с име или с PIN код.</p>

          <div className="grid md:grid-cols-2 gap-3">
            <select
              className="mad-select"
              value={rankingForm.game_id}
              onChange={e => setRankingForm({ ...rankingForm, game_id: e.target.value, game_round_id: '' })}
            >
              <option value="">Избери игра</option>
              {games.map(game => <option key={game.id} value={game.id}>{game.title}</option>)}
            </select>

            <select
              className="mad-select"
              value={rankingForm.game_round_id}
              onChange={e => setRankingForm({ ...rankingForm, game_round_id: e.target.value })}
              disabled={!rankingForm.game_id}
            >
              <option value="">Избери рунд</option>
              {selectedGameRounds.map(round => <option key={round.id} value={round.id}>Рунд {round.round_number}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(place => {
              const key = `place_${place}` as keyof typeof rankingForm
              return (
                <input
                  key={place}
                  className="mad-input"
                  placeholder={getPlaceLabel(place)}
                  value={rankingForm[key] as string}
                  onChange={e => setRankingForm({ ...rankingForm, [key]: e.target.value })}
                />
              )
            })}
          </div>

          <button onClick={addRoundRanking} className="mad-btn">Запиши резултата</button>
        </section>

        <section className="mad-card p-5 space-y-4">
          <h2 className="text-2xl font-black">Ръчни точки</h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-3">
            <select className="mad-select" value={pointForm.player_id} onChange={e => setPointForm({ ...pointForm, player_id: e.target.value })}>
              <option value="">Избери участник</option>
              {players.map(player => <option key={player.id} value={player.id}>{player.name}</option>)}
            </select>

            <select className="mad-select" value={pointForm.type} onChange={e => setPointForm({ ...pointForm, type: e.target.value })}>
              {pointTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>

            <input className="mad-input" placeholder="Причина" value={pointForm.title} onChange={e => setPointForm({ ...pointForm, title: e.target.value })} />
            <input className="mad-input" type="number" placeholder="Точки" value={pointForm.points} onChange={e => setPointForm({ ...pointForm, points: Number(e.target.value) })} />
            <input className="mad-input" placeholder="Бележка" value={pointForm.note} onChange={e => setPointForm({ ...pointForm, note: e.target.value })} />
          </div>

          <button onClick={addManualPoints} className="mad-btn">Добави ръчни точки</button>
        </section>

        <section className="mad-card p-5 space-y-4">
          <h2 className="text-2xl font-black">История на точки</h2>

          <div className="space-y-2">
            {events.map(event => (
              <div key={event.id} className="grid md:grid-cols-[1fr_120px_auto] gap-2 items-center mad-card-solid p-3">
                <div>
                  <p className="font-bold">{event.title}</p>
                  <p className="text-sm mad-muted">
                    {event.players?.name || 'Изтрит участник'}
                    {event.games?.title ? ` · ${event.games.title}` : ''}
                    {event.round_number ? ` · Рунд ${event.round_number}` : ''}
                  </p>
                  {event.note && <p className="text-sm mad-muted">{event.note}</p>}
                </div>

                <b className={event.points >= 0 ? 'text-green-300 text-xl' : 'text-red-300 text-xl'}>
                  {event.points > 0 ? '+' : ''}{event.points}
                </b>

                <button onClick={() => deleteEvent(event.id)} className="mad-btn-secondary">Изтрий</button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
