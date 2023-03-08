import { readdir, readFile, mkdir, writeFile } from 'fs/promises'
import cliProgress from 'cli-progress'
import sharp from 'sharp'
import keccak256 from 'keccak256'
import inquirer from 'inquirer'
import { validate } from 'validate-typescript'
import type { Command } from '../../types'
import { IpfsUrl } from '../../common/validators'
import chalk from 'chalk'
import path from 'path'

type OpenSeaMetadataAttribute = {
  display_type?: string
  trait_type: string
  value: number | string
}

type OpenSeaMetadata = {
  name: string
  description?: string
  image: string
  image_data?: string
  external_url?: string
  background_color?: string
  animation_url?: string
  youtube_url?: string
  attributes?: OpenSeaMetadataAttribute[]
}

type OpenSeaToken = {
  file: string
  index: number
  metadata: OpenSeaMetadata
}

type MediaCategory = 'image' | 'asset' | 'icon'

type MediaFileInfo = {
  file: string
  category: MediaCategory
  index: number
  extension: string
}

const tokenMetadataNamePattern = /^(\d+)\.json$/

// [category]-[index].[extension]
const mediaNamePattern = /^(?:(image|asset|icon)-)?(\d+)\.([a-z]+)$/
const isImageTypeSupported = (extension: string) => ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(extension)

const readMetadataDir = async (dir: string) => {
  try {
    const result: OpenSeaToken[] = []
    const files = await readdir(dir)
    for (const file of files) {
      const metadataFile = path.normalize(path.join(dir, file))
      const info = tokenMetadataNamePattern.exec(path.basename(metadataFile))
      if (info) {
        try {
          const data = await readFile(metadataFile, 'utf-8')
          const metadata = JSON.parse(data)
          if (!metadata?.name || !metadata?.image) {
            console.warn(chalk.yellowBright(`Token is missing name and/or image: ${metadataFile}`))
          } else {
            result.push({
              index: Number(info[1]),
              file: metadataFile,
              metadata,
            })
          }
        } catch {
          throw new Error(`Failed to read token: ${metadataFile}`)
        }
      }
    }
    return result
  } catch (e) {
    console.error(e)
    throw new Error(`Failed to read tokens from metadata directory: ${dir}`)
  }
}

const parseMediaFile = (file: string): MediaFileInfo | undefined => {
  const info = mediaNamePattern.exec(path.basename(file))
  if (info) {
    let category = info[1] as MediaCategory
    const index = Number(info[2])
    const extension = info[3]
    if (!category) {
      if (isImageTypeSupported(extension)) {
        category = 'image'
      } else {
        console.warn(chalk.yellowBright(`Unsupported image file type '${extension}': ${file}`))
        return
      }
    }
    return { file, category, index, extension }
  }
}

const readMediaDir = async (dir: string) => {
  try {
    const files = await readdir(dir)
    const result: MediaFileInfo[] = []
    for (const file of files) {
      const mediaFile = path.normalize(path.join(dir, file))
      const info = parseMediaFile(mediaFile)
      if (info) {
        result.push(info)
      }
    }
    return result
  } catch (e) {
    console.error(e)
    throw new Error(`Failed to read media from directory: ${dir}`)
  }
}

const buildFileInfo = async ({
  info,
  baseUri,
} : {
  info: MediaFileInfo
  baseUri: string
}) => {
  if (info.category === 'image') {
    const image = sharp(info.file)
    const imageInfo = await image.metadata()
    if (!imageInfo.width || !imageInfo.height) {
      throw new Error(`Failed to read image: ${info.file}`)
    }
    const content = await readFile(info.file)
    const hash = `0x${keccak256(content).toString('hex')}`
    return {
      width: imageInfo.width,
      height: imageInfo.height,
      hashFunction: 'keccak256(bytes)',
      hash,
      url: `${baseUri}/${info.index}.${info.extension}`,
    }
  }
}

