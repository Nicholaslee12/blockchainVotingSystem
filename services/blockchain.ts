import { ethers } from 'ethers';
import address from '@/artifacts/contractAddress.json'
import abi from '@/artifacts/contracts/DappVotes.sol/DappVotes.json'
import { globalActions } from '@/store/globalSlices';
import { store } from '@/store';
import { ContestantStruct, PollParams, PollStruct } from '@/utils/types';
import { fetchElectionPublicKey, encryptVoteClientSide } from '@/utils/crypto';

//address is probably an imported object from your project that holds your smart contract address.
//.address extracts the actual Ethereum contract address (string).
const { setWallet, setPolls, setPoll, setContestants } = globalActions
const ContractAddress = address.address
const ContractAbi = abi.abi
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545'
let ethereum: any

//window only exists in the browser.
//So if you try to access window.ethereum on the server:You’ll get an error.
//Meaning typeof window !== 'undefined', it checks if the code is running in the browser.
//(window as any) is TypeScript syntax to bypass type checking because window.ethereum is not typed by default.
if (typeof window !== 'undefined') ethereum = (window as any).ethereum

const connectWallet = async () => {
    try {
        if (!ethereum) return reportError('Please install Metamask')
        const accounts = await ethereum.request?.({ method: 'eth_requestAccounts' })
        store.dispatch(setWallet(accounts[0]))
    } catch (error) {
        reportError(error)
    }
}

const checkWallet = async () => {
    try {
        if (!ethereum) return reportError('Please install Metamask')
        //use ?.If accounts is undefined → accounts?.[0] becomes undefined safely
        //if not using the ?. and TypeError would occur when trying to access [0] of undefined.
        const accounts = await ethereum.request?.({ method: 'eth_accounts' })

        //If the user switches to a different blockchain network in MetaMask, 
        //the page automatically reloads so the app can recognize the new network.
        ethereum.on('chainChanged', () => {
            window.location.reload()
        })

        //Update the app state whenever the user switches accounts in MetaMask.
        ethereum.on('accountsChanged', (newAccounts: string[]) => {
            if (newAccounts.length === 0) {
                // No account connected
                store.dispatch(setWallet(''))
                reportError('Please connect wallet, no accounts found')
            } else {
                // Update Redux with the new account
                store.dispatch(setWallet(newAccounts[0]))
                // Optionally refresh the page if needed
                window.location.reload()
            }
        })

        if (accounts?.length) {
            //If the user has connected at least one wallet, store the first wallet in Redux
            store.dispatch(setWallet(accounts?.[0]))
        } else {
            //store an empty string to indicate no wallet is connected.
            store.dispatch(setWallet(''))
            reportError('Please connect wallet,no accounts found')
        }

    } catch (error) {
        reportError(error)
    }
}




//It is a function that prepares and returns a connection to your smart contract on the Ethereum blockchain.
const ensureWalletConnected = async () => {
    if (!ethereum) {
        throw new Error('Please install Metamask')
    }

    let accounts = await ethereum.request?.({ method: 'eth_accounts' })

    if (!accounts?.length) {
        accounts = await ethereum.request?.({ method: 'eth_requestAccounts' })
    }

    if (!accounts?.length) {
        throw new Error('Please connect wallet')
    }

    return accounts
}

const getBlockchainContract = (signerOrProvider: ethers.Signer | ethers.providers.Provider) => {
    return new ethers.Contract(ContractAddress, ContractAbi, signerOrProvider)
}

const getEthereumContract = async () => {
    const accounts = await ensureWalletConnected()
    const provider = new ethers.providers.Web3Provider(ethereum)
    const signer = provider.getSigner(accounts[0])
    return getBlockchainContract(signer)
}

// Helper function to get blockchain explorer URL based on chain ID
const getExplorerUrl = (chainId: number): string => {
    switch (chainId) {
        case 1:
            return 'https://etherscan.io/tx/'
        case 11155111:
            return 'https://sepolia.etherscan.io/tx/'
        case 5:
            return 'https://goerli.etherscan.io/tx/'
        case 31337: // Hardhat local
        default:
            return 'http://localhost:8545/tx/'
    }
}

// Helper function to get current network chain ID
const getCurrentChainId = async (): Promise<number> => {
    if (!ethereum) return 0
    try {
        const chainId = await ethereum.request({ method: 'eth_chainId' })
        return parseInt(chainId, 16)
    } catch (error) {
        console.error('Error getting chain ID:', error)
        return 0
    }
}

