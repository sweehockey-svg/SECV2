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
          group: "A",
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
          stage: "kvartsfinal",
          group: null,
          goalsSummary: "1-0 FezH_88 | 2-0 Maxboeeee | 3-0 LordOlii"
        }
      ],
      playerStats: {
        group: [
          { player: "FezH_88", team: "Frolunda", gp: 2, g: 3, a: 2, pts: 5, pim: 0, playerId: "123" },
          { player: "LordOlii", team: "Frolunda", gp: 2, g: 1, a: 2, pts: 3, pim: 2, playerId: "124" },
          { player: "Dan9105", team: "Lulea", gp: 2, g: 1, a: 1, pts: 2, pim: 0, playerId: "125" }
        ],
        playoffs: []
      },
      goalieStats: {
        group: [
          { player: "Mlv Frolunda", team: "Frolunda", gp: 2, sa: 42, ga: 3, sv: 39, gaa: 1.5, svp: 0.929, so: 0, playerId: "456" },
          { player: "Mlv Lulea", team: "Lulea", gp: 2, sa: 50, ga: 6, sv: 44, gaa: 3.0, svp: 0.88, so: 0, playerId: "457" }
        ],
        playoffs: []
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
  showFatalError(event.error || event.message || "Okänt fel i JavaScript.");
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
      const normalizedMatches = (cup.matches || []).map(function(match, index) {
        const stageInfo = normalizeStage(match.stage);

        return {
          id: createMatchId(cup.id, index),
          date: match.date || null,
          time: match.time || null,
          awayTeam: match.awayTeam || "Okänt lag",
          awayScore: toNullableNumber(match.awayScore),
          homeScore: toNullableNumber(match.homeScore),
          homeTeam: match.homeTeam || "Okänt lag",
          overtime: Boolean(match.overtime),
          stage: stageInfo.value,
          stageCategory: stageInfo.category,
          stageLabel: stageInfo.label,
          group: match.group || null,
          goalsSummary: match.goalsSummary || ""
        };
      });

      const normalizedPlayerGroup = normalizePlayerRows(cup.playerStats?.group || [], "group");
      const normalizedPlayerPlayoffs = normalizePlayerRows(cup.playerStats?.playoffs || [], "playoffs");
      const normalizedGoalieGroup = normalizeGoalieRows(cup.goalieStats?.group || [], "group");
      const normalizedGoaliePlayoffs = normalizeGoalieRows(cup.goalieStats?.playoffs || [], "playoffs");

      const allPlayerStats = normalizedPlayerGroup.concat(normalizedPlayerPlayoffs);
      const allGoalieStats = normalizedGoalieGroup.concat(normalizedGoaliePlayoffs);

      const topScorer = allPlayerStats
        .slice()
        .sort(function(a, b) {
          return (toNumber(b.pts) - toNumber(a.pts)) || (toNumber(b.g) - toNumber(a.g));
        })[0];

      const playoffMatchCount = normalizedMatches.filter(function(match) {
        return match.stageCategory === "playoffs";
      }).length;

      const groupMatchCount = normalizedMatches.filter(function(match) {
        return match.stageCategory === "group";
      }).length;

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
          group: normalizedPlayerGroup,
          playoffs: normalizedPlayerPlayoffs
        },
        goalieStats: {
          group: normalizedGoalieGroup,
          playoffs: normalizedGoaliePlayoffs
        },
        matchCount: normalizedMatches.length,
        groupMatchCount,
        playoffMatchCount,
        playerCount: allPlayerStats.length,
        goalieCount: allGoalieStats.length,
        topScorer: topScorer ? formatPlayerLabel(topScorer) : "Ingen data än"
      };
    })
    .sort(function(a, b) {
      return b.sortOrder - a.sortOrder;
    });
}

function normalizePlayerRows(rows, stage) {
  return rows.map(function(row) {
    return {
      player: row.player || "Okänd spelare",
      team: row.team || "Okänt lag",
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
      player: row.player || "Okänd målvakt",
      team: row.team || "Okänt lag",
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
          stageCategory: match.stageCategory,
          stageLabel: match.stageLabel,
          date: match.date
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
  const topChampions = state.cups.filter(function(cup) {
    return cup.winner && cup.winner !== "Ej klar";
  }).slice(0, 3);

  return `
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Svenska eHockey Cupen</p>
        <h1>Mörkblått, tydligt och byggt för hela SEC.</h1>
        <p class="hero-text">
          Här samlas hela historiken för Svensk eHockey. Från tidigare SEC-turneringar i sheetet till nya cuper i databasen, allt på ett och samma ställe.
        </p>
        <div class="hero-actions">
          <a class="button button-primary" href="#/cups">Se alla cuper</a>
          <a class="button button-secondary" href="#/teams">Se alla lag
