import { useState } from 'react'
import { Col, Modal, Row, Tooltip } from 'antd'
import { QuestionCircleOutlined } from '@ant-design/icons'
import useIsMobile from '../../hooks/useIsMobile'

/**
 * 高阶数据说明书：全站唯一一份解释文案。
 *
 * 三个出口共用同一份定义，改文案只改这里：
 *   · <GlossaryIcon />        资料卡「高阶数据」标题旁的问号
 *   · <GlossaryButton />      数据表工具条上的「指标说明」
 *   · withGlossary(columns)   表头虚下划线，悬停/点按出小卡片
 *
 * 口径全部跟 Basketball-Reference 官网一致（数据也是从那儿来的），
 * 刻度取 B-R 自己给的参考线，不是我们自己拍的。
 */

const GROUPS = [
  {
    group: '综合价值',
    color: '#fa541c',
    intro: '一个数字概括整体贡献，可以跨位置比',
    items: [
      {
        field: 'playerPerReal', label: 'PER', en: 'Player Efficiency Rating',
        desc: '把得分、篮板、助攻、抢断、盖帽这些好事加起来，减掉打铁、失误、犯规，再按上场时间摊平。每个赛季都会重新校准，让联盟平均正好等于 15，所以不同年代可以直接比。',
        scale: [['15', '联盟平均'], ['18', '球队二当家'], ['22', '全明星'], ['25', 'MVP 候选'], ['30+', '历史级赛季']],
      },
      {
        field: 'playerBpm', label: 'BPM', en: 'Box Plus/Minus',
        desc: '他在场时，球队每 100 个回合比一支平均水准的球队多得几分。用基础数据估算，不是真的正负值，好处是不受队友强弱影响那么大。',
        scale: [['0', '联盟平均'], ['+2', '优质首发'], ['+4', '全明星'], ['+8', 'MVP 赛季'], ['+10', '历史级']],
      },
      {
        field: 'playerObpm', label: '进攻BPM', en: 'Offensive BPM',
        desc: 'BPM 里进攻端那一半，衡量他每 100 回合给球队进攻多带来几分。',
        scale: [['0', '联盟平均'], ['+5', '顶级进攻手']],
      },
      {
        field: 'playerDbpm', label: '防守BPM', en: 'Defensive BPM',
        desc: 'BPM 里防守端那一半。进攻 BPM + 防守 BPM 就是 BPM。',
        scale: [['0', '联盟平均'], ['+3', '顶级防守人']],
      },
      {
        field: 'playerVorp', label: 'VORP', en: 'Value Over Replacement Player',
        desc: '比一个「随时能从发展联盟签来的替补」多贡献多少。基准线定在 BPM −2.0，再乘上场时间占比和赛季长度，所以打得久、身体健康的人分更高。',
        scale: [['0', '替补水准'], ['2', '首发'], ['5', '全明星'], ['8+', 'MVP 级']],
      },
      {
        field: 'playerWs', label: '胜利贡献', en: 'Win Shares (WS)',
        desc: '把球队赢下的场次按功劳分给每个人。全队加起来差不多就是球队的胜场数，所以它跟球队战绩绑得很紧，弱队的核心会吃亏。',
        scale: [['5', '首发'], ['10', '全明星'], ['15+', 'MVP 级']],
      },
      {
        field: 'playerOws', label: '进攻胜利贡献', en: 'Offensive Win Shares',
        desc: '胜利贡献里靠进攻挣来的那部分。',
      },
      {
        field: 'playerDws', label: '防守胜利贡献', en: 'Defensive Win Shares',
        desc: '靠防守挣来的那部分。进攻 + 防守 = 胜利贡献。',
      },
      {
        field: 'playerWs48', label: 'WS/48', en: 'Win Shares per 48 Minutes',
        desc: '每打满一场（48 分钟）能贡献多少胜场。去掉了出场时间的影响，所以替补和首发能公平比。',
        scale: [['.100', '联盟平均'], ['.200', '全明星'], ['.250+', '历史级']],
      },
    ],
  },
  {
    group: '得分与回合效率',
    color: '#1677ff',
    intro: '同样出手一次，谁换来的分更多',
    items: [
      {
        field: 'playerTsPct', label: '真实命中率', en: 'True Shooting % (TS%)',
        desc: '把两分、三分、罚球放到同一把尺子上量的命中率：得分 ÷ (2 × (出手数 + 0.44 × 罚球数))。三分多一分、造犯规站上罚球线，这些价值普通命中率算不进去，真实命中率算得进去。',
        scale: [['55%', '联盟平均'], ['60%', '高效'], ['65%+', '顶级'] ],
      },
      {
        field: 'playerUsgPct', label: '使用率', en: 'Usage % (USG%)',
        desc: '他在场的时候，球队多少比例的回合是由他终结的（出手、罚球或者失误）。场上五个人平分就是 20%，所以 20% 是天然的平均线。它只说球权多少，不说用得好不好。',
        scale: [['20%', '五人平分'], ['25%', '主要得分点'], ['30%+', '绝对核心']],
      },
      {
        field: 'playerOffEff', label: '进攻效率', en: 'Offensive Rating (ORtg)',
        desc: '他每消耗 100 个进攻回合，能给球队产出多少分。B-R 只给到整数，所以并列很常见。',
        scale: [['113', '近年联盟平均'], ['120+', '顶级']],
      },
      {
        field: 'playerDefEff', label: '防守效率', en: 'Defensive Rating (DRtg)',
        desc: '他在场时对手每 100 个回合能拿多少分，越低越好。个人防守效率里含大量球队因素，看的时候别太较真。',
        scale: [['113', '近年联盟平均'], ['105', '优秀']],
      },
      {
        field: 'playerNetEff', label: '净效率', en: 'Net Rating',
        desc: '进攻效率减防守效率。两边都是整数，所以净效率也是整数，一个赛季里几十号人并列很正常 —— 想区分细微差距看 BPM。',
        scale: [['0', '打平'], ['+10', '很强']],
      },
    ],
  },
  {
    group: '参与率',
    color: '#52c41a',
    intro: '他在场的时候，这类事情有多少是他做的',
    items: [
      {
        field: 'playerTrbPct', label: '篮板率', en: 'Total Rebound % (TRB%)',
        desc: '他在场期间所有能抢的篮板里，他抢到的百分比。比场均篮板公平：打得少、球队投得准（可抢的板本来就少）都不会拖累它。',
        scale: [['10%', '后卫偏高'], ['20%+', '顶级内线']],
      },
      { field: 'playerOrbPct', label: '前板率', en: 'Offensive Rebound %', desc: '本方投失的球里，他抢到进攻篮板的比例。' },
      { field: 'playerDrbPct', label: '后板率', en: 'Defensive Rebound %', desc: '对方投失的球里，他保护下防守篮板的比例。' },
      {
        field: 'playerAstPct', label: '助攻率', en: 'Assist % (AST%)',
        desc: '他在场时队友投中的球里，有多少是他助攻的。',
        scale: [['20%', '普通'], ['40%+', '组织核心']],
      },
      {
        field: 'playerStlPct', label: '抢断率', en: 'Steal % (STL%)',
        desc: '对手每 100 个回合里被他断掉的比例。',
        scale: [['1.5%', '联盟平均'], ['3%+', '顶级']],
      },
      {
        field: 'playerBlkPct', label: '盖帽率', en: 'Block % (BLK%)',
        desc: '对手的两分出手里被他封盖的比例。',
        scale: [['2%', '内线一般'], ['6%+', '顶级护框']],
      },
      {
        field: 'playerTovPct', label: '失误率', en: 'Turnover % (TOV%)',
        desc: '他每用掉 100 个回合会丢几次球，越低越好。持球多的人天然偏高，跟使用率一起看才有意义。',
        scale: [['13%', '联盟平均'], ['10%', '很稳']],
      },
    ],
  },
]

