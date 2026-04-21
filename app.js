const DATA_SOURCES = {
  sheet: window.SEC_CONFIG?.sheetUrl || "",
  database: window.SEC_CONFIG?.databaseUrl || ""
};

const FALLBACK_DATA = {
  cups: [
    {
      id: 1,
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
          homeScore: 3,
          homeTeam: "Lulea",
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
          homeScore: 4,
          homeTeam: "Frolunda",
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

init();

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
    setView(renderErrorState("Kunde inte ladda SEC-data. Kontrollera config.js och JSON-filerna."));
  }
}

async function loadCups() {
  const datasets = await Promise.all([
    loadSource(DATA_SOURCES.sheet),
    loadSource(DATA_SOURCES.database)
  ]);

  const merged = [];

  datasets.forEach(function(dataset) {
    if (Array.isArray(dataset)) {
      merged.push.apply(merged, dataset);
    }
  });

  const deduped = new Map();

  merged.forEach(function(cup) {
    deduped.set(String(cup.id), cup);
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

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Request failed for " + url);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : data.cups || [];
}

function normalizeCups(cups) {
  return cups
    .map(function(cup) {
      const allPlayerStats = []
        .concat(cup.playerStats?.group || [])
        .concat(cup.playerStats?.playoffs || []);
      const allGoalieStats = []
        .concat(cup.goalieStats?.group || [])
        .concat(cup.goalieStats?.playoffs || []);
      const topScorer = allPlayerStats
        .slice()
        .sort(function(a, b) {
          return (toNumber(b.pts) - toNumber(a.pts)) || (toNumber(b.g) - toNumber(a.g));
        })[0];

      const normalizedMatches = (cup.matches || []).map(function(match, index) {
        return {
          id: createMatchId(cup.id, index),
          date: match.date || null,
          time: match.time || null,
          awayTeam: match.awayTeam || "Okant lag",
          awayScore: toNullableNumber(match.awayScore),
          homeScore: toNullableNumber(match.homeScore),
          homeTeam: match.homeTeam || "Okant lag",
          overtime: Boolean(match.overtime),
          stage: normalizeStage(match.stage),
          group: match.group || null,
          goalsSummary: match.goalsSummary || ""
        };
      });

      return {
        id: String(cup.id),
        sortOrder: typeof cup.sortOrder === "number" ? cup.sortOrder : inferSortOrder(cup.id),
        code: cup.code || "SEC " + cup.id,
        name: cup.name || "Svenska eHockey Cupen " + cup.id,
        badge: cup.badge || "Historik",
        winner: cup.placements?.first || "Ej klar",
        runnerUp: cup.placements?.second || "Ej klar",
        placements: cup.placements || { first: null, second: null },
        matches: normalizedMatches,
        playerStats: {
          group: normalizePlayerRows(cup.playerStats?.group || [], "group"),
          playoffs: normalizePlayerRows(cup.playerStats?.playoffs || [], "playoffs")
        },
        goalieStats: {
          group: normalizeGoalieRows(cup.goalieStats?.group || [], "group"),
          playoffs: normalizeGoalieRows(cup.goalieStats?.playoffs || [], "playoffs")
        },
        matchCount: normalizedMatches.length,
        playerCount: allPlayerStats.length,
        goalieCount: allGoalieStats.length,
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
      player: row.player || "Okand spelare",
      team: row.team || "Okant lag",
      gp: toNumber(row.gp),
      g: toNumber(row.g),
      a: toNumber(row.a),
      pts: toNumber(row.pts),
      pim: toNumber(row.pim),
      playerId: row.playerId ? String(row.playerId) : null,
      stage
    };
  });
}

function normalizeGoalieRows(rows, stage) {
  return rows.map(function(row) {
    return {
      player: row.player || "Okand malvakt",
      team: row.team || "Okant lag",
      gp: toNumber(row.gp),
      sa: toNumber(row.sa),
      ga: toNumber(row.ga),
      sv: toNumber(row.sv),
      gaa: toNumber(row.gaa),
      svp: row.svp === null || typeof row.svp === "undefined" ? null : Number(row.svp),
      so: toNumber(row.so),
      playerId: row.playerId ? String(row.playerId) : null,
      stage
    };
  });
}

function buildTeams(cups) {
  const teamMap = new Map();

  cups.forEach(function(cup) {
    const teamNames = new Set();

    cup.matches.forEach(function(match) {
      teamNames.add(match.homeTeam);
      teamNames.add(match.awayTeam);
    });

    cup.playerStats.group.concat(cup.playerStats.playoffs).forEach(function(row) {
      teamNames.add(row.team);
    });

    cup.goalieStats.group.concat(cup.goalieStats.playoffs).forEach(function(row) {
      teamNames.add(row.team);
    });

    teamNames.forEach(function(teamName) {
      const key = createTeamKey(teamName);
      if (!teamMap.has(key)) {
        teamMap.set(key, {
          key,
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

      const team = teamMap.get(key);
      team.cups.push({ id: cup.id, code: cup.code, name: cup.name });

      cup.matches.forEach(function(match) {
        if (match.homeTeam !== teamName && match.awayTeam !== teamName) {
          return;
        }

        team.matches.push({
          cupId: cup.id,
          cupCode: cup.code,
          opponent: match.homeTeam === teamName ? match.awayTeam : match.homeTeam,
          isHome: match.homeTeam === teamName,
          goalsFor: match.homeTeam === teamName ? match.homeScore : match.awayScore,
          goalsAgainst: match.homeTeam === teamName ? match.awayScore : match.homeScore,
          overtime: match.overtime,
          date: match.date,
          time: match.time,
          stage: match.stage
        });

        const goalsFor = match.homeTeam === teamName ? match.homeScore : match.awayScore;
        const goalsAgainst = match.homeTeam === teamName ? match.awayScore : match.homeScore;

        team.goalsFor += toNumber(goalsFor);
        team.goalsAgainst += toNumber(goalsAgainst);

        if (goalsFor > goalsAgainst) {
          team.wins += 1;
        } else if (match.overtime) {
          team.otLosses += 1;
        } else {
          team.losses += 1;
        }
      });

      cup.playerStats.group.concat(cup.playerStats.playoffs).forEach(function(row) {
        if (row.team === teamName) {
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
        }
      });

      cup.goalieStats.group.concat(cup.goalieStats.playoffs).forEach(function(row) {
        if (row.team === teamName) {
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
  });

  return Array.from(teamMap.values())
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

function buildPlayers(cups) {
  const playerMap = new Map();

  cups.forEach(function(cup) {
    cup.playerStats.group.concat(cup.playerStats.playoffs).forEach(function(row) {
      const key = createPlayerKey(row);
      if (!playerMap.has(key)) {
        playerMap.set(key, {
          key,
          playerId: row.playerId || null,
          name: row.player,
          teamNames: new Set(),
          cups: [],
          skaterRows: [],
          goalieRows: [],
          totals: { gp: 0, g: 0, a: 0, pts: 0, pim: 0 }
        });
      }

      const player = playerMap.get(key);
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
      if (!playerMap.has(key)) {
        playerMap.set(key, {
          key,
          playerId: row.playerId || null,
          name: row.player,
          teamNames: new Set(),
          cups: [],
          skaterRows: [],
          goalieRows: [],
          totals: { gp: 0, g: 0, a: 0, pts: 0, pim: 0 }
        });
      }

      const player = playerMap.get(key);
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

  return Array.from(playerMap.values())
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

function renderCurrentRoute() {
  try {
    if (!state.ready) {
      setView(renderLoadingState());
      return;
    }

    const route = parseRoute();

    if (route.type === "home") {
      setView(renderHomePage());
      return;
    }

    if (route.type === "cups") {
      setView(renderCupsIndex());
      return;
    }

    if (route.type === "cup") {
      const cup = state.cups.find(function(entry) { return entry.id === route.id; });
      setView(cup ? renderCupPage(cup) : renderNotFound("Cupen kunde inte hittas."));
      return;
    }

    if (route.type === "teams") {
      setView(renderTeamsIndex());
      return;
    }

    if (route.type === "team") {
      const team = state.teams.find(function(entry) { return entry.key === route.id; });
      setView(team ? renderTeamPage(team) : renderNotFound("Laget kunde inte hittas."));
      return;
    }

    if (route.type === "players") {
      setView(renderPlayersIndex());
      return;
    }

    if (route.type === "player") {
      const player = state.players.find(function(entry) { return entry.key === route.id; });
      setView(player ? renderPlayerPage(player) : renderNotFound("Spelaren kunde inte hittas."));
      return;
    }

    setView(renderNotFound("Sidan kunde inte hittas."));
  } catch (error) {
    console.error(error);
    showFatalError(error);
  }
}
function renderHomePage() {
  const categories = splitCupsByCategory(state.cups);
  const totalMatches = sumBy(state.cups, "matchCount");
  const totalTeams = state.teams.length;

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
          Valkommen till Svenska eHockey Cupen, en samlad hubb for SEC med matcher, tabeller,
          slutspel, lag och spelarstatistik i samma arkiv. Har bygger vi vidare pa samma upplagg
          som din nuvarande sida, men kopplar det till den nya datamodellen sa att varje cup blir
          enklare att uppdatera och enklare att hitta i.
        </p>
        <p>
          Just nu finns <strong>${state.cups.length}</strong> cuper, <strong>${totalMatches}</strong> matcher,
          <strong>${totalTeams}</strong> lag och <strong>${state.players.length}</strong> spelare i arkivet.
        </p>
      </section>

      <section class="tab-panel cups-panel">
        <h2>Valj turnering</h2>
        <div class="cup-status">
          Visar ${state.cups.length} cup${state.cups.length === 1 ? "" : "er"} (SEC: ${categories.regular.length}, Sommar: ${categories.sommar.length}${categories.challenger.length ? ", Challenger: " + categories.challenger.length : ""}).
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
          Â© 2026 <span>Svenska eHockey Cupen</span> | Design & utveckling av <span>Svensk eHockey</span>
        </div>
      </footer>
    </section>
  `;
}

function renderCupsIndex() {
  const categories = splitCupsByCategory(state.cups);

  return `
    <section class="tab-panel cups-panel cups-panel-archive">
      <h2>Alla SEC-cuper</h2>
      <div class="cup-status">
        Hela arkivet med alla cuper, sommarupplagor och challenger-turneringar.
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
  const groupStandings = buildGroupStandings(cup.matches);
  const overview = getCupOverview(cup);

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
        <p class="page-intro">En egen SEC-sida for hela turneringen med oversikt, gruppspel, slutspel, lag, poangliga och alla matchresultat.</p>
        <div class="cup-hero-actions">
          <a class="button button-primary" href="#cup-overview">Oversikt</a>
          <a class="button button-secondary" href="#cup-matches">Matcher</a>
          <a class="button button-secondary" href="#cup-stats">Statistik</a>
        </div>
        <div class="summary-ribbon">
          <span>${overview.teams.length} lag</span>
          <span>${overview.groupMatches.length} gruppmatcher</span>
          <span>${overview.playoffMatches.length} slutspelsmatcher</span>
        </div>
      </div>

      <aside class="cup-hero-side">
        <p class="entity-label">Finalbild</p>
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
        <div class="cup-side-note">
          ${overview.featuredMatch ? renderCompactMatchSummary(overview.featuredMatch) : `<div class="empty-state">Ingen featured match an.</div>`}
        </div>
      </aside>
    </section>

    <nav class="cup-subnav">
      <div class="breadcrumbs">
        <a href="#cup-overview">Oversikt</a>
        <a href="#cup-tables">Tabeller</a>
        <a href="#cup-teams">Lag</a>
        <a href="#cup-stats">Statistik</a>
        <a href="#cup-matches">Matcher</a>
      </div>
    </nav>

    <section class="detail-grid" id="cup-overview">
      <article class="detail-card hero-stat-card">
        <span class="detail-label">Vinnare</span>
        <strong>${escapeHtml(cup.winner)}</strong>
      </article>
      <article class="detail-card hero-stat-card">
        <span class="detail-label">Finalist</span>
        <strong>${escapeHtml(cup.runnerUp)}</strong>
      </article>
      <article class="detail-card hero-stat-card">
        <span class="detail-label">Matcher</span>
        <strong>${cup.matchCount}</strong>
      </article>
      <article class="detail-card hero-stat-card">
        <span class="detail-label">Poangkung</span>
        <strong>${escapeHtml(cup.topScorer)}</strong>
      </article>
    </section>

    <section class="section two-column-section">
      <article class="detail-card">
        <div class="section-heading compact">
          <p class="eyebrow">Turneringsbild</p>
          <h2>Snabb oversikt</h2>
        </div>
        <div class="simple-list">
          <div class="simple-list-item muted-item">Badge: ${escapeHtml(cup.badge)}</div>
          <div class="simple-list-item muted-item">Lag i cupen: ${overview.teams.length}</div>
          <div class="simple-list-item muted-item">Gruppspel: ${overview.groupMatches.length} matcher</div>
          <div class="simple-list-item muted-item">Slutspel: ${overview.playoffMatches.length} matcher</div>
          <div class="simple-list-item muted-item">Spelarposter: ${cup.playerStats.group.length + cup.playerStats.playoffs.length}</div>
          <div class="simple-list-item muted-item">Malvaktsrader: ${cup.goalieStats.group.length + cup.goalieStats.playoffs.length}</div>
        </div>
      </article>

      <article class="detail-card">
        <div class="section-heading compact">
          <p class="eyebrow">Featured match</p>
          <h2>Match i fokus</h2>
        </div>
        ${overview.featuredMatch ? renderFeaturedMatchCard(overview.featuredMatch) : `<div class="empty-state">Ingen featured match finns an.</div>`}
      </article>
    </section>

    <section class="section" id="cup-tables">
      <div class="section-heading">
        <p class="eyebrow">Tabeller</p>
        <h2>Gruppstallningar</h2>
      </div>
      <div class="stack-grid">
        ${groupStandings.length ? groupStandings.map(renderStandingsTable).join("") : `<div class="empty-state">Det finns inte tillrackligt med matchdata for att rakna fram en tabell an.</div>`}
      </div>
    </section>

    <section class="section" id="cup-teams">
      <div class="section-heading">
        <p class="eyebrow">Lag</p>
        <h2>Deltagande lag</h2>
      </div>
      <div class="entity-grid">
        ${overview.teams.map(renderTeamMiniCard).join("")}
      </div>
    </section>

    <section class="section two-column-section" id="cup-stats">
      <article class="detail-card">
        <div class="section-heading compact">
          <p class="eyebrow">Poangliga</p>
          <h2>Toppspelare</h2>
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
          <p class="eyebrow">Malvakter</p>
          <h2>Toppmalvakter</h2>
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
    </section>

    <section class="section" id="cup-matches">
      <div class="section-heading">
        <p class="eyebrow">Matcher</p>
        <h2>Matchcenter</h2>
      </div>
      <div class="stage-stack">
        ${overview.playoffMatches.length ? renderMatchCollection("Slutspel", overview.playoffMatches) : ""}
        ${overview.groupMatches.length ? renderMatchCollection("Gruppspel", overview.groupMatches) : ""}
        ${!cup.matches.length ? `<div class="empty-state">Inga matcher finns registrerade for den har cupen an.</div>` : ""}
      </div>
    </section>
  `;
}

function renderTeamsIndex() {
  return `
    <section class="section-header-block">
      <p class="eyebrow">Lagregister</p>
      <h1 class="page-title">Alla lag</h1>
      <p class="page-intro">Klicka in pa ett lag for att se cuphistorik, malskillnad, spelartrupp och malvakter.</p>
    </section>
    <section class="entity-grid">
      ${state.teams.map(renderTeamCard).join("")}
    </section>
  `;
}

function renderTeamPage(team) {
  const topScorers = team.playerRows
    .slice()
    .sort(function(a, b) { return b.pts - a.pts || b.g - a.g; })
    .slice(0, 12);
  const topGoalies = team.goalieRows
    .slice()
    .sort(function(a, b) { return safeNumber(b.svp) - safeNumber(a.svp) || safeNumber(a.gaa) - safeNumber(b.gaa); })
    .slice(0, 8);

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
          <p class="page-intro">Historik over matcher, cuper och spelare for laget.</p>
        </div>
      </div>
    </section>

    <section class="detail-grid">
      <article class="detail-card hero-stat-card"><span class="detail-label">Cuper</span><strong>${team.cups.length}</strong></article>
      <article class="detail-card hero-stat-card"><span class="detail-label">Vinster</span><strong>${team.wins}</strong></article>
      <article class="detail-card hero-stat-card"><span class="detail-label">Malskillnad</span><strong>${team.goalsFor - team.goalsAgainst}</strong></article>
      <article class="detail-card hero-stat-card"><span class="detail-label">Mal</span><strong>${team.goalsFor}-${team.goalsAgainst}</strong></article>
    </section>

    <section class="section two-column-section">
      <article class="detail-card">
        <div class="section-heading compact">
          <p class="eyebrow">Cuper</p>
          <h2>Lagets cuper</h2>
        </div>
        <div class="simple-list">
          ${team.cups.map(function(cup) {
            return `<a class="simple-list-item" href="#/cup/${encodeURIComponent(cup.id)}">${escapeHtml(cup.code)}</a>`;
          }).join("")}
        </div>
      </article>

      <article class="detail-card">
        <div class="section-heading compact">
          <p class="eyebrow">Form</p>
          <h2>Senaste matcher</h2>
        </div>
        <div class="simple-list">
          ${team.matches.slice(0, 8).map(function(match) {
            return `<div class="simple-list-item muted-item">${escapeHtml(match.cupCode)}: ${match.goalsFor}-${match.goalsAgainst} mot ${escapeHtml(match.opponent)}</div>`;
          }).join("") || `<div class="empty-state">Inga matcher hittades.</div>`}
        </div>
      </article>
    </section>

    <section class="section two-column-section">
      <article class="detail-card">
        <div class="section-heading compact">
          <p class="eyebrow">Spelare</p>
          <h2>Poangproduktion</h2>
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
          <p class="eyebrow">Malvakter</p>
          <h2>Malvaktsrad</h2>
        </div>
        ${renderStatsTable(
          ["Spelare", "Cup", "GP", "SV%", "GAA", "SO"],
          topGoalies.map(function(row) {
            return [
              renderPlayerLink(row),
              renderCupLink(row.cupId, row.cupCode),
              row.gp,
              formatPercentage(row.svp),
              formatDecimal(row.gaa),
              row.so
            ];
          })
        )}
      </article>
    </section>
  `;
}

function renderPlayersIndex() {
  const topPlayers = state.players
    .slice()
    .sort(function(a, b) { return b.totals.pts - a.totals.pts || a.name.localeCompare(b.name, "sv"); })
    .slice(0, 80);

  return `
    <section class="section-header-block">
      <p class="eyebrow">Spelarregister</p>
      <h1 class="page-title">Alla spelare</h1>
      <p class="page-intro">Klicka pa en spelare for att se cuphistorik, total statistik och tillhorande lag.</p>
    </section>
    <section class="detail-card">
      ${topPlayers.length ? renderStatsTable(
        ["Spelare", "Lag", "Cuper", "GP", "PTS"],
        topPlayers.map(function(player) {
          return [
            renderPlayerIdentity(player),
            escapeHtml(player.teamNames.join(", ")),
            player.cups.length,
            player.totals.gp,
            player.totals.pts
          ];
        })
      ) : `<div class="empty-state">Det finns inga spelare att visa an.</div>`}
    </section>
  `;
}

function renderPlayerPage(player) {
  const isGoalieOnly = player.skaterRows.length === 0 && player.goalieRows.length > 0;
  const latestTeam = player.teamNames[0] || "Okant lag";

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
          <p class="eyebrow">${isGoalieOnly ? "Malvaktsprofil" : "Spelarprofil"}</p>
          <h1 class="page-title">${escapeHtml(player.name)}</h1>
          <p class="page-intro">Statistik over alla registrerade SEC-cuper, lag och prestationer.</p>
        </div>
      </div>
    </section>

    <section class="detail-grid">
      <article class="detail-card hero-stat-card"><span class="detail-label">Lag</span><strong>${escapeHtml(latestTeam)}</strong></article>
      <article class="detail-card hero-stat-card"><span class="detail-label">Cuper</span><strong>${player.cups.length}</strong></article>
      <article class="detail-card hero-stat-card"><span class="detail-label">GP</span><strong>${player.totals.gp || sumBy(player.goalieRows, "gp")}</strong></article>
      <article class="detail-card hero-stat-card"><span class="detail-label">${isGoalieOnly ? "Raddningar" : "Poang"}</span><strong>${isGoalieOnly ? sumBy(player.goalieRows, "sv") : player.totals.pts}</strong></article>
    </section>

    ${player.skaterRows.length ? `
      <section class="section detail-card">
        <div class="section-heading compact">
          <p class="eyebrow">Utespelarstatistik</p>
          <h2>Alla cuper</h2>
        </div>
        ${renderStatsTable(
          ["Cup", "Lag", "GP", "G", "A", "PTS", "PIM"],
          player.skaterRows
            .slice()
            .sort(function(a, b) { return inferSortOrder(b.cupId) - inferSortOrder(a.cupId); })
            .map(function(row) {
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
      <section class="section detail-card">
        <div class="section-heading compact">
          <p class="eyebrow">Malvaktsstatistik</p>
          <h2>Alla cuper</h2>
        </div>
        ${renderStatsTable(
          ["Cup", "Lag", "GP", "SV%", "GAA", "SV", "GA", "SO"],
          player.goalieRows
            .slice()
            .sort(function(a, b) { return inferSortOrder(b.cupId) - inferSortOrder(a.cupId); })
            .map(function(row) {
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

function renderChampionCard(cup) {
  return `
    <article class="champion-card">
      <p class="champion-cup">${escapeHtml(cup.code)}</p>
      <div class="champion-brand">
        ${renderTeamLogo(cup.winner, "team-logo-md")}
        <h3 class="champion-team">${escapeHtml(cup.winner)}</h3>
      </div>
      <p class="champion-meta">Finalist: ${escapeHtml(cup.runnerUp)}</p>
      <a class="inline-link" href="#/cup/${encodeURIComponent(cup.id)}">Oppna cup</a>
    </article>
  `;
}

function renderCupCard(cup) {
  const overview = getCupOverview(cup);
  const category = getCupCategory(cup);
  const seasonText = getCupSeasonLabel(cup, category);
  const dateLine = getCupDateLine(cup.matches);
  const className = [
    "cup",
    category === "sommar" ? "is-sommar" : "",
    category === "challenger" ? "is-challenger" : ""
  ].filter(Boolean).join(" ");

  return `
    <article class="${className}" role="link" tabindex="0" data-cup-link="#/cup/${encodeURIComponent(cup.id)}">
      <img class="cup-logo" src="./SECLOGGA.png" alt="Cup Logo">
      <a href="#/cup/${encodeURIComponent(cup.id)}">${escapeHtml(cup.name)}</a>
      <div class="cup-season">
        Sasong: ${escapeHtml(seasonText)}<br>
        Datum: ${escapeHtml(dateLine)}<br>
        Matcher: ${cup.matchCount}<br>
        Lag: ${overview.teams.length}
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
      <p>${team.cups.length} cuper, ${team.wins} vinster, malskillnad ${team.goalsFor - team.goalsAgainst}</p>
      <a class="inline-link" href="#/team/${encodeURIComponent(team.key)}">Oppna lag</a>
    </article>
  `;
}

function renderTeamMiniCard(team) {
  return `
    <article class="entity-card small">
      <p class="entity-label">Lag</p>
      <div class="entity-brand">
        ${renderTeamLogo(team.name, "team-logo-sm")}
        <h3>${escapeHtml(team.name)}</h3>
      </div>
      <p>${team.matches.length} matcher</p>
      <a class="inline-link" href="#/team/${encodeURIComponent(team.key)}">Lagsida</a>
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
        ${renderTeamIdentity(match.awayTeam, "sm")}
        <strong>${displayScore(match.awayScore)} - ${displayScore(match.homeScore)}</strong>
        ${renderTeamIdentity(match.homeTeam, "sm")}
      </div>
      <p class="match-summary">${escapeHtml(match.goalsSummary || "Ingen maltext registrerad.")}</p>
    </article>
  `;
}

function renderStatsTable(headers, rows) {
  if (!rows.length) {
    return `<div class="empty-state">Ingen data finns an.</div>`;
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

function renderPortalCard(title, text, href) {
  return `
    <article class="portal-card">
      <p class="entity-label">${escapeHtml(title)}</p>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(text)}</p>
      <a class="inline-link" href="${href}">Oppna</a>
    </article>
  `;
}

function renderGlobalSearchModule() {
  return `
    <div class="player-search-centered home-search">
      <div class="search-title">Sok lag &amp; spelare</div>
      <div class="search-wrapper">
        <input id="globalSearch" placeholder="Sok lag eller spelare" autocomplete="off" aria-label="Sok lag eller spelare">
        <div id="globalResults" role="listbox" aria-label="Sokresultat"></div>
      </div>
    </div>
  `;
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
    .map(function(match) {
      return match.date || "";
    })
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

function bindViewInteractions() {
  bindCupCardLinks();
  bindGlobalSearch();
}

function bindCupCardLinks() {
  Array.from(document.querySelectorAll("[data-cup-link]")).forEach(function(card) {
    const href = card.getAttribute("data-cup-link");
    if (!href || card.dataset.bound === "true") {
      return;
    }

    card.dataset.bound = "true";

    card.addEventListener("click", function(event) {
      if (event.target && event.target.tagName === "A") {
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

  const items = []
    .concat(state.teams.map(function(team) {
      return {
        type: "team",
        label: team.name,
        href: "#/team/" + encodeURIComponent(team.key),
        meta: team.cups[0] ? team.cups[0].code : "Lag"
      };
    }))
    .concat(state.players.map(function(player) {
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
    const query = slugify(input.value || "");

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

function renderCompactMatchSummary(match) {
  return `
    <div class="compact-match">
      <p class="compact-match-meta">${escapeHtml(formatMatchDate(match.date, match.time))}</p>
      <div class="compact-match-row">
        ${renderTeamIdentity(match.awayTeam, "sm")}
        <strong>${displayScore(match.awayScore)} - ${displayScore(match.homeScore)}</strong>
        ${renderTeamIdentity(match.homeTeam, "sm")}
      </div>
    </div>
  `;
}

function renderFeaturedMatchCard(match) {
  return `
    <div class="featured-match-card">
      ${renderCompactMatchSummary(match)}
      <p class="match-summary">${escapeHtml(match.goalsSummary || "Ingen maltext registrerad.")}</p>
    </div>
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

function renderLoadingState() {
  return `
    <section class="tab-panel cups-panel">
      <h2>Valj turnering</h2>
      <div class="cup-status">Laddar cuper...</div>
    </section>
  `;
}

function setView(html) {
  if (!appView) {
    throw new Error("Saknar #app-view i index.html.");
  }
  appView.innerHTML = html;
  bindViewInteractions();
}

function showFatalError(error) {
  const message = typeof error === "string"
    ? error
    : error && error.message
      ? error.message
      : "Ett ovantat fel uppstod i sidan.";

  if (appView) {
    appView.innerHTML = renderErrorState("JavaScript-fel: " + message);
  }
}

function buildGroupStandings(matches) {
  const groupMap = new Map();

  matches.filter(function(match) {
    return match.stage !== "playoffs";
  }).forEach(function(match) {
    const groupName = match.group || "Gruppspel";
    if (!groupMap.has(groupName)) {
      groupMap.set(groupName, new Map());
    }

    const standings = groupMap.get(groupName);
    ingestStandingRow(standings, match.homeTeam, match.homeScore, match.awayScore, match.overtime);
    ingestStandingRow(standings, match.awayTeam, match.awayScore, match.homeScore, match.overtime);
  });

  return Array.from(groupMap.entries()).map(function(entry) {
    const rows = Array.from(entry[1].values()).sort(function(a, b) {
      return b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor || a.team.localeCompare(b.team, "sv");
    });

    return {
      name: entry[0],
      rows
    };
  });
}

function ingestStandingRow(standings, teamName, goalsFor, goalsAgainst, overtime) {
  const key = createTeamKey(teamName);
  if (!standings.has(key)) {
    standings.set(key, {
      team: teamName,
      gp: 0,
      wins: 0,
      losses: 0,
      otLosses: 0,
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

  if (goalsFor > goalsAgainst) {
    row.wins += 1;
    row.points += 3;
  }
  } else if (overtime) {
    row.otLosses += 1;
    row.points += 1;
  } else {
    row.losses += 1;
  }
}

function getCupOverview(cup) {
  const teams = buildCupTeams(cup);
  const groupMatches = cup.matches
    .filter(function(match) { return match.stage !== "playoffs"; })
    .slice()
    .sort(compareMatchesDesc);
  const playoffMatches = cup.matches
    .filter(function(match) { return match.stage === "playoffs"; })
    .slice()
    .sort(compareMatchesDesc);
  const allPlayerRows = cup.playerStats.group.concat(cup.playerStats.playoffs);
  const allGoalieRows = cup.goalieStats.group.concat(cup.goalieStats.playoffs);
  const topPlayers = allPlayerRows
    .slice()
    .sort(function(a, b) { return b.pts - a.pts || b.g - a.g || a.player.localeCompare(b.player, "sv"); })
    .slice(0, 12);
  const topGoalies = allGoalieRows
    .slice()
    .sort(function(a, b) { return safeNumber(b.svp) - safeNumber(a.svp) || safeNumber(a.gaa) - safeNumber(b.gaa); })
    .slice(0, 10);
  const featuredMatch = playoffMatches[0] || groupMatches[0] || null;
  const bestGoalie = topGoalies[0] || null;

  return {
    teams,
    groupMatches,
    playoffMatches,
    featuredMatch,
    bestGoalie,
    topPlayers,
    topGoalies
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

  return Array.from(names)
    .map(function(name) {
      return state.teams.find(function(team) { return team.key === createTeamKey(name); });
    })
    .filter(Boolean)
    .sort(function(a, b) {
      return a.name.localeCompare(b.name, "sv");
    });
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

function renderTeamIdentity(teamName, size) {
  const logoClass = size === "sm" ? "team-logo-sm" : "team-logo-md";
  const href = "#/team/" + encodeURIComponent(createTeamKey(teamName));
  return `
    <a class="team-identity" href="${href}">
      ${renderTeamLogo(teamName, logoClass)}
      <span class="team-identity-text">${escapeHtml(teamName)}</span>
    </a>
  `;
}

function renderPlayerIdentity(player) {
  const href = "#/player/" + encodeURIComponent(player.key);
  return `
    <a class="player-identity" href="${href}">
      ${renderPlayerPortrait(player, "player-portrait-sm")}
      <span class="player-identity-text">${escapeHtml(player.name)}</span>
    </a>
  `;
}

function renderTeamLogo(teamName, sizeClass) {
  if (!teamName || teamName === "Ej klar") {
    return `<span class="team-logo-wrap ${sizeClass || "team-logo-sm"} is-missing"></span>`;
  }

  const src = getTeamLogoUrl(teamName);
  return `
    <span class="team-logo-wrap ${sizeClass || "team-logo-sm"}">
      <img
        class="team-logo-image"
        src="${escapeHtml(src)}"
        alt="${escapeHtml(teamName)} logga"
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

function renderPlayerLink(row) {
  return `<a href="#/player/${encodeURIComponent(createPlayerKey(row))}">${escapeHtml(row.player)}</a>`;
}

function renderPlayerPortrait(player, sizeClass) {
  const filename = getPlayerImageFilename(player);

  if (!filename) {
    return `<span class="player-portrait-wrap ${sizeClass || "player-portrait-sm"} is-missing"></span>`;
  }

  const src = getPlayerImageBaseUrl() + "/" + encodeURIComponent(filename);
  return `
    <span class="player-portrait-wrap ${sizeClass || "player-portrait-sm"}">
      <img
        class="player-portrait-image"
        src="${escapeHtml(src)}"
        alt="${escapeHtml(player.name || player.player)} spelarkort"
        loading="lazy"
        onerror="this.style.display='none';this.parentElement.classList.add('is-missing');"
      >
    </span>
  `;
}

function getPlayerImageFilename(player) {
  const baseName = getPlayerImageStem(player?.name || player?.player || "");
  return baseName ? baseName + ".jpg" : "";
}

function getPlayerImageStem(playerName) {
  return String(playerName || "")
    .split(",")[0]
    .trim();
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
    .replace(/[Ã¥Ã¤]/g, "a")
    .replace(/Ã¶/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueBy(items, key) {
  const map = new Map();
  items.forEach(function(item) {
    map.set(item[key], item);
  });
  return Array.from(map.values());
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
  if (numeric > 1) {
    return numeric.toFixed(1);
  }
  return (numeric * 100).toFixed(1);
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

function sumBy(items, key) {
  return items.reduce(function(sum, item) {
    return sum + toNumber(item[key]);
  }, 0);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