const getReadOnlyContract = () => {
    const provider =
        typeof window === 'undefined' || !ethereum
            ? new ethers.providers.JsonRpcProvider(RPC_URL)
            : new ethers.providers.Web3Provider(ethereum)
    return getBlockchainContract(provider)
}

const createPoll = async (data: PollParams) => {
    if (!ethereum) {
        reportError('Please install Metamask')
        return Promise.reject(new Error('Metamask not installed'))
    }
    try {
        const contract = await getEthereumContract()
        const { image, title, description, startsAt, endsAt } = data
        //Calls the smart contract's createPoll function on the blockchain, passing the poll info
        const tx = await contract.createPoll(image, title, description, startsAt, endsAt)

        const chainId = await getCurrentChainId()
        const explorerUrl = getExplorerUrl(chainId)
        
        console.log('📝 Transaction Hash:', tx.hash)
        console.log('🔗 View on Explorer:', explorerUrl + tx.hash)

        await tx.wait() //comfirmed before it processds further

        const polls = await getPolls()
        store.dispatch(setPolls(polls))

        // Return transaction with hash and explorer URL
        return Promise.resolve({
            ...tx,
            hash: tx.hash,
            explorerUrl: explorerUrl + tx.hash
        })
    } catch (error) {
        const message = reportError(error)
        return Promise.reject(new Error(message))
    }
}

const updatePoll = async (id: number, data: PollParams) => {
    if (!ethereum) {
        reportError('Please install Metamask')
        return Promise.reject(new Error('Metamask not installed'))
    }
    try {
        const contract = await getEthereumContract()
        const { image, title, description, startsAt, endsAt } = data
        //Calls the smart contract's updatePoll function on the blockchain, passing the poll info
        const tx = await contract.updatePoll(id, image, title, description, startsAt, endsAt)

        const chainId = await getCurrentChainId()
        const explorerUrl = getExplorerUrl(chainId)
        
        console.log('📝 Transaction Hash:', tx.hash)
        console.log('🔗 View on Explorer:', explorerUrl + tx.hash)

        await tx.wait() //comfirmed before it processds further

        const poll = await getPoll(id)
        store.dispatch(setPoll(poll))

        // Also refresh the polls list to update the home page
        const polls = await getPolls()
        store.dispatch(setPolls(polls))

        // Return transaction with hash and explorer URL
        return Promise.resolve({
            ...tx,
            hash: tx.hash,
            explorerUrl: explorerUrl + tx.hash
        })
    } catch (error) {
        const message = reportError(error)
        return Promise.reject(new Error(message))
    }
}

const deletePoll = async (id: number) => {
    if (!ethereum) {
        reportError('Please install Metamask')
        return Promise.reject(new Error('Metamask not installed'))
    }
    try {
        const contract = await getEthereumContract()
        //Calls the smart contract's deletePoll function on the blockchain, passing the poll info
        const tx = await contract.deletePoll(id)

        const chainId = await getCurrentChainId()
        const explorerUrl = getExplorerUrl(chainId)
        
        console.log('📝 Transaction Hash:', tx.hash)
        console.log('🔗 View on Explorer:', explorerUrl + tx.hash)

        await tx.wait() //comfirmed before it processds further

        const poll = await getPoll(id)
        store.dispatch(setPoll(poll))

        // Return transaction with hash and explorer URL
        return Promise.resolve({
            ...tx,
            hash: tx.hash,
            explorerUrl: explorerUrl + tx.hash
        })
    } catch (error) {
        const message = reportError(error)
        return Promise.reject(new Error(message))
    }
}

const getPolls = async (): Promise<PollStruct[]> => {
    const contract = getReadOnlyContract()
    const polls = await contract.getPolls()
    const structuredPolls = structurePolls(polls)
    
    // Rebuild avatars from contestants for each poll since blockchain doesn't update avatars when contestants change
    const pollsWithRebuiltAvatars = await Promise.all(
        structuredPolls.map(async (poll) => {
            try {
                const contestants = await getContestants(poll.id)
                const rebuiltAvatars = contestants.map(c => c.image)
                return { ...poll, avatars: rebuiltAvatars }
            } catch (error) {
                console.error(`Error rebuilding avatars for poll ${poll.id}:`, error)
                return poll // Return original poll if error
            }
        })
    )
    
    return pollsWithRebuiltAvatars
}

