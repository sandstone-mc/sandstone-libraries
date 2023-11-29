import { sandstonePack } from 'sandstone'
import { Coordinates, NBTObject, RootNBT } from 'sandstone/arguments'
import { FinalCommandOutput } from 'sandstone/commands/helpers'
import { MCFunctionClass, SandstoneCore, TagClass } from 'sandstone/core'
import { DataPointClass } from 'sandstone/variables/Data'

import { BLOCK_PROPERTIES, BLOCK_NAMES, available_names } from './generated/index.js'
import { LiteralUnion } from 'sandstone/utils'
import { ResolveNBTPart } from 'sandstone/variables/ResolveNBT'
import { ConditionClass } from 'sandstone/variables/abstractClasses'
import { DataPointPickClass } from 'sandstone/core'
import { SingleConditionNode } from 'sandstone/flow/index'
import { coordinatesParser } from 'sandstone/variables/parsers'
import { Score } from 'sandstone/variables/Score'
import { NBTAnyValue } from 'sandstone/variables'

const propsObjectToArgs = (props: Record<string, string>) => `[${Object.entries(props).map(props => `${props[0]}=${props[1]}`).join(',')}]`

let blockSetId = 0

class IfBlockConditionClass extends SingleConditionNode {
    constructor(sandstoneCore: SandstoneCore, readonly pos: Coordinates<false> = '~ ~ ~', readonly blockName: string, readonly properties?: Record<string, string>) {
        super(sandstoneCore)
    }

    getCondition(): unknown[] {
        return ['block', coordinatesParser(this.pos), `${this.blockName}${this.properties ? propsObjectToArgs(this.properties) : ''}`]
    }
}

class BlockSetClass<NAMES extends readonly string[]> extends ConditionClass {

    private generated: Record<string, [MCFunctionClass<undefined, undefined>, ...(Score | DataPointClass)[]]> = {}

    private readonly id: number

    constructor(private sandstoneCore: SandstoneCore, public blockNames: NAMES, public preGenerated = false) {
        super()

        this.id = blockSetId++

        // ESM is funny

        for (const method of Object.getOwnPropertyNames(Object.getPrototypeOf(this))) {
            /* @ts-ignore */
            if (method !== 'constructor' && typeof this[method] === 'function' && typeof this[method].bind === 'function') {
                /* @ts-ignore */
                this[method] = this[method].bind(this)
            }
        }
    }

    Block<NAME extends NAMES[number], PROPERTIES extends PropertiesOfName<NAME>>(blockName: NAME, pos: Coordinates<false> | undefined, properties: PROPERTIES): BlockClass<NAME, PROPERTIES>

    Block<NAME extends NAMES[number] | DataPointClass>(blockName: NAME): BlockClass<NAME, undefined>

    Block(): BlockClass<undefined, undefined>

    Block(num: number | Score): BlockClass<undefined, undefined>

    Block(blockName: undefined, pos: Coordinates<false>): BlockClass<undefined, undefined>

    Block<NAME extends DataPointClass | undefined, PROPERTIES extends DataPointClass>(blockName: NAME, pos: Coordinates<false> | undefined, properties: PROPERTIES): BlockClass<NAME, PROPERTIES>

    Block<NAME extends NAMES[number] | DataPointClass | Score | number | undefined, POS extends Coordinates<false> | undefined, PROPERTIES extends PropertiesOfName<NAME> | DataPointClass | undefined>(blockName?: NAME, pos?: POS, properties?: PROPERTIES) {
        return new BlockClass<any, any>(this.sandstoneCore, this, typeof blockName === 'number' || blockName instanceof Score ? blockName : undefined, blockName, pos, properties)
    }

    __groupTag?: TagClass<'blocks'>

    groupTag() {
        if (!this.__groupTag) {
            this.__groupTag = this.sandstoneCore.pack.Tag('blocks', `sandstone_block:set${this.id}`, [...this.blockNames])
        }
        return this.__groupTag
    }

    from<VALUE extends RootNBT | DataPointClass | DataPointPickClass>(type: 'nbt', value: VALUE, to: 'num' | 'world'): FinalCommandOutput

    from<VALUE extends RootNBT | DataPointClass | DataPointPickClass>(type: 'nbt', value: VALUE, to: string, callback: (value: VALUE, blockName: string, properties?: Record<string, string>) => unknown): FinalCommandOutput

    from<VALUE extends Score | number>(type: 'num', value: VALUE, to: 'nbt'): DataPointClass

    from<VALUE extends Score | number>(type: 'num', value: VALUE, to: 'world'): FinalCommandOutput
    
    from<VALUE extends Score | number>(type: 'num', value: VALUE, to: string, callback: (value: VALUE, blockName: string, properties?: Record<string, string>) => unknown): FinalCommandOutput

    from<VALUE extends Coordinates<false>>(type: 'world', value: VALUE, to: 'nbt'): DataPointClass

    from<VALUE extends Coordinates<false>>(type: 'world', value: VALUE, to: 'num'): FinalCommandOutput

