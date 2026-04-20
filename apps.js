const DATA_SOURCES = {
  sheet: window.SEC_CONFIG?.sheetUrl || "",
  database: window.SEC_CONFIG?.databaseUrl || ""
};

const FALLBACK_DATA = {
  cups: [
    {
      id: 1,
      code: "SEC 1",
      name: "Svenska eHockey Cupen 1",
      placements: {
        first: "Lag 1",
        second: "Lag 2"
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
          goalsSummary: "1-0 Karlsson, 2-0 Andersson, 2-1 Olsson"
        }
      ],
      playerStats: {
        group: [
          {
            player: "Spelare 1",
            team: "Frolunda",
            gp: 5,
            g: 4,
            a: 3,
            pts: 7,
            pim: 2,
            playerId: "123"
          }
        ],
        playoffs: [
          {
            player: "Spelare 1",
            team: "Frolunda",
            gp: 2,
            g: 1,
            a: 2,
            pts: 3,
            pim: 0,
            playerId: "123"
          }
        ]
      },
      goalieStats: {
        group: [
          {
            player: "Malvakt 1",
            team: "Frolunda",
            gp: 5,
            sa: 60,
            ga: 10,
            sv: 50,
            gaa: 2,
            svp: 83.3,
            so: 1,
            playerId: "456"
          }
        ],
        playoffs: []
      }
    }
  ]
};

const state = {
  cups: [],
  filteredCups: []
};

const elements = {
  totalCups: document.querySelector("#total-cups"),
  totalMatches: document.querySelector("#total-matches"),
  totalPlayers: document.querySelector("#total-players"),
  dataStatus: document.querySelector("#data-status"),
  championsGrid: document.querySelector("#champions-grid"),
  cupsGrid: document.querySelector("#cups-grid"),
  cupSearch: document.querySelector("#cup-search"),
  cupSort: document.querySelector("#cup-sort"),
  championTemplate: document.querySelector("#champion-card-template"),
  cupTemplate: document.querySelector("#cup-card-template")
};

init();

async function init() {
  wireEvents();

  try {
    const cups = await loadCups();
    state.cups = normalizeCups(cups);
    state.filteredCups = [...state.cups];

    renderHeroStats(state.cups);
    renderChampions(state.cups);
    applyFilters();

    elements.dataStatus.textContent = "Live";
  } catch (error) {
    console.error(error);
    elements.dataStatus.textContent = "Fel vid laddning";
    renderEmptyState(
      elements.championsGrid,
      "Kunde inte ladda data. Kontrollera länkarna i app.js och försök igen."
    );
    renderEmptyState(
      elements.cupsGrid,
      "Ingen cupdata kunde visas just nu."
    );
  }
}

function wireEvents() {
  elements.cupSearch.addEventListener("input", applyFilters);
  elements.cupSort.addEventListener("change", applyFilters);
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

async function loadSource(url, optional) {
  if (!url) {
    return [];
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Request failed for " + url);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : data.cups || [];
  } catch (error) {
    if (!optional) {
      throw error;
    }

    return [];
  }
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

      return {
        id: cup.id,
        code: cup.code || "SEC " + cup.id,
        name: cup.name || "Svenska eHockey Cupen " + cup.id,
        winner: cup.placements?.first || "Ej klar",
        runnerUp: cup.placements?.second || "Ej klar",
        matches: cup.matches || [],
        matchCount: (cup.matches || []).length,
        playerCount: allPlayerStats.length,
        goalieCount: allGoalieStats.length,
        groupPlayerCount: (cup.playerStats?.group || []).length,
        playoffPlayerCount: (cup.playerStats?.playoffs || []).length,
        topScorer: topScorer ? formatTopScorer(topScorer) : "Ingen data än"
      };
    })
    .sort(function(a, b) {
      return b.id - a.id;
    });
}

function renderHeroStats(cups) {
  const totalMatches = cups.reduce(function(sum, cup) {
    return sum + cup.matchCount;
  }, 0);
  const totalPlayers = cups.reduce(function(sum, cup) {
    return sum + cup.playerCount;
  }, 0);

  elements.totalCups.textContent = String(cups.length);
  elements.totalMatches.textContent = String(totalMatches);
  elements.totalPlayers.textContent = String(totalPlayers);
}

function renderChampions(cups) {
  elements.championsGrid.innerHTML = "";

  const champions = cups
    .filter(function(cup) { return cup.winner && cup.winner !== "Ej klar"; })
    .slice(0, 3);

  if (!champions.length) {
    renderEmptyState(elements.championsGrid, "Lägg till vinnardata i sheetet så visas mästarna här.");
    return;
  }

  champions.forEach(function(cup, index) {
    const fragment = elements.championTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".champion-card");

    card.style.animationDelay = String(index * 90) + "ms";
    fragment.querySelector(".champion-cup").textContent = cup.code;
    fragment.querySelector(".champion-team").textContent = cup.winner;
    fragment.querySelector(".champion-meta").textContent = "Finalist: " + cup.runnerUp;

    elements.championsGrid.appendChild(fragment);
  });
}

function applyFilters() {
  const searchValue = elements.cupSearch.value.trim().toLowerCase();
  const sortValue = elements.cupSort.value;

  state.filteredCups = state.cups
    .filter(function(cup) {
      if (!searchValue) {
        return true;
      }

      return [cup.code, cup.name, cup.winner, cup.runnerUp]
        .join(" ")
        .toLowerCase()
        .includes(searchValue);
    })
    .sort(function(a, b) {
      return sortValue === "asc" ? a.id - b.id : b.id - a.id;
    });

  renderCupCards(state.filteredCups);
}

function renderCupCards(cups) {
  elements.cupsGrid.innerHTML = "";

  if (!cups.length) {
    renderEmptyState(elements.cupsGrid, "Ingen cup matchade din sökning.");
    return;
  }

  cups.forEach(function(cup, index) {
    const fragment = elements.cupTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".cup-card");

    card.style.animationDelay = String(index * 60) + "ms";
    fragment.querySelector(".cup-code").textContent = cup.code;
    fragment.querySelector(".cup-name").textContent = cup.name;
    fragment.querySelector(".cup-badge").textContent = "Cup " + cup.id;
    fragment.querySelector(".cup-winner").textContent = cup.winner;
    fragment.querySelector(".cup-runner-up").textContent = cup.runnerUp;
    fragment.querySelector(".cup-match-count").textContent = String(cup.matchCount);
    fragment.querySelector(".cup-top-scorer").textContent = cup.topScorer;
    fragment.querySelector(".cup-stage-note").textContent =
      "Gruppspel: " + cup.groupPlayerCount + " spelarposter, slutspel: " + cup.playoffPlayerCount + " spelarposter.";

    elements.cupsGrid.appendChild(fragment);
  });
}

function renderEmptyState(container, message) {
  container.innerHTML = "";

  const box = document.createElement("div");
  box.className = "empty-state";
  box.textContent = message;
  container.appendChild(box);
}

function formatTopScorer(player) {
  const playerName = player.player || "Okänd spelare";
  const team = player.team ? " - " + player.team : "";
  const points = toNumber(player.pts);
  return playerName + team + " (" + points + " p)";
}

function toNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
