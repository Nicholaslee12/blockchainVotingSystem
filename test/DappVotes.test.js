const { expect } = require('chai')
// enable Hardhat chai matchers (provides .revertedWith, etc.)
require('@nomicfoundation/hardhat-chai-matchers')

const { ethers } = require('hardhat')



describe('Contract', () => {
    let contract, result

    const description = 'Lorem Ipsum'
    const title = 'Republican Primary Election'
    const image = 'https://image.png'
    const starts = Date.now() - 10 * 60 * 1000
    const ends = Date.now() + 10 * 60 * 1000
    const pollId = 1
    const contestantId = 1

    const avater1 = 'https://avatar1.png'
    const name1 = 'Nebu Ballon'
    const avater2 = 'https://avatar2.png'
    const name2 = 'Kad Neza'

    //Mocha test
    //Before each test case runs, do the following setup steps
    beforeEach(async () => {
        const Contract = await ethers.getContractFactory('DappVotes')//“Find the compiled smart contract named DappVotes, and prepare it so I can deploy it or interact with it.”
            ;[deployer, contestant1, contestant2, voter1, voter2, voter3] = await ethers.getSigners()//getSigner() is gives you a list of wallets(signers) from Hardhat network.Signer can send transcation ,deploy contrats and interract with smart contracts

        contract = await Contract.deploy()//Create a new instance of the contract on the blockchain //await is important here because deploying a contract takes time — it sends a transaction to the blockchain and waits for it to be mined.
        await contract.deployed() //waits until it’s fully deployed and
    })

    describe('Poll Mgt.', () => {
        describe('Successes.', () => {
            it('should confirm poll creation sucess', async () => {
                result = await contract.getPolls()
                expect(result).to.have.lengthOf(0)//Using expect() assertion library.

                await contract.createPoll(image, title, description, starts, ends)//await ensures we wait until the transaction is mined before moving on.

                result = await contract.getPolls()//Calls getPolls() again after creating the poll and Now the array should contain 1 poll.
                expect(result).to.have.lengthOf(1)//Checks that the array returned from getPolls() now has 1 element.

                result = await contract.getPoll(pollId);
                expect(result.title).to.be.equal(title)
                expect(result.director).to.be.equal(deployer.address)
            })

            it('should confirm poll update success', async () => {
                await contract.createPoll(image, title, description, starts, ends)

                result = await contract.getPoll(pollId)
                expect(result.title).to.be.equal(title)

                await contract.updatePoll(pollId, image, 'New title', description, starts, ends)

                result = await contract.getPoll(pollId)
                expect(result.title).to.be.equal('New title')
            })

            it('should confirm poll deletion success', async () => {
                await contract.createPoll(image, title, description, starts, ends)

                result = await contract.getPolls()
                expect(result).to.have.lengthOf(1)


                result = await contract.getPoll(pollId)
                expect(result.deleted).to.be.equal(false)

                await contract.deletePoll(pollId)

                result = await contract.getPolls()
                expect(result).to.have.lengthOf(0)


                result = await contract.getPoll(pollId)
                expect(result.deleted).to.be.equal(true)
            })
        })

        //test scenarios where the function should fai
        describe('Failure', () => {
            it('should comfirm poll creation failures', async () => {
                await expect(contract.createPoll('', title, description, starts, ends)).to.be.revertedWith('Image URL cannot be empty')
                await expect(contract.createPoll(image, title, description, 0, ends)).to.be.revertedWith('Start date must be greater than 0')
            })

            //test that updating a poll fails when something is wrong
            it('should comfirm poll update failures', async () => {
                await expect(contract.updatePoll(100, image, 'New Title', description, starts, ends)).to.be.revertedWith('Poll not found')
            })

            it('should confirm poll deletion failures', async () => {
                await expect(contract.deletePoll(100)).to.be.revertedWith('Poll not found')
            })
        })
    })

    describe('Poll Contest', () => {
        //Every time a test runs under describe('Poll Contest', ...),this code runs first:
        //Makes tests predictable and independent(Each test works on its own poll, so if one test fails, it doesn’t break the others.)
        beforeEach(async () => {
            await contract.createPoll(image, title, description, starts, ends)
        })

        describe('Success', () => {
            it('should confirm contest entry success', async () => {
                result = await contract.getPoll(pollId)
                //If the value isn’t 0, the test fails. becausebefore anyone joins the contest, the poll should have zero contestants.
                expect(result.contestants.toNumber()).to.be.equal(0)

                await contract.connect(contestant1).contest(pollId, name1, avater1)
                await contract.connect(contestant2).contest(pollId, name2, avater2)

                result = await contract.getPoll(pollId)
                expect(result.contestants.toNumber()).to.be.equal(2)

                result = await contract.getContestants(pollId)
                expect(result).to.have.lengthOf(2)
            })
        })

        describe('Failure', () => {
            it('should comfirm contest entry failures', async () => {
                await expect(contract.contest(100, name1, avater1)).to.be.revertedWith('Poll not found')
                await expect(contract.contest(pollId, '', avater1)).to.be.revertedWith('Name cannot be empty')

                await contract.connect(contestant1).contest(pollId, name1, avater1)
                await expect(contract.connect(contestant1).contest(pollId, name1, avater1)).to.be.revertedWith('Already contested')
            })
        })
    })

    describe('Poll Voting', () => {
        beforeEach(async () => {
            await contract.createPoll(image, title, description, starts, ends)
            await contract.connect(contestant1).contest(pollId, name1, avater1)
            await contract.connect(contestant2).contest(pollId, name2, avater2)
        })

        describe('Success', () => {
            it('should confirm contest entry success', async () => {
                result = await contract.getPoll(pollId)
                expect(result.votes.toNumber()).to.be.equal(0)

                await contract.connect(contestant1).vote(pollId, contestantId)
                await contract.connect(contestant2).vote(pollId, contestantId)

                result = await contract.getPoll(pollId)
                expect(result.votes.toNumber()).to.be.equal(2)
                // votes is a BigNumber (count) — don't check .length on it
                expect(result.avatars).to.have.lengthOf(2)

                result = await contract.getContestants(pollId)
                expect(result).to.have.lengthOf(2)
                // result is an array of contestant structs; check first item's voter
                expect(result[0].voter).to.be.equal(contestant1.address)

            })


        })
        describe('Failure', () => {
            it('should confrim contest entry failure', async () => {
                await expect(contract.vote(100, contestantId)).to.be.revertedWith('Poll not found')
                await contract.deletePoll(pollId)
                await expect(contract.vote(pollId, contestantId)).to.be.revertedWith('Polling not available')
            })
        })
    })
})