const getPoll = async (id: number): Promise<PollStruct> => {
    const contract = getReadOnlyContract()
    const poll = await contract.getPoll(id)
    return structurePolls([poll])[0]
}

const contestPoll = async (id: number, name: string, image: string) => {
    if (!ethereum) {
        reportError('Please install Metamask')
        return Promise.reject(new Error('Metamask not installed'))
    }
    try {
        const contract = await getEthereumContract()
        //Calls the smart contract's contestPoll function on the blockchain, passing the poll info
        const tx = await contract.contest(id, name, image)

        const chainId = await getCurrentChainId()
        const explorerUrl = getExplorerUrl(chainId)
        
        console.log('📝 Transaction Hash:', tx.hash)
        console.log('🔗 View on Explorer:', explorerUrl + tx.hash)

        await tx.wait() //comfirmed before it processds further

        const poll = await getPoll(id)
        store.dispatch(setPoll(poll))

        const contestants = await getContestants(id)
        store.dispatch(setContestants(contestants))

        // Return transaction with hash and explorer URL
        return Promise.resolve({
            ...tx,
            hash: tx.hash,
            explorerUrl: explorerUrl + tx.hash
        })
    } catch (error) {
        const message = reportError(error)
        return Promise.reject(new Error(message))
    }
}

const updateContestant = async (
    pollId: number,
    contestantId: number,
    data: { name: string; image: string }
) => {
    if (!ethereum) {
        reportError('Please install Metamask')
        return Promise.reject(new Error('Metamask not installed'))
    }
    try {
        const contract = await getEthereumContract()
        const tx = await contract.updateContestant(pollId, contestantId, data.name, data.image)
        
        const chainId = await getCurrentChainId()
        const explorerUrl = getExplorerUrl(chainId)
        
        console.log('📝 Transaction Hash:', tx.hash)
        console.log('🔗 View on Explorer:', explorerUrl + tx.hash)
        
        await tx.wait()

        const poll = await getPoll(pollId)
        const contestants = await getContestants(pollId)
        
        // Rebuild avatars array from updated contestants since smart contract doesn't update it
        const updatedAvatars = contestants.map(c => c.image)
        const updatedPoll = { ...poll, avatars: updatedAvatars }
        
        store.dispatch(setPoll(updatedPoll))
        store.dispatch(setContestants(contestants))

        // Also refresh the polls list and update the specific poll's avatars
        const polls = await getPolls()
        // Update the specific poll in the list with rebuilt avatars
        const updatedPolls = polls.map(p => 
            p.id === pollId ? { ...p, avatars: updatedAvatars } : p
        )
        store.dispatch(setPolls(updatedPolls))

        // Return transaction with hash and explorer URL
        return Promise.resolve({
            ...tx,
            hash: tx.hash,
            explorerUrl: explorerUrl + tx.hash
        })
    } catch (error) {
        const message = reportError(error)
        return Promise.reject(new Error(message))
    }
}

const deleteContestant = async (pollId: number, contestantId: number) => {
    if (!ethereum) {
        reportError('Please install Metamask')
        return Promise.reject(new Error('Metamask not installed'))
    }
    try {
        const contract = await getEthereumContract()
        const tx = await contract.deleteContestant(pollId, contestantId)
        
        const chainId = await getCurrentChainId()
        const explorerUrl = getExplorerUrl(chainId)
        
        console.log('📝 Transaction Hash:', tx.hash)
        console.log('🔗 View on Explorer:', explorerUrl + tx.hash)
        
        await tx.wait()

        const poll = await getPoll(pollId)
        store.dispatch(setPoll(poll))

        const contestants = await getContestants(pollId)
        store.dispatch(setContestants(contestants))

        // Return transaction with hash and explorer URL
        return Promise.resolve({
            ...tx,
            hash: tx.hash,
            explorerUrl: explorerUrl + tx.hash
        })
    } catch (error) {
        const message = reportError(error)
        return Promise.reject(new Error(message))
    }
}

