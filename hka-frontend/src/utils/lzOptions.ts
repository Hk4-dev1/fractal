import { ethers } from 'ethers'

export function buildLzV2OptionsLzReceiveGas(gas: bigint = 350_000n) {
  const TYPE3 = 3n
  const WORKER_EXECUTOR_ID = 1n
  const OPTTYPE_LZRECEIVE = 1n
  const opt = ethers.solidityPacked(['uint128'], [gas])
  const optBytes = ethers.getBytes(opt)
  const size = 1 + optBytes.length
  const header = ethers.getBytes(ethers.solidityPacked(['uint16'], [TYPE3]))
  const execChunk = ethers.getBytes(
    ethers.solidityPacked(['uint8', 'uint16', 'uint8'], [WORKER_EXECUTOR_ID, BigInt(size), OPTTYPE_LZRECEIVE]),
  )
  return ethers.hexlify(ethers.concat([header, execChunk, optBytes]))
}
