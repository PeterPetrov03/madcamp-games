"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { isLoggedIn, logout } from "../../lib/auth";

type Player = {
  id: string;
  name: string;
  pin: string;
  avatar_url: string | null;
  total_points: number;
};

type Game = {
  id: string;
  title: string;
};

type GameRound = {
  id: string;
  game_id: string;
  round_number: number;
  place_1_points: number;
  place_2_points: number;
  place_3_points: number;
  place_4_points: number;
  place_5_points: number;
  place_6_points: number;
  place_7_points: number;
  place_8_points: number;
};

type PointEvent = {
  id: string;
  player_id: string;
  game_id: string | null;
  game_round_id: string | null;
  round_number: number | null;
  type: "game" | "achievement" | "steps" | "heart_rate" | "bonus" | "penalty";
  title: string;
  points: number;
  note: string | null;
  created_at: string;
  players?: { name: string } | { name: string }[] | null;
  games?: { title: string } | { title: string }[] | null;
};

const emptyGameRoundPoints = {
  place_1_points: 100,
  place_2_points: 90,
  place_3_points: 80,
  place_4_points: 70,
  place_5_points: 60,
  place_6_points: 50,
  place_7_points: 40,
  place_8_points: 30,
};

function getPlayerName(event: PointEvent) {
  if (Array.isArray(event.players))
    return event.players[0]?.name || "Изтрит участник";
  return event.players?.name || "Изтрит участник";
}

function getGameTitle(event: PointEvent) {
  if (Array.isArray(event.games)) return event.games[0]?.title || null;
  return event.games?.title || null;
}

function getRoundPoints(round: GameRound, place: number) {
  const key = `place_${place}_points` as keyof Pick<
    GameRound,
    | "place_1_points"
    | "place_2_points"
    | "place_3_points"
    | "place_4_points"
    | "place_5_points"
    | "place_6_points"
    | "place_7_points"
    | "place_8_points"
  >;

  return Number(round[key] || 0);
}

function findPlayerByNameOrPin(players: Player[], value: string) {
  const cleanValue = value.trim().toLowerCase();
  if (!cleanValue) return null;

  return (
    players.find((player) => player.pin.trim().toLowerCase() === cleanValue) ||
    players.find((player) => player.name.trim().toLowerCase() === cleanValue) ||
    null
  );
}