const voteCandidate = async (id: number, cid: number) => {
    if (!ethereum) {
        reportError('Please install Metamask')
        return Promise.reject(new Error('Metamask not installed'))
    }
    try {
        // Get current voter address from MetaMask
        const accounts = await ethereum.request?.({ method: 'eth_accounts' })
        const voterAddress: string | undefined = accounts?.[0]

        if (!voterAddress) {
            return Promise.reject(new Error('No connected wallet found for encryption'))
        }

        // 1) Fetch RSA public key for this election from backend
        const publicKeyPem = await fetchElectionPublicKey()

        // 2) Encrypt vote details client-side (AES-GCM + RSA-OAEP hybrid)
        const encryptedPayload = await encryptVoteClientSide(
            {
                pollId: id,
                contestantId: cid,
                voter: voterAddress.toLowerCase(),
            },
            publicKeyPem
        )

        // 3) Send encrypted vote to backend (MySQL) for immutable storage
        await fetch('/api/votes/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                pollId: id,
                contestantId: cid,
                voterAddress,
                payload: encryptedPayload,
            }),
        })

        // 4) Proceed with on-chain vote as before
        const contract = await getEthereumContract()
        //Calls the smart contract's contestPoll function on the blockchain, passing the poll info
        const tx = await contract.vote(id, cid)

        const chainId = await getCurrentChainId()
        const explorerUrl = getExplorerUrl(chainId)
        
        console.log('📝 Transaction Hash:', tx.hash)
        console.log('🔗 View on Explorer:', explorerUrl + tx.hash)

        await tx.wait() //comfirmed before it processds further

        // Get updated poll and contestant data after voting
        const updatedPoll = await getPoll(id)
        const updatedContestants = await getContestants(id)
        const votedContestant = updatedContestants.find(c => Number(c.id) === cid)

        // Store vote record in localStorage immediately to preserve it even if poll is deleted
        // Use wallet-specific storage so each account has its own vote history
        if (typeof window !== 'undefined' && updatedPoll && votedContestant && voterAddress) {
          try {
            const walletKey = `userVoteRecords_${voterAddress.toLowerCase()}`
            const existingVotes = JSON.parse(localStorage.getItem(walletKey) || '[]')
            const voteRecord = {
              poll: updatedPoll,
              contestant: votedContestant,
            }
            
            // Check if vote record already exists for this poll
            const existingIndex = existingVotes.findIndex((v: any) => v.poll?.id === id)
            if (existingIndex >= 0) {
              // Update existing record
              existingVotes[existingIndex] = voteRecord
            } else {
              // Add new record
              existingVotes.push(voteRecord)
            }
            
            localStorage.setItem(walletKey, JSON.stringify(existingVotes))
          } catch (err) {
            console.error('Failed to store vote record in localStorage:', err)
            // Don't fail the vote if localStorage storage fails
          }
        }

        // Get transaction receipt to get from/to addresses and timestamp
        try {
          const receipt = await contract.provider.getTransactionReceipt(tx.hash)
          const contractAddress = contract.address
          const fromAddress = receipt?.from || voterAddress
          let timestamp = Date.now() // Default to current time
          
          if (receipt?.blockNumber) {
            const block = await contract.provider.getBlock(receipt.blockNumber)
            timestamp = (block?.timestamp || 0) * 1000 // Convert to milliseconds
          }

          // Store transaction details in database
          await fetch('/api/votes/store-transaction', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                  pollId: id,
                  voterAddress,
                  transactionHash: tx.hash,
                  fromAddress,
                  toAddress: contractAddress,
                  timestamp,
              }),
          }).catch(err => {
              console.error('Failed to store transaction details:', err)
              // Don't fail the vote if transaction storage fails
          })
        } catch (err) {
          console.error('Failed to get transaction receipt:', err)
          // Still try to store with basic info
          try {
            await fetch('/api/votes/store-transaction', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    pollId: id,
                    voterAddress,
                    transactionHash: tx.hash,
                    fromAddress: voterAddress,
                    toAddress: contract.address,
                    timestamp: Date.now(),
                }),
            }).catch(() => {
                // Ignore errors
            })
          } catch (updateErr) {
            console.error('Failed to store transaction details:', updateErr)
          }
        }

        const poll = await getPoll(id)
        store.dispatch(setPoll(poll))

        const contestants = await getContestants(id)
        store.dispatch(setContestants(contestants))

        // Refresh the global polls list to update voting status in dashboard
        const polls = await getPolls()
        store.dispatch(setPolls(polls))

        // Return transaction with hash and explorer URL
        return Promise.resolve({
            ...tx,
            hash: tx.hash,
            explorerUrl: explorerUrl + tx.hash
        })
    } catch (error) {
        const message = reportError(error)
        return Promise.reject(new Error(message))
    }
}

