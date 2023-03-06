import figlet from 'figlet'
import chalk from 'chalk'
import inquirer from 'inquirer'
import { help, quit, generateMetadata } from './commands'
import { Command } from './types'

console.log(chalk.bold.blueBright(figlet.textSync('UniversalPage')))

const commands: Record<string, Command> = Object.fromEntries(
  [
    help,
    quit,
    generateMetadata,
  ].map((command) =>[command.name, command]),
)

const main = async () => {
  console.log(chalk.bold('Welcome to the UniversalPage CLI!'))
  console.log()
  console.log('This CLI provides a guided interface to configure and manage your NFTs on the UniversalPage marketplace.')
  console.log('You can use this tool to create new NFTs, manage existing ones, and generate metadata using LSP7 and LSP8 standards.')
  console.log('Thank you for using the UniversalPage NFT CLI!')
  console.log()

  for (;;) {
    const { name } = await inquirer.prompt({
      type: 'input',
      name: 'name',
      message: 'Enter a command:',
      default: 'help',
    })
    const command = commands[name]
    if (command) {
      await command.invoke()
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
