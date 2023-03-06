import type { Command } from '../types'

const command: Command = {
  name: 'quit',
  invoke: async () => {
    process.exit(0)
  },
}

export default command
