import type { ThemeConfig } from 'antd'
import { theme } from 'antd'

/** 金融蓝主色 */
export const FINANCIAL_BLUE = '#2563eb'

const baseToken = {
  colorPrimary: FINANCIAL_BLUE,
  borderRadius: 12,
  fontFamily: `'Inter', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif`,
  colorSuccess: '#389e0d',
  colorError: '#cf1322',
} as const

/** 与 global.scss 亮色壳一致：冷灰底、略强调边框与层级 */
const lightToken = {
  ...baseToken,
  colorBgLayout: '#f3f6fc',
  colorBgContainer: '#ffffff',
  colorBgElevated: '#ffffff',
  colorBorder: 'rgba(15, 23, 42, 0.1)',
  colorBorderSecondary: 'rgba(15, 23, 42, 0.06)',
  colorText: '#0f172a',
  colorTextSecondary: 'rgba(15, 23, 42, 0.68)',
  colorTextTertiary: 'rgba(15, 23, 42, 0.45)',
  colorTextQuaternary: 'rgba(15, 23, 42, 0.3)',
  colorFillAlter: 'rgba(15, 23, 42, 0.02)',
  colorFillSecondary: 'rgba(15, 23, 42, 0.04)',
  colorFillTertiary: 'rgba(15, 23, 42, 0.06)',
}

export function getAntdTheme(isDark: boolean): ThemeConfig {
  return {
    algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: isDark ? { ...baseToken } : lightToken,
    components: {
      Card: {
        borderRadiusLG: 14,
      },
      Modal: {
        borderRadiusLG: 14,
      },
      Segmented: {
        borderRadius: 10,
      },
      Input: {
        activeBorderColor: FINANCIAL_BLUE,
        hoverBorderColor: 'rgba(37, 99, 235, 0.45)',
      },
      Select: {
        optionSelectedBg: 'rgba(37, 99, 235, 0.08)',
      },
    },
  }
}
