#!/usr/bin/env node
import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true })
import { checkPeers, setPeer, listChains } from './lz-utils.mjs'

const [,, cmd, ...args] = process.argv

async function main() {
  if (!cmd || cmd === 'help') {
    console.log('Usage: node scripts/lz-configure.mjs <command>')
    console.log('Commands:')
    console.log('  list                          # list chains and routers')
    console.log('  check                         # show current peers matrix')
    console.log('  set <from> <to> <PRIVATE_KEY> # setPeer on <from> router to trust <to> router')
    process.exit(0)
  }
  if (cmd === 'list') {
    console.table(listChains())
    return
  }
  if (cmd === 'check') {
    const rows = await checkPeers()
    console.dir(rows, { depth: 5 })
    return
  }
  if (cmd === 'set') {
  const [from, to, pkArg] = args
  if (!from || !to) throw new Error('Missing args: set <from> <to> [<PRIVATE_KEY>]')
  const raw = (pkArg || process.env.PRIVATE_KEY || '').trim()
  const pk = raw ? (raw.startsWith('0x') ? raw : `0x${raw}`) : ''
  if (!pk || pk.length < 66) throw new Error('Missing/invalid PRIVATE_KEY. Provide as 3rd arg or set in your .env')
  const hash = await setPeer({ from, to, pk })
    console.log('setPeer tx:', hash)
    return
  }
  throw new Error(`Unknown command: ${cmd}`)
}

main().catch(e => { console.error(e); process.exit(1) })