/** field → 词条，供表头 tooltip 直接查 */
const BY_FIELD = Object.fromEntries(GROUPS.flatMap((g) => g.items.map((i) => [i.field, { ...i, color: g.color }])))

const Scale = ({ items, color, size = 11 }) => (
  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
    {items.map(([v, t]) => (
      <span
        key={v}
        style={{
          fontSize: size, color: '#8c8c8c', background: '#fafafa',
          border: '1px solid #f0f0f0', borderRadius: 4, padding: '1px 6px',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <b style={{ color }}>{v}</b> {t}
      </span>
    ))}
  </div>
)

/** 说明书弹窗本体 */
export function StatGlossaryModal({ open, onClose }) {
  const isMobile = useIsMobile()
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={isMobile ? '94vw' : 860}
      title={
        <span>
          高阶数据说明书
          <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: '#bbb' }}>
            口径与 Basketball-Reference 一致
          </span>
        </span>
      }
      styles={{ body: { maxHeight: '72vh', overflowY: 'auto', paddingRight: 6 } }}
    >
      {GROUPS.map((g) => (
        <div key={g.group}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '18px 0 10px' }}>
            <span style={{ width: 3, height: 14, background: g.color, borderRadius: 2 }} />
            <span style={{ fontWeight: 700, fontSize: 15 }}>{g.group}</span>
            <span style={{ fontSize: 12, color: '#bbb' }}>{g.intro}</span>
          </div>
          <Row gutter={[10, 10]}>
            {g.items.map((it) => (
              <Col key={it.field} xs={24} lg={12}>
                <div
                  style={{
                    height: '100%', background: '#fff', borderRadius: 8,
                    border: '1px solid #f0f0f0', borderLeft: `3px solid ${g.color}`,
                    padding: '10px 12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{it.label}</span>
                    <span style={{ fontSize: 11, color: '#bbb' }}>{it.en}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#555', lineHeight: 1.75, marginTop: 4 }}>{it.desc}</div>
                  {it.scale && <Scale items={it.scale} color={g.color} />}
                </div>
              </Col>
            ))}
          </Row>
        </div>
      ))}
      <div style={{ marginTop: 20, fontSize: 12, color: '#bbb', lineHeight: 1.8 }}>
        参考刻度是常见水准的大致位置，不是硬门槛。没有数据的格子显示「/」：生涯汇总没有
        高阶指标（B-R 只按赛季发布，不发生涯合计）；1976-77 没有全联盟的失误和前场篮板
        统计，进攻/防守效率那年也算不出来。
      </div>
    </Modal>
  )
}