const getContestants = async (id: number): Promise<ContestantStruct[]> => {
    const contract = getReadOnlyContract()
    const contestants = await contract.getContestants(id)
    return structureContestants(contestants)
}


const structureContestants = (contestants: ContestantStruct[]): ContestantStruct[] =>
    contestants
        .map((contestant) => ({
            id: Number(contestant.id),
            image: contestant.image,
            name: contestant.name,
            voter: contestant.voter.toLowerCase(),
            votes: Number(contestant.votes),
            voters: contestant.voters.map((voter: string) => voter.toLowerCase()),
            deleted: contestant.deleted,
        }))
        .filter((contestant) => !contestant.deleted)
        .sort((a, b) => b.votes - a.votes)//It’s a common pattern for ranking or leaderboards.

const structurePolls = (polls: any[]): PollStruct[] => {
    return polls.map((poll) => ({
        id: Number(poll.id),
        image: poll.image,
        title: poll.title,
        description: poll.description,
        votes: Number(poll.votes),
        contestants: Number(poll.contestants),
        deleted: poll.deleted,
        director: poll.director.toLowerCase(),
        startsAt: Number(poll.startsAt),
        endsAt: Number(poll.endsAt),
        timestamp: Number(poll.timestamp),
        voters: poll.voters.map((voter: string) => voter.toLowerCase()),
        avatars: poll.avatars,
    }))
        .sort((a, b) => b.timestamp - a.timestamp)

}

const stripRevertPrefix = (message: string) => {
    const prefixes = [
        'execution reverted: ',
        'Error: VM Exception while processing transaction: reverted with reason string ',
        'VM Exception while processing transaction: reverted with reason string ',
    ]

    let output = message
    prefixes.forEach((prefix) => {
        if (output.startsWith(prefix)) {
            output = output.slice(prefix.length)
        }
    })

    return output.trim()
}

const extractErrorMessage = (error: any): string | undefined => {
    if (!error) return undefined
    if (typeof error === 'string') return error

    const candidates = [
        error?.reason,
        error?.error?.reason,
        error?.data?.message,
        error?.error?.data?.message,
        error?.error?.data?.originalError?.message,
        error?.error?.data?.originalError?.error?.message,
        error?.message,
    ]

    for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim().length) {
            return stripRevertPrefix(candidate)
        }
    }

    return undefined
}

const reportError = (error: any) => {
    const parsedMessage = extractErrorMessage(error) || 'Unexpected error occurred'
    console.error('Blockchain error:', parsedMessage, error)
    return parsedMessage
}

// Get the contract owner address
const getContractOwner = async (): Promise<string | null> => {
    try {
        const contract = getReadOnlyContract()
        const owner = await contract.owner()
        return owner
    } catch (error) {
        console.error('Error getting contract owner:', error)
        return null
    }
}

// Check if an address is an admin
const isAdmin = async (address: string): Promise<boolean> => {
    try {
        const contract = getReadOnlyContract()
        const result = await contract.isAdmin(address)
        return result
    } catch (error) {
        console.error('Error checking admin status:', error)
        return false
    }
}

