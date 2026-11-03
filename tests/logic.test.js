'use strict';
const assert = require('assert');
const L = require('../logic.js');
const P = (id, team, role, c, r) => ({ id, team, role, c, r });
let n = 0;
function ok(name, fn) { fn(); n++; console.log('PASS', name); }
const has = (list, c, r) => list.some(m => m.c === c && m.r === r);

ok('初期配置は22人・キックオフは青FW', () => {
  const ps = L.initialPlayers();
  assert.strictEqual(ps.length, 22);
  assert.strictEqual(new Set(ps.map(p => p.c + ',' + p.r)).size, 22, '重なりなし');
  const h = L.byId(ps, L.kickoffHolder(ps, 'blue'));
  assert.strictEqual(h.team, 'blue'); assert.strictEqual(h.role, 'FW');
});

ok('移動（保持者）：縦横・斜めとも最大2マス（盤面中央、誰もいない）', () => {
  const ps = [P('a', 'blue', 'MF', 4, 6)];
  const t = L.moveTargets(ps, ps[0], true);
  assert.strictEqual(t.length, 16); // 縦横 4方向×2 + 斜め 4方向×2
  assert.ok(has(t, 4, 4) && has(t, 4, 8) && has(t, 2, 6) && has(t, 6, 6));
  assert.ok(has(t, 2, 4) && has(t, 6, 8), '斜め2マスも可');
  assert.ok(!has(t, 4, 3), '縦3マスは不可');
  assert.ok(!has(t, 1, 3), '斜め3マスは不可');
});

ok('移動（非保持者・MF）：全方向最大3マス', () => {
  const ps = [P('a', 'blue', 'MF', 4, 6)];
  const t = L.moveTargets(ps, ps[0], false);
  assert.strictEqual(t.length, 24); // 8方向×3
  assert.ok(has(t, 4, 3) && has(t, 4, 9) && has(t, 1, 6) && has(t, 7, 6), '縦横3マス');
  assert.ok(has(t, 1, 3) && has(t, 7, 9), '斜め3マス');
  assert.ok(!has(t, 4, 2), '4マスは不可');
});

ok('移動：途中に選手がいると先へ行けない／選手のマスには入れない（保持者・非保持者共通）', () => {
  const ps = [P('a', 'blue', 'MF', 4, 6), P('b', 'red', 'DF', 4, 5), P('c', 'blue', 'DF', 3, 5)];
  const t = L.moveTargets(ps, ps[0], false);
  assert.ok(!has(t, 4, 5), '占有マス不可');
  assert.ok(!has(t, 4, 4) && !has(t, 4, 3) && !has(t, 4, 2), '塞がれた方向は先へ進めない');
  assert.ok(has(t, 4, 9) && !has(t, 4, 10), '空いている方向は3マスまで（MF非保持）');
  assert.ok(!has(t, 3, 5), '斜めの占有マス不可');
  assert.ok(!has(t, 2, 4), '斜め1マス目が塞がれると2マス目も不可');
  assert.ok(has(t, 6, 8), '空いた斜めは2マス可');
  const th = L.moveTargets(ps, ps[0], true);
  assert.ok(has(t, 4, 8) && !has(th, 4, 9) && has(th, 4, 8), '保持者は縦横2まで');
});

ok('移動（非保持者・方向別）：FWは前4・横3・後2、斜めは前後の値を適用', () => {
  const ps = [P('a', 'blue', 'FW', 4, 6)];
  const t = L.moveTargets(ps, ps[0], false);
  assert.strictEqual(t.length, 24); // 前4+後2+横3×2+斜め前4×2+斜め後2×2
  assert.ok(has(t, 4, 2) && !has(t, 4, 1), '前4マス');
  assert.ok(has(t, 4, 8) && !has(t, 4, 9), '後2マス');
  assert.ok(has(t, 1, 6) && has(t, 7, 6), '横3マス');
  assert.ok(has(t, 0, 2), '斜め前4マス');
  assert.ok(has(t, 2, 8) && !has(t, 1, 9), '斜め後は2マス');
});

