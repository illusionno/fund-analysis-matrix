import type { ThemeConfig } from 'antd'
import { theme } from 'antd'

/** Claude 式极简主色：亮色赤陶 / 暗色柔杏 */
export const ACCENT_LIGHT = '#c96442'
export const ACCENT_DARK = '#e8a87c'

const baseToken = {
  borderRadius: 10,
  fontFamily: `'Inter', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif`,
  colorSuccess: '#4a7c59',
  colorError: '#c45c4e',
} as const

const lightToken = {
  ...baseToken,
  colorPrimary: ACCENT_LIGHT,
  colorBgLayout: '#faf9f7',
  colorBgContainer: '#ffffff',
  colorBgElevated: '#ffffff',
  colorBorder: 'rgba(44, 40, 37, 0.1)',
  colorBorderSecondary: 'rgba(44, 40, 37, 0.06)',
  colorText: '#1c1b1a',
  colorTextSecondary: 'rgba(28, 27, 26, 0.64)',
  colorTextTertiary: 'rgba(28, 27, 26, 0.42)',
  colorTextQuaternary: 'rgba(28, 27, 26, 0.28)',
  colorFillAlter: 'rgba(44, 40, 37, 0.02)',
  colorFillSecondary: 'rgba(44, 40, 37, 0.04)',
  colorFillTertiary: 'rgba(44, 40, 37, 0.06)',
}

const darkToken = {
  ...baseToken,
  colorPrimary: ACCENT_DARK,
  colorBgLayout: '#141312',
  colorBgContainer: '#1c1b1a',
  colorBgElevated: '#222120',
  colorBorder: 'rgba(255, 248, 240, 0.1)',
  colorBorderSecondary: 'rgba(255, 248, 240, 0.06)',
  colorText: 'rgba(255, 250, 245, 0.92)',
  colorTextSecondary: 'rgba(255, 240, 230, 0.55)',
  colorTextTertiary: 'rgba(255, 235, 220, 0.38)',
  colorTextQuaternary: 'rgba(255, 230, 210, 0.26)',
  colorFillAlter: 'rgba(255, 255, 255, 0.04)',
  colorFillSecondary: 'rgba(255, 255, 255, 0.06)',
  colorFillTertiary: 'rgba(255, 255, 255, 0.09)',
}

export function getAntdTheme(isDark: boolean): ThemeConfig {
  return {
    algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: isDark ? { ...darkToken } : { ...lightToken },
    components: {
      Card: {
        borderRadiusLG: 12,
      },
      Modal: {
        borderRadiusLG: 12,
      },
      Segmented: {
        borderRadius: 10,
      },
      Input: {
        activeBorderColor: isDark ? ACCENT_DARK : ACCENT_LIGHT,
        hoverBorderColor: isDark ? 'rgba(232, 168, 124, 0.55)' : 'rgba(201, 100, 66, 0.45)',
      },
      Select: {
        optionSelectedBg: isDark
          ? 'rgba(232, 168, 124, 0.12)'
          : 'rgba(201, 100, 66, 0.08)',
      },
      Button: {
        primaryShadow: 'none',
      },
    },
  }
}
