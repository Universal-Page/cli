import { Validator } from 'validate-typescript'
import * as assert from 'validate-typescript/lib/assertions'

const uriPattern = /ipfs:\/\/(Qm[1-9A-HJ-NP-Za-km-z]{44,}|b[A-Za-z2-7]{58,}|B[A-Z2-7]{58,}|z[1-9A-HJ-NP-Za-km-z]{48,}|F[0-9A-F]{50,})/

export const IpfsUrl = () => Validator((input: any): string => {
  assert.isString(input)
  const uri = uriPattern.exec(input)
  if (!uri) {
    throw new Error('not ipfs url')
  }
  return input
}, 'IpfsUrl')