    from<VALUE extends Coordinates<false>>(type: 'world', value: VALUE, to: string, callback: (value: VALUE, blockName: string, properties?: Record<string, string>) => unknown): DataPointClass

    from<VALUE extends RootNBT | DataPointClass | DataPointPickClass | Score | number | Coordinates<false>>(type: 'nbt' | 'num' | 'world', value: VALUE, to: LiteralUnion<'nbt' | 'num' | 'world'>, callback?: (value: VALUE, blockName: string, properties?: Record<string, string>) => unknown) {
        switch (type) {
            case 'nbt': {
                switch (to) {
                    case 'nbt':
                        throw('Use Block()')
                    case 'num': {
                        const [convert, input] = this._generateNBTToNum()

                        input.set(value as RootNBT | DataPointClass)

                        return convert()
                    }
                    case 'world': {
                        const [convert, input] = this._generateNBTToWorld()

                        input.set(value as RootNBT | DataPointClass)

                        return convert()
                    }
                    default: {
                        if (callback) {
                            return this._generateNBTToCustom(to, (blockName, properties) => callback(value, blockName, properties))[0]()
                        }
                        throw new Error('Provide a callback for custom conversions')
                    }
                }
            }
            case 'num': {
                switch (to) {
                    case 'nbt': {
                        const [convert, input, output] = this._generateNumToNBT()

                        input.set(value as number | Score)

                        convert()

                        return output
                    }
                    case 'num':
                        throw('Use Block()')
                    case 'world': {
                        const [convert, input] = this._generateNumToWorld()

                        input.set(value as number | Score)

                        return convert()
                    }
                    default: {
                        if (callback) {
                            return this._generateNumToCustom(to, (blockName, properties) => callback(value, blockName, properties))[0]()
                        }
                        throw new Error('Provide a callback for custom conversions')
                    }
                }
            }
            case 'world': {
                switch (to) {
                    case 'nbt': {
                        const [convert, output] = this._generateWorldToNBT()

                        convert()

                        return output
                    }
                    case 'num':
                        return this._generateWorldToNum()[0]()
                    case 'world':
                        throw('Use Block()')
                    default: {
                        if (callback) {
                            return this._generateWorldToCustom(to, (blockName, properties) => callback(value, blockName, properties))[0]()
                        }
                        throw new Error('Provide a callback for custom conversions')
                    }
                }
            }
        }
    }

    /**
     * @internal
     */
    _toMinecraftCondition = () => new IfBlockConditionClass(this.sandstoneCore, '~ ~ ~', `${this.groupTag()}`)

    _forProperties(handle: (blockName: NAMES[number], properties?: Record<string, string>) => void) {
        // Stack overflow to the rescue, yes I know I could've done this with types and one less recursion but I'm lazy
        function combinations(variants: any) {
            return (function recurse(keys) {
                if (!keys.length) return [{}];
                let result = recurse(keys.slice(1));
                return variants[keys[0]].reduce( (acc: any, value: any) =>
                    acc.concat( result.map( (item: any) => 
                        Object.assign({}, item, { [keys[0]]: value }) 
                    ) ),
                    []
                );
            })(Object.keys(variants));
        }

        const combo_split: Record<string, [number, string, string[]]> = {}

        for (const blockName of this.blockNames) {
            const properties = BLOCK_PROPERTIES[blockName as keyof typeof BLOCK_PROPERTIES]
            if (properties !== undefined) {
                const combos = combinations(properties)

                combos.forEach((props: Record<string, string>) => {
                    handle(blockName, props)
                })

                if (combos.length > 48) {
                    const biggestProperty: [string, string[]] = Object.entries(BLOCK_PROPERTIES[blockName as keyof typeof BLOCK_PROPERTIES])[0]

                    combo_split[blockName] = [combos.length / biggestProperty[1].length, biggestProperty[0], biggestProperty[1]]
                }
            } else {
                handle(blockName)
            }
        }

        return combo_split
    }

