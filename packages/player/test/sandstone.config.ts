import type { DatapackConfig, ResourcePackConfig, SandstoneConfig } from 'sandstone'

export default {
  name: 'player-test',
  packs: {
    datapack: {
      description: '@sandstone/player testing datapack',
      packFormat: 12,
    } as DatapackConfig,
    resourcepack: {
      description: '@sandstone/player testing resourcepack',
      packFormat: 13,
    } as ResourcePackConfig
  },
  onConflict: {
    default: 'warn',
  },
  namespace: 'player_test',
  packUid: 'Yw60Tw_x',
  mcmeta: 'latest',
  saveOptions: { root: true },
} as SandstoneConfig
