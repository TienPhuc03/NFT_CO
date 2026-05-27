// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;


// import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
// save tokenURI, IPFS metadata link 
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
// import AccessControl  
import "@openzeppelin/contracts/access/AccessControl.sol";

// Create new Smart Contract for ERC721storage to save tokenURI, IPFS metadata link, and AccessControl for role-based access control
contract CertificateNFT is ERC721URIStorage, AccessControl {
    // state machine for certificate status
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE"); // define issuer role for access control

    enum CertificateNFTStatus {
        Pending,
        Valid,
        Suspended,
        Revoked,
        Expired
    }   

    struct Certificate {
        uint256 tokenId;
        string coReferenceNumber;
        bytes32 documentHash;
        string ipfsCID;
        address issuerAddress;
        address exporterAddress;
        uint256 issueDate;
        CertificateNFTStatus status;
        uint256 revokedAt;
    }
    //role as blockchain database to store certificate information
    mapping(uint256 => Certificate) public certificates;
    uint256 public nextTokenId = 1 ;

    //blockchain event to audit, tracking, indexing 
    event Certificate_issued (
        uint256 tokenId,
        string coReferenceNumber,
        address exporterAddress
    );
    // event for certificate status change
    event Certificate_revoked(
        uint256 tokenId,
        uint256 revokedAt
    );
    event Certificate_suspended(
        uint256 tokenId
    );


    function mintCertificateNFT (
        string memory _coReferenceNumber,
        bytes32 _documentHash,
        string memory _ipfsCID,
        address _exporterWallet
    ) public 
      onlyRole(ISSUER_ROLE) //only issuer can call this function
    {
        uint256 tokenId = nextTokenId;
        nextTokenId++;
        _safeMint(_exporterWallet, tokenId);
        _setTokenURI(tokenId, _ipfsCID );
        certificates[tokenId] = Certificate ({
            tokenId: tokenId,
            coReferenceNumber: _coReferenceNumber,
            documentHash: _documentHash,
            ipfsCID: _ipfsCID,
            issuerAddress: msg.sender,
            exporterAddress: _exporterWallet,
            issueDate: block.timestamp,
            status: CertificateNFTStatus.Valid,
            revokedAt: 0
        });
        emit Certificate_issued(tokenId, _coReferenceNumber, _exporterWallet);
    }

    function revokedCertificate (uint256 tokenId)
        public 
        onlyRole(ISSUER_ROLE) //only issuer can call this function
    {
        certificates[tokenId].status = CertificateNFTStatus.Revoked;

        certificates[tokenId].revokedAt = block.timestamp;

        emit Certificate_revoked(
        tokenId,
        block.timestamp
       );
    }

    function suspendCertificate(uint256 tokenId)
    public
    onlyRole(ISSUER_ROLE)
    {
         certificates[tokenId].status =
       CertificateNFTStatus.Suspended;

    emit Certificate_suspended(tokenId);
    }
    


    function verifyCertificate(uint256 tokenId)
    public
    view
    returns (
        CertificateNFTStatus,
        bytes32,
        string memory
    )
   {
        Certificate memory cert =
        certificates[tokenId];

     return (
        cert.status,
        cert.documentHash,
        cert.ipfsCID
    );
    }   



    constructor() ERC721("Certificate of Origin NFT", "CEO") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender); //assign admin role to contract deployer
        _grantRole(ISSUER_ROLE, msg.sender); //assign issuer role to contract deployer
    }

    function _baseURI()
        internal
        pure
        override
        returns (string memory)
    {
        return "ipfs://";
    }

    function addIssuer (address issuer)
       public onlyRole (DEFAULT_ADMIN_ROLE)
    {
        _grantRole (ISSUER_ROLE, issuer);
    }


     function removeIssuer (address issuer)
       public onlyRole (DEFAULT_ADMIN_ROLE)
    {
        _revokeRole (ISSUER_ROLE, issuer);
    }
    

    function supportsInterface(bytes4 interfaceId)
    public view override(ERC721URIStorage, AccessControl)
    returns (bool)
    {
    return super.supportsInterface(interfaceId);
    }
}
