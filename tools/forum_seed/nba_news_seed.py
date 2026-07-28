#!/usr/bin/env python3
"""往 NBA 专区灌 60 条新闻贴（30 队 × 2 条），每条带球队标签。

内容不是编的，全部来自 ESPN 两篇「一次覆盖 30 支球队」的稿子：

  A《What we've learned about all 30 NBA teams this offseason》Ben Golliver, 2026-07-23
    https://www.espn.com/nba/story/_/id/49425930/what-learned-all-30-nba-teams-offseason
  B《2026 NBA draft grades: Winners, losers for all 30 teams》Ben Golliver, 2026-06-24
    https://www.espn.com/nba/story/_/id/49147426/2026-nba-draft-grades-winners-losers-sleepers-best-picks-value-reaches-all-30-teams-classes

选这两篇是因为它们**天然按队分节**，30 支队一条不落，不用一队搜一次、也不会出现
有的队三条有的队零条。正文是中文摘编 + 原文链接，不整篇搬运。

帖子要同时写 MySQL 和 ES：列表页读的是 ES（getNewsByParams），置顶/精华/浏览数那些
标记读的是 MySQL，少一边就要么列表里不出现、要么点进去是空的。

news_id 用 uuid5 从「队码 + 类型」推出来，所以脚本可以重复跑：MySQL 走
ON DUPLICATE KEY UPDATE，ES 走同 _id 覆盖，不会灌出两份。

用法：
  python3 nba_news_seed.py --dry-run   # 只打印，不写库
  python3 nba_news_seed.py             # 写 MySQL + ES
  python3 nba_news_seed.py --delete    # 撤销：按同一批 id 删干净
"""
import argparse
import json
import subprocess
import uuid
from datetime import datetime, timedelta

TOPIC_ID = 'd0e7cfae-d26b-42f2-9b32-09b90332ea3d'          # NBA🏀
AUTHOR_ID = '67ac56b4-79fb-40d8-9e98-71412ac0acac'          # Dream Owner（超管）
AUTHOR = 'Dream Owner'
NS = uuid.UUID('6f2b4b3e-0f7a-4f4a-9f1a-nba-seed'.replace('nba-seed', 'aabbccddeeff'))

URL_A = 'https://www.espn.com/nba/story/_/id/49425930/what-learned-all-30-nba-teams-offseason'
URL_B = ('https://www.espn.com/nba/story/_/id/49147426/'
         '2026-nba-draft-grades-winners-losers-sleepers-best-picks-value-reaches-all-30-teams-classes')
URL_LBJ = 'https://www.espn.com/nba/story/_/id/49440164/lebron-chooses-76ers-sign-2-year-8-million-contract'

SRC = {
    'a': ('ESPN《What we\'ve learned about all 30 NBA teams this offseason》Ben Golliver，2026-07-23', URL_A),
    'b': ('ESPN《2026 NBA draft grades》Ben Golliver，2026-06-24', URL_B),
}
DATE = {'a': datetime(2026, 7, 23, 9, 0, 0), 'b': datetime(2026, 6, 24, 9, 0, 0)}
TAG2 = {'a': '休赛期', 'b': '选秀'}

ZH = {
    'ATL': '老鹰', 'BOS': '凯尔特人', 'BKN': '篮网', 'CHA': '黄蜂', 'CHI': '公牛',
    'CLE': '骑士', 'DAL': '独行侠', 'DEN': '掘金', 'DET': '活塞', 'GSW': '勇士',
    'HOU': '火箭', 'IND': '步行者', 'LAC': '快船', 'LAL': '湖人', 'MEM': '灰熊',
    'MIA': '热火', 'MIL': '雄鹿', 'MIN': '森林狼', 'NOP': '鹈鹕', 'NYK': '尼克斯',
    'OKC': '雷霆', 'ORL': '魔术', 'PHI': '76人', 'PHX': '太阳', 'POR': '开拓者',
    'SAC': '国王', 'SAS': '马刺', 'TOR': '猛龙', 'UTA': '爵士', 'WAS': '奇才',
}