/** 资料卡标题旁的问号；也可当通用触发器用 */
export function GlossaryIcon({ style }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <QuestionCircleOutlined
        onClick={() => setOpen(true)}
        style={{ color: '#bbb', fontSize: 14, cursor: 'pointer', marginLeft: 6, ...style }}
      />
      <StatGlossaryModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}

/** 数据表工具条上的「指标说明」入口（手机上表头 tooltip 不好点，主要靠它） */
export function GlossaryButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <a onClick={() => setOpen(true)} style={{ fontSize: 12, color: '#8c8c8c', whiteSpace: 'nowrap' }}>
        <QuestionCircleOutlined style={{ marginRight: 4 }} />
        指标说明
      </a>
      <StatGlossaryModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}

/**
 * 单条释义的悬停卡片。不是高阶项就原样返回，调用方不用自己判断。
 *
 * 表头不加任何视觉标记（虚下划线、悬停浮出的 ⓘ 都试过，都嫌脏），只保留悬停出解释
 * 这一件事。发现入口靠工具条上的「指标说明」——手机也只能走那儿。
 */
export function GlossaryTip({ field, children }) {
  const it = BY_FIELD[field]
  if (!it) return children
  return (
    <Tooltip
      trigger={['hover', 'click']}
      overlayStyle={{ maxWidth: 320 }}
      title={
        <div style={{ fontSize: 12, lineHeight: 1.7 }}>
          <div style={{ fontWeight: 700 }}>
            {it.label}
            <span style={{ fontWeight: 400, opacity: 0.65, marginLeft: 5 }}>{it.en}</span>
          </div>
          <div style={{ marginTop: 2 }}>{it.desc}</div>
          {it.scale && (
            <div style={{ marginTop: 4, opacity: 0.8 }}>
              {it.scale.map(([v, t]) => `${v} ${t}`).join('　')}
            </div>
          )}
        </div>
      }
    >
      <span className="stat-tip">{children}</span>
    </Tooltip>
  )
}

/** 批量给数据列的表头挂上释义 */
export function withGlossary(columns) {
  return columns.map((c) =>
    !BY_FIELD[c.dataIndex] || typeof c.title !== 'string'
      ? c
      : { ...c, title: <GlossaryTip field={c.dataIndex}>{c.title}</GlossaryTip> },
  )
}
