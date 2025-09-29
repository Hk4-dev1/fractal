import { solidityPacked, getBytes, hexlify, concat } from '../../services/viemAdapter'

export function buildLzV2OptionsLzReceiveGas(gas: bigint = 400_000n) {
  const TYPE3 = 3n
  const WORKER_EXECUTOR_ID = 1n
  const OPTTYPE_LZRECEIVE = 1n
  const opt = solidityPacked(['uint128'], [gas])
  const optBytes = getBytes(opt)
  const size = 1 + optBytes.length
  const header = getBytes(solidityPacked(['uint16'], [TYPE3]))
  const execChunk = getBytes(
    solidityPacked(['uint8', 'uint16', 'uint8'], [WORKER_EXECUTOR_ID, BigInt(size), OPTTYPE_LZRECEIVE]),
  )
  return hexlify(concat([header, execChunk, optBytes]))
}
