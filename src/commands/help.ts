import chalk from 'chalk'
import type { Command } from '../types'

const command: Command = {
  name: 'help',
  invoke: async () => {
    console.log('Here is a list of supported commands:')
    console.log(`${chalk.bold.blueBright('generate metadata')}: generate metadata for an NFT using LSP7 or LSP8 standards`)
    console.log(`${chalk.bold.blueBright('quit')}: quit CLI`)
    console.log(`${chalk.bold.blueBright('help')}: display help information for a command`)
    console.log()
  },
}

export default command
