#!/usr/bin/env node
import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true })
import { checkPeers } from './lz-utils.mjs'

const rows = await checkPeers()
console.log(JSON.stringify(rows, null, 2))
