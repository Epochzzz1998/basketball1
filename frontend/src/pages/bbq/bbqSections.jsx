import {
  BarChartOutlined, DollarOutlined, FireOutlined, TagsOutlined, TeamOutlined,
} from '@ant-design/icons'

/**
 * 耿阿姨烤串的分区注册表：**侧栏菜单（AppLayout）和页内标签条（BbqTabs）共用这一份**。
 *
 * 分成两份的话，加一个分区就要改两处，迟早对不上——多出来的入口点了是空白，
 * 或者反过来有页面但侧栏没入口。`lolSections` 是同样的结构，改法也一样。
 *
 * 两个角色看到的不是同一组：**店长共管全店账本，店员只看得到自己的薪资**。
 * 所以这里按角色返回，而不是渲染时各自过滤——过滤条件散在两个文件里同样会分叉。
 *
 * 顺序有讲究：**每天会点的排在前面**。店长每天记账（薪资计算），台账隔几天看一次，
 * 成员管理和串价设置是偶尔改一次的——把一次性的功能放在第一个会让人每次进来都先看见它。
 *
 * @param role `'manager'` | `'staff'` | 其它（非店内成员，返回空数组）
 */
export const bbqSections = (role) => {
  if (role === 'manager') {
    return [
      { path: '/bbq/wage', label: '薪资计算', icon: <DollarOutlined /> },
      { path: '/bbq/ledger', label: '经营台账', icon: <BarChartOutlined /> },
      { path: '/bbq/burning', label: 'Burning！', icon: <FireOutlined /> },
      { path: '/bbq/members', label: '成员管理', icon: <TeamOutlined /> },
      { path: '/bbq/skewers', label: '串价设置', icon: <TagsOutlined /> },
    ]
  }
  if (role === 'staff') {
    return [
      { path: '/bbq/ledger', label: '我的薪资', icon: <BarChartOutlined /> },
      { path: '/bbq/burning', label: 'Burning！', icon: <FireOutlined /> },
    ]
  }
  return []
}