    _generateWorldToNBT() {
        if (!this.preGenerated && !this.generated['world_to_nbt']) {
            const { commands, MCFunction, Tag, Data } = this.sandstoneCore.pack
            const { execute } = commands

            const output = Data('storage', 'sandstone_block:world_to_nbt', 'Output')

            const convert = MCFunction(`sandstone_block:world_to_nbt${this.id}`, () => {
                let total = 0

                const blocks: string[] = []

                const conversions: Record<string, (() => FinalCommandOutput)[]> = {}

                const combos = this._forProperties((blockName, properties) => {
                    if (!blocks.includes(blockName)) {
                        blocks.push(blockName)
                        conversions[blockName] = []
                    }

                    if (properties) {
                        conversions[blockName].push(() => execute.if.block('~ ~ ~', `${blockName}${propsObjectToArgs(properties)}`).run
                            .returnCmd.run.data.modify.storage(output.currentTarget, 'Output').set.value({Name: blockName, Properties: properties}))
                    } else {
                        conversions[blockName].push(() => execute.if.block('~ ~ ~', blockName).run
                            .returnCmd.run.data.modify.storage(output.currentTarget, 'Output').set.value({Name: blockName}))
                    }
                })

                const convert = (blockName: string) => {
                    if (combos[blockName]) {
                        for (const [i, propertyValue] of combos[blockName][2].entries()) {
                            execute.if.block('~ ~ ~', `${blockName}${propsObjectToArgs({[combos[blockName][1]]: propertyValue})}`).run.returnCmd.run(() => {
                                const length = i*combos[blockName][0]
                                for (const conversion of conversions[blockName].slice(length, (length + combos[blockName][0] - 1))) {
                                    conversion()
                                }
                            })
                        }
                    } else {
                        for (const conversion of conversions[blockName]) {
                            conversion()
                        }
                    }
                }

                if (total <= 10) {
                    for (const blockName of blocks) {
                        convert(blockName)
                    }
                } else if (blocks.length <= 10) {
                    for (const blockName of blocks) {
                        execute.if.block('~ ~ ~', blockName).run.returnCmd.run(() => {
                            convert(blockName)
                        })
                    }
                } else {
                    const set_id = this.id

                    function split(_blocks: string[], start: number) {
                        const chunks = Math.floor(_blocks.length / 10)

                        if (chunks > 10) {
                            const _chunks = Math.floor(chunks / 10)

                            for (let i = 0; i < _chunks; i++) {
                                const blockNames = _blocks.slice(i*100, (i*100)+100)

                                execute.if.block('~ ~ ~', `${Tag('blocks', `sandstone_block:convert${set_id}_${start}_${i}`, blockNames, { onConflict: 'ignore' })}`)
                                    .run.returnCmd.run(() => {
                                        split(blockNames, start + (i*10))
                                    })
                            }

                            if (chunks % 10 !== 0) {
                                const blockNames = _blocks.slice(-chunks)

                                execute.if.block('~ ~ ~', `${Tag('blocks', `sandstone_block:convert${set_id}_${start + _chunks}_${_chunks}`, blockNames, { onConflict: 'ignore' })}`)
                                    .run.returnCmd.run(() => {
                                        split(blockNames, start + _chunks)
                                    })
                            }
                        } else if (chunks === 10) {
                            for (let i = 0; i < chunks; i++) {
                                const blockNames = _blocks.slice(i*10, (i*10)+10)

                                split(blockNames, start + (i*10))
                            }
                        } else {
                            for (let i = 0; i < chunks; i++) {
                                const blockNames = _blocks.slice(i*10, (i*10)+10)
                
                                execute.if.block('~ ~ ~', `${Tag('blocks', `sandstone_block:convert${set_id}_${start}_${i}`, blockNames, { onConflict: 'ignore' })}`)
                                    .run.returnCmd.run(() => {
                                        for (const blockName of blockNames) {
                                            execute.if.block('~ ~ ~', blockName).run.returnCmd.run(() => {
                                                convert(blockName)
                                            })
                                        }
                                    })
                            }
                        }
                    }
                    split(blocks, 0)

                    const leftovers = blocks.length % 10 
        
                    if (leftovers !== 0) {
                        const blockNames = blocks.slice(-leftovers+2)
        
                        execute.if.block('~ ~ ~', `${Tag('blocks', `sandstone_block:convert${this.id}_${Math.floor(blocks.length / 10) + 1}`, blockNames, { onConflict: 'ignore' })}`)
                                .run.returnCmd.run(() => {
                                    for (const blockName of blockNames) {
                                        execute.if.block('~ ~ ~', blockName).run.returnCmd.run(() => {
                                            convert(blockName)
                                        })
                                    }
                                })
                    }
                }
            })

            this.generated['world_to_nbt'] = [convert, output]
        }
        return this.generated['world_to_nbt']! as [MCFunctionClass<undefined, undefined>, DataPointClass]
    }

    _generateNBTToWorld() {
        if (!this.preGenerated && !this.generated['nbt_to_world']) {

            const { MCFunction, Data, initMCFunction, Macro } = this.sandstoneCore.pack

            const input = Data('storage', 'sandstone_block:nbt_to_world', 'Input')

            const convert = MCFunction(`sandstone_block:nbt_to_world${this.id}`, () => {

                const states: RootNBT[] = []

                this._forProperties((blockName, properties) => {
                    if (properties) {
                        states.push({Name: blockName, Properties: properties, Block: `${blockName}${propsObjectToArgs(properties)}`})
                    } else {
                        states.push({Name: blockName, Block: blockName})
                    }
                })

                const statesPoint = Data('storage', `sandstone_block:nbt_to_world${this.id}`, 'States')

                initMCFunction.push(() => statesPoint.set(states))

                MCFunction(`sandstone_block:nbt_to_world${this.id}_inner`, [input], () => {
                    Macro.setblock('~ ~ ~', input.Macro`States[${input}].Block`)
                })()
            })

            this.generated['nbt_to_world'] = [convert, input]
        }
        return this.generated['nbt_to_world']! as [MCFunctionClass<undefined, undefined>, DataPointClass]
    }

