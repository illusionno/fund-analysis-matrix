import { createContext, useContext } from 'react'

export const ThemeContext = createContext<boolean>(true)

export function useThemeDark() {
  return useContext(ThemeContext)
}
