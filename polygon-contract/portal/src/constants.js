export const AMOY_CHAIN_ID = 80002;
export const AMOY_CHAIN_HEX = "0x13882";
export const AMOY_CHAIN_NAME = "Polygon Amoy";

export const DEFAULT_CONTRACT_ADDRESS = "0xff70689039ec4577FC30444f632BDE738445A35d";
export const DEFAULT_RPC_URL = "https://rpc-amoy.polygon.technology";
export const DEFAULT_IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

export const STORAGE_KEYS = {
  config: "co.portal.config",
  issuerDraft: "co.portal.issuerDraft",
  verifierToken: "co.portal.verifierToken",
};

export const SPECIAL_CASES = [
  ["third_country_invoicing", "Third country invoicing"],
  ["accumulation", "Accumulation"],
  ["back_to_back_co", "Back-to-back CO"],
  ["partial_cumulation", "Partial cumulation"],
  ["exhibition", "Exhibition"],
  ["de_minimis", "De minimis"],
  ["issued_retroactively", "Issued retroactively"],
];

export const CONTRACT_ABI = [
  "function mintCertificateNFT(string _coReferenceNumber, bytes32 _documentHash, string _ipfsCID, address _exporterWallet)",
  "function revokedCertificate(uint256 tokenId)",
  "function suspendCertificate(uint256 tokenId)",
  "function verifyCertificate(uint256 tokenId) view returns (uint8 status, bytes32 documentHash, string ipfsCID)",
  "function certificates(uint256 tokenId) view returns (uint256 tokenId, string coReferenceNumber, bytes32 documentHash, string ipfsCID, address issuerAddress, address exporterAddress, uint256 issueDate, uint8 status, uint256 revokedAt)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function nextTokenId() view returns (uint256)",
  "function ISSUER_ROLE() view returns (bytes32)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "event Certificate_issued(uint256 tokenId, string coReferenceNumber, address exporterAddress)",
  "event Certificate_revoked(uint256 tokenId, uint256 revokedAt)",
  "event Certificate_suspended(uint256 tokenId)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];

export function createDefaultIssuerDraft(contractAddress = DEFAULT_CONTRACT_ADDRESS) {
  return {
    name: "C/O - ATIGA FORM D - VN-D-2026-00001",
    description:
      "Giấy chứng nhận xuất xứ điện tử (e-CoO) mẫu D theo Hiệp định Thương mại Hàng hóa ASEAN (ATIGA).",
    image: "ipfs://<image-cid>",
    external_url: "https://your-dapp-domain.com/co/VN-D-2026-00001",
    co_document_details: {
      co_id: "CO-2026-00001",
      co_standard: "ATIGA_FORM_D",
      reference_number: "VN-D-2026-00001",
      issuing_country: "Vietnam",
      issue_date: "2026-05-03",
      exporter: {
        name: "Cong ty TNHH Xuat Nhap Khau A",
        address: "123 Duong ABC, TP.HCM",
        country: "Vietnam",
        tax_id: "0312345678",
        wallet_address: "",
      },
      consignee: {
        name: "Company B PTE LTD",
        address: "456 Road XYZ, Singapore",
        country: "Singapore",
        wallet_address: "",
      },
      transport: {
        mode: "Sea",
        departure_date: "2026-05-05",
        vessel_or_flight_no: "Vessel 999",
        port_of_loading: "Cat Lai Port",
        port_of_discharge: "Port of Singapore",
        bill_of_lading_no: "BL123456",
      },
      goods_items: [
        {
          item_no: 1,
          hs_code: "100590",
          description: "Corn (Maize)",
          origin_criterion: "RVC 40%",
          gross_weight: "5000 kg",
          quantity: "5000 kg",
          fob_value: "15000 USD",
          invoice_number: "INV-2026-001",
          invoice_date: "2026-05-01",
        },
      ],
      special_cases: {
        third_country_invoicing: false,
        accumulation: false,
        back_to_back_co: false,
        partial_cumulation: false,
        exhibition: false,
        de_minimis: false,
        issued_retroactively: false,
      },
      certification: {
        exporter_declaration_date: "2026-05-02",
        issuing_authority: "Ministry of Industry and Trade (MOIT) Vietnam",
        certification_date: "2026-05-03",
        authority_signature: "Nguyen Van C",
      },
    },
    blockchain_proof: {
      nft_token_id: 0,
      contract_address: contractAddress,
      co_document_hash: "",
      ipfs_cid: "",
    },
  };
}
