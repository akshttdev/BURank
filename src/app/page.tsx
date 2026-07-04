"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { LeetCodeUser } from "@/types";
import AddUserModal from "@/components/AddUserModal";
import ChampionsPodium from "@/components/leaderboard/ChampionsPodium";
import HighlightCards from "@/components/leaderboard/HighlightCards";
import LeaderboardTable from "@/components/leaderboard/LeaderboardTable";

type ViewMode = "individuals" | "batches";

interface BatchData {
  year: string;
  totalStudents: number;
  totalSolved: number;
  avgSolved: number;
  totalEasy: number;
  totalMedium: number;
  totalHard: number;
}

export default function LeaderboardPage() {
  const [users, setUsers] = useState<LeetCodeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [firstBlood, setFirstBlood] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("individuals");
  const { data: session } = useSession();
  const currentEmail = session?.user?.email ?? null;

  const isRegistered =
    !!currentEmail &&
    users.some(
      (u) => u.email?.toLowerCase() === currentEmail.toLowerCase(),
    );

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, qotwRes] = await Promise.all([
        fetch("/api/leaderboard", { cache: "no-store" }),
        fetch("/api/qotw", { cache: "no-store" }),
      ]);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      const qotwData = await qotwRes.json();

      setUsers(data.users ?? []);
      setFirstBlood(qotwData.first_blood || "");
      setLastRefreshed(new Date());
    } catch {
      setError("Could not load leaderboard. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Sorted + searched list for the table
  const processed = useMemo(() => {
    let list = [...users].filter((u) => !u.error);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          u.realName.toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => b.totalSolved - a.totalSolved);
    return list;
  }, [users, search]);

  // Top-3 by total solved, independent of the search box
  const topThree = useMemo(
    () =>
      [...users]
        .filter((u) => !u.error)
        .sort((a, b) => b.totalSolved - a.totalSolved)
        .slice(0, 3),
    [users],
  );

  const batchStats = useMemo(() => {
    const batches: Record<string, BatchData> = {};
    users
      .filter((u) => !u.error)
      .forEach((u) => {
        const year = u.yearStudying || "Unknown";
        if (!batches[year]) {
          batches[year] = {
            year,
            totalStudents: 0,
            totalSolved: 0,
            avgSolved: 0,
            totalEasy: 0,
            totalMedium: 0,
            totalHard: 0,
          };
        }
        batches[year].totalStudents++;
        batches[year].totalSolved += u.totalSolved;
        batches[year].totalEasy += u.easySolved;
        batches[year].totalMedium += u.mediumSolved;
        batches[year].totalHard += u.hardSolved;
      });

    return Object.values(batches)
      .map((b) => {
        b.avgSolved = Math.round(b.totalSolved / b.totalStudents);
        return b;
      })
      .sort((a, b) => b.avgSolved - a.avgSolved);
  }, [users]);

  const registeredCount = users.filter((u) => !u.error).length;

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Navbar: search left, actions right */}
      <div className="topbar">
        <div className="search">
          <span className="s-ic">⌕</span>
          <input
            placeholder="Search coders, usernames, batches…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="nav-actions">
          <button className="max-md:hidden chip-btn" onClick={fetchLeaderboard} disabled={loading}>
            ↻ {loading ? "Loading…" : "Refresh"}
          </button>
          {session ? (
            <>
              {!isRegistered && (
                <button className="chip-btn primary" onClick={() => setShowModal(true)}>
                  + Join Leaderboard
                </button>
              )}
              <button className="chip-btn" onClick={() => signOut({ callbackUrl: "/" })}>
                Logout
              </button>
            </>
          ) : (
            <button
              className="chip-btn primary"
              onClick={() => signIn(undefined, { callbackUrl: "/" })}
            >
              Sign In
            </button>
          )}
        </div>
      </div>

      {/* segmented toggle */}
      <div className="seg-wrap">
        <div className="segmented">
          <button
            className={viewMode === "individuals" ? "on" : ""}
            onClick={() => setViewMode("individuals")}
          >
            Individuals
          </button>
          <button
            className={viewMode === "batches" ? "on" : ""}
            onClick={() => setViewMode("batches")}
          >
            Batch Wars
          </button>
        </div>
      </div>

      {viewMode === "individuals" ? (
        <>
          <div className="wrap hero-wrap">
            {!loading && <ChampionsPodium top={topThree} />}
          </div>

          <section className="sheet">
            <div className="sheet-inner">
              <HighlightCards users={users} firstBlood={firstBlood} />

              <div className="max-sm:hidden board-head" style={{ marginTop: 28 }}>
                <h2>All Coders · {registeredCount} registered</h2>
                <div className="re">
                  {lastRefreshed ? `↻ Refreshed ${lastRefreshed.toLocaleTimeString()}` : ""} · every 30 min
                </div>
              </div>

              {error && (
                <div style={{ color: "var(--hard)", padding: "8px 6px" }}>{error}</div>
              )}

              {loading ? (
                <div className="board">
                  <div className="list-scroll">
                    <div className="rows">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div className="row" key={i}>
                          <div className="inner" style={{ cursor: "default" }}>
                            <div
                              className="skeleton"
                              style={{ height: 20, gridColumn: "1 / -1" }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : processed.length === 0 ? (
                <div style={{ padding: "48px 6px", textAlign: "center", color: "var(--sub)" }}>
                  {search ? "No coders match your search." : "No coders on the leaderboard yet."}
                </div>
              ) : (
                <LeaderboardTable users={processed} />
              )}
            </div>
          </section>
        </>
      ) : (
        <section className="sheet">
          <div className="sheet-inner">
            <div
              className="highlights"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
            >
              {batchStats.map((batch) => (
                <div key={batch.year} className="hl" style={{ display: "block", padding: 20 }}>
                  <div className="lab">
                    Batch {batch.year === "Unknown" ? "Unassigned" : batch.year} ·{" "}
                    {batch.totalStudents} coders
                  </div>
                  <div className="num" style={{ marginTop: 6 }}>
                    {batch.avgSolved}
                  </div>
                  <div className="lab" style={{ marginTop: 4 }}>
                    avg solved · {batch.totalEasy}E / {batch.totalMedium}M / {batch.totalHard}H
                  </div>
                </div>
              ))}
              {batchStats.length === 0 && (
                <div style={{ padding: "48px 6px", textAlign: "center", color: "var(--sub)" }}>
                  No batch data yet.
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {showModal && (
        <AddUserModal onClose={() => setShowModal(false)} onSuccess={fetchLeaderboard} />
      )}
    </div>
  );
}
