import type { DatapackConfig, ResourcePackConfig, SandstoneConfig } from 'sandstone'

export default {
  name: 'block-test',
  packs: {
    datapack: {
      description: '@sandstone/block testing datapack',
      packFormat: 12,
    } as DatapackConfig,
    resourcepack: {
      description: '@sandstone/block testing resourcepack',
      packFormat: 13,
    } as ResourcePackConfig
  },
  onConflict: {
    default: 'warn',
  },
  namespace: 'block_test',
  packUid: 'Yw60Tw_x',
  mcmeta: 'latest',
  saveOptions: { root: true },
} as SandstoneConfig
