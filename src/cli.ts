import yargs from 'yargs'
import dropsImport from './commands/drops/import'

const cli = yargs(process.argv.slice(2))
  .scriptName('upage')
  .usage('Usage: $0 <command>')
  .command(dropsImport)
  .wrap(null)
  .help('h')
  .alias('h', 'help')

cli.argv