    _generateWorldToNum() {
        if (!this.preGenerated && !this.generated['world_to_num']) {
            const { commands, MCFunction, Tag } = this.sandstoneCore.pack
            const { execute } = commands

            const convert = MCFunction(`sandstone_block:world_to_num${this.id}`, () => {
                let total = 0

                const blocks: string[] = []

                const conversions: Record<string, (() => FinalCommandOutput)[]> = {}

                const combos = this._forProperties((blockName, properties) => {
                    if (!blocks.includes(blockName)) {
                        blocks.push(blockName)
                        conversions[blockName] = []
                    }

                    let current = total++

                    if (properties) {
                        conversions[blockName].push(() => execute.if.block('~ ~ ~', `${blockName}${propsObjectToArgs(properties)}`).run.returnCmd(current))
                    } else {
                        conversions[blockName].push(() => execute.if.block('~ ~ ~', blockName).run.returnCmd(current))
                    }
                })

                const convert = (blockName: string) => {
                    if (combos[blockName]) {
                        for (const [i, propertyValue] of combos[blockName][2].entries()) {
                            execute.if.block('~ ~ ~', `${blockName}${propsObjectToArgs({[combos[blockName][1]]: propertyValue})}`).run.returnCmd.run(() => {
                                const length = i*combos[blockName][0]
                                for (const conversion of conversions[blockName].slice(length, (length + combos[blockName][0] - 1))) {
                                    conversion()
                                }
                            })
                        }
                    } else {
                        for (const conversion of conversions[blockName]) {
                            conversion()
                        }
                    }
                }

                if (total <= 10) {
                    for (const blockName of blocks) {
                        convert(blockName)
                    }
                } else if (blocks.length <= 10) {
                    for (const blockName of blocks) {
                        execute.if.block('~ ~ ~', blockName).run.returnCmd.run(() => {
                            convert(blockName)
                        })
                    }
                } else {
                    const set_id = this.id

                    function split(_blocks: string[], start: number) {
                        const chunks = Math.floor(_blocks.length / 10)

                        if (chunks > 10) {
                            const _chunks = Math.floor(chunks / 10)

                            for (let i = 0; i < _chunks; i++) {
                                const blockNames = _blocks.slice(i*100, (i*100)+100)

                                execute.if.block('~ ~ ~', `${Tag('blocks', `sandstone_block:convert${set_id}_${start}_${i}`, blockNames, { onConflict: 'ignore' })}`)
                                    .run.returnCmd.run(() => {
                                        split(blockNames, start + (i*10))
                                    })
                            }

                            if (chunks % 10 !== 0) {
                                const blockNames = _blocks.slice(-chunks)

                                execute.if.block('~ ~ ~', `${Tag('blocks', `sandstone_block:convert${set_id}_${start + _chunks}_${_chunks}`, blockNames, { onConflict: 'ignore' })}`)
                                    .run.returnCmd.run(() => {
                                        split(blockNames, start + _chunks)
                                    })
                            }
                        } else if (chunks === 10) {
                            for (let i = 0; i < chunks; i++) {
                                const blockNames = _blocks.slice(i*10, (i*10)+10)

                                split(blockNames, start + (i*10))
                            }
                        } else {
                            for (let i = 0; i < chunks; i++) {
                                const blockNames = _blocks.slice(i*10, (i*10)+10)
                
                                execute.if.block('~ ~ ~', `${Tag('blocks', `sandstone_block:convert${set_id}_${start}_${i}`, blockNames, { onConflict: 'ignore' })}`)
                                    .run.returnCmd.run(() => {
                                        for (const blockName of blockNames) {
                                            execute.if.block('~ ~ ~', blockName).run.returnCmd.run(() => {
                                                convert(blockName)
                                            })
                                        }
                                    })
                            }
                        }
                    }
                    split(blocks, 0)

                    const leftovers = blocks.length % 10 
        
                    if (leftovers !== 0) {
                        const blockNames = blocks.slice(-leftovers+2)
        
                        execute.if.block('~ ~ ~', `${Tag('blocks', `sandstone_block:convert${this.id}_${Math.floor(blocks.length / 10) + 1}`, blockNames, { onConflict: 'ignore' })}`)
                                .run.returnCmd.run(() => {
                                    for (const blockName of blockNames) {
                                        execute.if.block('~ ~ ~', blockName).run.returnCmd.run(() => {
                                            convert(blockName)
                                        })
                                    }
                                })
                    }
                }
            })

            this.generated['world_to_num'] = [convert]
        }
        return this.generated['world_to_num']! as [MCFunctionClass<undefined, undefined>]
    }

