import { sandstonePack } from 'sandstone'
import { Coordinates } from 'sandstone/arguments'
import { FinalCommandOutput } from 'sandstone/commands/helpers'
import { SandstoneCore } from 'sandstone/core'
import { DataPointClass } from 'sandstone/variables/Data'

import { BLOCK_PROPERTIES, BLOCK_NAMES, available_names } from './generated/index.js'
import { LiteralUnion } from 'sandstone/utils'
import { IfStatement } from 'sandstone/flow/if_else'

const propsObjectToArgs = (props: Record<string, string>) => `[${Object.entries(props).map(props => `${props[0]}=${props[1]}`).join(',')}]`

export class BlockSetClass<NAMES extends readonly string[]> {

    private generated: string[] = []

    constructor(private sandstoneCore: SandstoneCore, public blockNames: NAMES, public preGenerated = false) {}

    Block<NAME extends NAMES[number], POS extends Coordinates<false> | undefined, PROPERTIES extends PropertiesOfName<NAME>>(blockName: NAME, pos: POS, properties: PROPERTIES): BlockClass<NAME, POS, PROPERTIES>

    Block<NAME extends NAMES[number] | DataPointClass>(blockName: NAME): BlockClass<NAME, undefined, undefined>

    Block<NAME extends NAMES[number] | DataPointClass | undefined, POS extends Coordinates<false>>(blockName: NAME, pos: POS): BlockClass<NAME, POS, undefined>

    Block<NAME extends DataPointClass | undefined, POS extends Coordinates<false> | undefined, PROPERTIES extends DataPointClass>(blockName: NAME, pos: POS, properties: PROPERTIES): BlockClass<NAME, POS, PROPERTIES>

    Block<NAME extends DataPointClass | undefined, POS extends Coordinates<false> | undefined>(blockName: NAME, pos: POS, properties: Record<string, string>): BlockClass<NAME, POS, any>

    Block<NAME extends NAMES[number] | DataPointClass | undefined, POS extends Coordinates<false> | undefined, PROPERTIES extends PropertiesOfName<NAME> | DataPointClass | undefined>(blockName?: NAME, pos?: POS, properties?: PROPERTIES) {
        return new BlockClass<NAME, POS, PROPERTIES>(this.sandstoneCore, this, blockName, pos, properties)
    }

    _forProperties(handle: (blockName: NAMES[number], properties?: Record<string, string>) => void) {
        for (const blockName of this.blockNames) {
            if ((BLOCK_PROPERTIES[blockName as keyof typeof BLOCK_PROPERTIES]) !== undefined) {
                for (const [propertyName, propertyValues] of Object.entries(BLOCK_PROPERTIES[blockName as keyof typeof BLOCK_PROPERTIES]!)) {
                    for (const propertyValue of propertyValues) {
                        for (const [_propertyName, _propertyValues] of Object.entries(BLOCK_PROPERTIES[blockName as keyof typeof BLOCK_PROPERTIES]!)) {
                            if (propertyName === _propertyName) continue

                            // TODO: This actually needs to be recursive and do every combination of properties

                            for (const _propertyValue of _propertyValues) {
                                handle(blockName, properties)
                            }
                        }
                    }
                }
            } else {
                handle(blockName)
            }
        }
    }

    _generateWorldToNBT() {
        if (!this.preGenerated && !this.generated.includes('world_to_nbt')) {
            this.generated.push('world_to_nbt')

            const { commands, MCFunction, Data } = this.sandstoneCore.pack
            const { execute } = commands

            MCFunction('sandstone_block:world_to_nbt', () => {
                const output = Data('storage', 'sandstone_block:world_to_nbt', 'Output')

                const blocks: string[] = []

                // TODO: This should use if statements as well, after Block becomes a ConditionNode

                const conversions: Record<string, (() => FinalCommandOutput)[]> = {}

                this._forProperties((blockName, properties) => {
                    if (!blocks.includes(blockName)) {
                        blocks.push(blockName)
                        conversions[blockName] = []
                    }

                    if (properties) {
                        conversions[blockName].push(() => execute.if.block('~ ~ ~', `${blockName}${propsObjectToArgs(properties)}`).run.returnCmd.run(() => {
                            output.set({Name: blockName, Properties: properties})
                        }))
                    } else {
                        conversions[blockName].push(() => execute.if.block('~ ~ ~', blockName).run.returnCmd.run(() => {
                            output.set({Name: blockName})
                        }))
                    }
                })

                // TODO: Depending on how many blocks there are, it might be better to do this in multiple functions; branch using block tags
            }, {
                onConflict: 'rename'
            })
        }
    }