# (队码, 篇目, 标题, 正文段落…)
ITEMS = [
    # ---------- A：休赛期一句话总结 ----------
    ('ATL', 'a', '老鹰：里萨谢成了近几年最大的选秀失误',
     '2024 年的状元被送去了独行侠，两个赛季下来没打出任何说服力。ESPN 的说法比较直接：46 胜的老鹰上赛季在他不在场时反而打得更好，他也看不出有成长为第一得分点所需要的爆发力、组织能力和接管比赛的心气。'),
    ('BOS', 'a', '凯尔特人：第二土豪线是真的会伤人',
     '布朗被送去 76 人，换回保罗·乔治和选秀权，直接原因是第二土豪线那套惩罚。这不是球队一时冲动，萧华本人说过，这类交易「当然不是规则的意外后果」。'),
    ('BKN', 'a', '篮网：还在拖时间',
     '换来了兰德尔，但 31 岁的他既没好到能扛起一支争冠队，也没年轻到能陪着球队走完下一个周期。真正押的还是两个乐透秀 Egor Demin 和 Mikel Brown Jr. 能长起来。'),
    ('CHA', 'a', '黄蜂：野心比拉梅洛更大',
     '没有继续围着球哥那套好看的打法转，直接把他送去了森林狼。球队总裁 Jeff Peterson 把话说得很明白，目标不是打一年附加赛、甚至不是打一年季后赛。'),
    ('CHI', 'a', '公牛：4 号秀 Caleb Wilson 意味着换了个时代',
     '尺寸、技术、运动能力同时集中在一个高能量球员身上，这种组合不常见。和吉迪、布泽利斯凑在一起，公牛下赛季大概率是联盟里最好看的球队之一。'),
    ('CLE', 'a', '骑士：这个夏天是米切尔赢了',
     '4 年 2.73 亿续约，加上最佳阵容二阵。ESPN 提了一句冷水：这份合同的额度其实该被更认真地讨论一下，27-28 赛季他一个人就要拿走 6000 万以上。'),
    ('DAL', 'a', '独行侠：Masai Ujiri 一上任就开干',
     '新总经理、新主帅、乐透秀，外加换来里萨谢。思路挺清楚，找的都是能让 Cooper Flagg 打得轻松点的人：有人负责创造机会，有人负责把空间拉开。'),
    ('DEN', 'a', '掘金：原样不动',
     '首轮出局之后基本原班人马再来一遍。看着约基奇身边这么多年始终没有一次真正的实力补强，确实让人着急；不过西部几支争冠对手今夏也在掉人，这可能是掘金唯一的运气。'),
    ('DET', 'a', '活塞：坎宁安的日子没轻松多少',
     '用 John Collins 换掉了 Tobias Harris，又加了 Isaiah Joe 拉空间，仅此而已。他这些年在底特律扛过更难的局面，但新赛季开始时身边依然没有一个像样的第二持球点。'),
    ('GSW', 'a', '勇士：等着看是爆发还是崩盘',
     '库里和格林整个夏天都在招募詹姆斯，ESPN 当时的说法是，如果詹姆斯真来了，他和库里这对老对手的组合会有一种「银河级」的观感。',
     '（后续：7 月 25 日詹姆斯选择了 76 人，2 年 800 万带球员选项。勇士这条路走不通了。）'),
    ('HOU', 'a', '火箭：Rafael Stone 不是莫雷',
     '首轮出局之后没有拆队。乌度卡留任，续约 Tari Eason，又换来了 Marcus Smart 和博格丹诺维奇。剩下的赌注押在范弗利特伤愈归来、以及杜兰特和申京之间的配合能顺一点。'),
    ('IND', 'a', '步行者：具备「蹦极式反弹」的全部条件',
     '换来的小佐上赛季在得分、篮板、效率值、胜利贡献值四项上都压过特纳。哈利伯顿回归，轮换人手基本没散，熬完这个伤病赛季之后往上弹回去是合理预期。'),
    ('LAC', 'a', '快船：终于不再自欺欺人',
     '莱昂纳德七年拿走 2.93 亿薪水，只换来 17 场季后赛胜利。换来 Darius Garland 和 Keaton Wagler，一边处理莱昂纳德的交易一边转向年轻化，说明球队认清了继续绑着他是条死路。'),
    ('LAL', 'a', '湖人：开始认真围着东契奇建队',
     '佩林卡付出了惊人的选秀资产才把 Walker Kessler 弄到手，同时和詹姆斯分道扬镳。腾出薪资空间、补上厚度，围着东契奇和里夫斯搭一套能正常运转的阵容。'),
    ('MEM', 'a', '灰熊：认定莫兰特不值得再折腾了',
     '把他送去开拓者，一个选秀权都没换回来。转头在选秀上拿到 Cameron Boozer，这位新秀是拉斯维加斯夏联表现最好的球员之一。'),
    ('MIA', 'a', '热火：莱利宝刀未老',
     '拿下了今夏最大的转会明星字母哥。代价不小：接下他的伤病风险，外加四名球员和三个首轮签。'),
    ('MIL', 'a', '雄鹿：送走字母哥只是难受的开始',
     '4 年 6400 万签下小特伦特，特纳那份超额合同还是甩不掉。更别提赫罗和阿德巴约动了手，整个转型期看起来都不太平。'),
    ('MIN', 'a', '森林狼：Tim Connelly 是真敢下手',
     '送走兰德尔和里德，换来拉梅洛，爱德华兹终于有了一个明星级别的后场搭档。但拉梅洛没有季后赛经验、有伤病史、打法有时偏随意，这一票赌得不小。'),
    ('NOP', 'a', '鹈鹕：把宝押在 Jamahl Mosley 身上',
     '没有新的首轮签，没有大牌签约，没有像样的交易，指望新帅把防守带起来。Mosley 手上还有一堆位置冲突要理，乐透秀和老将得抢同一批出场时间。'),
    ('NYK', 'a', '尼克斯：第二土豪线的威力前所未有',
     '手握冠军成色和惊人的球队估值，老板依然选择避开第二土豪线，代价是 Mitchell Robinson 自由市场走人。卫冕的底子还在，但连这种体量的球队都要省钱，规则的约束力可见一斑。'),
    ('OKC', 'a', '雷霆：依然相信自己的三巨头',
     '把 Dort、Isaiah Joe、Wiggins 分别送走换回一些次要选秀资产，宁可动角色球员也不拆核心。这么做既躲开了第二土豪线，也保住了首发中锋哈滕施泰因。'),
    ('ORL', 'a', '魔术：只是想换个声音',
     '连续第三年首轮出局之后换帅，Sean Sweeney 接替 Mosley，季后赛轮换阵容基本没动。想再往前走一步，得先把防守捡回来：防守效率从全联盟第 2 掉到了第 13。'),
    ('PHI', 'a', '76 人：已经不是恩比德的球队了',
     '换来布朗之后问题跟着来了，他和恩比德都是高用球率、都爱在中距离做文章。后场还有全明星马克西和正在起来的 VJ Edgecombe，总得有人让一让。',
     '（后续：7 月 25 日詹姆斯加盟，2 年 800 万带球员选项，先发预计是马克西、Edgecombe、布朗、詹姆斯、恩比德。）'),
    ('PHX', 'a', '太阳：Khaman Maluach 值得一个真正的机会',
     '布克、杰伦·格林、布鲁克斯这套核心，吓不到西部任何一支真正的强队。夏联上这位 19 岁中锋两端的判断和劲头都有长进，既能拉出来投又能在内线顶人，是现在这套阵容最需要的类型。'),
    ('POR', 'a', '开拓者：Tom Dundon 完全不在意第一印象',
     '大规模裁员，砍掉解说，为球馆融资的事和当地官员正面开撕，本地已经开始担心他要把球队搬走。利拉德回归带来的那点气氛，被他自己搅得干干净净。'),
    ('SAC', 'a', '国王：现在就得开始担心「选秀降级」',
     '新的乐透规则下，战绩最差的几支球队拿状元的概率只剩 5.4%，摆明了是冲着摆烂去的。上赛季只赢 22 场的国王，正好在最不该待的那个区间里。'),
    ('SAS', 'a', '马刺：文班照着邓肯那套剧本走',
     '主动接受了一份更低的续约合同，他自己的理由是「很多球队的潜力最后没兑现，都是卡在钱上」。这一让，马刺才有余地把几个近年的乐透秀按新秀续约留下来。'),
    ('TOR', 'a', '猛龙：换回莱昂纳德有两个说得通的理由',
     '一是 2019 年那个冠军是他带来的，二是顺手甩掉了英格拉姆的合同，那人在 2026 年季后赛里几乎消失。先换来英格拉姆再把他打包送走，等于用了一次漂亮的撤销键。'),
    ('UTA', 'a', '爵士：Darryn Peterson 还打不了控卫',
     '夏联期间明显扛不住组织的担子，好在还有 Keyonte George 顶着发起进攻。等他适应了，Hardy 可以再往他盘子里加东西，但助攻失误比得先有明显改善。'),
    ('WAS', 'a', '奇才：全押在特雷·杨身上',
     '4 年 2.12 亿续约，还专门办了一场摆着家人照片的自助餐式发布会。球队希望他更多地转向组织者的角色，把球权让一部分给 Dybantsa 这些年轻人。'),

    # ---------- B：2026 选秀评级 ----------
    ('ATL', 'b', '老鹰 2026 选秀评级 A-：8 号 Flemings + 23 号 Ejiofor',
     '首轮 8 号 Kingston Flemings、23 号 Zuby Ejiofor，次轮 52 号 Henri Veesaar。Flemings 来了就是持球突破的威胁，Ejiofor 给一直缺人的老鹰内线补上了长度和防守硬度。'),
    ('BOS', 'b', '凯尔特人 2026 选秀评级 A-：27 号 Cenac 补内线',
     '27 号 Chris Cenac Jr.、40 号 Dillon Mitchell。Cenac 填的正是季后赛被 76 人打穿的那个位置，绿军的内线又薄又缺经验。'),
    ('BKN', 'b', '篮网 2026 选秀评级 C+：6 号跳过 Acuff 选了 Brown',
     '6 号 Mikel Brown Jr.、28 号 Joshua Jefferson、43 号 Tyler Bilodeau。在 Brown 和阿肯色的 Darius Acuff Jr. 之间选了前者，这个取舍会被盯着看好几年。'),
    ('CHA', 'b', '黄蜂 2026 选秀评级 B-：14 号 Steinbach + 18 号 Anderson',
     '14 号 Hannes Steinbach 补内线厚度，18 号 Christian Anderson 是德州理工出来的纯射手，因为防守端的实用性存疑掉出了乐透区。'),
    ('CHI', 'b', '公牛 2026 选秀评级 B+：4 号 Caleb Wilson',
     '4 号 Caleb Wilson、15 号 Dailyn Swain。Wilson 那股运动能力和劲头正是把公牛从长期昏睡里摇醒需要的东西，不过他和 Swain 都得把投篮练出来。'),
    ('CLE', 'b', '骑士 2026 选秀评级 B-：只有 34 号一签',
     '34 号 Meleek Thomas。典型的枪手，防守端大概率吃亏，但他那手三分有机会把骑士的外线激活。'),
    ('DAL', 'b', '独行侠 2026 选秀评级 B+：9 号 Morez Johnson Jr.',
     '9 号 Morez Johnson Jr.、25 号 Sergio De Larrea、48 号 Tobi Lawal、56 号 Vsevolod Ishchenko。Johnson 在密歇根靠防守和篮板上的不知疲倦立足，这股劲儿要是保得住，这个签回头看会很值。'),
    ('DEN', 'b', '掘金 2026 选秀评级 C：两个次轮签',
     '35 号 Trevon Brazile、49 号 Bryce Hopkins。Brazile 是那种看着热闹、实货不多的类型，Hopkins 有标准的锋线尺寸和四年大学经验。'),
    ('DET', 'b', '活塞 2026 选秀评级 B+：17 号 Okorie 能直接打',
     '17 号 Ebuka Okorie、53 号 Ugonna Onyenso。Okorie 靠持球把对方防守压缩到一起，正好对上活塞季后赛进攻打不开的毛病，他大概率很快就能吃到真正的轮换时间。'),
    ('GSW', 'b', '勇士 2026 选秀评级 A：11 号 Lendeborg 值了',
     '11 号 Yaxel Lendeborg、54 号 Lajae Jones。Lendeborg 在密歇根攻防两端都能贡献，新秀年就该拿到不少时间，这对还想打有意义的比赛的库里来说是实打实的帮助。'),
    ('HOU', 'b', '火箭 2026 选秀评级 C+：31 号 Bruce Thornton',
     '范弗利特伤了之后后场厚度是明摆着的窟窿。杜兰特来休斯敦第一年负担太重，球队希望 Thornton 能分走一点进攻组织的活。'),
    ('IND', 'b', '步行者 2026 选秀评级 C+：38 号本地娃 Braden Smith',
     '普渡出来的本地球员，个子偏小但组织能力出众。ESPN 开了句玩笑：训练营里他和 T.J. McConnell 对位，步行者应该考虑收门票。'),
    ('LAC', 'b', '快船 2026 选秀评级 A-：5 号 Keaton Wagler',
     '5 号 Keaton Wagler，外加 36 号 Baba Miller、55 号 Nick Martinelli、57 号 Narcisse Ngoy。老阵容到期之后快船急需年轻人，Wagler 是那种比较全面的组织者，能和 Garland 搭起新的后场。'),
    ('LAL', 'b', '湖人 2026 选秀评级 C：24 号 Cameron Carr',
     '三分稳定，是符合湖人需求的类型。问题是他对锋线来说太轻了，官方登记只有 184 磅，防守端刚开始肯定要吃亏。'),
    ('MEM', 'b', '灰熊 2026 选秀评级 A+：3 号 Cameron Boozer 领衔',
     '3 号 Cameron Boozer、21 号 Karim Lopez、32 号 Richie Saunders。Boozer 得分有技术、串联有脑子、抢板有意识，是能扛起下一个时代的人。Kleiman 这个夏天连交易带引援（还包括中锋 Isaiah Stewart）都干得漂亮。'),
    ('MIA', 'b', '热火 2026 选秀评级 B+：37 号 Ryan Conwell 补三分',
     '送走赫罗之后，热火围着字母哥优先补外线投射。Conwell 大学最后一年三分命中率 37.6%，在路易斯维尔场均出手接近 10 记三分。'),
    ('MIL', 'b', '雄鹿 2026 选秀评级 B：10 号和 13 号两个一年级新人',
     '10 号 Brayden Burries、13 号 Nate Ament、60 号 Malique Lewis。字母哥走后雄鹿只能从头搭，Ament 自己也说了，那边留下的是双很大的鞋子要填。'),
    ('MIN', 'b', '森林狼 2026 选秀评级 C-：33 号 Isaiah Evans',
     '33 号 Isaiah Evans、59 号 Trey Kaufman-Renn。Evans 掉到次轮是因为对锋线来说偏轻，也没法给防守制造多少向内的压力。送走兰德尔之后，爱德华兹身上的进攻担子只会更重。'),
    ('NOP', 'b', '鹈鹕 2026 选秀评级 D：整届只有 58 号一个签',
     '去年就把首轮签交易掉了，这届只剩下 58 号 Jaron Pierre Jr.。'),
    ('NYK', 'b', '尼克斯 2026 选秀评级 C：两个次轮签',
     '39 号 Jack Kayil、47 号 Tyler Nickel。卫冕赛季里新秀想要时间不容易。Nickel 大学四年换了三所学校，最后把三分练到了 40%。'),
    ('OKC', 'b', '雷霆 2026 选秀评级 A：12 号 Aday Mara + 16 号 Stirtz',
     '12 号 Aday Mara、16 号 Bennett Stirtz、41 号 Otega Oweh。西决出局之后，雷霆一手补内线一手补外线：一个是密歇根来的大个中锋，一个是爱荷华出来的苦力型后卫。'),
    ('ORL', 'b', '魔术 2026 选秀评级 C：51 号 Izaiyah Nelson',
     '不会投，身高又不太够打中锋。好处是防守数据实在，盖帽和抢断都不错。'),
    ('PHI', 'b', '76 人 2026 选秀评级 B+：22 号 Labaron Philon Jr.',
     '补上了走掉那名后卫的位置。他有球无球都能打，跟在全明星后场后面轮换正合适。'),
    ('PHX', 'b', '太阳 2026 选秀评级 D：30 号 Koa Peat',
     '大学阶段看着有点招架不住，身板偏小、选择出手的时机和防守的适应性都被打了问号。'),
    ('POR', 'b', '开拓者 2026 选秀评级 F：一个签都没有',
     '这届一个球员都没选。首轮签五年前就交易出去了。'),
    ('SAC', 'b', '国王 2026 选秀评级 B+：7 号 Darius Acuff Jr.',
     '7 号 Darius Acuff Jr.、29 号 Alex Karaban、45 号 Emanuel Sharp。Acuff 来了就能得分，但他是个小个后卫，得分能力没有上限，防守端的漏洞也没有下限。'),
    ('SAS', 'b', '马刺 2026 选秀评级 A：一届把内线换了个遍',
     '20 号 Jayden Quaintance、26 号 Tarris Reed Jr.、42 号 Ja\'Kobi Gillespie、44 号 Maliq Brown。围着文班把内线重做了一遍，既拿到了能搅局的防守者，也拿到了几个马上能用的替补中锋。'),
    ('TOR', 'b', '猛龙 2026 选秀评级 B-：19 号 Allen Graves',
     '19 号 Allen Graves、50 号 Jaden Bradley。Graves 是数据模型偏爱的四号位，得先证明大一那 41.3% 的三分不是偶然，防守站位也还有得练。'),
    ('UTA', 'b', '爵士 2026 选秀评级 A-：榜眼 Darryn Peterson',
     '正好补上爵士最缺的后卫。ESPN 的评价是，只要能迈过大学时期那些让人摸不着头脑的健康问题，他有成为常年全明星的潜力。'),
    ('WAS', 'b', '奇才 2026 选秀评级 B：状元 AJ Dybantsa',
     '1 号 AJ Dybantsa、46 号 Felix Okpara。在状元人选上选了更稳的那个，没去赌有健康问题的后卫。他这种有冲击力的锋线得分手，正是上赛季进攻排名第 29 的奇才急需的。'),
]