    _generateNBTToNum() {
        if (!this.preGenerated && !this.generated['nbt_to_num']) {

            const { commands, MCFunction, Data, Macro, initMCFunction } = this.sandstoneCore.pack
            const { returnCmd } = commands

            const input = Data('storage', 'sandstone_block:nbt_to_num', 'Input')

            const convert = MCFunction(`sandstone_block:nbt_to_num${this.id}`, () => {

                let total = 0

                const states: RootNBT[] = []

                this._forProperties((blockName, properties) => {
                    states.push({Name: blockName, Num: total++, ...(properties ? {Properties: properties} : {})})
                })

                const statesPoint = Data('storage', `sandstone_block:nbt_to_num${this.id}`, 'States')

                initMCFunction.push(() => statesPoint.set(states))

                returnCmd.run(() => {
                    MCFunction(`sandstone_block:nbt_to_num${this.id}_inner`, [input], () => {
                        Macro.returnCmd.run.data.get.storage(statesPoint.currentTarget, input.Macro`States[${input}].Num`)
                    })()
                })
            })

            this.generated['nbt_to_num'] = [convert, input]
        }

        return this.generated['nbt_to_num']! as [MCFunctionClass<undefined, undefined>, DataPointClass]
    }

    _generateNumToNBT() {
        if (!this.preGenerated && !this.generated['num_to_nbt']) {
            const { commands, MCFunction, Variable, Data } = this.sandstoneCore.pack
            const { data } = commands

            const input = Variable(undefined, 'num_to_nbt')

            const output = Data('storage', 'sandstone_block:num_to_nbt', 'Output')

            const convert = MCFunction(`sandstone_block:num_to_nbt${this.id}`, () => {
                let total = 0

                const conversions: RootNBT[] = []

                this._forProperties((blockName, properties) => {
                    conversions.push({Name: blockName, ...(properties ? { Properties: properties } : {})})
                })

                input.match(0, total, (id) => {
                    data.modify.storage(output.currentTarget, 'Output').set.value(conversions[id])
                })()
            })

            this.generated['num_to_nbt'] = [convert, input, output]
        }
        return this.generated['num_to_nbt']! as [MCFunctionClass<undefined, undefined>, Score, DataPointClass]
    }

    _generateNumToWorld() {
        if (!this.preGenerated && !this.generated['num_to_world']) {

            const { commands, MCFunction, Variable } = this.sandstoneCore.pack
            const { setblock } = commands

            const input = Variable(undefined, 'num_to_world')

            const convert = MCFunction(`sandstone_block:num_to_world${this.id}`, () => {

                let total = 0

                const states: string[] = []

                this._forProperties((blockName, properties) => {
                    total++

                    states.push(`${blockName}${properties ? propsObjectToArgs(properties) : ''}`)
                })
                
                input.match(0, total, (id) => {
                    setblock('~ ~ ~', states[id])
                })
            })

            this.generated['num_to_world'] = [convert, input] as [MCFunctionClass<undefined, undefined>, Score]
        }

        return this.generated['num_to_world']! as [MCFunctionClass<undefined, undefined>, Score]
    }