// Add a new admin (only existing admins can do this)
const addAdmin = async (newAdminAddress: string) => {
    if (!ethereum) {
        reportError('Please install Metamask')
        return Promise.reject(new Error('Metamask not installed'))
    }
    try {
        // Get current wallet address
        const accounts = await ethereum.request?.({ method: 'eth_accounts' })
        const currentWallet = accounts?.[0]?.toLowerCase()
        
        if (!currentWallet) {
            return Promise.reject(new Error('Please connect your wallet first'))
        }
        
        // Check admin status and owner before attempting
        const contract = getReadOnlyContract()
        const isCurrentUserAdmin = await contract.isAdmin(currentWallet)
        const owner = await contract.owner()
        const isCurrentUserOwner = currentWallet === owner?.toLowerCase()
        
        console.log('🔍 Admin Check:', {
            currentWallet,
            isAdmin: isCurrentUserAdmin,
            isOwner: isCurrentUserOwner,
            owner: owner
        })
        
        if (!isCurrentUserAdmin && !isCurrentUserOwner) {
            const errorMsg = `Only admin can add admins. Current wallet: ${currentWallet}, Owner: ${owner}, Is Admin: ${isCurrentUserAdmin}`
            console.error('❌', errorMsg)
            console.error('💡 Solution: Deploy the contract with your wallet address using: npx hardhat run scripts/deploy-with-account.js --network localhost')
            return Promise.reject(new Error(`Only admin can add admins. Your wallet (${currentWallet.substring(0, 10)}...) is not the owner or an admin.`))
        }
        
        const writeContract = await getEthereumContract()
        
        // Check if the function exists in the contract
        if (!writeContract.addAdmin) {
            const errorMsg = 'Contract does not have addAdmin function. Please redeploy the contract with the latest code.'
            console.error('❌', errorMsg)
            console.error('📋 To fix: Run "npx hardhat run scripts/deploy-with-account.js --network localhost" to redeploy')
            return Promise.reject(new Error(errorMsg))
        }
        
        const tx = await writeContract.addAdmin(newAdminAddress)
        
        const chainId = await getCurrentChainId()
        const explorerUrl = getExplorerUrl(chainId)
        
        console.log('📝 Transaction Hash:', tx.hash)
        console.log('🔗 View on Explorer:', explorerUrl + tx.hash)
        
        await tx.wait()
        
        return Promise.resolve({
            ...tx,
            hash: tx.hash,
            explorerUrl: explorerUrl + tx.hash
        })
    } catch (error: any) {
        // Check for specific error about function not existing
        if (error?.message?.includes('is not a function') || error?.message?.includes('addAdmin')) {
            const errorMsg = 'Contract does not have addAdmin function. Please redeploy the contract with the latest code.'
            console.error('❌', errorMsg)
            console.error('📋 To fix: Run "npx hardhat run scripts/deploy-with-account.js --network localhost" to redeploy')
            return Promise.reject(new Error(errorMsg + ' Run: npx hardhat run scripts/deploy-with-account.js --network localhost'))
        }
        const message = reportError(error)
        return Promise.reject(new Error(message))
    }
}

// Remove an admin (only existing admins can do this)
const removeAdmin = async (adminAddress: string) => {
    if (!ethereum) {
        reportError('Please install Metamask')
        return Promise.reject(new Error('Metamask not installed'))
    }
    try {
        const contract = await getEthereumContract()
        
        // Check if the function exists in the contract
        if (!contract.removeAdmin) {
            const errorMsg = 'Contract does not have removeAdmin function. Please redeploy the contract with the latest code.'
            console.error('❌', errorMsg)
            console.error('📋 To fix: Run "npx hardhat run scripts/deploy.js --network localhost" to redeploy')
            return Promise.reject(new Error(errorMsg))
        }
        
        const tx = await contract.removeAdmin(adminAddress)
        
        const chainId = await getCurrentChainId()
        const explorerUrl = getExplorerUrl(chainId)
        
        console.log('📝 Transaction Hash:', tx.hash)
        console.log('🔗 View on Explorer:', explorerUrl + tx.hash)
        
        await tx.wait()
        
        return Promise.resolve({
            ...tx,
            hash: tx.hash,
            explorerUrl: explorerUrl + tx.hash
        })
    } catch (error: any) {
        // Check for specific error about function not existing
        if (error?.message?.includes('is not a function') || error?.message?.includes('removeAdmin')) {
            const errorMsg = 'Contract does not have removeAdmin function. Please redeploy the contract with the latest code.'
            console.error('❌', errorMsg)
            console.error('📋 To fix: Run "npx hardhat run scripts/deploy.js --network localhost" to redeploy')
            return Promise.reject(new Error(errorMsg + ' Run: npx hardhat run scripts/deploy.js --network localhost'))
        }
        const message = reportError(error)
        return Promise.reject(new Error(message))
    }
}

//In another file can use import { connectWallet, checkWallet } from './wallet'
export {
    connectWallet,
    checkWallet,
    createPoll,
    getReadOnlyContract,
    getPolls,
    getPoll,
    updatePoll,
    deletePoll,
    contestPoll,
    updateContestant,
    deleteContestant,
    getContestants,
    voteCandidate,
    getContractOwner,
    isAdmin,
    addAdmin,
    removeAdmin,
}