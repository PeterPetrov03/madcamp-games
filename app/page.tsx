"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type PublicPlayer = {
  id: string;
  name: string;
  avatar_url: string | null;
  total_points: number;
  game_points: number;
};

type Game = {
  id: string;
  title: string;
};

type Round = {
  id: string;
  game_id: string;
  round_number: number;
};

type FeedEvent = {
  id: string;
  type: "game" | "achievement" | "steps" | "heart_rate" | "bonus" | "penalty";
  title: string;
  points: number;
  round_number: number | null;
  created_at: string;
  players?: { name: string } | { name: string }[] | null;
  games?: { title: string } | { title: string }[] | null;
};

function getPlayerName(event: FeedEvent) {
  if (Array.isArray(event.players)) return event.players[0]?.name || "Участник";
  return event.players?.name || "Участник";
}

function getGameTitle(event: FeedEvent) {
  if (Array.isArray(event.games)) return event.games[0]?.title || "Игра";
  return event.games?.title || "Игра";
}

function feedLabel(event: FeedEvent) {
  if (event.type === "game") {
    return `${getGameTitle(event)}${event.round_number ? ` · Рунд ${event.round_number}` : ""}`;
  }

  if (event.type === "achievement") return `Achievement · ${event.title}`;
  if (event.type === "steps") return `Крачки · ${event.title}`;
  if (event.type === "heart_rate") return `Пулс · ${event.title}`;
  if (event.type === "bonus") return `Бонус · ${event.title}`;
  if (event.type === "penalty") return "Промяна в точки";

  return event.title;
}

function getInitials(name: string) {
  return (
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?"
  );
}

function pointsNeededForTop4(
  player: PublicPlayer,
  index: number,
  fourthPlace?: PublicPlayer,
) {
  if (index < 4) return 0;
  if (!fourthPlace) return 0;
  return Math.max(
    (fourthPlace.total_points || 0) - (player.total_points || 0) + 1,
    1,
  );
}