    _generateWorldToCustom(name: string, callback: (blockName: string, properties?: Record<string, string>) => unknown) {
        const named = `world_to_${name}`

        if (!this.preGenerated && !this.generated[named]) {
            const { commands, MCFunction, Tag, _ } = this.sandstoneCore.pack
            const { execute } = commands

            const convert = MCFunction(`sandstone_block:${named}${this.id}`, () => {
                let total = 0

                const blocks: string[] = []

                const conversions: Record<string, (() => FinalCommandOutput)[]> = {}

                const combos = this._forProperties((blockName, properties) => {
                    if (!blocks.includes(blockName)) {
                        blocks.push(blockName)
                        conversions[blockName] = []
                    }

                    if (properties) {
                        conversions[blockName].push(() => execute.if.block('~ ~ ~', `${blockName}${propsObjectToArgs(properties)}`).run
                            .returnCmd.run(() => callback(blockName, properties)))
                    } else {
                        conversions[blockName].push(() => execute.if.block('~ ~ ~', blockName).run
                            .returnCmd.run(() => callback(blockName)))
                    }
                })

                const convert = (blockName: string) => {
                    if (combos[blockName]) {
                        for (const [i, propertyValue] of combos[blockName][2].entries()) {
                            execute.if.block('~ ~ ~', `${blockName}${propsObjectToArgs({[combos[blockName][1]]: propertyValue})}`).run.returnCmd.run(() => {
                                const length = i*combos[blockName][0]
                                for (const conversion of conversions[blockName].slice(length, (length + combos[blockName][0] - 1))) {
                                    conversion()
                                }
                            })
                        }
                    } else {
                        for (const conversion of conversions[blockName]) {
                            conversion()
                        }
                    }
                }

                if (total <= 10) {
                    for (const blockName of blocks) {
                        convert(blockName)
                    }
                } else if (blocks.length <= 10) {
                    for (const blockName of blocks) {
                        execute.if.block('~ ~ ~', blockName).run.returnCmd.run(() => {
                            convert(blockName)
                        })
                    }
                } else {
                    const set_id = this.id

                    function split(_blocks: string[], start: number) {
                        const chunks = Math.floor(_blocks.length / 10)

                        if (chunks > 10) {
                            const _chunks = Math.floor(chunks / 10)

                            for (let i = 0; i < _chunks; i++) {
                                const blockNames = _blocks.slice(i*100, (i*100)+100)

                                execute.if.block('~ ~ ~', `${Tag('blocks', `sandstone_block:convert${set_id}_${start}_${i}`, blockNames, { onConflict: 'ignore' })}`)
                                    .run.returnCmd.run(() => {
                                        split(blockNames, start + (i*10))
                                    })
                            }

                            if (chunks % 10 !== 0) {
                                const blockNames = _blocks.slice(-chunks)

                                execute.if.block('~ ~ ~', `${Tag('blocks', `sandstone_block:convert${set_id}_${start + _chunks}_${_chunks}`, blockNames, { onConflict: 'ignore' })}`)
                                    .run.returnCmd.run(() => {
                                        split(blockNames, start + _chunks)
                                    })
                            }
                        } else if (chunks === 10) {
                            for (let i = 0; i < chunks; i++) {
                                const blockNames = _blocks.slice(i*10, (i*10)+10)

                                split(blockNames, start + (i*10))
                            }
                        } else {
                            for (let i = 0; i < chunks; i++) {
                                const blockNames = _blocks.slice(i*10, (i*10)+10)
                
                                execute.if.block('~ ~ ~', `${Tag('blocks', `sandstone_block:convert${set_id}_${start}_${i}`, blockNames, { onConflict: 'ignore' })}`)
                                    .run.returnCmd.run(() => {
                                        for (const blockName of blockNames) {
                                            execute.if.block('~ ~ ~', blockName).run.returnCmd.run(() => {
                                                convert(blockName)
                                            })
                                        }
                                    })
                            }
                        }
                    }
                    split(blocks, 0)

                    const leftovers = blocks.length % 10 
        
                    if (leftovers !== 0) {
                        const blockNames = blocks.slice(-leftovers+2)
        
                        execute.if.block('~ ~ ~', `${Tag('blocks', `sandstone_block:convert${this.id}_${Math.floor(blocks.length / 10) + 1}`, blockNames, { onConflict: 'ignore' })}`)
                                .run.returnCmd.run(() => {
                                    for (const blockName of blockNames) {
                                        execute.if.block('~ ~ ~', blockName).run.returnCmd.run(() => {
                                            convert(blockName)
                                        })
                                    }
                                })
                    }
                }
            })

            this.generated[named] = [convert]
        }
        return this.generated[named]! as [MCFunctionClass<undefined, undefined>]
    }

    _generateNBTToCustom(name: string, callback: (blockName: string, properties?: Record<string, string>) => unknown) {
        const named = `nbt_to_${name}`

        if (!this.preGenerated && !this.generated[named]) {

            const { MCFunction, Data, Macro, initMCFunction } = this.sandstoneCore.pack

            const input = Data('storage', `sandstone_block:${named}`, 'Input')

            const convert = MCFunction(`sandstone_block:${named}${this.id}`, () => {

                let total = 0

                const states: RootNBT[] = []

                this._forProperties((blockName, properties) => {
                    MCFunction(`sandstone_block:${named}${this.id}_${total}`, () => callback(blockName, properties))

                    states.push({Name: blockName, Num: total++, ...(properties ? {Properties: properties} : {})})
                })

                const statesPoint = Data('storage', `sandstone_block:nbt_to_num${this.id}`, 'States')

                initMCFunction.push(() => statesPoint.set(states))

                MCFunction(`sandstone_block:nbt_to_${name}${this.id}_inner`, [input], () => {

                    const num = Data('storage', 'sandstone_block:nbt_to_num', 'Output')

                    Macro.data.modify.storage(num.currentTarget, 'Output').set.from.storage(statesPoint.currentTarget, input.Macro`States[${input}].Num`)

                    MCFunction(`sandstone_block:nbt_to_${name}${this.id}_inner_inner`, [num], () => {
                        Macro.functionCmd(num.Macro`sandstone_block:nbt_to_${name}${this.id}_${num}`)
                    })
                })()
            })

            this.generated[named] = [convert, input]
        }
        return this.generated[named]! as [MCFunctionClass<undefined, undefined>, DataPointClass]
    }