const buildMetadata = async ({
  outputDir,
  baseUri,
  links,
  openSeaTokens,
  mediaFiles,
} : {
  outputDir: string
  baseUri: string
  links?: {
    title: string
    url: string
  }[]
  openSeaTokens?: OpenSeaToken[]
  mediaFiles?: MediaFileInfo[]
}) => {
  await mkdir(outputDir, { recursive: true })

  const progress = new cliProgress.SingleBar({
    format: `${chalk.bold.blueBright('Building')} {bar} | ${chalk.bold.greenBright('{percentage}%')} | {value}/${chalk.bold('{total}')}`,
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
  })

  try {
    if (openSeaTokens) {
      progress.start(openSeaTokens.length, 0)

      for (const token of openSeaTokens) {
        const file = path.normalize(path.join(outputDir, `${token.index}.json`))

        const attributes = token.metadata.attributes?.map((attribute) => ({
          key: attribute.trait_type,
          value: attribute.value,
        }))

        const iconInfo = mediaFiles ?.find((info) => info.index === token.index && info.category === 'icon')
        const icon = iconInfo ? await buildFileInfo({
          baseUri,
          info: iconInfo,
        }) : undefined

        const imageJobs = mediaFiles
          ?.filter((info) => info.index === token.index && info.category === 'image')
          ?.map((info) => buildFileInfo({ baseUri, info }))
        const images = imageJobs ? [await Promise.all(imageJobs)] : undefined

        const metadata = {
          LSP4Metadata: {
            name: token.metadata.name,
            description: token.metadata.description,
            attributes,
            icon,
            images,
            links,
          },
        }

        const data = JSON.stringify(metadata)
        await writeFile(file, data, 'utf-8')
        progress.increment()
      }
    }
  } finally {
    progress.stop()
  }
}

const command: Command = {
  name: 'generate metadata',
  invoke: async () => {
    console.log('Before generating metadata for your NFT, please ensure that you have uploaded all necessary images and assets to IPFS.')
    console.log('Once uploaded, you will need to have the IPFS hashes for each file.')
    console.log()

    const { didUploadToIpfs } = await inquirer.prompt({
      type: 'confirm',
      name: 'didUploadToIpfs',
      message: 'Are you ready to generate metadata for your NFT?',
      default: true,
    })
    if (!didUploadToIpfs) {
      return
    }

    const { baseUri, mediaDir, metadataDir } = await inquirer.prompt([
      {
        type: 'input',
        name: 'baseUri',
        message: 'Enter a IPFS url containing media (images, video, etc.):',
        validate: (input) => {
          try {
            validate(
              { baseUri: IpfsUrl() },
              { baseUri: input },
            )
            return true
          } catch (e) {
            return 'Invalid IPFS URL. Please enter a valid IPFS URL, e.g. ipfs://bafybeiesesamfxkgronf4pf4maauei6svfas4vvzlhm7o4kzwnvbb3h5i4'
          }
        },
      },
      {
        type: 'input',
        name: 'mediaDir',
        message: `Enter a directory containing media (images, videos, etc.) ${chalk.yellowBright('[optional]')}:`,
      },
      {
        type: 'input',
        name: 'metadataDir',
        message: `Enter a directory containing metadata (json) ${chalk.yellowBright('[optional]')}:`,
      },
    ])

    const links: {
      title: string
      url: string
    }[] = []

    for (;;) {
      const { addLink } = await inquirer.prompt({
        type: 'confirm',
        name: 'addLink',
        message: 'Would you like to add a link to each NFT?',
        default: false,
      })
      if (!addLink) {
        break
      }
      const { title, url } = await inquirer.prompt([
        {
          type: 'input',
          name: 'title',
          message: 'Enter a title of the link, e.g. Twitter:',
          validate: (input) => input?.length > 0,
        },
        {
          type: 'input',
          name: 'url',
          message: 'Enter a URL of the link, e.g. https://twitter.com/_universalpage:',
          validate: (input) => input?.length > 0,
        },
      ])
      links.push({ title: title.trim(), url: url.trim() })
    }

    const outputDir = path.join(__dirname, '../../../build', String(Date.now()))

    try {
      const openSeaTokens = await readMetadataDir(metadataDir.trim())
      const mediaFiles = await readMediaDir(mediaDir.trim())

      console.log()
      await buildMetadata({
        baseUri: baseUri.trim(),
        outputDir,
        openSeaTokens,
        mediaFiles,
        links,
      })
      console.log(chalk.bold.greenBright('Done!'))
      console.log()

      console.log('Token metadata is built and available for upload:')
      console.log(outputDir)
      console.log()
    } catch (e: any) {
      console.log()
      console.error(chalk.redBright(e.message ?? 'Something went wrong'))
      console.log()
    }
  },
}

export default command