export default function AdminPage() {
  const router = useRouter();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [rounds, setRounds] = useState<GameRound[]>([]);
  const [events, setEvents] = useState<PointEvent[]>([]);

  const [newPlayer, setNewPlayer] = useState({ name: "", pin: "" });
  const [newGameTitle, setNewGameTitle] = useState("");
  const [newRound, setNewRound] = useState({
    game_id: "",
    round_number: 1,
    ...emptyGameRoundPoints,
  });

  const [rankingForm, setRankingForm] = useState({
    game_round_id: "",
    place_1: "",
    place_2: "",
    place_3: "",
    place_4: "",
    place_5: "",
    place_6: "",
    place_7: "",
    place_8: "",
  });

  const [manualPoints, setManualPoints] = useState({
    player_id: "",
    type: "bonus",
    title: "",
    points: 10,
    note: "",
  });

  const [stepsForm, setStepsForm] = useState({
    player_id: "",
    day_label: "Ден 1",
    steps: 0,
    points: 0,
  });

  const sortedPlayers = useMemo(
    () =>
      [...players].sort(
        (a, b) => (b.total_points || 0) - (a.total_points || 0),
      ),
    [players],
  );

  const selectedRound = useMemo(
    () =>
      rounds.find((round) => round.id === rankingForm.game_round_id) || null,
    [rounds, rankingForm.game_round_id],
  );

  const selectedRoundGame = useMemo(
    () => games.find((game) => game.id === selectedRound?.game_id) || null,
    [games, selectedRound],
  );

  async function loadData() {
    setLoading(true);

    const [playersRes, gamesRes, roundsRes, eventsRes] = await Promise.all([
      supabase
        .from("leaderboard")
        .select("id,name,pin,avatar_url,total_points")
        .order("total_points", { ascending: false }),
      supabase
        .from("games")
        .select("id,title")
        .order("created_at", { ascending: true }),
      supabase
        .from("game_rounds")
        .select("*")
        .order("round_number", { ascending: true }),
      supabase
        .from("point_events")
        .select(
          "id,player_id,game_id,game_round_id,round_number,type,title,points,note,created_at,players(name),games(title)",
        )
        .order("created_at", { ascending: false })
        .limit(80),
    ]);

    if (
      playersRes.error ||
      gamesRes.error ||
      roundsRes.error ||
      eventsRes.error
    ) {
      setStatus(
        playersRes.error?.message ||
          gamesRes.error?.message ||
          roundsRes.error?.message ||
          eventsRes.error?.message ||
          "Има проблем с четенето от Supabase.",
      );
    } else {
      setStatus("");
      setPlayers((playersRes.data || []) as Player[]);
      setGames((gamesRes.data || []) as Game[]);
      setRounds((roundsRes.data || []) as GameRound[]);
      setEvents((eventsRes.data || []) as PointEvent[]);
    }

    setLoading(false);
  }

  async function addPlayer() {
    if (!newPlayer.name.trim() || !newPlayer.pin.trim()) {
      setStatus("Име и PIN са задължителни.");
      return;
    }

    const { error } = await supabase.from("players").insert({
      name: newPlayer.name.trim(),
      pin: newPlayer.pin.trim(),
    });

    if (error) {
      setStatus(error.message);
      return;
    }

    setNewPlayer({ name: "", pin: "" });
    setStatus("Участникът е добавен.");
    await loadData();
  }

  async function deletePlayer(id: string) {
    if (!confirm("Да изтрия ли участника и всичките му точки?")) return;

    const { error } = await supabase.from("players").delete().eq("id", id);
    if (error) setStatus(error.message);
    else await loadData();
  }

  async function addGame() {
    if (!newGameTitle.trim()) {
      setStatus("Въведи име на играта.");
      return;
    }

    const { error } = await supabase
      .from("games")
      .insert({ title: newGameTitle.trim() });

    if (error) {
      setStatus(error.message);
      return;
    }

    setNewGameTitle("");
    setStatus("Играта е добавена.");
    await loadData();
  }

  async function addRound() {
    if (!newRound.game_id) {
      setStatus("Избери игра за рунда.");
      return;
    }

    const { error } = await supabase.from("game_rounds").insert({
      game_id: newRound.game_id,
      round_number: Number(newRound.round_number),
      place_1_points: Number(newRound.place_1_points),
      place_2_points: Number(newRound.place_2_points),
      place_3_points: Number(newRound.place_3_points),
      place_4_points: Number(newRound.place_4_points),
      place_5_points: Number(newRound.place_5_points),
      place_6_points: Number(newRound.place_6_points),
      place_7_points: Number(newRound.place_7_points),
      place_8_points: Number(newRound.place_8_points),
    });

    if (error) {
      setStatus(error.message);
      return;
    }

    setNewRound({
      ...newRound,
      round_number: Number(newRound.round_number) + 1,
    });
    setStatus("Рундът е добавен.");
    await loadData();
  }

  async function saveRoundRanking() {
    if (!selectedRound) {
      setStatus("Избери рунд.");
      return;
    }

    const placements = [
      rankingForm.place_1,
      rankingForm.place_2,
      rankingForm.place_3,
      rankingForm.place_4,
      rankingForm.place_5,
      rankingForm.place_6,
      rankingForm.place_7,
      rankingForm.place_8,
    ];

    const rows = placements
      .map((value, index) => {
        const player = findPlayerByNameOrPin(players, value);
        if (!player) return null;

        const place = index + 1;
        const points = getRoundPoints(selectedRound, place);

        return {
          player_id: player.id,
          game_id: selectedRound.game_id,
          game_round_id: selectedRound.id,
          round_number: selectedRound.round_number,
          type: "game" as const,
          title: `${selectedRoundGame?.title || "Игра"} - Рунд ${selectedRound.round_number}`,
          points,
          note: `${place}. място`,
        };
      })
      .filter(Boolean);

    if (!rows.length) {
      setStatus("Не намерих участници по въведените имена/PIN-ове.");
      return;
    }

    const { error } = await supabase.from("point_events").insert(rows);

    if (error) {
      setStatus(error.message);
      return;
    }

    setRankingForm({
      game_round_id: rankingForm.game_round_id,
      place_1: "",
      place_2: "",
      place_3: "",
      place_4: "",
      place_5: "",
      place_6: "",
      place_7: "",
      place_8: "",
    });
    setStatus("Резултатът от рунда е записан.");
    await loadData();
  }

  async function addManualPoints() {
    if (!manualPoints.player_id || !manualPoints.title.trim()) {
      setStatus("Избери участник и въведи заглавие.");
      return;
    }

    const { error } = await supabase.from("point_events").insert({
      player_id: manualPoints.player_id,
      game_id: null,
      game_round_id: null,
      round_number: null,
      type: manualPoints.type,
      title: manualPoints.title.trim(),
      points: Number(manualPoints.points),
      note: manualPoints.note.trim() || null,
    });

    if (error) {
      setStatus(error.message);
      return;
    }

    setManualPoints({ ...manualPoints, title: "", points: 10, note: "" });
    setStatus("Ръчните точки са добавени.");
    await loadData();
  }

  async function addSteps() {
    if (!stepsForm.player_id) {
      setStatus("Избери участник за крачките.");
      return;
    }

    if (!stepsForm.steps || stepsForm.steps <= 0) {
      setStatus("Въведи брой крачки.");
      return;
    }

    const { error } = await supabase.from("point_events").insert({
      player_id: stepsForm.player_id,
      game_id: null,
      game_round_id: null,
      round_number: null,
      type: "steps",
      title: `${stepsForm.day_label} · ${stepsForm.steps} крачки`,
      points: Number(stepsForm.points),
      note: `Ръчно въведени крачки: ${stepsForm.steps}`,
    });

    if (error) {
      setStatus(error.message);
      return;
    }

    setStepsForm({ ...stepsForm, steps: 0, points: 0 });
    setStatus("Крачките са записани като точки.");
    await loadData();
  }

  async function deleteEvent(id: string) {
    if (!confirm("Да изтрия ли този запис с точки?")) return;

    const { error } = await supabase.from("point_events").delete().eq("id", id);
    if (error) setStatus(error.message);
    else await loadData();
  }

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }

    setCheckingAuth(false);
    loadData();

    const channel = supabase
      .channel("admin-live-data")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players" },
        loadData,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games" },
        loadData,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_rounds" },
        loadData,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "point_events" },
        loadData,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  if (checkingAuth) {
    return (
      <main className="min-h-screen py-10">
        <div className="mad-shell">
          <p className="mad-muted">Проверка на достъпа...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-6 space-y-6">
      <div className="mad-shell space-y-6">
        <header className="py-6 flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
          <div>
            <p className="mad-kicker">MAD CAMP Games</p>
            <h1 className="text-4xl font-black">Админ панел</h1>
            <p className="mad-muted">
              Управляваш участници, игри, рундове, точки и крачки.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/" className="mad-btn-secondary">
              Публична страница
            </Link>
            <Link href="/profile" className="mad-btn-secondary">
              Профил
            </Link>
            <button onClick={loadData} className="mad-btn-secondary">
              Refresh
            </button>
            <button onClick={logout} className="mad-btn-secondary">
              Изход
            </button>
          </div>
        </header>

        {status && (
          <div className="mad-card p-4 border-indigo-500/50">{status}</div>
        )}

        <section className="grid md:grid-cols-4 gap-4">
          <div className="mad-card p-4">
            <p className="mad-muted">Участници</p>
            <b className="text-3xl">{players.length}</b>
          </div>
          <div className="mad-card p-4">
            <p className="mad-muted">Игри</p>
            <b className="text-3xl">{games.length}</b>
          </div>
          <div className="mad-card p-4">
            <p className="mad-muted">Рундове</p>
            <b className="text-3xl">{rounds.length}</b>
          </div>
          <div className="mad-card p-4">
            <p className="mad-muted">Записи с точки</p>
            <b className="text-3xl">{events.length}</b>
          </div>
        </section>

        <section className="grid lg:grid-cols-2 gap-6">
          <div className="mad-card p-5 space-y-4">
            <h2 className="text-xl font-black">Участници</h2>
            <div className="grid md:grid-cols-[1fr_140px_auto] gap-3">
              <input
                className="mad-input"
                placeholder="Име"
                value={newPlayer.name}
                onChange={(event) =>
                  setNewPlayer({ ...newPlayer, name: event.target.value })
                }
              />
              <input
                className="mad-input"
                placeholder="PIN"
                value={newPlayer.pin}
                onChange={(event) =>
                  setNewPlayer({ ...newPlayer, pin: event.target.value })
                }
              />
              <button onClick={addPlayer} className="mad-btn">
                Добави
              </button>
            </div>

            <div className="space-y-2">
              {sortedPlayers.map((player) => (
                <div
                  key={player.id}
                  className="mad-card-solid p-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-bold">{player.name}</p>
                    <p className="text-sm mad-muted">
                      PIN: {player.pin} · {player.total_points || 0} т.
                    </p>
                  </div>
                  <button
                    onClick={() => deletePlayer(player.id)}
                    className="mad-btn-secondary"
                  >
                    Изтрий
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="mad-card p-5 space-y-4">
            <h2 className="text-xl font-black">Класация</h2>
            <div className="space-y-2">
              {sortedPlayers.map((player, index) => (
                <div
                  key={player.id}
                  className="mad-card-solid p-3 flex items-center justify-between"
                >
                  <div>
                    <p className="font-bold">
                      {index + 1}. {player.name}
                    </p>
                    <p className="text-sm mad-muted">PIN: {player.pin}</p>
                  </div>
                  <b className="text-2xl">{player.total_points || 0}</b>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid lg:grid-cols-2 gap-6">
          <div className="mad-card p-5 space-y-4">
            <h2 className="text-xl font-black">Добави игра</h2>
            <div className="grid md:grid-cols-[1fr_auto] gap-3">
              <input
                className="mad-input"
                placeholder="Име на играта"
                value={newGameTitle}
                onChange={(event) => setNewGameTitle(event.target.value)}
              />
              <button onClick={addGame} className="mad-btn">
                Добави игра
              </button>
            </div>

            <div className="space-y-2">
              {games.map((game) => (
                <div key={game.id} className="mad-card-solid p-3">
                  <p className="font-bold">{game.title}</p>
                  <p className="text-sm mad-muted">
                    {rounds.filter((round) => round.game_id === game.id).length}{" "}
                    рунда
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mad-card p-5 space-y-4">
            <h2 className="text-xl font-black">Добави рунд</h2>
            <div className="grid md:grid-cols-2 gap-3">
              <select
                className="mad-input"
                value={newRound.game_id}
                onChange={(event) =>
                  setNewRound({ ...newRound, game_id: event.target.value })
                }
              >
                <option value="">Избери игра</option>
                {games.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.title}
                  </option>
                ))}
              </select>
              <input
                className="mad-input"
                type="number"
                min={1}
                placeholder="Рунд номер"
                value={newRound.round_number}
                onChange={(event) =>
                  setNewRound({
                    ...newRound,
                    round_number: Number(event.target.value),
                  })
                }
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((place) => {
                const key =
                  `place_${place}_points` as keyof typeof emptyGameRoundPoints;
                return (
                  <label key={place} className="space-y-1">
                    <span className="text-xs mad-muted">{place}. място</span>
                    <input
                      className="mad-input"
                      type="number"
                      value={newRound[key]}
                      onChange={(event) =>
                        setNewRound({
                          ...newRound,
                          [key]: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                );
              })}
            </div>
            <button onClick={addRound} className="mad-btn">
              Добави рунд
            </button>
          </div>
        </section>

        <section className="mad-card p-5 space-y-4">
          <h2 className="text-xl font-black">Запиши резултат от рунд</h2>
          <p className="mad-muted">
            Можеш да въвеждаш име или PIN за всяко място.
          </p>

          <select
            className="mad-input"
            value={rankingForm.game_round_id}
            onChange={(event) =>
              setRankingForm({
                ...rankingForm,
                game_round_id: event.target.value,
              })
            }
          >
            <option value="">Избери рунд</option>
            {rounds.map((round) => {
              const game = games.find((item) => item.id === round.game_id);
              return (
                <option key={round.id} value={round.id}>
                  {game?.title || "Игра"} · Рунд {round.round_number}
                </option>
              );
            })}
          </select>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((place) => {
              const key = `place_${place}` as keyof typeof rankingForm;
              return (
                <input
                  key={place}
                  className="mad-input"
                  placeholder={`${place}. място`}
                  value={rankingForm[key]}
                  onChange={(event) =>
                    setRankingForm({
                      ...rankingForm,
                      [key]: event.target.value,
                    })
                  }
                />
              );
            })}
          </div>

          <button onClick={saveRoundRanking} className="mad-btn">
            Запиши резултат
          </button>
        </section>

        <section className="grid lg:grid-cols-2 gap-6">
          <div className="mad-card p-5 space-y-4 border-cyan-500/30">
            <h2 className="text-xl font-black">Крачки за деня</h2>
            <p className="mad-muted">
              Ръчно въвеждане, ако няма автоматична връзка с телефонно
              приложение.
            </p>

            <div className="grid md:grid-cols-2 gap-3">
              <select
                className="mad-input"
                value={stepsForm.player_id}
                onChange={(event) =>
                  setStepsForm({ ...stepsForm, player_id: event.target.value })
                }
              >
                <option value="">Избери участник</option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name} · PIN {player.pin}
                  </option>
                ))}
              </select>
              <input
                className="mad-input"
                placeholder="Ден / етикет"
                value={stepsForm.day_label}
                onChange={(event) =>
                  setStepsForm({ ...stepsForm, day_label: event.target.value })
                }
              />
              <input
                className="mad-input"
                type="number"
                min={0}
                placeholder="Крачки"
                value={stepsForm.steps}
                onChange={(event) =>
                  setStepsForm({
                    ...stepsForm,
                    steps: Number(event.target.value),
                  })
                }
              />
              <input
                className="mad-input"
                type="number"
                placeholder="Точки"
                value={stepsForm.points}
                onChange={(event) =>
                  setStepsForm({
                    ...stepsForm,
                    points: Number(event.target.value),
                  })
                }
              />
            </div>

            <button onClick={addSteps} className="mad-btn">
              Запиши крачки
            </button>
          </div>

          <div className="mad-card p-5 space-y-4">
            <h2 className="text-xl font-black">Ръчни точки</h2>
            <div className="grid md:grid-cols-2 gap-3">
              <select
                className="mad-input"
                value={manualPoints.player_id}
                onChange={(event) =>
                  setManualPoints({
                    ...manualPoints,
                    player_id: event.target.value,
                  })
                }
              >
                <option value="">Избери участник</option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name} · PIN {player.pin}
                  </option>
                ))}
              </select>
              <select
                className="mad-input"
                value={manualPoints.type}
                onChange={(event) =>
                  setManualPoints({ ...manualPoints, type: event.target.value })
                }
              >
                <option value="bonus">Бонус</option>
                <option value="achievement">Achievement</option>
                <option value="heart_rate">Пулс</option>
                <option value="steps">Крачки</option>
                <option value="penalty">Наказание</option>
              </select>
              <input
                className="mad-input"
                placeholder="Заглавие"
                value={manualPoints.title}
                onChange={(event) =>
                  setManualPoints({
                    ...manualPoints,
                    title: event.target.value,
                  })
                }
              />
              <input
                className="mad-input"
                type="number"
                placeholder="Точки"
                value={manualPoints.points}
                onChange={(event) =>
                  setManualPoints({
                    ...manualPoints,
                    points: Number(event.target.value),
                  })
                }
              />
              <input
                className="mad-input md:col-span-2"
                placeholder="Бележка"
                value={manualPoints.note}
                onChange={(event) =>
                  setManualPoints({ ...manualPoints, note: event.target.value })
                }
              />
            </div>
            <button onClick={addManualPoints} className="mad-btn">
              Добави точки
            </button>
          </div>
        </section>

        <section className="mad-card p-5 space-y-4">
          <h2 className="text-xl font-black">Последни записи</h2>
          <div className="space-y-2">
            {events.map((event) => (
              <div
                key={event.id}
                className="mad-card-solid p-3 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="font-bold">{event.title}</p>
                  <p className="text-sm mad-muted">
                    {getPlayerName(event)}
                    {getGameTitle(event) ? ` · ${getGameTitle(event)}` : ""}
                    {event.note ? ` · ${event.note}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <b
                    className={
                      event.points >= 0
                        ? "text-green-300 text-xl"
                        : "text-red-300 text-xl"
                    }
                  >
                    {event.points > 0 ? "+" : ""}
                    {event.points}
                  </b>
                  <button
                    onClick={() => deleteEvent(event.id)}
                    className="mad-btn-secondary"
                  >
                    Изтрий
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
