import { Argv } from 'yargs'

const command = 'dropsImport'
const aliases = ['di']
const desc = 'prepare tokens for import'
const usage = 'usage: $0 drops import [options]'

const builder = (builder: Argv) => builder
  .option('metadataDir', {
    type: 'string',
    describe: 'directory containing tokens metadata. e.g. 1.json, 2.json, etc.',
  })
  .option('mediaDir', {
    type: 'string',
    describe: 'directory containing tokens media (images, videos, 3d assets, etc.)',
    demandOption: true,
  })
  .option('outDir', {
    type: 'string',
    requiresArg: true,
    describe: 'output directory where generated tokens are placed',
    demandOption: true,
  })

const handler = (argv: any) => {
  console.log('import', argv)
}

export default {
  command,
  aliases,
  desc,
  usage,
  builder,
  handler,
}
