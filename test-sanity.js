// Quick test script to verify Sanity connection
import { createClient } from '@sanity/client'
import dotenv from 'dotenv'

dotenv.config()

const client = createClient({
  projectId: process.env.VITE_SANITY_PROJECT_ID,
  dataset: process.env.VITE_SANITY_DATASET,
  useCdn: false,
  apiVersion: process.env.VITE_SANITY_API_VERSION,
  token: process.env.VITE_SANITY_TOKEN
})

async function testConnection() {
  console.log('🔍 Testing Sanity connection...\n')
  
  try {
    // Test 1: Fetch registry items
    console.log('Test 1: Fetching registry items...')
    const items = await client.fetch(`*[_type == "registryItem"] | order(itemId) {
      _id,
      itemId,
      name,
      type,
      goal
    }`)
    console.log(`✅ Found ${items.length} registry items`)
    console.log('Sample items:', items.slice(0, 3).map(i => `${i.itemId}: ${i.name}`))
    
    // Test 2: Fetch claims
    console.log('\nTest 2: Fetching claims...')
    const claims = await client.fetch(`*[_type == "claim"] {
      _id,
      guestName,
      claimType,
      amount
    }`)
    console.log(`✅ Found ${claims.length} claims`)
    
    // Test 3: Test query with claims
    console.log('\nTest 3: Fetching items with claims...')
    const itemsWithClaims = await client.fetch(`*[_type == "registryItem"][0..2] {
      itemId,
      name,
      "claims": *[_type == "claim" && references(^._id)] {
        guestName,
        claimType,
        amount
      }
    }`)
    console.log('✅ Query successful')
    console.log('Sample:', itemsWithClaims[0])
    
    console.log('\n🎉 All tests passed! Sanity is connected and working.')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    process.exit(1)
  }
}

testConnection()