def news_id(code, kind):
    return str(uuid.uuid5(NS, f'nba-seed-{code}-{kind}'))


# 这 60 条统一归到专题自己的「新闻」类别下（forum_topic.POST_CATEGORIES 里的一项）。
# id 也是推出来的固定值，重复跑不会重复建类别。
CATEGORY_ID = str(uuid.uuid5(NS, 'nba-post-category-news'))
CATEGORY_NAME = '新闻'


def ensure_category():
    """返回这批帖子该用的类别 id。

    **先按名字找**：题主可能已经在界面上建过「新闻」了，那就用他那个 id，
    不能自己再建一个同名的——专题里出现两个「新闻」，筛选条上就是两个一模一样的按钮。
    实在没有才新建一项。
    """
    p = subprocess.run(
        ['docker', 'exec', '-i', 'mysql', 'mysql', '--default-character-set=utf8mb4', '-uroot',
         '-p' + open(__file__.rsplit('/', 2)[0] + '/nba_sync/.dbpwd').read().strip(),
         '-D', 'dream', '-N', '-B', '-e',
         f"select ifnull(POST_CATEGORIES,'') from forum_topic where TOPIC_ID='{TOPIC_ID}';"],
        capture_output=True, text=True)
    raw = (p.stdout or '').strip()
    cats = json.loads(raw) if raw.startswith('[') else []
    for c in cats:
        if c.get('name') == CATEGORY_NAME and c.get('id'):
            return c['id'], False
    cats.append({'id': CATEGORY_ID, 'name': CATEGORY_NAME})
    run_mysql("update forum_topic set POST_CATEGORIES='{}' where TOPIC_ID='{}';".format(
        sql_escape(json.dumps(cats, ensure_ascii=False)), TOPIC_ID))
    return CATEGORY_ID, True


