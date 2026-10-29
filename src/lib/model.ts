// Tahmin motoru: Elo -> beklenen gol -> Poisson dağılımı -> 1/X/2 olasılıkları ve en olası skor.
// Girdiler (Elo, ev sahibi avantajı) veri katmanından gelir; model sade ve açıklanabilir tutuldu (/metodoloji sayfasında anlatılır).

export interface TeamStrength {
  elo: number;
  attack?: number; // lig ortalamasına göre 1.0 = ortalama
  defense?: number; // 1.0 = ortalama, <1 daha iyi savunma
}

export interface MatchPrediction {
  xgHome: number;
  xgAway: number;
  pHome: number;
  pDraw: number;
  pAway: number;
  mostLikely: { home: number; away: number; p: number };
  fairOdds: { home: number; draw: number; away: number };
}

const HOME_ADVANTAGE_ELO = 65;
const LEAGUE_AVG_GOALS = 1.35; // takım başı maç başına ortalama gol
const MAX_GOALS = 8;

function poissonPmf(k: number, lambda: number): number {
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

export function predictMatch(home: TeamStrength, away: TeamStrength): MatchPrediction {
  const diff = home.elo + HOME_ADVANTAGE_ELO - away.elo;
  // Elo farkını gol beklentisine çevir (400 puan ≈ 10x güç)
  const share = 1 / (1 + Math.pow(10, -diff / 400));
  const total = LEAGUE_AVG_GOALS * 2;
  let xgHome = total * share * (home.attack ?? 1) * (away.defense ?? 1);
  let xgAway = total * (1 - share) * (away.attack ?? 1) * (home.defense ?? 1);
  xgHome = Math.max(0.2, xgHome);
  xgAway = Math.max(0.2, xgAway);

  let pHome = 0, pDraw = 0, pAway = 0;
  let best = { home: 0, away: 0, p: 0 };
  for (let h = 0; h <= MAX_GOALS; h++) {
    for (let a = 0; a <= MAX_GOALS; a++) {
      const p = poissonPmf(h, xgHome) * poissonPmf(a, xgAway);
      if (h > a) pHome += p;
      else if (h === a) pDraw += p;
      else pAway += p;
      if (p > best.p) best = { home: h, away: a, p };
    }
  }
  const sum = pHome + pDraw + pAway; // kesilen kuyruğu normalize et
  pHome /= sum; pDraw /= sum; pAway /= sum;
  const odds = (p: number) => Math.round((1 / p) * 100) / 100;
  return {
    xgHome, xgAway, pHome, pDraw, pAway, mostLikely: best,
    fairOdds: { home: odds(pHome), draw: odds(pDraw), away: odds(pAway) },
  };
}