ok('移動（非保持者・方向別）：DFは前2・横3・後4／赤は前後が反転する', () => {
  const ps = [P('a', 'blue', 'DF', 4, 6)];
  const t = L.moveTargets(ps, ps[0], false);
  assert.strictEqual(t.length, 24); // 前2+後4+横3×2+斜め前2×2+斜め後4×2
  assert.ok(has(t, 4, 4) && !has(t, 4, 3), '前2マス');
  assert.ok(has(t, 4, 10), '後4マス');
  assert.ok(has(t, 0, 10), '斜め後4マス');
  const red = [P('b', 'red', 'FW', 4, 6)];
  const tr = L.moveTargets(red, red[0], false);
  assert.ok(has(tr, 4, 10) && !has(tr, 4, 2), '赤FWは下方向が前4・上は後2');
  assert.ok(has(tr, 0, 10), '赤FWの斜め前も4マス');
});

ok('移動（保持者・方向別）：FWは前2・横2・後1、DFは前1・横2・後2、GKは均一', () => {
  const fw = [P('a', 'blue', 'FW', 4, 6)];
  const tf = L.moveTargets(fw, fw[0], true);
  assert.ok(has(tf, 4, 4) && has(tf, 4, 7) && !has(tf, 4, 8), 'FW保持：前2・後1');
  assert.ok(has(tf, 3, 7) && !has(tf, 2, 8), 'FW保持：斜め後は1');
  const df = [P('b', 'blue', 'DF', 4, 6)];
  const td = L.moveTargets(df, df[0], true);
  assert.ok(has(td, 4, 5) && !has(td, 4, 4), 'DF保持：前1');
  assert.ok(has(td, 2, 8), 'DF保持：斜め後は2');
  const gk = [P('c', 'blue', 'GK', 4, 6)];
  assert.strictEqual(L.moveTargets(gk, gk[0], true).length, 16, 'GK保持は全方向2');
  assert.strictEqual(L.moveTargets(gk, gk[0], false).length, 24, 'GK非保持は全方向3（既存仕様）');
});

ok('キック方向：FWは斜め後ろ不可（斜め前・縦横は可）、MFは8方向可、赤FWは前後が反転', () => {
  const fw = P('h', 'blue', 'FW', 4, 6);
  const t = L.ballKickTargets([fw], { c: 4, r: 6 }, null, fw);
  assert.ok(!has(t, 3, 7) && !has(t, 5, 7) && !has(t, 2, 8), '青FWの斜め後ろは候補に出ない');
  assert.ok(has(t, 3, 5) && has(t, 4, 7) && has(t, 3, 6), '斜め前・真後ろ・横は可');
  const mf = P('m', 'blue', 'MF', 4, 6);
  const tm = L.ballKickTargets([mf], { c: 4, r: 6 }, null, mf);
  assert.ok(has(tm, 3, 7) && has(tm, 2, 8), 'MFは斜め後ろも可');
  const rf = P('r', 'red', 'FW', 4, 6);
  const tr = L.ballKickTargets([rf], { c: 4, r: 6 }, null, rf);
  assert.ok(!has(tr, 3, 5) && has(tr, 3, 7), '赤FWは上向きの斜めが禁止（＝斜め後ろ）');
});

ok('ターン内保有1度のみ：使用済みの味方は蹴り先がブロックされ、CPUパス候補からも外れる', () => {
  const ps = [P('h', 'blue', 'MF', 4, 7), P('u', 'blue', 'FW', 4, 4), P('f', 'blue', 'FW', 7, 7)];
  const t = L.ballKickTargets(ps, { c: 4, r: 7 }, ['h', 'u']);
  const up = t.filter(x => x.c === 4 && x.r < 7);
  assert.strictEqual(up[up.length - 1].holderId, 'u');
  assert.strictEqual(up[up.length - 1].usedBlock, true, '使用済み選手で止まる先はブロック扱い');
  const bp = L.bestPass(ps, 'h', ['h', 'u']);
  assert.ok(bp === null || bp.receiver.id !== 'u', '使用済み選手へのパスは選ばない');
});

ok('ボールキック：直線5マスまで・空きマスも対象', () => {
  const ps = [P('h', 'blue', 'FW', 4, 10)];
  const t = L.ballKickTargets(ps, { c: 4, r: 10 });
  assert.ok(has(t, 4, 5), '縦5マス可');
  assert.ok(!has(t, 4, 4), '縦6マスは不可');
  const up5 = t.filter(x => x.c === 4 && x.r < 10);
  assert.strictEqual(up5.length, 5);
  assert.ok(t.every(x => x.holderId === null), '誰もいなければ全て空きマス扱い');
});