    _generateNumToCustom(name: string, callback: (blockName: string, properties?: Record<string, string>) => unknown) {
        const named = `num_to_${name}`

        if (!this.preGenerated && !this.generated[named]) {

            const { MCFunction, Variable } = this.sandstoneCore.pack

            const input = Variable(undefined, named)

            const convert = MCFunction(`sandstone_block:${named}${this.id}`, () => {

                let total = 0

                const states: [blockName: NAMES[number], properties?: Record<string, string>][] = []

                this._forProperties((blockName, properties) => {
                    total++

                    states.push([blockName, properties])
                })
                
                input.match(0, total, (id) => callback(states[id][0], states[id][1]))
            })

            this.generated[named] = [convert, input] as [MCFunctionClass<undefined, undefined>, Score]
        }

        return this.generated[named]! as [MCFunctionClass<undefined, undefined>, Score]
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

type RemapToLiterals<Type> = {
    [Properties in keyof Type]: {
        [Property in keyof Type[Properties]]: Type[Properties][Property] extends readonly string[] ? Type[Properties][Property][number] : Type[Properties][Property]
    }
}

type PropertiesOfName<NAME extends LiteralUnion<typeof BLOCK_NAMES[number]> | DataPointClass | Score | number | undefined> = NAME extends GetKeys<typeof BLOCK_PROPERTIES> ? Partial<RemapToLiterals<typeof BLOCK_PROPERTIES>[NAME]> : Record<string, string>

export class BlockClass<NAME extends LiteralUnion<typeof BLOCK_NAMES[number]> | DataPointClass | undefined, PROPERTIES extends PropertiesOfName<NAME> | DataPointClass | undefined> extends ConditionClass {
    
    private num?: number | Score

    constructor(private sandstoneCore: SandstoneCore, private blockSet: BlockSetClass<readonly string[]>, num?: number | Score, public blockName?: NAME, public pos: Coordinates<false> = '~ ~ ~', public properties?: PROPERTIES) {
        super()
        if (num) this.num = num

        // ESM is funny

        for (const method of Object.getOwnPropertyNames(Object.getPrototypeOf(this))) {
            /* @ts-ignore */
            if (method !== 'constructor' && typeof this[method] === 'function' && typeof this[method].bind === 'function') {
                /* @ts-ignore */
                this[method] = this[method].bind(this)
            }
        }
    }

    set: NAME extends undefined ? never : (() => FinalCommandOutput) = (() => {
        const { commands, ResolveNBT } = this.sandstoneCore.pack
        const { setblock } = commands

        if (this.blockName) {
            if (this.blockName instanceof DataPointClass || this.properties instanceof DataPointClass) {
                const [convert, input] = this.blockSet._generateNBTToWorld()

                input.set(ResolveNBT({
                    Name: this.blockName instanceof DataPointClass ? ResolveNBTPart(this.blockName, NBTAnyValue) : this.blockName,
                    ...(this.properties ? {
                        /* @ts-ignore */ // Lol TypeScript had a poopy diaper
                        Properties: this.properties instanceof DataPointClass ? ResolveNBTPart(this.properties, NBTAnyValue) : this.properties
                    } : {})
                }))

                return convert()
            }
            return setblock(this.pos, this.blockName + (this.properties ? propsObjectToArgs(this.properties) : ''))
        }
        throw new Error('Not using TypeScript!')
    }) as never

    getName() {
        const { Data, DataVariable, commands } = this.sandstoneCore.pack

        if (this.blockName) {
            if (this.blockName instanceof DataPointClass) return this.blockName as DataPointClass
            return DataVariable(this.blockName)
        }

        const output = Data('storage', 'sandstone_block:world_to_name', 'Output')

        if (this.pos !== '~ ~ ~') {
            commands.execute.positioned(this.pos).run(() => this.blockSet._generateWorldToCustom('get_name', (blockName) => 
                output.set(blockName)
            )[0]())
            return output
        }

        this.blockSet._generateWorldToCustom('get_name', (blockName) => 
            output.set(blockName)
        )[0]()
        return output
    }

    getProperties() {
        const { Data, DataVariable, commands } = this.sandstoneCore.pack

        if (this.properties) {
            if (this.properties instanceof DataPointClass) return this.properties as DataPointClass
            return DataVariable(this.properties)
        }

        const output = Data('storage', 'sandstone_block:world_to_properties', 'Output')
        
        if (this.pos !== '~ ~ ~') {
            commands.execute.positioned(this.pos).run(() => this.blockSet._generateWorldToCustom('get_properties', (blockName, properties) => 
                output.set(properties as NBTObject)
            )[0]())
            return output
        }

        this.blockSet._generateWorldToCustom('get_properties', (blockName, properties) => 
            output.set(properties as NBTObject)
        )[0]()
        return output
    }

    getState() {
        const { DataVariable, ResolveNBT, commands } = this.sandstoneCore.pack

        if (this.blockName && this.properties) {
            if (this.blockName instanceof DataPointClass || this.properties instanceof DataPointClass) {
                return DataVariable(ResolveNBT({
                    Name: this.blockName instanceof DataPointClass ? ResolveNBTPart(this.blockName, NBTAnyValue) : this.blockName,

                    Properties: this.properties instanceof DataPointClass ? ResolveNBTPart(this.properties, NBTAnyValue) : this.properties
                })._toDataPoint()) // TODO: Remove this once DataVariable has released support for DataPointPickClass
            }
            return DataVariable({ Name: this.blockName, Properties: this.properties })
        }

        if (this.pos !== '~ ~ ~') {
            const [convert, output] = this.blockSet._generateWorldToNBT()

            commands.execute.positioned(this.pos).run(() => convert())

            return output
        }

        const [convert, output] = this.blockSet._generateWorldToNBT()
        convert()
        return output
    }

    getNum() {
        const { commands } = this.sandstoneCore.pack

        if (this.num) {
            if (this.num instanceof Score) return this.num
            return this.num
        }

        if (this.blockName && this.properties) {
            const [convert, input] = this.blockSet._generateNBTToNum()

            input.set(this.getState())

            return convert() // Could I do this statically? Yes. Will I? No. Bake this yourself if you're concerned about it.
        }

        if (this.pos !== '~ ~ ~') {
            const [convert] = this.blockSet._generateWorldToNum()

            return commands.execute.positioned(this.pos).run(() => convert())
        }

        const [convert] = this.blockSet._generateWorldToNum()
        return convert()
    }

    getData = () => this.sandstoneCore.pack.Data('block', this.pos, '{}')

    to(type: 'nbt'): DataPointClass<"storage"> | DataPointClass<any>

    to(type: 'num'): FinalCommandOutput

    to(type: 'world'): FinalCommandOutput

    to(type: string, callback: (blockName: string, properties?: Record<string, string>) => unknown): FinalCommandOutput

    to(type: 'nbt' | 'num' | 'world' | string, callback?: (blockName: string, properties?: Record<string, string>) => unknown) {
        switch (type) {
            case 'nbt':
                return this.getState()
            case 'num':
                return this.getNum()
            case 'world':
                return this.set()
            default: {
                if (callback) {
                    return this.blockSet._generateWorldToCustom(type, callback)[0]()
                }
                throw new Error('Not using TypeScript!')
            }
        }
    }

    toString() {
        if (this.blockName) {
            if (this.blockName instanceof DataPointClass || this.properties instanceof DataPointClass) {
                throw new Error('Unsupported!')
            }
            return `${this.blockName}${this.properties ? propsObjectToArgs(this.properties) : ''}`
        }
        throw new Error('Unsupported!')
    }

    /**
     * @internal
     */
    _toMinecraftCondition() {
        if (this.blockName) {
            if (this.blockName instanceof DataPointClass || this.properties instanceof DataPointClass) {
                throw new Error('Not implemented')
            }
            return new IfBlockConditionClass(this.sandstoneCore, this.pos, this.blockName, this.properties)
        } else if (this.properties) {
            if (this.properties instanceof DataPointClass) {
                throw new Error('Not implemented')
            }
            return new IfBlockConditionClass(this.sandstoneCore, this.pos, `${this.blockSet.groupTag()}`, this.properties)
        }
        throw new Error('Not supported (use `BlockSet` instead)')
    }
}

export function Properties(blockSet: BlockSetClass<readonly string[]> | TagClass<'block'> | string, pos: Coordinates<false>, properties: Partial<RemapToLiterals<typeof BLOCK_PROPERTIES>[keyof typeof BLOCK_PROPERTIES]>) {
    return new IfBlockConditionClass(sandstonePack.core, pos, blockSet instanceof BlockSetClass ? blockSet.groupTag().name : `${blockSet}`, properties)
}

class IfBlocksConditionClass extends SingleConditionNode {
    constructor(
        sandstoneCore: SandstoneCore,
        readonly start: Coordinates<false> = '~ ~ ~',
        readonly end: Coordinates<false> = '~ ~ ~',
        readonly destination: Coordinates<false> = '~ ~ ~',
        readonly scanMode: 'all' | 'masked',
    ) {
        super(sandstoneCore)
    }

    getCondition(): unknown[] {
        return ['blocks', coordinatesParser(this.start), coordinatesParser(this.end), coordinatesParser(this.destination), this.scanMode]
    }
}

/**
 * Compares the blocks in two equally sized volumes. Succeeds if both are identical.
 *
 * @param start Positions of the first diagonal corner of the source volume (the comparand; the volume to compare).
 *
 * @param end Positions of the second diagonal corner of the source volume (the comparand; the volume to compare)
 *
 * @param destination
 * Position of the lower northwest (the smallest X, Y and Z value) corner of the destination volume
 * (the comparator; the volume to compare to). Assumed to be of the same size as the source volume.
 *
 * @param scanMode Specifies whether all blocks in the source volume should be compared, or if air blocks should be masked/ignored.
 */
export function Blocks(start: Coordinates<false> = '~ ~ ~', end: Coordinates<false> = '~ ~ ~', destination: Coordinates<false> = '~ ~ ~', scanMode: 'all' | 'masked' = 'all') {
    return new IfBlocksConditionClass(sandstonePack.core, start, end, destination, scanMode)
}

export type BlockSet = typeof BlockSetClass

export const defaultBlocks = BlockSet(BLOCK_NAMES)

export const Block = defaultBlocks.Block