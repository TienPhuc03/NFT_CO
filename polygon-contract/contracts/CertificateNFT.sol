// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract CertificateNFT is ERC721URIStorage, AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    uint256 private _nextTokenId = 1;

    enum Status { Valid, Suspended, Revoked }

    struct Certificate {
        bytes32 documentHash;
        bytes32 certificateReferenceHash; //Neo bảo chứng duy nhất & Reverse lookup
        uint256 parentTokenId;            //Khai báo C/O giáp lưng (0 nếu là gốc)
        
        //STRUCT PACKING (Fit 32 bytes tối ưu Gas)
        address issuerAddress;            // 20 bytes
        uint32 issueDate;                 // 4 bytes 
        uint32 validUntil;                // 4 bytes (Temporal Validity)
        Status status;                    // 1 byte
    }

    mapping(uint256 => Certificate) public certificates;
    
    // Mapping tra ngược: certificateReferenceHash => tokenId
    mapping(bytes32 => uint256) public certificateByReference;

    // --- EVENTS (có indexed để tra cứu nhanh trên PolygonScan) ---
    event CertificateMinted(address indexed issuer, uint256 indexed tokenId, bytes32 indexed documentHash);
    event CertificateStatusChanged(uint256 indexed tokenId, Status newStatus);
    
    // EVENT KÍCH HOẠT LAN TRUYỀN (Cascade Revocation)
    event CascadeRevoked(uint256 indexed parentTokenId, string message);

    constructor() ERC721("Certificate of Origin", "C/O") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // Yêu cầu bắt buộc của OZ v5 khi đa kế thừa (Multiple Inheritance)
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721URIStorage, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // KHÓA CHUYỂN NHƯỢNG (SOULBOUND TOKEN) - Giải quyết lỗi C8
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        
        // Chỉ cho phép Mint (từ địa chỉ 0) hoặc Burn (đến địa chỉ 0)
        require(from == address(0) || to == address(0), "C/O is a Soulbound Token: Transfer is disabled");
        
        return super._update(to, tokenId, auth);
    }

    // MINT CHỨNG THƯ C/O
    function mintCO(
        address exporter,
        string memory coReferenceNumber,
        bytes32 _documentHash,
        string memory _tokenURI,
        uint32 _validUntil,
        uint256 _parentTokenId // Truyền ID của C/O mẹ nếu là C/O giáp lưng
    ) public onlyRole(ISSUER_ROLE) {
        
        // 1. Tạo mã băm định danh duy nhất theo namespace của tổ chức cấp
        bytes32 certRefHash = keccak256(abi.encodePacked(msg.sender, coReferenceNumber));
        require(certificateByReference[certRefHash] == 0, "Duplicate C/O reference for this issuer");

        uint256 newTokenId = _nextTokenId++;
        
        // 2. Lưu Reverse Lookup để hải quan tra cứu ngược
        certificateByReference[certRefHash] = newTokenId;

        // 3. Khởi tạo cấu trúc chứng thư
        certificates[newTokenId] = Certificate({
            documentHash: _documentHash,
            certificateReferenceHash: certRefHash,
            parentTokenId: _parentTokenId,
            issuerAddress: msg.sender,
            issueDate: uint32(block.timestamp),
            validUntil: _validUntil,
            status: Status.Valid
        });

        // 4. Mint & Gắn URI (Chỉ tốn phí khi slot nhảy từ 0 lên 1)
        _safeMint(exporter, newTokenId);
        _setTokenURI(newTokenId, _tokenURI);

        emit CertificateMinted(msg.sender, newTokenId, _documentHash);
    }

    // Ràng buộc: Chỉ cơ quan tạo C/O gốc mới được phép đổi trạng thái
    modifier onlyCertificateIssuer(uint256 tokenId) {
        require(certificates[tokenId].issuerAddress == msg.sender, "Unauthorized: Not the original issuer");
        _;
    }

    // ĐÌNH CHỈ (Tối ưu xuống mốc ~32k Gas nhờ Struct Packing)
    function suspendCertificate(uint256 tokenId) public onlyRole(ISSUER_ROLE) onlyCertificateIssuer(tokenId) {
        require(certificates[tokenId].status == Status.Valid, "Can only suspend a valid C/O");
        certificates[tokenId].status = Status.Suspended;
        emit CertificateStatusChanged(tokenId, Status.Suspended);
    }

    // PHỤC HỒI (Hàm mới - Vá lỗi C/O bị ngõ cụt)
    function reinstateCertificate(uint256 tokenId) public onlyRole(ISSUER_ROLE) onlyCertificateIssuer(tokenId) {
        require(certificates[tokenId].status == Status.Suspended, "Can only reinstate a suspended C/O");
        certificates[tokenId].status = Status.Valid;
        emit CertificateStatusChanged(tokenId, Status.Valid);
    }

    // THU HỒI & KÍCH HOẠT HẬU KIỂM LAN TRUYỀN
    function revokeCertificate(uint256 tokenId) public onlyRole(ISSUER_ROLE) onlyCertificateIssuer(tokenId) {
        require(certificates[tokenId].status != Status.Revoked, "C/O is already revoked");
        
        certificates[tokenId].status = Status.Revoked;
        emit CertificateStatusChanged(tokenId, Status.Revoked);
        
        // Điểm nhấn học thuật: Gửi tín hiệu Off-chain để hậu kiểm các C/O con (Cascade)
        emit CascadeRevoked(tokenId, "Cascade Alert: Initiate post-clearance audit for related child certificates");
    }
    
    // HÀM VIEW KHÔNG TỐN GAS: Xác minh thông tin cho cổng thông tin Hải quan
    function verifyCertificate(uint256 tokenId) public view returns (Status, bytes32, uint32, uint256) {
        _requireOwned(tokenId); // Chuẩn OpenZeppelin v5 check token tồn tại
        Certificate memory cert = certificates[tokenId];
        
        return (cert.status, cert.documentHash, cert.validUntil, cert.parentTokenId);
    }
}