ok('ボールキック：最初に選手がいるマスで止まり、その選手のボールになる（相手も味方も）', () => {
  const ps = [P('h', 'blue', 'FW', 4, 10), P('m', 'blue', 'MF', 4, 7), P('o', 'red', 'DF', 4, 3),
              P('x', 'red', 'MF', 6, 10)];
  const t = L.ballKickTargets(ps, { c: 4, r: 10 });
  const up = t.filter(x => x.c === 4 && x.r < 10);
  assert.strictEqual(up.length, 3, '味方MF(4,7)で止まる');
  assert.strictEqual(up[up.length - 1].holderId, 'm');
  assert.ok(!has(t, 4, 3), 'MFより先の相手DFまでは届かない');
  const right = t.filter(x => x.r === 10 && x.c > 4);
  assert.strictEqual(right.length, 2, '右は相手MF(6,10)で止まる');
  assert.strictEqual(right[right.length - 1].holderId, 'x');
});

ok('奪取：保持者の縦横1マスの相手だけが奪える（斜め・2マス先は不可）', () => {
  const ps = [P('h', 'red', 'FW', 4, 6), P('a', 'blue', 'MF', 4, 5), P('b', 'blue', 'MF', 3, 5),
              P('c', 'blue', 'MF', 4, 4), P('d', 'blue', 'DF', 5, 6)];
  const cand = L.stealCandidates(ps, 'h', 'blue');
  assert.deepStrictEqual(cand.map(p => p.id).sort(), ['a', 'd']); // 上と右のみ。bは斜め、cは2マス先
  assert.strictEqual(L.stealCandidates(ps, 'h', 'red').length, 0, '保持側は奪えない');
});

ok('GKゾーン：守るGKと相手プレイヤーは入れる／守る側のGK以外は立てない', () => {
  assert.strictEqual(L.goalFrontTeam(4, 0), 'red');
  assert.strictEqual(L.goalFrontTeam(3, 12), 'blue');
  assert.strictEqual(L.goalFrontTeam(2, 0), null);
  const df = P('d', 'red', 'DF', 4, 2);
  const t = L.moveTargets([df], df, false);
  assert.ok(!has(t, 4, 0), '守る側のDFはゾーンに入れない');
  assert.ok(has(t, 4, 1), 'ゾーンの手前までは行ける');
  const gk = P('g', 'red', 'GK', 4, 1);
  const tg = L.moveTargets([gk], gk, false);
  assert.ok(has(tg, 4, 0) && has(tg, 3, 0) && has(tg, 5, 0), '自ゴールのGKはゾーン内を動ける');
  const atk = P('a', 'blue', 'FW', 4, 1);
  assert.ok(has(L.moveTargets([atk], atk, false), 4, 0), '相手プレイヤーはゾーンに侵入できる（ゾーン内のボールも拾える）');
  const ogk = P('og', 'blue', 'GK', 4, 1);
  assert.ok(has(L.moveTargets([ogk], ogk, false), 4, 0), '相手GKも侵入できる');
});

ok('オフサイド：ラインより前＋ボールより前の受け手はオフサイド', () => {
  const defs = [P('g', 'red', 'GK', 4, 0), P('d', 'red', 'DF', 5, 2)]; // ラインはr=2
  const ball = { c: 4, r: 6 };
  assert.strictEqual(L.isOffside([...defs, P('f', 'blue', 'FW', 4, 1)], ball, P('f', 'blue', 'FW', 4, 1)), true, 'GKとDFの間にいるFWはオフサイド');
  const onLine = P('f2', 'blue', 'FW', 4, 2);
  assert.strictEqual(L.isOffside([...defs, onLine], ball, onLine), false, 'ラインと同じ高さはセーフ');
  const behind = P('f3', 'blue', 'FW', 4, 1);
  assert.strictEqual(L.isOffside([...defs, behind], { c: 4, r: 0 }, behind), false, 'ラインより前でもボールより後ろならセーフ');
  const ownHalf = P('f4', 'blue', 'FW', 3, 6);
  assert.strictEqual(L.isOffside([...defs, ownHalf], ball, ownHalf), false, '自陣はセーフ');
  // 赤の対称ケース
  const bdefs = [P('bg', 'blue', 'GK', 4, 12), P('bd', 'blue', 'DF', 3, 10)]; // ラインはr=10
  const rfw = P('rf', 'red', 'FW', 4, 11);
  assert.strictEqual(L.isOffside([...bdefs, rfw], { c: 4, r: 6 }, rfw), true, '赤FWも対称にオフサイド');
});

