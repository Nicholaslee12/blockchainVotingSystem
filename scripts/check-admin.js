const { ethers } = require('hardhat')
const fs = require('fs')
const path = require('path')

async function main() {
  // Check if contractAddress.json exists
  const contractAddressPath = path.join(__dirname, '../artifacts/contractAddress.json')
  
  if (!fs.existsSync(contractAddressPath)) {
    console.log('❌ Contract address file not found!')
    console.log('')
    console.log('💡 You need to deploy the contract first:')
    console.log('   1. Make sure Hardhat node is running: npx hardhat node')
    console.log('   2. Deploy the contract: npx hardhat run scripts/deploy-with-account.js --network localhost')
    process.exit(1)
  }
  
  const address = JSON.parse(fs.readFileSync(contractAddressPath, 'utf8'))
  const abi = require('../artifacts/contracts/DappVotes.sol/DappVotes.json')
  
  const contractAddress = address.address
  const [signer] = await ethers.getSigners()
  
  console.log('🔍 Checking Admin Status...\n')
  console.log('Contract Address:', contractAddress)
  console.log('Connected Account:', signer.address)
  console.log('')
  
  const contract = new ethers.Contract(contractAddress, abi.abi, signer)
  
  try {
    // Get owner
    const owner = await contract.owner()
    console.log('👤 Contract Owner:', owner)
    console.log('')
    
    // Check if connected account is owner
    const isOwner = owner.toLowerCase() === signer.address.toLowerCase()
    console.log('✅ Is Connected Account the Owner?', isOwner)
    console.log('')
    
    // Check admin status for connected account
    const isAdmin = await contract.isAdmin(signer.address)
    console.log('✅ Is Connected Account an Admin?', isAdmin)
    console.log('')
    
    // Check admin status for the known admin address
    const knownAdmin = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
    const isKnownAdmin = await contract.isAdmin(knownAdmin)
    console.log('✅ Is', knownAdmin, 'an Admin?', isKnownAdmin)
    console.log('')
    
    if (!isOwner && !isAdmin) {
      console.log('❌ PROBLEM: Your connected account is NOT the owner or an admin!')
      console.log('')
      console.log('💡 SOLUTION:')
      console.log('1. Make sure Hardhat node is running: npx hardhat node')
      console.log('2. Deploy with your admin account: npx hardhat run scripts/deploy-with-account.js --network localhost')
      console.log('3. Make sure MetaMask is connected to the same account that deployed the contract')
    } else {
      console.log('✅ SUCCESS: Your account has admin privileges!')
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.message.includes('is not a function')) {
      console.log('')
      console.log('💡 The contract does not have admin functions. You need to redeploy with the latest code.')
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

