/**
 * 选秀详情标签：贴在球员身份头名字下面的那一枚，也复用在历史选秀表的顺位列里。
 *
 * ## 为什么分档而不是一律灰底
 *
 * 「2003年1号秀」和「2003年48号秀」在一行小字里长得几乎一样，而这两件事的分量差得远。
 * 前三顺位给金银铜，乐透（4-14）给一个自己的颜色，其余保持素色——一眼扫过去
 * 就知道这是什么成色的新秀，不用去读数字。
 *
 * ## 说法用中文习惯，不用「第 1 顺位」
 *
 * 状元/榜眼/探花是中文篮球语境里现成的说法，比「第 1 顺位」更短也更常用。
 * 四顺位往后没有对应的固定叫法，才退回「N 号秀」。
 *
 * ## 老年份可能没有总顺位
 *
 * 1947-1955 那批 B-R 只记了轮次，没有总顺位号。这时显示「第 N 轮」，
 * 不编一个顺位出来——编了会让「1954年状元」这种说法凭空成立。
 */

const GOLD = { name: '状元', color: '#a97c00', bg: 'rgba(212,160,23,.16)', border: 'rgba(212,160,23,.5)' }
const SILVER = { name: '榜眼', color: '#6b7075', bg: 'rgba(140,145,150,.16)', border: 'rgba(140,145,150,.5)' }
const BRONZE = { name: '探花', color: '#96551f', bg: 'rgba(176,106,44,.16)', border: 'rgba(176,106,44,.5)' }
const LOTTERY = { color: '#6d4bc4', bg: 'rgba(124,92,214,.13)', border: 'rgba(124,92,214,.42)' }
const PLAIN = { color: '#8c8c8c', bg: '#f5f5f5', border: '#e8e8e8' }

/** 顺位 → 配色与叫法。乐透秀的分界线是 14：那是 1985 年抽签制以来的乐透区 */
export const draftTier = (pick) => {
  if (pick === 1) return GOLD
  if (pick === 2) return SILVER
  if (pick === 3) return BRONZE
  if (pick >= 4 && pick <= 14) return LOTTERY
  return PLAIN
}

export const draftText = (d) => {
  if (!d) return ''
  const pick = Number(d.pickNum) || 0
  if (!pick) return `${d.draftYear}年第${d.roundNum}轮`
  const tier = draftTier(pick)
  return `${d.draftYear}年${tier.name || `${pick}号秀`}`
}

/**
 * B-R 队码 → 现行 30 队码。选秀表存的是**选中时刻**的 B-R 码，队标库只认现行码。
 *
 * 镜像自 tools/nba_sync/br_backfill.py 的 BR2CODE（同一份血脉表，改要一起改）：
 * 有现代血脉的老特许权映射到继承者（SEA→OKC、MNL→LAL…），
 * **彻底消失的刻意不映射**（芝加哥雄鹿 CHS、圣路易斯轰炸机 STB、安德森包装工 AND…）——
 * 没有任何现役球队继承它们，硬塞给谁都是错的，让 TeamLogo 的灰底码块兜住。
 */
const BR_TEAM_MODERN = {
  CHH: 'CHA', WSB: 'WAS', VAN: 'MEM', SEA: 'OKC', NJN: 'BKN', PHO: 'PHX',
  NOH: 'NOP', NOK: 'NOP', BRK: 'BKN', CHO: 'CHA',
  BUF: 'LAC', SDC: 'LAC', NOJ: 'UTA', KCK: 'SAC', NYN: 'BKN',
  PHW: 'GSW', SFW: 'GSW', MNL: 'LAL', SYR: 'PHI', ROC: 'SAC', CIN: 'SAC', KCO: 'SAC',
  TRI: 'ATL', MLH: 'ATL', STL: 'ATL', FTW: 'DET', CHP: 'WAS', CHZ: 'WAS',
  BAL: 'WAS', CAP: 'WAS', SDR: 'HOU',
}

export const modernTeam = (code) => BR_TEAM_MODERN[code] || code
