import { describe, it, expect } from 'vitest'
import { decodeEventLog, parseAbi, encodeAbiParameters, keccak256, toBytes, toHex, padHex } from 'viem'

// Event: OrderCreated(uint256 indexed id, address indexed maker, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint64 dstEid)
const EVENT_SIGNATURE = 'OrderCreated(uint256,address,address,address,uint256,uint256,uint64)'
const EVENT_TOPIC0 = keccak256(toBytes(EVENT_SIGNATURE))

const abi = parseAbi([
  'event OrderCreated(uint256 indexed id, address indexed maker, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint64 dstEid)'
])

describe('OrderCreated event decoding', () => {
  it('decodes a fabricated log correctly', () => {
    const id = 123456789n
    const maker: `0x${string}` = '0x0000000000000000000000000000000000000AaA'
    const tokenIn: `0x${string}` = '0x0000000000000000000000000000000000000bBb'
    const tokenOut: `0x${string}` = '0x0000000000000000000000000000000000000cCc'
    const amountIn = 10_000000000000000000n
    const minAmountOut = 0n
    const dstEid = 101n

    const topicId = padHex(toHex(id), { size: 32 })
    const topicMaker = padHex(maker, { size: 32 })

    const data = encodeAbiParameters([
      { type: 'address' },
      { type: 'address' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint64' }
    ], [tokenIn, tokenOut, amountIn, minAmountOut, dstEid])

    const decoded = decodeEventLog({
      abi,
      data: data as `0x${string}`,
      topics: [EVENT_TOPIC0, topicId, topicMaker]
    })

    expect(decoded.eventName).toBe('OrderCreated')
    const { id: id2, maker: maker2, tokenIn: tokenIn2, tokenOut: tokenOut2, amountIn: amountIn2, minAmountOut: minAmountOut2, dstEid: dstEid2 } = decoded.args as unknown as {
      id: bigint; maker: `0x${string}`; tokenIn: `0x${string}`; tokenOut: `0x${string}`; amountIn: bigint; minAmountOut: bigint; dstEid: bigint
    }
    expect(id2).toEqual(id)
    expect(maker2.toLowerCase()).toBe(maker.toLowerCase())
    expect(tokenIn2.toLowerCase()).toBe(tokenIn.toLowerCase())
    expect(tokenOut2.toLowerCase()).toBe(tokenOut.toLowerCase())
    expect(amountIn2).toEqual(amountIn)
    expect(minAmountOut2).toEqual(minAmountOut)
    expect(dstEid2).toEqual(dstEid)
  })

  it('throws on incorrect signature topic', () => {
    const badTopic0 = keccak256(toBytes('OrderCreated(uint256,address)'))
    const id = 1n
    const maker: `0x${string}` = '0x0000000000000000000000000000000000000001'
    const topicId = padHex(toHex(id), { size: 32 })
    const topicMaker = padHex(maker, { size: 32 })
    const data = encodeAbiParameters([
      { type: 'address' },
      { type: 'address' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint64' }
    ], [maker, maker, 0n, 0n, 0n])
    expect(() => decodeEventLog({ abi, data: data as `0x${string}`, topics: [badTopic0, topicId, topicMaker] })).toThrow()
  })
})