ok('オフサイド：蹴り先にフラグがつき、CPUはオフサイドの受け手を選ばない', () => {
  const ps = [P('h', 'blue', 'MF', 4, 6), P('off', 'blue', 'FW', 4, 1), P('on', 'blue', 'FW', 6, 4),
              P('g', 'red', 'GK', 3, 0), P('d', 'red', 'DF', 5, 2)];
  const t = L.ballKickTargets(ps, { c: 4, r: 6 });
  const toOff = t.find(x => x.holderId === 'off');
  assert.ok(toOff && toOff.offside === true, 'オフサイドの受け手にはフラグ');
  const bp = L.bestPass(ps, 'h');
  assert.ok(bp && bp.receiver.id === 'on', 'CPUはオンサイドの受け手を選ぶ');
});

ok('ゴールキック：直線でゴールマスに届けばゴール対象になる', () => {
  const ps = [P('s', 'blue', 'FW', 4, 2)];
  const gt = L.attackingGoalTarget(ps, { c: 4, r: 2 }, 'blue');
  assert.ok(gt && gt.goal === 'top' && gt.c === 4 && gt.r === -1, '中央列・3ステップで上ゴールへ');
  const red = [P('s', 'red', 'FW', 4, 10)];
  const gt2 = L.attackingGoalTarget(red, { c: 4, r: 10 }, 'red');
  assert.ok(gt2 && gt2.goal === 'bottom', '赤は下ゴールへ');
  const edge = [P('s', 'blue', 'FW', 2, 2)];
  const gt3 = L.attackingGoalTarget(edge, { c: 2, r: 2 }, 'blue');
  assert.ok(gt3 && gt3.c === 5 && gt3.r === -1, '斜めでもゴール列に入ればゴール');
});

ok('ゴールキック：途中に選手がいればそこで止まり、ゴールには届かない（GKの位置取りが効く）', () => {
  const withGK = [P('s', 'blue', 'FW', 4, 2), P('g', 'red', 'GK', 4, 0)];
  assert.strictEqual(L.attackingGoalTarget(withGK, { c: 4, r: 2 }, 'blue'), null, '中央にGKがいれば直進は止まる');
  const t = L.ballKickTargets(withGK, { c: 4, r: 2 });
  const up = t.filter(x => x.c === 4 && x.r < 2);
  assert.strictEqual(up[up.length - 1].holderId, 'g', 'ボールはGKのものになる');
  const withDF = [P('s', 'blue', 'FW', 4, 3), P('d', 'red', 'DF', 4, 1), P('g', 'red', 'GK', 3, 0)];
  assert.strictEqual(L.attackingGoalTarget(withDF, { c: 4, r: 3 }, 'blue'), null, '途中のDFでも止まる');
  const gkAside = [P('s', 'blue', 'FW', 4, 2), P('g', 'red', 'GK', 3, 0)];
  assert.ok(L.attackingGoalTarget(gkAside, { c: 4, r: 2 }, 'blue'), 'GKが中央を外せば中央が空く');
});

ok('ゴールキック：直接ゴールは3マスまで（4マス以上先のゴールは候補に出ない）', () => {
  const far = [P('s', 'blue', 'FW', 4, 6)];
  assert.strictEqual(L.attackingGoalTarget(far, { c: 4, r: 6 }, 'blue'), null, 'ゴールまで7ステップは届かない');
  const four = [P('s', 'blue', 'FW', 4, 3)];
  assert.strictEqual(L.attackingGoalTarget(four, { c: 4, r: 3 }, 'blue'), null, '4ステップも届かない');
  const all = L.ballKickTargets(four, { c: 4, r: 3 });
  assert.ok(!all.some(x => x.goal === 'top'), 'ゴールマスは候補に出ない');
  const three = [P('s', 'blue', 'FW', 4, 2)];
  assert.ok(L.attackingGoalTarget(three, { c: 4, r: 2 }, 'blue'), '3ステップちょうどは届く');
});

ok('CPU判断：前進する味方へのパスを選ぶ／後ろへのパスや危険なパスは選ばない', () => {
  const ps = [P('h', 'red', 'FW', 4, 5), P('m', 'red', 'MF', 4, 8), P('g', 'blue', 'GK', 4, 12)];
  const bp = L.bestPass(ps, 'h');
  assert.ok(bp && bp.receiver.id === 'm', '前方の味方へ');
  const back = [P('h', 'red', 'FW', 4, 5), P('m', 'red', 'MF', 4, 2), P('g', 'blue', 'GK', 4, 12)];
  assert.strictEqual(L.bestPass(back, 'h'), null, '後退パスは選ばない');
  const danger = [P('h', 'red', 'FW', 4, 5), P('m', 'red', 'MF', 4, 7), P('x', 'blue', 'DF', 4, 8), P('g', 'blue', 'GK', 4, 12)];
  assert.strictEqual(L.bestPass(danger, 'h'), null, '受け手の縦横に相手がいる危険なパスは選ばない');
});

