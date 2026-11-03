/* サッカー将棋 - 純粋ロジック（UIなし、テスト可能） */
(function (global) {
  'use strict';
  const COLS = 9, ROWS = 13;
  const GOAL_COLS = [3, 4, 5]; // 左・中央・右

  function initialPlayers() {
    const blueSpec = [
      ['GK', 4, 12],
      ['DF', 1, 11], ['DF', 3, 11], ['DF', 5, 11], ['DF', 7, 11],
      ['MF', 1, 9], ['MF', 3, 9], ['MF', 5, 9], ['MF', 7, 9],
      ['FW', 3, 7], ['FW', 5, 7],
    ];
    const players = [];
    blueSpec.forEach((s, i) => players.push({ id: 'B' + i, team: 'blue', role: s[0], c: s[1], r: s[2] }));
    blueSpec.forEach((s, i) => players.push({ id: 'R' + i, team: 'red', role: s[0], c: 8 - s[1], r: 12 - s[2] }));
    return players;
  }
  // キックオフ時のボール保持者：そのチームのFWのうち先頭（左FW）
  function kickoffHolder(players, team) {
    const fw = players.find(p => p.team === team && p.role === 'FW');
    return fw.id;
  }
  function byId(players, id) { return players.find(p => p.id === id); }
  function playerAt(players, c, r) { return players.find(p => p.c === c && p.r === r) || null; }
  function cheb(a, b) { return Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r)); }
  function inBoard(c, r) { return c >= 0 && c < COLS && r >= 0 && r < ROWS; }
  // ゴール前ゾーン（2026-11-03追加）：ゴール3マスの真前のマス（上端 r=0／下端 r=12 の中央3列）
  function goalFrontTeam(c, r) {
    if (GOAL_COLS.includes(c) && r === 0) return 'red';
    if (GOAL_COLS.includes(c) && r === ROWS - 1) return 'blue';
    return null;
  }
  // GKゾーンに立てるのは、そのゴールを守るGKと、相手プレイヤー全員（2026-11-03改定：相手も侵入可能に）。
  // 守る側のGK以外の選手（自軍のDFなど）は立てない。相手が入れるため、ゾーン内のルーズボールも拾いにいける
  function canStand(p, c, r) {
    const owner = goalFrontTeam(c, r);
    if (!owner) return true;
    if (p.team !== owner) return true;
    return p.role === 'GK';
  }
  // オフサイドライン：守備側のうち自ゴールに近い方から2人目（GK含む）の行
  function offsideLine(players, attackingTeam) {
    const rows = players.filter(p => p.team !== attackingTeam).map(p => p.r);
    rows.sort((a, b) => attackingTeam === 'blue' ? a - b : b - a);
    return rows[1];
  }
  // 受け手がオフサイド位置にいるか（蹴る瞬間のボールの位置で判定）。
  // 自陣内（青はr>=6、赤はr<=5）、ボールと同じか後ろ、ラインと同じ高さはセーフ
  function isOffside(players, ball, recv) {
    if (recv.team === 'blue') {
      if (recv.r >= 6 || recv.r >= ball.r) return false;
      return recv.r < offsideLine(players, 'blue');
    }
    if (recv.r <= 5 || recv.r <= ball.r) return false;
    return recv.r > offsideLine(players, 'red');
  }
  // フィールドの外に突き出たゴールマス：上端の外＝'top'（赤のゴール）、下端の外＝'bottom'（青のゴール）
  function goalSquareAt(c, r) {
    if (r === -1 && GOAL_COLS.includes(c)) return 'top';
    if (r === ROWS && GOAL_COLS.includes(c)) return 'bottom';
    return null;
  }
  // そのチームが攻めるゴール（青は上＝top、赤は下＝bottom）
  function attackingGoal(team) { return team === 'blue' ? 'top' : 'bottom'; }
  // 選手の移動（2026-11-03改定：役割×方向別）。「前」はそのチームの攻撃方向（青は上＝r減少、赤は下＝r増加）。
  // 斜め前には前のマス数、斜め後には後のマス数を適用する。GKは既存仕様（全方向均一）を維持。
  // どの方向も途中のマスに選手がいれば先へ進めない。選手のいるマスには入れない
  const MOVE_TABLE = {
    FW: { free: { f: 4, s: 3, b: 2 }, hold: { f: 2, s: 2, b: 1 } },
    MF: { free: { f: 3, s: 3, b: 3 }, hold: { f: 2, s: 2, b: 2 } },
    DF: { free: { f: 2, s: 3, b: 4 }, hold: { f: 1, s: 2, b: 2 } },
    GK: { free: { f: 3, s: 3, b: 3 }, hold: { f: 2, s: 2, b: 2 } },
  };
  function moveTargets(players, p, isHolder) {
    const t = MOVE_TABLE[p.role][isHolder ? 'hold' : 'free'];
    const fwd = p.team === 'blue' ? -1 : 1;
    const rays = [
      { dc: 0, dr: fwd, max: t.f }, { dc: 0, dr: -fwd, max: t.b },
      { dc: 1, dr: 0, max: t.s }, { dc: -1, dr: 0, max: t.s },
      { dc: 1, dr: fwd, max: t.f }, { dc: -1, dr: fwd, max: t.f },
      { dc: 1, dr: -fwd, max: t.b }, { dc: -1, dr: -fwd, max: t.b },
    ];
    const out = [];
    for (const ray of rays) {
      for (let step = 1; step <= ray.max; step++) {
        const c = p.c + ray.dc * step, r = p.r + ray.dr * step;
        if (!inBoard(c, r) || !canStand(p, c, r) || playerAt(players, c, r)) break;
        out.push({ c, r });
      }
    }
    return out;
  }
  // ボールの単独移動（2026-11-03改定）：8方向の直線で最大5マス。各方向は最初に選手がいるマスまで（そのマスを含む）。
  // フィールドの外のゴールマスに届けばゴール（シュートもこのキックで行う）。ゴールマスは goal: 'top'|'bottom' つきで返る
  // usedIds（任意）：このターンにすでにボールを保有した選手のID配列。その選手が最初に触れる方向は usedBlock として返す（2度持ち禁止）
  // kicker（任意）：蹴る選手。FWは「斜め後ろ」へのキック不可（2026-11-03改定。それ以外の役割は8方向可、GKは既存仕様）
  function ballKickTargets(players, ball, usedIds, kicker) {
    const out = [];
    const fwd = kicker && kicker.team === 'red' ? 1 : -1;
    for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
      if (!dc && !dr) continue;
      if (kicker && kicker.role === 'FW' && dc !== 0 && dr === -fwd) continue; // FWの斜め後ろ禁止

      for (let step = 1; step <= 5; step++) {
        const c = ball.c + dc * step, r = ball.r + dr * step;
        const g = goalSquareAt(c, r);
        if (g) {
          // 直接ゴールに入れるキックは3マスまで（2026-11-03改定）。4マス以上先のゴールマスは候補に出さない
          if (step <= 3) out.push({ c, r, holderId: null, goal: g });
          break;
        }
        if (!inBoard(c, r)) break;
        const occ = playerAt(players, c, r);
        out.push({ c, r, holderId: occ ? occ.id : null, goal: null, usedBlock: !!(occ && usedIds && usedIds.includes(occ.id)), offside: occ ? isOffside(players, ball, occ) : false });
        if (occ) break;
      }
    }
    return out;
  }
  // そのチームが攻めるゴールへ今すぐ蹴り込めるターゲット（なければ null）。kickerを渡すとキック方向制限も反映する
  function attackingGoalTarget(players, ball, team, kicker) {
    const want = attackingGoal(team);
    return ballKickTargets(players, ball, null, kicker).find(t => t.goal === want) || null;
  }
  // 奪取（2026-11-03改定）：保持者の縦横1マス（斜め不可）にいる相手選手が奪える
  function stealCandidates(players, holderId, team) {
    const h = byId(players, holderId);
    if (!h || h.team === team) return [];
    return players.filter(p => p.team === team && Math.abs(p.c - h.c) + Math.abs(p.r - h.r) === 1);
  }
  function lineSquares(c0, r0, c1, r1) {
    // Bresenham: 始点と終点の間のマス（両端含まない）
    const pts = [];
    let dx = Math.abs(c1 - c0), dy = Math.abs(r1 - r0);
    let sx = c0 < c1 ? 1 : -1, sy = r0 < r1 ? 1 : -1, err = dx - dy, c = c0, r = r0;
    while (!(c === c1 && r === r1)) {
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; c += sx; }
      if (e2 < dx) { err += dx; r += sy; }
      if (c === c1 && r === r1) break;
      pts.push({ c, r });
    }
    return pts;
  }
  function distToGoal(p) { return p.team === 'blue' ? p.r : ROWS - 1 - p.r; }
  function manhattan(c1, r1, c2, r2) { return Math.abs(c1 - c2) + Math.abs(r1 - r2); }
  function oppOrthAdjacent(players, team, c, r) {
    return players.filter(p => p.team !== team && manhattan(p.c, p.r, c, r) === 1);
  }
  // CPU用：前進できる・決定機を作れる味方へのパスを1つ選ぶ（なければ null）
  function bestPass(players, holderId, usedIds) {
    const h = byId(players, holderId);
    const targets = ballKickTargets(players, { c: h.c, r: h.r }, usedIds, h);
    let best = null;
    for (const t of targets) {
      if (!t.holderId || t.usedBlock || t.offside) continue;
      const recv = byId(players, t.holderId);
      if (recv.team !== h.team || recv.id === h.id) continue;
      const advance = distToGoal(h) - distToGoal(recv);
      const danger = oppOrthAdjacent(players, h.team, recv.c, recv.r).length > 0;
      const recvGoal = !!attackingGoalTarget(players, { c: recv.c, r: recv.r }, recv.team, recv);
      const score = advance * 2 + (recvGoal ? 5 : 0) - (danger ? 6 : 0);
      if (score >= 3 && (!best || score > best.score)) best = { target: t, receiver: recv, score };
    }
    return best;
  }
  // CPU用：保持者のドリブル先（ゴールへ近づき、相手の縦横に捕まらないマス）。なければ null
  function dribbleTarget(players, holderId) {
    const h = byId(players, holderId);
    const cur = distToGoal(h);
    const curDanger = oppOrthAdjacent(players, h.team, h.c, h.r).length > 0;
    const cands = moveTargets(players, h, true).map(m => ({
      c: m.c, r: m.r,
      dist: distToGoal({ team: h.team, r: m.r }),
      danger: oppOrthAdjacent(players, h.team, m.c, m.r).length > 0,
    })).filter(x => !x.danger);
    cands.sort((a, b) => a.dist - b.dist);
    if (!cands.length) return null;
    const b = cands[0];
    if (b.dist < cur || (curDanger && b.dist <= cur)) return b;
    return null;
  }
  // CPU用：目標マスへ最も近づける自軍選手の移動（GKは自陣ゴール前から出ない制約つき可）
  function bestMoveToward(players, team, target, holderId, opts) {
    opts = opts || {};
    let best = null;
    for (const p of players) {
      if (p.team !== team) continue;
      let targets = moveTargets(players, p, p.id === holderId);
      if (opts.gkHome && p.role === 'GK') {
        targets = targets.filter(m => team === 'red' ? (m.r <= 2 && m.c >= 2 && m.c <= 6) : (m.r >= 10 && m.c >= 2 && m.c <= 6));
      }
      const before = manhattan(p.c, p.r, target.c, target.r);
      for (const m of targets) {
        const after = manhattan(m.c, m.r, target.c, target.r);
        const progress = before - after;
        if (progress < 1) continue;
        if (!best || progress > best.progress || (progress === best.progress && after < best.after)) {
          best = { playerId: p.id, c: m.c, r: m.r, progress, after };
        }
      }
    }
    return best;
  }
  // ===== 上級CPU（2026-11-03追加）：全候補手を評価関数で採点し、最善の1手を返す =====
  function progOf(team, r) { return team === 'red' ? r : ROWS - 1 - r; } // 攻撃方向への進み具合（0..12）
  function homeRowOf(team) { return team === 'red' ? 0 : ROWS - 1; }
  function clonePlayers(players) { return players.map(p => ({ id: p.id, team: p.team, role: p.role, c: p.c, r: p.r })); }
  // 局面評価（team視点。大きいほどteamに有利）
  function evalPosition(players, ball, ballId, team) {
    let s = 0;
    const h = ballId ? byId(players, ballId) : null;
    if (h) {
      const mine = h.team === team;
      const threat = oppOrthAdjacent(players, h.team, h.c, h.r).length; // 保持者の縦横にいる相手＝奪取リスク
      const support = players.filter(p => p.team === h.team && p.id !== h.id && manhattan(p.c, p.r, h.c, h.r) === 1).length;
      let v = 26 + progOf(h.team, h.r) * 3 + (4 - Math.abs(h.c - 4)) * 1.2
        + (h.role === 'FW' ? 5 : h.role === 'MF' ? 2 : 0) - threat * 16 + support * 2;
      if (attackingGoalTarget(players, { c: h.c, r: h.r }, h.team, h)) v += 25; // 次にシュート可能
      s += mine ? v : -v;
    } else {
      let dOwn = 99, dOpp = 99;
      for (const p of players) {
        const d = manhattan(p.c, p.r, ball.c, ball.r);
        if (p.team === team) dOwn = Math.min(dOwn, d); else dOpp = Math.min(dOpp, d);
      }
      s += (dOpp - dOwn) * 4 + progOf(team, ball.r) * 1.2;
    }
    for (const p of players) {
      const v = progOf(p.team, p.r) * 0.35 - Math.abs(p.c - 4) * 0.08;
      s += p.team === team ? v : -v;
      if (p.role === 'GK') {
        const idealC = Math.max(3, Math.min(5, ball.c));
        const pen = (Math.abs(p.c - idealC) + Math.abs(p.r - homeRowOf(p.team))) * 1.6;
        s += p.team === team ? -pen : pen;
      }
    }
    return s;
  }
  // opts: { team, usedIds, canGoal, gkFree } → {type:'kick',target} / {type:'move',playerId,c,r} / {type:'steal',playerId} / {type:'gkfree',c,r} / null（手なし）
  function chooseAdvanced(players, ball, ballId, opts) {
    const team = opts.team;
    const opp = team === 'red' ? 'blue' : 'red';
    const usedIds = opts.usedIds || [];
    const h = ballId ? byId(players, ballId) : null;
    if (opts.gkFree) {
      const gk = players.find(p => p.team === team && p.role === 'GK');
      const inHome = gk && (team === 'red' ? gk.r <= 1 : gk.r >= ROWS - 2);
      if (inHome) {
        const idealC = Math.max(3, Math.min(5, ball.c));
        if (gk.c !== idealC || gk.r !== homeRowOf(team)) {
          let best = null;
          for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
            if (!dc && !dr) continue;
            const c = gk.c + dc, r = gk.r + dr;
            if (!inBoard(c, r) || playerAt(players, c, r) || !canStand(gk, c, r)) continue;
            if (!(team === 'red' ? r <= 1 : r >= ROWS - 2)) continue;
            const d = Math.abs(c - idealC) + Math.abs(r - homeRowOf(team));
            if (!best || d < best.d) best = { c, r, d };
          }
          if (best) return { type: 'gkfree', c: best.c, r: best.r };
        }
      }
    }
    if (h && h.team === team) {
      if (opts.canGoal) {
        const gt = attackingGoalTarget(players, ball, team, h);
        if (gt) return { type: 'kick', target: gt };
      }
      let best = null;
      const consider = (score, act) => { const sc = score + Math.random() * 0.6; if (!best || sc > best.sc) best = { sc, act }; };
      for (const t of ballKickTargets(players, ball, usedIds, h)) {
        if (t.goal || t.usedBlock || t.offside) continue;
        if (t.holderId) {
          const recv = byId(players, t.holderId);
          if (recv.team === team) {
            if (recv.id === h.id) continue;
            let sc = evalPosition(players, { c: recv.c, r: recv.r }, recv.id, team);
            if (attackingGoalTarget(players, { c: recv.c, r: recv.r }, team, recv)) sc += 45; // 受け手が即シュート可能
            consider(sc, { type: 'kick', target: t });
          } else {
            consider(-260, { type: 'kick', target: t }); // 相手へのパスは最終手段
          }
        } else {
          consider(evalPosition(players, { c: t.c, r: t.r }, null, team) - 6, { type: 'kick', target: t });
        }
      }
      for (const m of moveTargets(players, h, true)) {
        const ps = clonePlayers(players);
        const mp = byId(ps, h.id); mp.c = m.c; mp.r = m.r;
        consider(evalPosition(ps, { c: m.c, r: m.r }, h.id, team), { type: 'move', playerId: h.id, c: m.c, r: m.r });
      }
      return best ? best.act : null;
    }
    if (h && h.team === opp) {
      const cands = stealCandidates(players, h.id, team);
      if (cands.length) {
        let best = null;
        for (const p of cands) {
          const sc = evalPosition(players, ball, p.id, team) + 14 + Math.random() * 0.6;
          if (!best || sc > best.sc) best = { sc, act: { type: 'steal', playerId: p.id } };
        }
        return best.act;
      }
      const cur = evalPosition(players, ball, ballId, team);
      let best = null;
      for (const p of players) {
        if (p.team !== team) continue;
        let targets = moveTargets(players, p, false);
        if (p.role === 'GK') targets = targets.filter(m => team === 'red' ? (m.r <= 2 && m.c >= 2 && m.c <= 6) : (m.r >= ROWS - 3 && m.c >= 2 && m.c <= 6));
        for (const m of targets) {
          const ps = clonePlayers(players);
          const mp = byId(ps, p.id); mp.c = m.c; mp.r = m.r;
          let sc = evalPosition(ps, ball, ballId, team);
          if (manhattan(m.c, m.r, h.c, h.r) === 1) sc += 12; // 保持者に隣接＝次に奪取圏
          if (!attackingGoalTarget(ps, ball, opp, byId(ps, h.id))) sc += 10; // シュートコースを消す
          sc += Math.random() * 0.6;
          if (!best || sc > best.sc) best = { sc, act: { type: 'move', playerId: p.id, c: m.c, r: m.r } };
        }
      }
      if (best && best.sc > cur + 0.5) return best.act;
      return null;
    }
    // ルーズボール
    let best = null;
    for (const p of players) {
      if (p.team !== team) continue;
      let targets = moveTargets(players, p, false);
      if (p.role === 'GK') targets = targets.filter(m => team === 'red' ? (m.r <= 2 && m.c >= 2 && m.c <= 6) : (m.r >= ROWS - 3 && m.c >= 2 && m.c <= 6));
      for (const m of targets) {
        const ps = clonePlayers(players);
        const mp = byId(ps, p.id); mp.c = m.c; mp.r = m.r;
        const picks = m.c === ball.c && m.r === ball.r;
        const sc = evalPosition(ps, ball, picks ? p.id : null, team) + Math.random() * 0.6;
        if (!best || sc > best.sc) best = { sc, act: { type: 'move', playerId: p.id, c: m.c, r: m.r } };
      }
    }
    return best ? best.act : null;
  }
  const api = { COLS, ROWS, GOAL_COLS, MOVE_TABLE, initialPlayers, kickoffHolder, byId, playerAt, cheb, inBoard, goalFrontTeam, canStand, offsideLine, isOffside, goalSquareAt, attackingGoal, moveTargets, ballKickTargets, attackingGoalTarget, stealCandidates, lineSquares, distToGoal, manhattan, oppOrthAdjacent, bestPass, dribbleTarget, bestMoveToward, evalPosition, chooseAdvanced };
  global.SSLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
