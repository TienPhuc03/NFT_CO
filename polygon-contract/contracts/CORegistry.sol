// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract CORegistry {
    struct Record {
        bytes32 documentHash;
        uint8 status; // 0: Valid, 1: Suspended, 2: Revoked
    }
    
    mapping(uint256 => Record) public records;
    uint256 public nextId = 1;

    function registerCO(bytes32 _docHash) public {
        records[nextId] = Record({
            documentHash: _docHash,
            status: 0
        });
        nextId++;
    }

    function changeStatus(uint256 _id, uint8 _newStatus) public {
        records[_id].status = _newStatus;
    }
}