def build():
    rows = []
    seq = {'a': 0, 'b': 0}
    for code, kind, title, *paras in ITEMS:
        src_text, src_url = SRC[kind]
        body = ''.join(f'<p>{p}</p>' for p in paras)
        body += (f'<p><em style="color:#8c8c8c;font-size:13px">编译自 {src_text}　'
                 f'<a href="{src_url}" target="_blank" rel="noopener">阅读原文</a></em></p>')
        if kind == 'a' and code in ('GSW', 'PHI'):
            body += (f'<p><em style="color:#8c8c8c;font-size:13px">后续消息来源：'
                     f'<a href="{URL_LBJ}" target="_blank" rel="noopener">ESPN · LeBron chooses 76ers</a></em></p>')
        # 同一篇里按顺序错开分钟数，列表排序才稳定
        when = DATE[kind] + timedelta(minutes=seq[kind])
        seq[kind] += 1
        rows.append({
            'newsId': news_id(code, kind),
            'title': title,
            'content': body,
            'tags': f'{ZH[code]},{TAG2[kind]}',
            'publishDate': when.strftime('%Y-%m-%d %H:%M:%S'),
        })
    return rows


def sql_escape(s):
    return s.replace('\\', '\\\\').replace("'", "\\'")


def run_mysql(sql):
    pwd = open(__file__.rsplit('/', 2)[0] + '/nba_sync/.dbpwd').read().strip()
    p = subprocess.run(
        ['docker', 'exec', '-i', 'mysql', 'mysql', '--default-character-set=utf8mb4',
         '-uroot', f'-p{pwd}', '-D', 'dream', '-e', sql],
        capture_output=True, text=True)
    err = '\n'.join(l for l in p.stderr.splitlines() if 'Using a password' not in l)
    if err:
        print(err)
    return p.returncode


