import { defaultConfig } from '@tamagui/config/v5'
import { createTamagui, createFont } from 'tamagui'

const zenMaruGothicFont = createFont({
  family: 'ZenMaruGothic_400Regular',
  size: {
    ...defaultConfig.fonts.body.size,
  },
  lineHeight: {
    ...defaultConfig.fonts.body.lineHeight,
  },
  weight: {
    ...defaultConfig.fonts.body.weight,
    // 太字が使われる箇所は Bold ウェイトのフォントファイルを使う
    7: 'ZenMaruGothic_700Bold',
    8: 'ZenMaruGothic_700Bold',
    9: 'ZenMaruGothic_700Bold',
  },
  letterSpacing: {
    ...defaultConfig.fonts.body.letterSpacing,
  },
  face: {
    400: { normal: 'ZenMaruGothic_400Regular' },
    500: { normal: 'ZenMaruGothic_500Medium' },
    700: { normal: 'ZenMaruGothic_700Bold' },
    800: { normal: 'ZenMaruGothic_700Bold' },
    900: { normal: 'ZenMaruGothic_700Bold' },
  },
})

export const config = createTamagui({
  ...defaultConfig,
  fonts: {
    ...defaultConfig.fonts,
    heading: zenMaruGothicFont,
    body: zenMaruGothicFont,
  },
})

export default config

export type Conf = typeof config

declare module 'tamagui' {
  interface TamaguiCustomConfig extends Conf {}
}