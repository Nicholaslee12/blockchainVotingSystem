const { ethers } = require('hardhat')
const fs = require('fs');

// Hardhat default accounts (for localhost)
// Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
// Account #1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (Your admin address)
// Account #2: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC

async function main() {
  // Get all signers
  const signers = await ethers.getSigners();
  
  // Use account #1 (0x70997970C51812dc3A010C7d01b50e0d17dc79C8) as deployer
  const deployer = signers[1]; // Index 1 = second account
  
  console.log('Deploying contract with account:', deployer.address);
  console.log('Account balance:', ethers.utils.formatEther(await deployer.getBalance()), 'ETH');
  
  // Match the Solidity contract name inside DappVotes.sol
  const Contract = await ethers.getContractFactory('DappVotes', deployer);
  console.log('Deploying contract...');
  const contract = await Contract.deploy();

  // Get transaction hash before waiting for deployment
  const deployTx = contract.deployTransaction;
  console.log('\n📝 Transaction Hash:', deployTx.hash);
  
  // Get network info for explorer URL
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;
  
  // Get explorer URL based on chain ID
  let explorerUrl = '';
  if (chainId === 1n) {
    explorerUrl = 'https://etherscan.io/tx/';
  } else if (chainId === 11155111n) {
    explorerUrl = 'https://sepolia.etherscan.io/tx/';
  } else if (chainId === 5n) {
    explorerUrl = 'https://goerli.etherscan.io/tx/';
  } else {
    explorerUrl = `http://localhost:8545/tx/`; // For localhost
  }
  
  console.log('🔗 View on Explorer:', explorerUrl + deployTx.hash);
  console.log('⏳ Waiting for deployment confirmation...');

  //Wait until the blockchain confirms the contract is created."
  await contract.deployed();

  //It converts the contract address into a clean, readable JSON string.Example:"address": "0xABC123..."}
  const address=JSON.stringify({address: contract.address}, null, 4);

  //used to create or overwrite a file.
  //This is the file path where you want to save your JSON file.
  //This tells Node.js to save the file using UTF-8 encoding, which is standard text format.
  fs.writeFile('./artifacts/contractAddress.json', address, 'utf8',(err) => {
    if (err) {
      console.error(err)
      return
    }
    console.log('\n✅ Deployment successful!');
    console.log('📍 Contract Address:', contract.address);
    console.log('👤 Deployed by (Owner/Admin):', deployer.address);
    console.log('📝 Transaction Hash:', deployTx.hash);
    console.log('🔗 View on Explorer:', explorerUrl + deployTx.hash);
    console.log('\n💡 Note: The deployer address is automatically set as the contract owner and initial admin.');
    console.log('✅ You can now use this address to add/remove admins!');
  })
}

// Run the script
main().catch((error) => {
    console.error(error);
    process.exitCode(1);
  });

