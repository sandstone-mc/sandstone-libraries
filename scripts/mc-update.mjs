import * as fs from 'fs'

import * as path from 'path'

import { fileURLToPath } from 'url'

import fetch from 'node-fetch'

const parentPath = path.dirname(fileURLToPath(import.meta.url))

async function generate() {
  const allNames = await (await fetch('https://raw.githubusercontent.com/misode/mcmeta/registries/block/data.min.json')).json()

  let names = ''

  for (const name of allNames) {
    names += `  '${name}',\n`
  }

  fs.writeFileSync(
    path.join(parentPath, './../packages/block/src/generated/names/all.ts'),

    `/* eslint-disable */\n` +
    `/* Auto-generated */\n` +
    `export const BLOCK_NAMES = [\n` +
    names +
    `] as const`,
    () => {}
  )

  const allProperties = await (await fetch('https://raw.githubusercontent.com/misode/mcmeta/summary/blocks/data.min.json')).json()

  let properties = ''
  
  for (const [name, _properties] of Object.entries(allProperties)) {
    names += `  '${name}',\n`

    properties +=
      `  ${name}: {\n` +
      `    ${Object.entries(_properties[0]).sort(([k, a], [_k, b]) => b.length - a.length).map(([key, value]) => `${key}: ['${value.join('\', \'')}']`).join(',\n    ')}\n` +
      `  },\n`
  }

  fs.writeFileSync(
    path.join(parentPath, './../packages/block/src/generated/properties.ts'),

    `/* eslint-disable */\n` +
    `/* Auto-generated */\n` +
    `export const BLOCK_PROPERTIES = {\n` +
    properties +
    `} as const`,
    () => {}
  )

  const allBlockTags = await (await fetch('https://raw.githubusercontent.com/misode/mcmeta/summary/data/tag/block/data.min.json')).json()

  function parseTag(values) {
    return values.flatMap(v => {
        if (v.includes('#')) {
            return parseTag(allBlockTags[v.replace('#minecraft:', '')].values)
        }
        return v.replace('minecraft:', '')
    })
  }

  const extra = new RegExp(`^((${[
    'climbable', 'banners', 'beds', 'walls', 'wool', 'wool\_carpets'
  ].join(')|(')}))$`)


  const nameLists = Object.entries(allBlockTags).filter(tag => extra.test(tag[0]) || tag[1].values.find(v => v.includes('#'))).map(tag => {
    return [tag[0].replace('/', '_'), parseTag(tag[1].values)]
  })

  let exports = ''

  let lists = ''

  for (const [list, names] of nameLists) {
    fs.writeFileSync(
      path.join(parentPath, `./../packages/block/src/generated/names/${list}.ts`),
  
      `/* eslint-disable */\n` +
      `/* Auto-generated */\n` +
      `export const ${list.toUpperCase()} = [\n` +
      `  '${names.join('\',\n  \'')}'\n` +
      `] as const`,
      () => {}
    )

    exports += `import { ${list.toUpperCase()} } from './names/${list}.js'\n`

    lists += `  ${list}: ${list.toUpperCase()},\n`
  }

  fs.writeFileSync(
    path.join(parentPath, './../packages/block/src/generated/index.ts'),
    `export * from './names/all.js'\n` +
    `export * from './properties.js'\n` +
    exports +
    `export const available_names = {\n${lists}} as const`,
    () => {}
  )
}

generate()
