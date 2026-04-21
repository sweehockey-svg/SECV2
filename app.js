const DATA_SOURCES = {
  sheet: window.SEC_CONFIG?.sheetUrl || "",
  database: window.SEC_CONFIG?.databaseUrl || ""
};

const FALLBACK_DATA = {
  cups: [
    {
      id: "1",
      sortOrder: 1,
      code: "SEC 1",
      name: "Svenska eHockey Cupen 1",
      badge: "Historik",
      placements: {
        first: "Frolunda",
        second: "Lulea"
      },
      matches: [
        {
          date: "2026-04-20",
          time: "20:00",
          awayTeam: "Frolunda",
          awayScore: 2,
          homeTeam: "Lulea",
          homeScore: 3,
          overtime: false,
          stage: "group",
          group: "Grupp A",
          goalsSummary: "1-0 Karlsson | 2-0 Andersson | 2-1 Olsson"
        },
        {
          date: "2026-04-22",
          time: "20:30",
          awayTeam: "Lulea",
          awayScore: 1,
          homeTeam: "Frolunda",
          homeScore: 4,
          overtime: false,
          stage: "playoffs",
          group: "Final",
          goalsSummary: "1-0 FezH_88 | 2-0 Maxboeeee | 3-0 LordOlii"
        }
      ],
      playerStats: {
        group: [
          { player: "FezH_88", team: "Frolunda", gp: 2, g: 3, a: 2, pts: 5, pim: 0, playerId: "123" },
          { player: "LordOlii", team: "Frolunda", gp: 2, g: 1, a: 2, pts: 3, pim: 2, playerId: "124" },
          { player: "Dan9105", team: "Lulea", gp: 2, g: 1, a: 1, pts: 2, pim: 0, playerId: "125" }
        ],
        playoffs: [
          { player: "FezH_88", team: "Frolunda", gp: 1, g: 2, a: 1, pts: 3, pim: 0, playerId: "123" }
        ]
      },
      goalieStats: {
        group: [
          { player: "Mlv Frolunda", team: "Frolunda", gp: 2, sa: 42, ga: 3, sv: 39, gaa: 1.5, svp: 0.929, so: 0, playerId: "456" },
          { player: "Mlv Lulea", team: "Lulea", gp: 2, sa: 50, ga: 6, sv: 44, gaa: 3.0, svp: 0.88, so: 0, playerId: "457" }
        ],
        playoffs: [
          { player: "Mlv Frolunda", team: "Frolunda", gp: 1, sa: 22, ga: 1, sv: 21, gaa: 1, svp: 0.955, so: 0, playerId: "456" }
        ]
      }
    },
    {
      id: "sommar-21",
      sortOrder: 21.1,
      code: "SEC Sommar 21",
      name: "SEC Sommar 21",
      badge: "Sommar",
      placements: {
        first: "Modo",
        second: "Brynas"
      },
      matches: [
        {
          date: "2026-07-02",
          time: "21:00",
          awayTeam: "Modo",
          awayScore: 5,
          homeTeam: "Brynas",
          homeScore: 2,
          overtime: false,
          stage: "playoffs",
          group: "Final",
          goalsSummary: "Modo avgjorde i tredje perioden."
        }
      ],
      playerStats: {
        group: [
          { player: "Toivo", team: "Modo", gp: 3, g: 4, a: 2, pts: 6, pim: 0, playerId: "901" }
        ],
        playoffs: [
          { player: "Toivo", team: "Modo", gp: 1, g: 2, a: 1, pts: 3, pim: 0, playerId: "901" }
        ]
      },
      goalieStats: {
        group: [],
        playoffs: [
          { player: "Jemmmuu", team: "Modo", gp: 1, sa: 25, ga: 2, sv: 23, gaa: 2, svp: 0.92, so: 0, playerId: "902" }
        ]
      }
    }
  ]
};

const state = {
  cups: [],
  teams: [],
  players: [],
  ready: false
};

const appView = document.querySelector("#app-view");