    _generateNBTToWorld() {
        if (!this.preGenerated && !this.generated.includes('nbt_to_world')) {
            this.generated.push('nbt_to_world')

            const { commands, MCFunction, Data, _ } = this.sandstoneCore.pack
            const { setblock } = commands

            MCFunction('sandstone_block:nbt_to_world', () => {
                const input = Data('storage', 'sandstone_block:nbt_to_world', 'Input')

                const blocks: string[] = []

                const conversions: Record<string, (() => IfStatement)[]> = {}

                this._forProperties((blockName, properties) => {
                    if (!blocks.includes(blockName)) {
                        blocks.push(blockName)
                        conversions[blockName] = []
                    }

                    if (properties) {
                        conversions[blockName].push(() => _.if(input.equals({Name: blockName, Properties: properties}), () => {
                            setblock('~ ~ ~', `${blockName}${propsObjectToArgs(properties)}`)
                        }))
                    } else {
                        conversions[blockName].push(() => _.if(input.equals({Name: blockName}), () => {
                            setblock('~ ~ ~', blockName)
                        }))
                    }
                })

                // Depending on how many blocks there are, it might be better to do this in multiple functions; branch using block tags
            }, {
                onConflict: 'rename'
            })
        }
    }
}

/**
 * @param blockNames List of blocks to include in the set
 * @param preGenerated Whether the block conversion functions are already pre generated and placed in existing resources; prevent generating them without changes
 */
export function BlockSet<NAMES extends readonly string[]>(blockNames: NAMES, preGenerated = false) {
    return new BlockSetClass<NAMES>(sandstonePack.core, blockNames, preGenerated)
}

type GetKeys<T> = T extends unknown[]
  ? T extends [] // special case empty tuple => no keys
    ? never
    : "0" extends keyof T // any tuple with at least one element
    ? Exclude<keyof T, keyof []>
    : number // other array
  : keyof T; // not an array

/**
 * @param blockNames List of blocks to include in the set
 * @param preGenerated Whether the block conversion functions are already pre generated and placed in existing resources; prevent generating them without changes
 */
export function BuiltinBlockSet<SET extends GetKeys<typeof available_names>>(set: SET, preGenerated = false) {
    return new BlockSetClass<typeof available_names[SET]>(sandstonePack.core, available_names[set], preGenerated)
}


type Placeable<NAME extends string | DataPointClass | undefined, POS extends Coordinates<false> | undefined> = (NAME extends undefined ? false : true) | (POS extends undefined ? false : true)

type RemapToLiterals<Type> = {
    [Properties in keyof Type]: {
        [Property in keyof Type[Properties]]: Type[Properties][Property] extends readonly string[] ? Type[Properties][Property][number] : Type[Properties][Property]
    }
}

type PropertiesOfName<NAME extends LiteralUnion<typeof BLOCK_NAMES[number]> | DataPointClass | undefined> = NAME extends GetKeys<typeof BLOCK_PROPERTIES> ? Partial<RemapToLiterals<typeof BLOCK_PROPERTIES>[NAME]> : Record<string, string>

class BlockClass<NAME extends LiteralUnion<typeof BLOCK_NAMES[number]> | DataPointClass | undefined, POS extends Coordinates<false> | undefined, PROPERTIES extends PropertiesOfName<NAME> | DataPointClass | undefined> {
    
    constructor(private sandstoneCore: SandstoneCore, private blockSet: BlockSetClass<readonly string[]>, public blockName?: NAME, public pos?: POS, public properties?: PROPERTIES) {}

    set: Placeable<NAME, POS> extends true ? (() => FinalCommandOutput) : never = (() => {
        if (this.pos && this.blockName) {
            if (this.blockName instanceof DataPointClass || this.properties instanceof DataPointClass) {
                throw new Error('Not implemented')
            }
            return this.sandstoneCore.pack.commands.setblock(this.pos, this.blockName + (this.properties ? propsObjectToArgs(this.properties) : ''))
        }
        throw new Error('Not using TypeScript!')
    }) as never
}

const defaultBlocks = BlockSet(BLOCK_NAMES)

export default defaultBlocks.Block