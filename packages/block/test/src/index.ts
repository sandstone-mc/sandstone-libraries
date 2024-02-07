import { defaultBlocks } from '@sandstone-mc/block'
import { MCFunction, Variable, execute, sandstonePack } from 'sandstone'


MCFunction('test', () => {
    const test = Variable()
    
    //execute.store.result.score(test).run(() => Block().to('num'))

    //defaultBlocks.from('num', test, 'world')

    defaultBlocks.from('nbt', {}, 'num')
})

export default sandstonePack