window.addEventListener("hashchange", renderCurrentRoute);
window.addEventListener("error", function(event) {
  showFatalError(event.error || event.message || "Okant fel i JavaScript.");
});
window.addEventListener("unhandledrejection", function(event) {
  showFatalError(event.reason || "Ohanterat fel i Promise.");
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

async function init() {
  try {
    const cups = await loadCups();
    const normalizedCups = normalizeCups(cups);

    state.cups = normalizedCups;
    state.teams = buildTeams(normalizedCups);
    state.players = buildPlayers(normalizedCups);
    state.ready = true;

    renderCurrentRoute();
  } catch (error) {
    console.error(error);
    state.cups = normalizeCups(FALLBACK_DATA.cups);
    state.teams = buildTeams(state.cups);
    state.players = buildPlayers(state.cups);
    state.ready = true;
    renderCurrentRoute();
  }
}

async function loadCups() {
  const results = await Promise.allSettled([
    loadSource(DATA_SOURCES.sheet),
    loadSource(DATA_SOURCES.database)
  ]);

  const merged = [];

  results.forEach(function(result) {
    if (result.status === "fulfilled" && Array.isArray(result.value)) {
      merged.push.apply(merged, result.value);
    }
  });

  const deduped = new Map();

  merged.forEach(function(cup) {
    const key = String(cup.id || cup.code || cup.name || Math.random());
    deduped.set(key, cup);
  });

  if (!deduped.size) {
    return FALLBACK_DATA.cups;
  }

  return Array.from(deduped.values());
}

async function loadSource(url) {
  if (!url) {
    return [];
  }

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Request failed for " + url);
  }

  const data = await response.json();
  if (Array.isArray(data)) {
    return data;
  }
  if (Array.isArray(data.cups)) {
    return data.cups;
  }
  return [];
}

function normalizeCups(cups) {
  return cups
    .map(function(cup, index) {
      const groupPlayers = normalizePlayerRows(cup.playerStats?.group || [], "group");
      const playoffPlayers = normalizePlayerRows(cup.playerStats?.playoffs || [], "playoffs");
      const groupGoalies = normalizeGoalieRows(cup.goalieStats?.group || [], "group");
      const playoffGoalies = normalizeGoalieRows(cup.goalieStats?.playoffs || [], "playoffs");
      const allPlayerStats = groupPlayers.concat(playoffPlayers);
      const allGoalieStats = groupGoalies.concat(playoffGoalies);
      const topScorer = allPlayerStats
        .slice()
        .sort(function(a, b) {
          return (b.pts - a.pts) || (b.g - a.g) || a.player.localeCompare(b.player, "sv");
        })[0] || null;

      const normalizedMatches = (cup.matches || []).map(function(match, matchIndex) {
        return {
          id: createMatchId(cup.id || index + 1, matchIndex),
          date: match.date || "",
          time: match.time || "",
          awayTeam: match.awayTeam || "Okant lag",
          awayScore: toNullableNumber(match.awayScore),
          homeScore: toNullableNumber(match.homeScore),
          homeTeam: match.homeTeam || "Okant lag",
          overtime: Boolean(match.overtime),
          stage: normalizeStage(match.stage),
          group: match.group || "",
          goalsSummary: match.goalsSummary || ""
        };
      });

      return {
        id: String(cup.id || index + 1),
        sortOrder: typeof cup.sortOrder === "number" ? cup.sortOrder : inferSortOrder(cup.code || cup.name || cup.id || index + 1),
        code: String(cup.code || ("SEC " + (index + 1))),
        name: String(cup.name || cup.code || ("Svenska eHockey Cupen " + (index + 1))),
        badge: String(cup.badge || ""),
        winner: String(cup.placements?.first || "Ej klar"),
        runnerUp: String(cup.placements?.second || "Ej klar"),
        placements: {
          first: cup.placements?.first || "",
          second: cup.placements?.second || ""
        },
        matches: normalizedMatches,
        playerStats: {
          group: groupPlayers,
          playoffs: playoffPlayers
        },
        goalieStats: {
          group: groupGoalies,
          playoffs: playoffGoalies
        },
        matchCount: normalizedMatches.length,
        topScorer: topScorer ? formatPlayerLabel(topScorer) : "Ingen data an"
      };
    })
    .sort(function(a, b) {
      return b.sortOrder - a.sortOrder;
    });
}

function normalizePlayerRows(rows, stage) {
  return rows.map(function(row) {
    return {
      player: String(row.player || "Okand spelare"),
      team: String(row.team || "Okant lag"),
      gp: toNumber(row.gp),
      g: toNumber(row.g),
      a: toNumber(row.a),
      pts: toNumber(row.pts),
      pim: toNumber(row.pim),
      playerId: row.playerId ? String(row.playerId) : "",
      stage: stage
    };
  });
}

function normalizeGoalieRows(rows, stage) {
  return rows.map(function(row) {
    return {
      player: String(row.player || "Okand malvakt"),
      team: String(row.team || "Okant lag"),
      gp: toNumber(row.gp),
      sa: toNumber(row.sa),
      ga: toNumber(row.ga),
      sv: toNumber(row.sv),
      gaa: toNumber(row.gaa),
      svp: row.svp === null || typeof row.svp === "undefined" ? null : Number(row.svp),
      so: toNumber(row.so),
      playerId: row.playerId ? String(row.playerId) : "",
      stage: stage
    };
  });
}

function buildTeams(cups) {
  const map = new Map();

  cups.forEach(function(cup) {
    const rows = []
      .concat(cup.playerStats.group)
      .concat(cup.playerStats.playoffs)
      .concat(cup.goalieStats.group)
      .concat(cup.goalieStats.playoffs);

    cup.matches.forEach(function(match) {
      ensureTeam(map, match.homeTeam);
      ensureTeam(map, match.awayTeam);

      addMatchToTeam(map.get(createTeamKey(match.homeTeam)), cup, match, true);
      addMatchToTeam(map.get(createTeamKey(match.awayTeam)), cup, match, false);
    });

    rows.forEach(function(row) {
      ensureTeam(map, row.team);
      const team = map.get(createTeamKey(row.team));
      team.cups.push({ id: cup.id, code: cup.code, name: cup.name });

      if (typeof row.g !== "undefined") {
        team.playerRows.push({
          cupId: cup.id,
          cupCode: cup.code,
          player: row.player,
          playerId: row.playerId,
          gp: row.gp,
          g: row.g,
          a: row.a,
          pts: row.pts,
          pim: row.pim,
          stage: row.stage
        });
      } else {
        team.goalieRows.push({
          cupId: cup.id,
          cupCode: cup.code,
          player: row.player,
          playerId: row.playerId,
          gp: row.gp,
          svp: row.svp,
          gaa: row.gaa,
          sv: row.sv,
          ga: row.ga,
          so: row.so,
          stage: row.stage
        });
      }
    });
  });

  return Array.from(map.values())
    .map(function(team) {
      team.cups = uniqueBy(team.cups, "id").sort(function(a, b) {
        return inferSortOrder(b.id) - inferSortOrder(a.id);
      });
      team.matches.sort(compareTeamMatchRowsDesc);
      return team;
    })
    .sort(function(a, b) {
      return a.name.localeCompare(b.name, "sv");
    });
}

function ensureTeam(map, teamName) {
  const key = createTeamKey(teamName);
  if (!map.has(key)) {
    map.set(key, {
      key: key,
      name: teamName,
      cups: [],
      matches: [],
      playerRows: [],
      goalieRows: [],
      wins: 0,
      losses: 0,
      otLosses: 0,
      goalsFor: 0,
      goalsAgainst: 0
    });
  }
}

function addMatchToTeam(team, cup, match, isHome) {
  if (!team) {
    return;
  }

  const goalsFor = isHome ? match.homeScore : match.awayScore;
  const goalsAgainst = isHome ? match.awayScore : match.homeScore;

  team.cups.push({ id: cup.id, code: cup.code, name: cup.name });
  team.matches.push({
    cupId: cup.id,
    cupCode: cup.code,
    opponent: isHome ? match.awayTeam : match.homeTeam,
    isHome: isHome,
    goalsFor: goalsFor,
    goalsAgainst: goalsAgainst,
    overtime: match.overtime,
    date: match.date,
    time: match.time,
    stage: match.stage
  });

  team.goalsFor += toNumber(goalsFor);
  team.goalsAgainst += toNumber(goalsAgainst);

  if (toNumber(goalsFor) > toNumber(goalsAgainst)) {
    team.wins += 1;
  } else if (match.overtime) {
    team.otLosses += 1;
  } else {
    team.losses += 1;
  }
}

function buildPlayers(cups) {
  const map = new Map();

  cups.forEach(function(cup) {
    cup.playerStats.group.concat(cup.playerStats.playoffs).forEach(function(row) {
      const key = createPlayerKey(row);
      if (!map.has(key)) {
        map.set(key, createEmptyPlayer(row, key));
      }

      const player = map.get(key);
      player.teamNames.add(row.team);
      player.cups.push({ id: cup.id, code: cup.code });
      player.skaterRows.push({
        cupId: cup.id,
        cupCode: cup.code,
        team: row.team,
        gp: row.gp,
        g: row.g,
        a: row.a,
        pts: row.pts,
        pim: row.pim,
        stage: row.stage
      });
      player.totals.gp += row.gp;
      player.totals.g += row.g;
      player.totals.a += row.a;
      player.totals.pts += row.pts;
      player.totals.pim += row.pim;
    });

    cup.goalieStats.group.concat(cup.goalieStats.playoffs).forEach(function(row) {
      const key = createPlayerKey(row);
      if (!map.has(key)) {
        map.set(key, createEmptyPlayer(row, key));
      }

      const player = map.get(key);
      player.teamNames.add(row.team);
      player.cups.push({ id: cup.id, code: cup.code });
      player.goalieRows.push({
        cupId: cup.id,
        cupCode: cup.code,
        team: row.team,
        gp: row.gp,
        svp: row.svp,
        gaa: row.gaa,
        sv: row.sv,
        ga: row.ga,
        sa: row.sa,
        so: row.so,
        stage: row.stage
      });
    });
  });

  return Array.from(map.values())
    .map(function(player) {
      player.teamNames = Array.from(player.teamNames).sort(function(a, b) {
        return a.localeCompare(b, "sv");
      });
      player.cups = uniqueBy(player.cups, "id").sort(function(a, b) {
        return inferSortOrder(b.id) - inferSortOrder(a.id);
      });
      return player;
    })
    .sort(function(a, b) {
      return a.name.localeCompare(b.name, "sv");
    });
}

function createEmptyPlayer(row, key) {
  return {
    key: key,
    playerId: row.playerId || "",
    name: row.player,
    teamNames: new Set(),
    cups: [],
    skaterRows: [],
    goalieRows: [],
    totals: { gp: 0, g: 0, a: 0, pts: 0, pim: 0 }
  };
}

function renderCurrentRoute() {
  if (!state.ready) {
    setView(renderLoadingState());
    return;
  }

  const route = parseRoute();
  let html = "";

  if (route.type === "home") {
    html = renderHomePage();
  } else if (route.type === "cups") {
    html = renderCupsIndex();
  } else if (route.type === "cup") {
    const cup = state.cups.find(function(entry) { return entry.id === route.id; });
    html = cup ? renderCupPage(cup) : renderNotFound("Cupen kunde inte hittas.");
  } else if (route.type === "teams") {
    html = renderTeamsIndex();
  } else if (route.type === "team") {
    const team = state.teams.find(function(entry) { return entry.key === route.id; });
    html = team ? renderTeamPage(team) : renderNotFound("Laget kunde inte hittas.");
  } else if (route.type === "players") {
    html = renderPlayersIndex();
  } else if (route.type === "player") {
    const player = state.players.find(function(entry) { return entry.key === route.id; });
    html = player ? renderPlayerPage(player) : renderNotFound("Spelaren kunde inte hittas.");
  } else {
    html = renderNotFound("Sidan kunde inte hittas.");
  }

  setView(html);
  updateNavState(route);
}

function renderHomePage() {
  const categories = splitCupsByCategory(state.cups);
  const totalMatches = sumBy(state.cups, "matchCount");

  return `
    <section class="sec-index-shell">
      <a href="#/" class="sec-header-link" aria-label="Svenska eHockey Cupen">
        <div class="sfc-header">
          <img class="sfc-logo" src="./SECLOGGA.png" alt="SEC Logo">
          <div class="sfc-title">Svenska eHockey <strong>Cupen</strong></div>
          <div class="sfc-divider"></div>
        </div>
      </a>

      ${renderGlobalSearchModule()}

      <section class="tab-panel info-panel">
        <h2>Valkommen</h2>
        <p>
          Valkommen till Svenska eHockey Cupen, en samlad hubb for matcher, tabeller,
          slutspel, lag och spelarstatistik. Startsidan ska ligga narmare din gamla SEC-sida,
          men vara enklare att bygga vidare pa i den nya strukturen.
        </p>
        <p>
          Just nu finns <strong>${state.cups.length}</strong> cuper, <strong>${totalMatches}</strong> matcher,
          <strong>${state.teams.length}</strong> lag och <strong>${state.players.length}</strong> spelare i arkivet.
        </p>
      </section>

      <section class="tab-panel cups-panel">
        <h2>Valj turnering</h2>
        <div class="cup-status">
          Visar ${state.cups.length} cup${state.cups.length === 1 ? "" : "er"}.
        </div>

        <div class="cup-section">
          <h3 class="cup-section-title">Svenska eHockey Cupen</h3>
          <div class="cup-list">
            ${categories.regular.length ? categories.regular.map(renderCupCard).join("") : renderEmptyCupState("Inga vanliga SEC-cuper hittades.")}
          </div>
        </div>

        <div class="cup-sep"></div>

        <div class="cup-section">
          <h3 class="cup-section-title">SEC Sommar</h3>
          <div class="cup-list">
            ${categories.sommar.length ? categories.sommar.map(renderCupCard).join("") : renderEmptyCupState("Inga sommarcuper hittades.")}
          </div>
        </div>

        ${categories.challenger.length ? `
          <div class="cup-sep"></div>
          <div class="cup-section">
            <h3 class="cup-section-title">Challenger</h3>
            <div class="cup-list">
              ${categories.challenger.map(renderCupCard).join("")}
            </div>
          </div>
        ` : ""}
      </section>

      <footer id="sec-footer-wrapper">
        <div class="sec-footer-glow"></div>
        <div id="sec-footer-line"></div>
        <div id="sec-footer-text">
          © 2026 <span>Svenska eHockey Cupen</span> | Design & utveckling av <span>Svensk eHockey</span>
        </div>
      </footer>
    </section>
  `;
}

function renderCupsIndex() {
  const categories = splitCupsByCategory(state.cups);

  return `
    <section class="tab-panel cups-panel">
      <h2>Alla SEC-cuper</h2>
      <div class="cup-status">
        Hela arkivet med ordinarie cuper, sommarcuper och challengerupplagor.
      </div>

      <div class="cup-section">
        <h3 class="cup-section-title">Svenska eHockey Cupen</h3>
        <div class="cup-list">
          ${categories.regular.length ? categories.regular.map(renderCupCard).join("") : renderEmptyCupState("Inga vanliga SEC-cuper hittades.")}
        </div>
      </div>

      <div class="cup-sep"></div>

      <div class="cup-section">
        <h3 class="cup-section-title">SEC Sommar</h3>
        <div class="cup-list">
          ${categories.sommar.length ? categories.sommar.map(renderCupCard).join("") : renderEmptyCupState("Inga sommarcuper hittades.")}
        </div>
      </div>

      ${categories.challenger.length ? `
        <div class="cup-sep"></div>
        <div class="cup-section">
          <h3 class="cup-section-title">Challenger</h3>
          <div class="cup-list">
            ${categories.challenger.map(renderCupCard).join("")}
          </div>
        </div>
      ` : ""}
    </section>
  `;
}

function renderCupPage(cup) {
  const overview = getCupOverview(cup);
  const groupStandings = buildGroupStandings(cup.matches);
  const playoffRounds = buildPlayoffRounds(cup.matches);

  return `
    <section class="cup-hero">
      <div class="cup-hero-main">
        <div class="breadcrumbs">
          <a href="#/">Start</a>
          <span>/</span>
          <a href="#/cups">Cuper</a>
          <span>/</span>
          <strong>${escapeHtml(cup.code)}</strong>
        </div>
        <p class="eyebrow">${escapeHtml(cup.code)}</p>
        <h1 class="page-title">${escapeHtml(cup.name)}</h1>
        <p class="page-intro">
          Cupsidan visar oversikt, tabeller, lag, topplistor och matcher for den valda turneringen.
        </p>
        <div class="summary-ribbon">
          <span>${overview.teams.length} lag</span>
          <span>${overview.groupMatches.length} gruppmatcher</span>
          <span>${overview.playoffMatches.length} slutspelsmatcher</span>
        </div>
      </div>

      <aside class="cup-hero-side">
        <p class="entity-label">Final</p>
        <div class="cup-finals">
          <div class="cup-finals-team">
            ${renderTeamLogo(cup.winner, "team-logo-lg")}
            <strong>${escapeHtml(cup.winner)}</strong>
            <span>Vinnare</span>
          </div>
          <div class="cup-finals-divider">vs</div>
          <div class="cup-finals-team">
            ${renderTeamLogo(cup.runnerUp, "team-logo-lg")}
            <strong>${escapeHtml(cup.runnerUp)}</strong>
            <span>Finalist</span>
          </div>
        </div>
      </aside>
    </section>

    <section class="detail-grid">
      <article class="detail-card hero-stat-card">
        <span class="detail-label">Matcher</span>
        <strong>${cup.matchCount}</strong>
      </article>
      <article class="detail-card hero-stat-card">
        <span class="detail-label">Poängkung</span>
        <strong>${escapeHtml(cup.topScorer)}</strong>
      </article>
      <article class="detail-card hero-stat-card">
        <span class="detail-label">Vinnare</span>
        <strong>${escapeHtml(cup.winner)}</strong>
      </article>
      <article class="detail-card hero-stat-card">
        <span class="detail-label">Finalist</span>
        <strong>${escapeHtml(cup.runnerUp)}</strong>
      </article>
    </section>

    <section class="cup-tabs-shell">
      <div class="cup-tabs" role="tablist" aria-label="Cupflikar">
        <button class="cup-tab is-active" type="button" role="tab" aria-selected="true" data-cup-tab="statistik">Statistik</button>
        <button class="cup-tab" type="button" role="tab" aria-selected="false" data-cup-tab="tabell">Tabell</button>
        <button class="cup-tab" type="button" role="tab" aria-selected="false" data-cup-tab="slutspel">Slutspelsträd</button>
        <button class="cup-tab" type="button" role="tab" aria-selected="false" data-cup-tab="regler">Regler</button>
      </div>

      <div class="cup-tab-panels">
        <section class="cup-tab-panel is-active" data-cup-panel="statistik" role="tabpanel">
          <div class="two-column-section">
            <article class="detail-card">
              <div class="section-heading compact">
                <p class="eyebrow">Topplista</p>
                <h2>Poängliga</h2>
              </div>
              ${renderStatsTable(
                ["Spelare", "Lag", "GP", "G", "A", "PTS"],
                overview.topPlayers.map(function(row) {
                  return [
                    renderPlayerLink(row),
                    renderTeamLink(row.team),
                    row.gp,
                    row.g,
                    row.a,
                    row.pts
                  ];
                })
              )}
            </article>

            <article class="detail-card">
              <div class="section-heading compact">
                <p class="eyebrow">Målvakter</p>
                <h2>Topplista</h2>
              </div>
              ${renderStatsTable(
                ["Spelare", "Lag", "GP", "SV%", "GAA", "SO"],
                overview.topGoalies.map(function(row) {
                  return [
                    renderPlayerLink(row),
                    renderTeamLink(row.team),
                    row.gp,
                    formatPercentage(row.svp),
                    formatDecimal(row.gaa),
                    row.so
                  ];
                })
              )}
            </article>
          </div>

          <section class="section">
            <div class="section-heading">
              <p class="eyebrow">Matcher</p>
              <h2>Matchcenter</h2>
            </div>
            <div class="stage-stack">
              ${overview.playoffMatches.length ? renderMatchCollection("Slutspel", overview.playoffMatches) : ""}
              ${overview.groupMatches.length ? renderMatchCollection("Gruppspel", overview.groupMatches) : ""}
              ${!cup.matches.length ? `<div class="empty-state">Inga matcher finns registrerade för den här cupen.</div>` : ""}
            </div>
          </section>
        </section>

        <section class="cup-tab-panel" data-cup-panel="tabell" role="tabpanel" hidden>
          <div class="stack-grid">
            ${groupStandings.length ? groupStandings.map(renderStandingsTable).join("") : `<div class="empty-state">Ingen gruppstatistik finns än.</div>`}
          </div>
        </section>

        <section class="cup-tab-panel" data-cup-panel="slutspel" role="tabpanel" hidden>
          ${renderPlayoffBracket(playoffRounds, overview.playoffMatches)}
        </section>

        <section class="cup-tab-panel" data-cup-panel="regler" role="tabpanel" hidden>
          ${renderCupRules(cup)}
        </section>
      </div>
    </section>
  `;
}

function renderTeamsIndex() {
  return `
    <section class="section-header-block">
      <p class="eyebrow">Lagregister</p>
      <h1 class="page-title">Alla lag</h1>
      <p class="page-intro">Klicka in på ett lag för att se cuper, matcher och spelare.</p>
    </section>
    <section class="entity-grid">
      ${state.teams.map(renderTeamCard).join("")}
    </section>
  `;
}

function renderTeamPage(team) {
  const topScorers = team.playerRows
    .slice()
    .sort(function(a, b) {
      return b.pts - a.pts || b.g - a.g || a.player.localeCompare(b.player, "sv");
    })
    .slice(0, 10);

  return `
    <section class="section-header-block">
      <div class="breadcrumbs">
        <a href="#/">Start</a>
        <span>/</span>
        <a href="#/teams">Lag</a>
        <span>/</span>
        <strong>${escapeHtml(team.name)}</strong>
      </div>
      <div class="team-page-heading">
        ${renderTeamLogo(team.name, "team-logo-lg")}
        <div>
          <p class="eyebrow">Lagprofil</p>
          <h1 class="page-title">${escapeHtml(team.name)}</h1>
          <p class="page-intro">Matcher, cuper och spelarproduktion för laget.</p>
        </div>
      </div>
    </section>

    <section class="detail-grid">
      <article class="detail-card hero-stat-card"><span class="detail-label">Cuper</span><strong>${team.cups.length}</strong></article>
      <article class="detail-card hero-stat-card"><span class="detail-label">Vinster</span><strong>${team.wins}</strong></article>
      <article class="detail-card hero-stat-card"><span class="detail-label">Mål för</span><strong>${team.goalsFor}</strong></article>
      <article class="detail-card hero-stat-card"><span class="detail-label">Mål emot</span><strong>${team.goalsAgainst}</strong></article>
    </section>

    <section class="two-column-section">
      <article class="detail-card">
        <div class="section-heading compact">
          <p class="eyebrow">Poängproduktion</p>
          <h2>Toppspelare</h2>
        </div>
        ${renderStatsTable(
          ["Spelare", "Cup", "GP", "G", "A", "PTS"],
          topScorers.map(function(row) {
            return [
              renderPlayerLink(row),
              renderCupLink(row.cupId, row.cupCode),
              row.gp,
              row.g,
              row.a,
              row.pts
            ];
          })
        )}
      </article>

      <article class="detail-card">
        <div class="section-heading compact">
          <p class="eyebrow">Senaste matcher</p>
          <h2>Matchlista</h2>
        </div>
        <div class="simple-list">
          ${team.matches.length ? team.matches.slice(0, 10).map(function(match) {
            return `<div class="simple-list-item">${escapeHtml(match.cupCode)}: ${displayScore(match.goalsFor)}-${displayScore(match.goalsAgainst)} mot ${escapeHtml(match.opponent)}</div>`;
          }).join("") : `<div class="empty-state">Inga matcher hittades.</div>`}
        </div>
      </article>
    </section>
  `;
}

function renderPlayersIndex() {
  const topPlayers = state.players
    .slice()
    .sort(function(a, b) {
      return b.totals.pts - a.totals.pts || a.name.localeCompare(b.name, "sv");
    });

  return `
    <section class="section-header-block">
      <p class="eyebrow">Spelarregister</p>
      <h1 class="page-title">Alla spelare</h1>
      <p class="page-intro">Klicka på en spelare för att se total statistik och laghistorik.</p>
    </section>
    <section class="detail-card">
      ${renderStatsTable(
        ["Spelare", "Lag", "Cuper", "GP", "PTS"],
        topPlayers.map(function(player) {
          return [
            renderPlayerIdentity(player),
            escapeHtml(player.teamNames.join(", ")),
            player.cups.length,
            player.totals.gp || sumBy(player.goalieRows, "gp"),
            player.totals.pts || 0
          ];
        })
      )}
    </section>
  `;
}

function renderPlayerPage(player) {
  const goalieGames = sumBy(player.goalieRows, "gp");
  const latestTeam = player.teamNames[0] || "Okänt lag";
  const isGoalieOnly = player.skaterRows.length === 0 && player.goalieRows.length > 0;

  return `
    <section class="section-header-block">
      <div class="breadcrumbs">
        <a href="#/">Start</a>
        <span>/</span>
        <a href="#/players">Spelare</a>
        <span>/</span>
        <strong>${escapeHtml(player.name)}</strong>
      </div>
      <div class="player-page-heading">
        ${renderPlayerPortrait(player, "player-portrait-lg")}
        <div>
          <p class="eyebrow">${isGoalieOnly ? "Målvaktsprofil" : "Spelarprofil"}</p>
          <h1 class="page-title">${escapeHtml(player.name)}</h1>
          <p class="page-intro">Total statistik över spelarens SEC-historik.</p>
        </div>
      </div>
    </section>

    <section class="detail-grid">
      <article class="detail-card hero-stat-card"><span class="detail-label">Lag</span><strong>${escapeHtml(latestTeam)}</strong></article>
      <article class="detail-card hero-stat-card"><span class="detail-label">Cuper</span><strong>${player.cups.length}</strong></article>
      <article class="detail-card hero-stat-card"><span class="detail-label">GP</span><strong>${player.totals.gp || goalieGames}</strong></article>
      <article class="detail-card hero-stat-card"><span class="detail-label">${isGoalieOnly ? "SV" : "PTS"}</span><strong>${isGoalieOnly ? sumBy(player.goalieRows, "sv") : player.totals.pts}</strong></article>
    </section>

    ${player.skaterRows.length ? `
      <section class="detail-card">
        <div class="section-heading compact">
          <p class="eyebrow">Utespelare</p>
          <h2>Alla cuper</h2>
        </div>
        ${renderStatsTable(
          ["Cup", "Lag", "GP", "G", "A", "PTS", "PIM"],
          player.skaterRows.map(function(row) {
            return [
              renderCupLink(row.cupId, row.cupCode),
              renderTeamLink(row.team),
              row.gp,
              row.g,
              row.a,
              row.pts,
              row.pim
            ];
          })
        )}
      </section>
    ` : ""}

    ${player.goalieRows.length ? `
      <section class="detail-card">
        <div class="section-heading compact">
          <p class="eyebrow">Målvakt</p>
          <h2>Alla cuper</h2>
        </div>
        ${renderStatsTable(
          ["Cup", "Lag", "GP", "SV%", "GAA", "SV", "GA", "SO"],
          player.goalieRows.map(function(row) {
            return [
              renderCupLink(row.cupId, row.cupCode),
              renderTeamLink(row.team),
              row.gp,
              formatPercentage(row.svp),
              formatDecimal(row.gaa),
              row.sv,
              row.ga,
              row.so
            ];
          })
        )}
      </section>
    ` : ""}
  `;
}

function renderCupCard(cup) {
  const category = getCupCategory(cup);
  const seasonText = getCupSeasonLabel(cup, category);
  const dateLine = getCupDateLine(cup.matches);
  const className = ["cup"];

  if (category === "sommar") {
    className.push("is-sommar");
  }
  if (category === "challenger") {
    className.push("is-challenger");
  }

  return `
    <article class="${className.join(" ")}" role="link" tabindex="0" data-cup-link="#/cup/${encodeURIComponent(cup.id)}">
      <img class="cup-logo" src="./SECLOGGA.png" alt="Cup Logo">
      <a href="#/cup/${encodeURIComponent(cup.id)}">${escapeHtml(cup.name)}</a>
      <div class="cup-season">
        Säsong: ${escapeHtml(seasonText)}<br>
        Datum: ${escapeHtml(dateLine)}<br>
        Matcher: ${cup.matchCount}<br>
        Vinnare: ${escapeHtml(cup.winner)}
      </div>
    </article>
  `;
}

function renderTeamCard(team) {
  return `
    <article class="entity-card">
      <p class="entity-label">Lag</p>
      <div class="entity-brand">
        ${renderTeamLogo(team.name, "team-logo-md")}
        <h3>${escapeHtml(team.name)}</h3>
      </div>
      <p>${team.cups.length} cuper, ${team.matches.length} matcher</p>
      <a class="inline-link" href="#/team/${encodeURIComponent(team.key)}">Öppna lag</a>
    </article>
  `;
}

function renderStandingsTable(group) {
  return `
    <article class="detail-card">
      <div class="section-heading compact">
        <p class="eyebrow">Tabell</p>
        <h2>${escapeHtml(group.name)}</h2>
      </div>
      ${renderStatsTable(
        ["Lag", "GP", "V", "OTF", "F", "MS", "P"],
        group.rows.map(function(row) {
          return [
            renderTeamLink(row.team),
            row.gp,
            row.wins,
            row.otLosses,
            row.losses,
            row.goalDiff,
            row.points
          ];
        })
      )}
    </article>
  `;
}

function renderPlayoffBracket(rounds, playoffMatches) {
  if (!playoffMatches.length) {
    return `<div class="empty-state">Inget slutspel finns registrerat för den här cupen än.</div>`;
  }

  return `
    <section class="playoff-shell">
      <div class="section-heading">
        <p class="eyebrow">Slutspel</p>
        <h2>Slutspelsträd</h2>
      </div>
      <div class="playoff-bracket">
        ${rounds.map(function(round) {
          return `
            <article class="playoff-round">
              <div class="playoff-round-title">${escapeHtml(round.name)}</div>
              <div class="playoff-round-list">
                ${round.matches.map(function(match) {
                  return `
                    <div class="playoff-match">
                      <div class="playoff-team-row">
                        <span>${escapeHtml(match.awayTeam)}</span>
                        <strong>${displayScore(match.awayScore)}</strong>
                      </div>
                      <div class="playoff-team-row">
                        <span>${escapeHtml(match.homeTeam)}</span>
                        <strong>${displayScore(match.homeScore)}</strong>
                      </div>
                      <div class="playoff-match-meta">${escapeHtml(formatMatchDate(match.date, match.time) || match.group || "Slutspel")}</div>
                    </div>
                  `;
                }).join("")}
              </div>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderCupRules(cup) {
  return `
    <section class="rules-shell">
      <div class="section-heading">
        <p class="eyebrow">Regler</p>
        <h2>${escapeHtml(cup.code)} regler</h2>
      </div>
      <div class="rules-grid">
        <article class="detail-card">
          <div class="section-heading compact">
            <p class="eyebrow">Format</p>
            <h2>Turnering</h2>
          </div>
          <div class="simple-list">
            <div class="simple-list-item">Gruppspel avgör grundplacering och seeding till slutspelet.</div>
            <div class="simple-list-item">Slutspelsmatcher avgör avancemang till nästa runda.</div>
            <div class="simple-list-item">Resultat, tabeller och statistik uppdateras direkt på cupsidan.</div>
          </div>
        </article>

        <article class="detail-card">
          <div class="section-heading compact">
            <p class="eyebrow">Poäng</p>
            <h2>Gruppspel</h2>
          </div>
          <div class="simple-list">
            <div class="simple-list-item">Vinst ger 3 poäng i tabellen.</div>
            <div class="simple-list-item">Övertidsförlust ger 1 poäng.</div>
            <div class="simple-list-item">Ordinarie förlust ger 0 poäng.</div>
          </div>
        </article>

        <article class="detail-card">
          <div class="section-heading compact">
            <p class="eyebrow">Sortering</p>
            <h2>Tabellordning</h2>
          </div>
          <div class="simple-list">
            <div class="simple-list-item">Tabellen sorteras på poäng, målskillnad och gjorda mål.</div>
            <div class="simple-list-item">Vid samma siffror visas lagen efter alfabetisk ordning i denna version.</div>
          </div>
        </article>

        <article class="detail-card">
          <div class="section-heading compact">
            <p class="eyebrow">Cupdata</p>
            <h2>Visning</h2>
          </div>
          <div class="simple-list">
            <div class="simple-list-item">Topplistor hämtas från registrerad spelar- och målvaktsstatistik.</div>
            <div class="simple-list-item">Slutspelsträdet byggs av matcher markerade som slutspel.</div>
            <div class="simple-list-item">Sidan kan enkelt bytas till exakta SEC-regler när de finns i datan.</div>
          </div>
        </article>
      </div>
    </section>
  `;
}

function renderMatchCollection(title, matches) {
  return `
    <section class="stage-block">
      <div class="stage-block-header">
        <div>
          <p class="eyebrow">${escapeHtml(title)}</p>
          <h2>${escapeHtml(title)} matcher</h2>
        </div>
        <span class="pill">${matches.length} st</span>
      </div>
      <div class="stack-grid">
        ${matches.map(renderMatchCard).join("")}
      </div>
    </section>
  `;
}

function renderMatchCard(match) {
  return `
    <article class="match-card">
      <div class="match-header">
        <div>
          <p class="entity-label">${escapeHtml(match.group || "Match")}</p>
          <strong>${escapeHtml(formatMatchDate(match.date, match.time))}</strong>
        </div>
        <span class="pill">${match.stage === "playoffs" ? "Slutspel" : "Gruppspel"}${match.overtime ? " OT" : ""}</span>
      </div>
      <div class="match-score">
        ${renderTeamIdentity(match.awayTeam)}
        <strong>${displayScore(match.awayScore)} - ${displayScore(match.homeScore)}</strong>
        ${renderTeamIdentity(match.homeTeam)}
      </div>
      <p class="match-summary">${escapeHtml(match.goalsSummary || "Ingen måltext registrerad.")}</p>
    </article>
  `;
}

function renderStatsTable(headers, rows) {
  if (!rows.length) {
    return `<div class="empty-state">Ingen data finns än.</div>`;
  }

  return `
    <div class="table-wrap">
      <table class="stats-table">
        <thead>
          <tr>${headers.map(function(header) { return `<th>${escapeHtml(String(header))}</th>`; }).join("")}</tr>
        </thead>
        <tbody>
          ${rows.map(function(row) {
            return `<tr>${row.map(function(cell) { return `<td>${cell}</td>`; }).join("")}</tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderGlobalSearchModule() {
  return `
    <div class="player-search-centered home-search">
      <div class="search-title">Sök lag &amp; spelare</div>
      <div class="search-wrapper">
        <input id="globalSearch" placeholder="Sök lag eller spelare" autocomplete="off" aria-label="Sök lag eller spelare">
        <div id="globalResults" role="listbox" aria-label="Sökresultat"></div>
      </div>
    </div>
  `;
}

function renderLoadingState() {
  return `
    <section class="tab-panel">
      <h2>Laddar</h2>
      <div class="cup-status">Hämtar SEC-data...</div>
    </section>
  `;
}

function renderNotFound(message) {
  return `
    <section class="section">
      <div class="empty-state">${escapeHtml(message)}</div>
    </section>
  `;
}

function renderErrorState(message) {
  return `
    <section class="section">
      <div class="empty-state">${escapeHtml(message)}</div>
    </section>
  `;
}

function setView(html) {
  if (!appView) {
    return;
  }
  appView.innerHTML = html;
  bindViewInteractions();
}

function bindViewInteractions() {
  bindCupCardLinks();
  bindGlobalSearch();
  bindCupTabs();
}

function bindCupCardLinks() {
  Array.from(document.querySelectorAll("[data-cup-link]")).forEach(function(card) {
    if (card.dataset.bound === "true") {
      return;
    }

    card.dataset.bound = "true";
    const href = card.getAttribute("data-cup-link");

    card.addEventListener("click", function(event) {
      if (event.target && event.target.closest("a")) {
        return;
      }
      window.location.hash = href.replace(/^#/, "");
    });

    card.addEventListener("keydown", function(event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        window.location.hash = href.replace(/^#/, "");
      }
    });
  });
}

function bindGlobalSearch() {
  const input = document.getElementById("globalSearch");
  const results = document.getElementById("globalResults");

  if (!input || !results || input.dataset.bound === "true") {
    return;
  }

  input.dataset.bound = "true";

  const items = state.teams.map(function(team) {
    return {
      type: "team",
      label: team.name,
      href: "#/team/" + encodeURIComponent(team.key),
      meta: team.cups[0] ? team.cups[0].code : "Lag"
    };
  }).concat(state.players.map(function(player) {
    return {
      type: "player",
      label: player.name,
      href: "#/player/" + encodeURIComponent(player.key),
      meta: player.teamNames[0] || "Spelare"
    };
  }));

  function closeResults() {
    results.style.display = "none";
    results.innerHTML = "";
  }

  input.addEventListener("input", function() {
    const query = slugify(input.value);

    if (!query) {
      closeResults();
      return;
    }

    const matched = items.filter(function(item) {
      return slugify(item.label).indexOf(query) !== -1 || slugify(item.meta).indexOf(query) !== -1;
    }).slice(0, 20);

    if (!matched.length) {
      closeResults();
      return;
    }

    results.innerHTML = matched.map(function(item) {
      return `
        <div class="search-item" role="option" data-href="${escapeHtml(item.href)}">
          <div>
            <div>${escapeHtml(item.label)}</div>
            <div class="search-sub">${escapeHtml(item.meta)}</div>
          </div>
          <div class="search-pill">${item.type === "team" ? "Lag" : "Spelare"}</div>
        </div>
      `;
    }).join("");

    results.style.display = "block";

    Array.from(results.querySelectorAll(".search-item")).forEach(function(element) {
      element.addEventListener("click", function() {
        window.location.hash = element.dataset.href.replace(/^#/, "");
      });
    });
  });

  document.addEventListener("click", function(event) {
    if (!results.contains(event.target) && event.target !== input) {
      closeResults();
    }
  });
}

function bindCupTabs() {
  const tabs = Array.from(document.querySelectorAll("[data-cup-tab]"));
  const panels = Array.from(document.querySelectorAll("[data-cup-panel]"));

  if (!tabs.length || !panels.length) {
    return;
  }

  tabs.forEach(function(tab) {
    if (tab.dataset.bound === "true") {
      return;
    }

    tab.dataset.bound = "true";

    tab.addEventListener("click", function() {
      const target = tab.getAttribute("data-cup-tab");

      tabs.forEach(function(button) {
        const active = button === tab;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-selected", active ? "true" : "false");
      });

      panels.forEach(function(panel) {
        const active = panel.getAttribute("data-cup-panel") === target;
        panel.classList.toggle("is-active", active);
        panel.hidden = !active;
      });
    });
  });
}

function updateNavState(route) {
  const active = route.type === "home" ? "#/" :
    route.type === "cups" || route.type === "cup" ? "#/cups" :
    route.type === "teams" || route.type === "team" ? "#/teams" :
    route.type === "players" || route.type === "player" ? "#/players" : "#/";

  document.querySelectorAll(".nav__link, .mobile__link").forEach(function(link) {
    link.classList.toggle("is-active", link.getAttribute("href") === active);
  });
}

function splitCupsByCategory(cups) {
  const regular = [];
  const sommar = [];
  const challenger = [];

  cups.forEach(function(cup) {
    const category = getCupCategory(cup);
    if (category === "sommar") {
      sommar.push(cup);
    } else if (category === "challenger") {
      challenger.push(cup);
    } else {
      regular.push(cup);
    }
  });

  return {
    regular: regular,
    sommar: sommar,
    challenger: challenger
  };
}

function getCupCategory(cup) {
  const source = [cup.code, cup.name, cup.badge].join(" ").toLowerCase();
  if (source.indexOf("sommar") !== -1) {
    return "sommar";
  }
  if (source.indexOf("challenger") !== -1) {
    return "challenger";
  }
  return "regular";
}

function getCupSeasonLabel(cup, category) {
  const label = String(cup.code || cup.name || "").trim();
  const match = label.match(/([0-9]+(?:\.[0-9]+)?)/);
  const number = match ? match[1] : "";

  if (category === "sommar") {
    return number ? "SEC Sommar " + number : "SEC Sommar";
  }
  if (category === "challenger") {
    return number ? "SEC " + number + " Challenger" : "SEC Challenger";
  }
  return number ? "SEC " + number : label || "SEC";
}

function getCupDateLine(matches) {
  const dated = (matches || [])
    .map(function(match) { return match.date || ""; })
    .filter(Boolean)
    .sort();

  if (!dated.length) {
    return "-";
  }
  if (dated.length === 1) {
    return dated[0];
  }
  return dated[0] + " -> " + dated[dated.length - 1];
}

function renderEmptyCupState(message) {
  return `<div class="sec-empty-state">${escapeHtml(message)}</div>`;
}

function getCupOverview(cup) {
  const teams = buildCupTeams(cup);
  const groupMatches = cup.matches.filter(function(match) { return match.stage !== "playoffs"; }).sort(compareMatchesDesc);
  const playoffMatches = cup.matches.filter(function(match) { return match.stage === "playoffs"; }).sort(compareMatchesDesc);
  const allPlayerRows = cup.playerStats.group.concat(cup.playerStats.playoffs);
  const allGoalieRows = cup.goalieStats.group.concat(cup.goalieStats.playoffs);

  return {
    teams: teams,
    groupMatches: groupMatches,
    playoffMatches: playoffMatches,
    topPlayers: allPlayerRows.slice().sort(function(a, b) {
      return b.pts - a.pts || b.g - a.g || a.player.localeCompare(b.player, "sv");
    }).slice(0, 10),
    topGoalies: allGoalieRows.slice().sort(function(a, b) {
      return safeNumber(b.svp) - safeNumber(a.svp) || safeNumber(a.gaa) - safeNumber(b.gaa);
    }).slice(0, 10)
  };
}

function buildCupTeams(cup) {
  const names = new Set();

  cup.matches.forEach(function(match) {
    names.add(match.homeTeam);
    names.add(match.awayTeam);
  });

  cup.playerStats.group.concat(cup.playerStats.playoffs).forEach(function(row) {
    names.add(row.team);
  });

  cup.goalieStats.group.concat(cup.goalieStats.playoffs).forEach(function(row) {
    names.add(row.team);
  });

  return Array.from(names).map(function(name) {
    return state.teams.find(function(team) {
      return team.key === createTeamKey(name);
    });
  }).filter(Boolean);
}

function buildGroupStandings(matches) {
  const groups = new Map();

  matches.filter(function(match) {
    return match.stage !== "playoffs";
  }).forEach(function(match) {
    const groupName = match.group || "Gruppspel";
    if (!groups.has(groupName)) {
      groups.set(groupName, new Map());
    }

    const standings = groups.get(groupName);
    ingestStandingRow(standings, match.homeTeam, match.homeScore, match.awayScore, match.overtime);
    ingestStandingRow(standings, match.awayTeam, match.awayScore, match.homeScore, match.overtime);
  });

  return Array.from(groups.entries()).map(function(entry) {
    const rows = Array.from(entry[1].values()).sort(function(a, b) {
      return b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor || a.team.localeCompare(b.team, "sv");
    });

    return {
      name: entry[0],
      rows: rows
    };
  });
}

function buildPlayoffRounds(matches) {
  const playoffMatches = matches.filter(function(match) {
    return match.stage === "playoffs";
  });

  const rounds = new Map();

  playoffMatches.forEach(function(match) {
    const raw = String(match.group || "Slutspel").trim();
    const key = raw.toLowerCase();
    const sortOrder = inferPlayoffRoundOrder(raw);

    if (!rounds.has(key)) {
      rounds.set(key, {
        key: key,
        name: raw,
        sortOrder: sortOrder,
        matches: []
      });
    }

    rounds.get(key).matches.push(match);
  });

  return Array.from(rounds.values()).sort(function(a, b) {
    return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "sv");
  });
}

function ingestStandingRow(standings, teamName, goalsFor, goalsAgainst, overtime) {
  const key = createTeamKey(teamName);

  if (!standings.has(key)) {
    standings.set(key, {
      team: teamName,
      gp: 0,
      wins: 0,
      otLosses: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      points: 0
    });
  }

  const row = standings.get(key);
  row.gp += 1;
  row.goalsFor += toNumber(goalsFor);
  row.goalsAgainst += toNumber(goalsAgainst);
  row.goalDiff = row.goalsFor - row.goalsAgainst;

  if (toNumber(goalsFor) > toNumber(goalsAgainst)) {
    row.wins += 1;
    row.points += 3;
  } else if (overtime) {
    row.otLosses += 1;
    row.points += 1;
  } else {
    row.losses += 1;
  }
}

function parseRoute() {
  const hash = window.location.hash || "#/";
  const clean = hash.replace(/^#\/?/, "");

  if (!clean) {
    return { type: "home" };
  }

  const parts = clean.split("/").filter(Boolean).map(decodeURIComponent);

  if (parts[0] === "cups") {
    return { type: "cups" };
  }
  if (parts[0] === "cup" && parts[1]) {
    return { type: "cup", id: parts[1] };
  }
  if (parts[0] === "teams") {
    return { type: "teams" };
  }
  if (parts[0] === "team" && parts[1]) {
    return { type: "team", id: parts[1] };
  }
  if (parts[0] === "players") {
    return { type: "players" };
  }
  if (parts[0] === "player" && parts[1]) {
    return { type: "player", id: parts[1] };
  }

  return { type: "home" };
}

function renderCupLink(cupId, label) {
  return `<a href="#/cup/${encodeURIComponent(cupId)}">${escapeHtml(label)}</a>`;
}

function renderTeamLink(teamName) {
  return `<a href="#/team/${encodeURIComponent(createTeamKey(teamName))}">${escapeHtml(teamName)}</a>`;
}

function renderPlayerLink(row) {
  return `<a href="#/player/${encodeURIComponent(createPlayerKey(row))}">${escapeHtml(row.player)}</a>`;
}

function renderTeamIdentity(teamName) {
  return `
    <a class="team-identity" href="#/team/${encodeURIComponent(createTeamKey(teamName))}">
      ${renderTeamLogo(teamName, "team-logo-sm")}
      <span class="team-identity-text">${escapeHtml(teamName)}</span>
    </a>
  `;
}

function renderPlayerIdentity(player) {
  return `
    <a class="player-identity" href="#/player/${encodeURIComponent(player.key)}">
      ${renderPlayerPortrait(player, "player-portrait-sm")}
      <span class="player-identity-text">${escapeHtml(player.name)}</span>
    </a>
  `;
}

function renderTeamLogo(teamName, sizeClass) {
  if (!teamName || teamName === "Ej klar") {
    return `<span class="team-logo-wrap ${sizeClass || "team-logo-sm"} is-missing"></span>`;
  }

  return `
    <span class="team-logo-wrap ${sizeClass || "team-logo-sm"}">
      <img
        class="team-logo-image"
        src="${escapeHtml(getTeamLogoUrl(teamName))}"
        alt="${escapeHtml(teamName)} logga"
        loading="lazy"
        onerror="this.style.display='none';this.parentElement.classList.add('is-missing');"
      >
    </span>
  `;
}

function renderPlayerPortrait(player, sizeClass) {
  const filename = getPlayerImageFilename(player);
  if (!filename) {
    return `<span class="player-portrait-wrap ${sizeClass || "player-portrait-sm"} is-missing"></span>`;
  }

  return `
    <span class="player-portrait-wrap ${sizeClass || "player-portrait-sm"}">
      <img
        class="player-portrait-image"
        src="${escapeHtml(getPlayerImageBaseUrl() + "/" + encodeURIComponent(filename))}"
        alt="${escapeHtml(player.name || player.player)} spelarkort"
        loading="lazy"
        onerror="this.style.display='none';this.parentElement.classList.add('is-missing');"
      >
    </span>
  `;
}

function getTeamLogoUrl(teamName) {
  return getTeamLogoBaseUrl() + "/" + encodeURIComponent(String(teamName || "").trim()) + ".png";
}

function getTeamLogoBaseUrl() {
  return String(window.SEC_CONFIG?.teamLogoBaseUrl || "https://sweehockey-svg.github.io/teamlogos").replace(/\/+$/, "");
}

function getPlayerImageFilename(player) {
  const baseName = String(player?.name || player?.player || "").split(",")[0].trim();
  return baseName ? baseName + ".jpg" : "";
}

function getPlayerImageBaseUrl() {
  return String(window.SEC_CONFIG?.playerImageBaseUrl || "https://sweehockey-svg.github.io/players").replace(/\/+$/, "");
}

function formatPlayerLabel(player) {
  const team = player.team ? " - " + player.team : "";
  return player.player + team + " (" + toNumber(player.pts) + " p)";
}

function createTeamKey(teamName) {
  return slugify(teamName || "unknown-team");
}

function createPlayerKey(row) {
  if (row.playerId) {
    return "player-" + row.playerId;
  }
  return slugify((row.player || "unknown-player") + "-" + (row.team || ""));
}

function createMatchId(cupId, index) {
  return String(cupId) + "-" + String(index);
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/[ö]/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeStage(stage) {
  const normalized = String(stage || "").trim().toLowerCase();
  if (!normalized || normalized.indexOf("grupp") !== -1 || normalized === "group") {
    return "group";
  }
  if (normalized.indexOf("slut") !== -1 || normalized === "playoffs") {
    return "playoffs";
  }
  return normalized;
}

function compareMatchesDesc(a, b) {
  const left = [a.date || "", a.time || "", a.id || ""].join("|");
  const right = [b.date || "", b.time || "", b.id || ""].join("|");
  return right.localeCompare(left, "sv");
}

function compareTeamMatchRowsDesc(a, b) {
  const left = [a.date || "", a.time || "", a.cupId || ""].join("|");
  const right = [b.date || "", b.time || "", b.cupId || ""].join("|");
  return right.localeCompare(left, "sv");
}

function formatMatchDate(date, time) {
  return [date, time].filter(Boolean).join(" ");
}

function formatPercentage(value) {
  if (value === null || typeof value === "undefined" || Number.isNaN(Number(value))) {
    return "-";
  }
  const numeric = Number(value);
  return numeric > 1 ? numeric.toFixed(1) : (numeric * 100).toFixed(1);
}

function formatDecimal(value) {
  if (value === null || typeof value === "undefined" || Number.isNaN(Number(value))) {
    return "-";
  }
  return Number(value).toFixed(2);
}

function displayScore(value) {
  return value === null || typeof value === "undefined" ? "-" : value;
}

function toNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableNumber(value) {
  if (value === null || typeof value === "undefined" || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function inferSortOrder(id) {
  const numeric = Number(String(id).replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function inferPlayoffRoundOrder(name) {
  const value = String(name || "").toLowerCase();

  if (value.indexOf("attondel") !== -1) {
    return 1;
  }
  if (value.indexOf("sexton") !== -1) {
    return 1;
  }
  if (value.indexOf("kvarts") !== -1) {
    return 2;
  }
  if (value.indexOf("semi") !== -1) {
    return 3;
  }
  if (value.indexOf("brons") !== -1) {
    return 4;
  }
  if (value.indexOf("final") !== -1) {
    return 5;
  }
  return 10;
}

function uniqueBy(items, key) {
  const map = new Map();
  items.forEach(function(item) {
    map.set(item[key], item);
  });
  return Array.from(map.values());
}

function sumBy(items, key) {
  return items.reduce(function(sum, item) {
    return sum + toNumber(item[key]);
  }, 0);
}

function showFatalError(error) {
  const message = typeof error === "string" ? error : error?.message || "Ett oväntat fel uppstod.";
  if (appView) {
    appView.innerHTML = renderErrorState("JavaScript-fel: " + message);
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
