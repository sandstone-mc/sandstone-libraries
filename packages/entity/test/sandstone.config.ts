import type { DatapackConfig, ResourcePackConfig, SandstoneConfig } from 'sandstone'

export default {
  name: 'entity-test',
  packs: {
    datapack: {
      description: '@sandstone/entity testing datapack',
      packFormat: 12,
    } as DatapackConfig,
    resourcepack: {
      description: '@sandstone/entity testing resourcepack',
      packFormat: 13,
    } as ResourcePackConfig
  },
  onConflict: {
    default: 'warn',
  },
  namespace: 'entity_test',
  packUid: 'Yw60Tw_x',
  mcmeta: 'latest',
  saveOptions: { root: true },
} as SandstoneConfig
