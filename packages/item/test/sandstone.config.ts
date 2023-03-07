import type { DatapackConfig, ResourcePackConfig, SandstoneConfig } from 'sandstone'

export default {
  name: 'item-test',
  packs: {
    datapack: {
      description: '@sandstone/item testing datapack',
      packFormat: 12,
    } as DatapackConfig,
    resourcepack: {
      description: '@sandstone/item testing resourcepack',
      packFormat: 13,
    } as ResourcePackConfig
  },
  onConflict: {
    default: 'warn',
  },
  namespace: 'item_test',
  packUid: 'Yw60Tw_x',
  mcmeta: 'latest',
  saveOptions: { root: true },
} as SandstoneConfig