ok('CPU判断：ドリブルはゴールへ近づく安全なマス／囲まれていれば選ばない', () => {
  const ps = [P('h', 'red', 'FW', 4, 5), P('g', 'blue', 'GK', 4, 12)];
  const dt = L.dribbleTarget(ps, 'h');
  assert.ok(dt && dt.r > 5, '下ゴールへ前進');
  const surrounded = [P('h', 'red', 'FW', 4, 5),
    P('a', 'blue', 'DF', 4, 7), P('b', 'blue', 'DF', 2, 5), P('c', 'blue', 'DF', 6, 5), P('d', 'blue', 'DF', 4, 3)];
  // 前進先(4,6)(4,7)は(4,7)の相手と縦横隣接などで危険、横も同様に危険なケース
  const dt2 = L.dribbleTarget(surrounded, 'h');
  assert.ok(dt2 === null || L.oppOrthAdjacent(surrounded, 'red', dt2.c, dt2.r).length === 0, '危険なマスは選ばない');
});

ok('CPU判断：寄せは保持者へ近づく移動を選び、GKはゴール前から出ない', () => {
  const ps = [P('h', 'blue', 'FW', 4, 6), P('d', 'red', 'DF', 4, 3), P('g', 'red', 'GK', 4, 0)];
  const mv = L.bestMoveToward(ps, 'red', { c: 4, r: 6 }, 'h', { gkHome: true });
  assert.ok(mv && mv.playerId === 'd' && mv.r > 3, 'DFが保持者へ寄せる');
  const gkOnly = [P('h', 'blue', 'FW', 4, 9), P('g', 'red', 'GK', 4, 0)];
  const mv2 = L.bestMoveToward(gkOnly, 'red', { c: 4, r: 9 }, 'h', { gkHome: true });
  assert.ok(mv2 === null || mv2.r <= 2, 'GKはr<=2の範囲でしか動かない');
});

ok('上級CPU：目の前のゴールは必ず決めにいく', () => {
  // 赤FWが青ゴール（下段）の2マス手前で保持。正面は空いている
  const ps = [P('f', 'red', 'FW', 4, 10), P('g', 'blue', 'GK', 3, 12), P('d', 'blue', 'DF', 6, 11)];
  const act = L.chooseAdvanced(ps, { c: 4, r: 10 }, 'f', { team: 'red', usedIds: ['f'], canGoal: true, gkFree: false });
  assert.ok(act && act.type === 'kick' && act.target.goal === 'bottom', 'ゴールへのキックを選ぶ');
});

ok('上級CPU：奪取できる位置なら奪う', () => {
  const ps = [P('h', 'blue', 'FW', 4, 6), P('m', 'red', 'MF', 4, 5), P('g', 'red', 'GK', 4, 0)];
  const act = L.chooseAdvanced(ps, { c: 4, r: 6 }, 'h', { team: 'red', usedIds: [], canGoal: true, gkFree: false });
  assert.ok(act && act.type === 'steal' && act.playerId === 'm', '縦横隣接の味方が奪取する');
});

ok('上級CPU：保持時は相手へパスせず、オフサイドの味方にも出さない', () => {
  for (let i = 0; i < 8; i++) {
    const ps = L.initialPlayers();
    const h = L.byId(ps, L.kickoffHolder(ps, 'red'));
    const act = L.chooseAdvanced(ps, { c: h.c, r: h.r }, h.id, { team: 'red', usedIds: [h.id], canGoal: true, gkFree: false });
    assert.ok(act, '何らかの手を返す');
    if (act.type === 'kick' && act.target.holderId) {
      const recv = L.byId(ps, act.target.holderId);
      assert.strictEqual(recv.team, 'red', '相手へパスしない');
      assert.ok(!act.target.offside, 'オフサイドの受け手に出さない');
      assert.ok(!act.target.usedBlock, '保有済みの味方に出さない');
    }
  }
});

console.log('全 ' + n + ' 件パス');