export default function PublicHomePage() {
  const [players, setPlayers] = useState<PublicPlayer[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const topPlayers = useMemo(() => players.slice(0, 8), [players]);
  const finalists = useMemo(() => players.slice(0, 4), [players]);
  const nextChallenger = players[4];
  const fourthPlace = players[3];
  const totalRounds = rounds.length;

  const cutLineDifference =
    fourthPlace && nextChallenger
      ? Math.max(
          (fourthPlace.total_points || 0) -
            (nextChallenger.total_points || 0) +
            1,
          1,
        )
      : null;

  async function loadPublicData() {
    setLoading(true);

    const [leaderboardRes, gamesRes, roundsRes, feedRes] = await Promise.all([
      supabase
        .from("leaderboard")
        .select("id,name,avatar_url,total_points,game_points")
        .order("total_points", { ascending: false }),

      supabase
        .from("games")
        .select("id,title")
        .order("created_at", { ascending: true }),

      supabase
        .from("game_rounds")
        .select("id,game_id,round_number")
        .order("round_number", { ascending: true }),

      supabase
        .from("point_events")
        .select(
          "id,type,title,points,round_number,created_at,players(name),games(title)",
        )
        .neq("type", "penalty")
        .order("created_at", { ascending: false })
        .limit(15),
    ]);

    if (!leaderboardRes.error)
      setPlayers((leaderboardRes.data || []) as PublicPlayer[]);
    if (!gamesRes.error) setGames((gamesRes.data || []) as Game[]);
    if (!roundsRes.error) setRounds((roundsRes.data || []) as Round[]);
    if (!feedRes.error) setFeed((feedRes.data || []) as FeedEvent[]);

    setLoading(false);
  }

  useEffect(() => {
    loadPublicData();

    const channel = supabase
      .channel("public-home-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players" },
        loadPublicData,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games" },
        loadPublicData,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_rounds" },
        loadPublicData,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "point_events" },
        loadPublicData,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <main className="min-h-screen py-6 space-y-6">
      <div className="mad-shell space-y-6">
        <header className="py-6 flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
          <div>
            <p className="mad-kicker">MAD CAMP Games</p>
            <h1 className="text-4xl font-black">Лагерен турнир</h1>
            <p className="mad-muted max-w-2xl">
              Публична класация в реално време. Тук няма PIN кодове, лични
              бележки или лична история на участниците.
            </p>
          </div>

          <div className="flex gap-3">
            <Link href="/profile" className="mad-btn-secondary">
              Моят профил
            </Link>
            <Link href="/login" className="mad-btn-secondary">
              Admin
            </Link>
          </div>
        </header>

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
            <b className="text-3xl">{totalRounds}</b>
          </div>

          <div className="mad-card p-4">
            <p className="mad-muted">Лидер</p>
            <b className="text-3xl">{topPlayers[0]?.name || "—"}</b>
          </div>
        </section>

        <section className="mad-card p-5 space-y-4 border-yellow-500/40">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-yellow-300 uppercase tracking-[0.25em] font-black">
                Final Zone
              </p>
              <h2 className="text-2xl font-black">
                Топ 4 финалисти към момента
              </h2>
            </div>
            {loading && (
              <span className="text-sm mad-muted">Обновяване...</span>
            )}
          </div>

          <div className="grid md:grid-cols-4 gap-3">
            {finalists.map((player, index) => (
              <div key={player.id} className="mad-card-solid p-4">
                <p className="text-sm mad-muted">{index + 1}. място</p>
                <h3 className="text-xl font-black">{player.name}</h3>
                <p className="text-yellow-300 font-bold">
                  {player.total_points || 0} точки
                </p>
                <p className="text-xs text-green-300 mt-1">
                  В момента е във финала ✅
                </p>
              </div>
            ))}

            {!finalists.length && (
              <p className="mad-muted">
                Все още няма достатъчно точки за финалисти.
              </p>
            )}
          </div>

          {nextChallenger && fourthPlace && cutLineDifference !== null && (
            <div className="mad-card-solid p-4">
              <p className="text-slate-300">
                <b>{nextChallenger.name}</b> е първи/a извън финала и му/и трябват
                още <b className="text-yellow-300">{cutLineDifference}</b>{" "}
                точки, за да влезе в Топ 4.
              </p>
            </div>
          )}
        </section>

        <section className="mad-card p-4 overflow-hidden border-indigo-500/30">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="shrink-0">
              <p className="mad-kicker">Live Feed</p>
              <h2 className="text-xl font-black">Последни 15 събития</h2>
            </div>

            <div className="feed-ticker">
              <div className="feed-ticker-track">
                {feed.map((event, index) => (
                  <div
                    key={`${event.id}-${index}`}
                    className="feed-ticker-item"
                  >
                    <span className="font-black">{getPlayerName(event)}</span>
                    <span className="text-slate-400">{feedLabel(event)}</span>
                    <span
                      className={
                        event.points >= 0
                          ? "text-green-300 font-black"
                          : "text-red-300 font-black"
                      }
                    >
                      {event.points > 0 ? "+" : ""}
                      {event.points}
                    </span>
                  </div>
                ))}

                {!feed.length && (
                  <div className="feed-ticker-item">
                    <span className="font-black">Все още няма събития</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
          <div className="mad-card p-5 space-y-4">
            <h2 className="text-xl font-black">Класация</h2>

            <div className="space-y-2">
              {topPlayers.map((player, index) => {
                const rankClass =
                  index === 0
                    ? "gold"
                    : index === 1
                      ? "silver"
                      : index === 2
                        ? "bronze"
                        : "";
                const needed = pointsNeededForTop4(player, index, fourthPlace);

                return (
                  <div
                    key={player.id}
                    className="flex items-center justify-between rounded-xl bg-slate-800/70 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`mad-rank-badge ${rankClass}`}>
                        {index + 1}
                      </div>

                      <div
                        className={`leaderboard-avatar ${
                          index === 0
                            ? "leaderboard-avatar-gold"
                            : index === 1
                              ? "leaderboard-avatar-silver"
                              : index === 2
                                ? "leaderboard-avatar-bronze"
                                : ""
                        }`}
                      >
                        {player.avatar_url ? (
                          <img
                            src={player.avatar_url}
                            alt={player.name}
                            className="leaderboard-avatar-image"
                          />
                        ) : (
                          getInitials(player.name)
                        )}
                      </div>

                      <div>
                        <p className="font-bold">{player.name}</p>
                        <p className="text-sm mad-muted">Общо точки</p>
                        {index < 4 ? (
                          <p className="text-xs text-green-300">
                            В момента е във финала ✅
                          </p>
                        ) : (
                          <p className="text-xs text-yellow-300">
                            Трябват още {needed} т. до Топ 4
                          </p>
                        )}
                      </div>
                    </div>

                    <b className="text-2xl">{player.total_points || 0}</b>
                  </div>
                );
              })}

              {!players.length && (
                <p className="mad-muted">Все още няма участници или точки.</p>
              )}
            </div>
          </div>

          <div className="mad-card p-5 space-y-4">
            <h2 className="text-xl font-black">Игри</h2>

            <div className="space-y-2">
              {games.map((game) => {
                const gameRounds = rounds.filter(
                  (round) => round.game_id === game.id,
                );

                return (
                  <div key={game.id} className="rounded-xl bg-slate-800/70 p-3">
                    <p className="font-bold">{game.title}</p>
                    <p className="text-sm mad-muted">
                      {gameRounds.length} рунда
                    </p>
                  </div>
                );
              })}

              {!games.length && (
                <p className="mad-muted">Все още няма добавени игри.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