def run_es(body, path='/_bulk'):
    p = subprocess.run(
        ['curl', '-s', '-X', 'POST', f'http://127.0.0.1:9200{path}',
         '-H', 'Content-Type: application/x-ndjson', '--data-binary', body],
        capture_output=True, text=True)
    out = json.loads(p.stdout or '{}')
    if out.get('errors'):
        print('ES 有失败项：', json.dumps(out, ensure_ascii=False)[:800])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--delete', action='store_true')
    a = ap.parse_args()
    rows = build()

    if a.delete:
        ids = ','.join(f"'{r['newsId']}'" for r in rows)
        if a.dry_run:
            print(f'会删除 {len(rows)} 条')
            return
        run_mysql(f'delete from dream_news where NEWS_ID in ({ids});')
        bulk = ''.join(json.dumps({'delete': {'_index': 'news', '_id': r['newsId']}}) + '\n' for r in rows)
        run_es(bulk)
        print(f'已删除 {len(rows)} 条')
        return

    if a.dry_run:
        for r in rows[:3] + rows[-2:]:
            print(r['publishDate'], '|', r['tags'], '|', r['title'])
        print(f'... 共 {len(rows)} 条')
        return

    cat_id, created = ensure_category()
    if created:
        print(f'已给专题加上「{CATEGORY_NAME}」帖子类别')
    else:
        print(f'复用专题里已有的「{CATEGORY_NAME}」类别（{cat_id}）')

    # MySQL：重复跑就覆盖，不会灌出两份
    values = []
    for r in rows:
        values.append(
            "('{id}','{author}','{aid}',0,0,'{content}',0,'{tags}','{date}','{title}','forum','{topic}',"
            "'0','0',0,0,'0','0',0,'{cat}')".format(
                id=r['newsId'], author=sql_escape(AUTHOR), aid=AUTHOR_ID,
                content=sql_escape(r['content']), tags=sql_escape(r['tags']),
                date=r['publishDate'][:10], title=sql_escape(r['title']), topic=TOPIC_ID,
                cat=cat_id))
    sql = ('insert into dream_news (NEWS_ID,AUTHOR,AUTHOR_ID,BAD_NUM,COMMENT_NUM,CONTENT,GOOD_NUM,TAGS,'
           'PUBLISH_DATE,TITLE,NEWS_CHANNEL,TOPIC_ID,TOP,ESSENCE,VIEW_COUNT,VIEWER_COUNT,LOCKED,HIDDEN,DRAFT,CATEGORY_ID) values '
           + ',\n'.join(values)
           + ' on duplicate key update TITLE=values(TITLE), CONTENT=values(CONTENT), TAGS=values(TAGS),'
             ' PUBLISH_DATE=values(PUBLISH_DATE), CATEGORY_ID=values(CATEGORY_ID);')
    if run_mysql(sql) != 0:
        print('MySQL 写入失败，ES 不动')
        return

    # ES：_id 用同一个 newsId，重复跑是覆盖
    lines = []
    for r in rows:
        lines.append(json.dumps({'index': {'_index': 'news', '_id': r['newsId']}}))
        lines.append(json.dumps({
            '_class': 'com.dream.basketball.esEntity.News',
            'newsId': r['newsId'], 'title': r['title'], 'content': r['content'],
            'author': AUTHOR, 'authorId': AUTHOR_ID, 'publishDate': r['publishDate'],
            'newsChannel': 'forum', 'topicId': TOPIC_ID, 'tags': r['tags'],
        }, ensure_ascii=False))
    run_es('\n'.join(lines) + '\n')
    run_es('', '/news/_refresh')
    print(f'已写入 {len(rows)} 条（MySQL + ES）')


if __name__ == '__main__':
    main()
