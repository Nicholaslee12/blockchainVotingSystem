// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import '@openzeppelin/contracts/utils/Counters.sol';

contract DappVotes {
  using Counters for Counters.Counter;
  //I using Counters.sol in @openzeppelin/contracts/utils/Counters.sol
  Counters.Counter private totalPolls;
  Counters.Counter private totalContestants;

  // Admin management - mapping to track admin addresses
  mapping(address => bool) public admins;
  
  // Owner of the contract (initial admin)
  address public owner;
  
  // Event for admin changes
  event AdminAdded(address indexed admin);
  event AdminRemoved(address indexed admin);
  
  // Constructor - sets deployer as owner and initial admin
  constructor() {
    owner = msg.sender;
    admins[msg.sender] = true;
  }

  struct PollStruct {
    uint id;
    string image;
    string title;
    string description;
    uint votes;
    uint contestants;
    bool deleted;
    address director;
    uint startsAt;
    uint endsAt;
    uint timestamp;
    address[] voters;
    string[] avatars;
  }

  struct ContestantStruct {
    uint id;
    string image;
    string name;
    address voter;
    uint votes;
    address[] voters;
    bool deleted;
  }

  //to know the pool is true or false condition, if the pollExist become true, which mean it exist, but if deleted, it must became false;
  mapping(uint => bool) pollExist;
  mapping(uint => PollStruct) polls; //track every poll created
  mapping(uint => mapping(address => bool)) voted; //multi-dimensional mapping, track the voted already voted for specific poll(in true or false condition)
  mapping(uint => mapping(address => mapping(bytes32 => bool))) contestEntryExists; //track unique entries per wallet/poll
  mapping(uint => mapping(uint => ContestantStruct)) contestants; //keep track of all the contestants that have what

  //handle The Ethereum address of the person who voted and The time (in seconds since Unix epoch) when the vote occurred
  event Voted(address indexed voter, uint timestamp);

  // Admin management functions
  function addAdmin(address newAdmin) public {
    require(admins[msg.sender] || msg.sender == owner, 'Only admin can add admins');
    require(newAdmin != address(0), 'Invalid address');
    require(!admins[newAdmin], 'Address is already an admin');
    
    admins[newAdmin] = true;
    emit AdminAdded(newAdmin);
  }
  
  function removeAdmin(address adminToRemove) public {
    require(admins[msg.sender] || msg.sender == owner, 'Only admin can remove admins');
    require(adminToRemove != owner, 'Cannot remove owner');
    require(admins[adminToRemove], 'Address is not an admin');
    
    admins[adminToRemove] = false;
    emit AdminRemoved(adminToRemove);
  }
  
  function isAdmin(address account) public view returns (bool) {
    return admins[account] || account == owner;
  }
  
  function createPoll(
    string memory image,
    string memory title,
    string memory description,
    uint startsAt,
    uint endsAt
  ) public {
    require(admins[msg.sender] || msg.sender == owner, 'Only admin can create polls');
    require(bytes(title).length > 0, 'Title cannot be empty');
    require(bytes(description).length > 0, 'Description cannot be empty');
    require(bytes(image).length > 0, 'Image URL cannot be empty');
    require(startsAt > 0, 'Start date must be greater than 0');
    require(endsAt > startsAt, 'Start date must be greater than 0');

    //give ability to increase the totalPolls
    totalPolls.increment();

    PollStruct memory poll;
    poll.id = totalPolls.current();
    poll.title = title;
    poll.description = description;
    poll.image = image;
    poll.startsAt = startsAt;
    poll.endsAt = endsAt;
    poll.director = msg.sender;
    poll.timestamp = currentTime(); // able to have 13 digit in timestamp

    polls[poll.id] = poll; //Store this poll object into the polls mapping, using its id as the key.”
    pollExist[poll.id] = true; //we saying that this pool now exists
  }

  function updatePoll(
    uint id, // we need id of the poll for us to able delete search poll
    string memory image,
    string memory title,
    string memory description,
    uint startsAt,
    uint endsAt
  ) public {
    require(pollExist[id], 'Poll not found');
    require(polls[id].director == msg.sender, 'Unauthorize entity');
    require(bytes(title).length > 0, 'Title cannot be empty');
    require(bytes(description).length > 0, 'Description cannot be empty');
    require(bytes(image).length > 0, 'Image URL cannot be empty');
    require(!polls[id].deleted, 'Polling already deleted');
    require(polls[id].votes < 1, 'Poll has votes already');
    require(endsAt > startsAt, 'End date must be greater than start date');

    //Update the title
    polls[id].title = title;
    polls[id].description = description;
    polls[id].startsAt = startsAt;
    polls[id].endsAt = endsAt;
    polls[id].image = image;
  }

  function deletePoll(uint id) public {
    require(pollExist[id], 'Poll not found');
    require(polls[id].director == msg.sender, 'Unauthorize entity');
    // Allow deletion if poll has no votes OR if poll has ended
    require(polls[id].votes < 1 || currentTime() > polls[id].endsAt, 'Poll is still active and has votes');
    polls[id].deleted = true;
  }

  function getPoll(uint id) public view returns (PollStruct memory) {
    return polls[id];
  }

  //retreive all the poll that have not been deleted
  function getPolls() public view returns (PollStruct[] memory Polls) {
    uint available; //get and return have not been deleted
    for (uint i = 1; i <= totalPolls.current(); i++) {
      if (!polls[i].deleted) available++; //If this poll is not deleted.” available ++
    }

    Polls = new PollStruct[](available);
    uint index;

    for (uint i = 1; i <= totalPolls.current(); i++) {
      if (!polls[i].deleted) {
        //poll
        Polls[index++] = polls[i]; //Put the current poll (polls[i]) into the next available slot in the Polls array, then move to the next slot.”
      }
    }
  }

  function contest(uint id, string memory name, string memory image) public {
    require(pollExist[id], 'Poll not found');
    require(bytes(name).length > 0, 'Name cannot be empty');
    require(bytes(image).length > 0, 'Image URL cannot be empty');
    require(polls[id].votes < 1 , 'Poll has votes already');
    bytes32 entryKey = keccak256(abi.encodePacked(msg.sender, name, image));
    require(!contestEntryExists[id][msg.sender][entryKey], 'Contestant already submitted'); //allow multiple submissions but avoid duplicates per wallet/name/image combo

    totalContestants.increment();

    ContestantStruct memory contestant; //struct ContestantStruct
    contestant.name = name; //read which they are from the parameter at line 130
    contestant.image = image;
    contestant.voter = msg.sender;
    contestant.id = totalContestants.current();//know the total contest and the current total contestant
    contestant.deleted = false;

    contestants[id][contestant.id]= contestant; //assign contestant to contestants[id]
    contestEntryExists[id][msg.sender][entryKey] = true;
    polls[id].avatars.push(image); //Add the image to the list of avatar images for the poll with this ID.”
    polls[id].contestants++; 
  }

  function getContestant(uint id, uint cid) public view returns (ContestantStruct memory) {
    return contestants[id][cid];//cid is unique contestant ID and contestant for specific poll
  }

  //retreive all the contestants that have not been deleted
  function getContestants(uint id) public view returns (ContestantStruct[] memory Contestants) {
    uint available; //get and return have not been deleted
    for (uint i = 1; i <= totalContestants.current(); i++) {
      if (contestants[id][i].id == i && !contestants[id][i].deleted) available++; //This checks whether the contestant’s stored ID matches the index i in the array.
    }

    Contestants = new ContestantStruct[](available);
    uint index;

    for (uint i = 1; i <= totalContestants.current(); i++) {
      if (contestants[id][i].id == i && !contestants[id][i].deleted) {
        Contestants[index++] = contestants[id][i]; //
      }
    }
  }

  function updateContestant(uint pollId, uint contestantId, string memory name, string memory image) public {
    require(pollExist[pollId], 'Poll not found');
    require(bytes(name).length > 0, 'Name cannot be empty');
    require(bytes(image).length > 0, 'Image URL cannot be empty');
    require(polls[pollId].votes < 1 , 'Poll has votes already');

    ContestantStruct storage target = contestants[pollId][contestantId];
    require(target.id == contestantId && !target.deleted, 'Contestant not found');
    require(
      msg.sender == target.voter || msg.sender == polls[pollId].director,
      'Unauthorize entity'
    );

    bytes32 previousKey = keccak256(abi.encodePacked(target.voter, target.name, target.image));
    contestEntryExists[pollId][target.voter][previousKey] = false;

    bytes32 newKey = keccak256(abi.encodePacked(target.voter, name, image));
    require(!contestEntryExists[pollId][target.voter][newKey], 'Contestant already submitted');

    target.name = name;
    target.image = image;
    contestEntryExists[pollId][target.voter][newKey] = true;
  }

  function deleteContestant(uint pollId, uint contestantId) public {
    require(pollExist[pollId], 'Poll not found');
    require(polls[pollId].votes < 1 , 'Poll has votes already');

    ContestantStruct storage target = contestants[pollId][contestantId];
    require(target.id == contestantId && !target.deleted, 'Contestant not found');
    require(
      msg.sender == target.voter || msg.sender == polls[pollId].director,
      'Unauthorize entity'
    );

    bytes32 entryKey = keccak256(abi.encodePacked(target.voter, target.name, target.image));
    contestEntryExists[pollId][target.voter][entryKey] = false;
    string memory previousImage = target.image;

    target.deleted = true;
    target.name = '';
    target.image = '';
    delete target.voters;
    target.votes = 0;

    if (polls[pollId].contestants > 0) {
      polls[pollId].contestants--;
    }

    string[] storage avatars = polls[pollId].avatars;
    uint length = avatars.length;
    for (uint i = 0; i < length; i++) {
      if (keccak256(abi.encodePacked(avatars[i])) == keccak256(abi.encodePacked(previousImage))) {
        avatars[i] = avatars[length - 1];
        avatars.pop();
        break;
      }
    }
  }


  function vote(uint id, uint cid) public  {
    require(pollExist[id],'Poll not found');
    require(!voted[id][msg.sender],'Already voted');
    require(!polls[id].deleted,'Polling not available');
    require(polls[id].contestants > 1,'Not enough contestant');
    require(
      currentTime()>= polls[id].startsAt && currentTime() < polls[id].endsAt,'Voting must be session'
    );

    polls[id].votes++;//Add one vote to the poll’s total whenever someone votes.
    polls[id].voters.push(msg.sender);//add something to the end of a list (array)”. For example:numbers.push(10); // numbers = [10] numbers.push(20); // numbers = [10, 20] 

    contestants[id][cid].votes++;//If voter vote, increase this contestant’s total votes by one.”
    contestants[id][cid].voters.push(msg.sender);//Stores voter address in array
    voted[id][msg.sender] = true; //Marks this user as “already voted”

    emit Voted(msg.sender, currentTime());//“record a blockchain event showing that this user just voted at this timestamp.
  }

  function currentTime() internal view returns (uint256) {
    return (block.timestamp * 1000) + 1000;
  }
}
