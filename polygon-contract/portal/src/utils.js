import { ethers } from "ethers";

export function loadJson(key, fallback = null) {
  try {
    const rawValue = localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function removeJson(key) {
  localStorage.removeItem(key);
}

export function updateNestedValue(source, path, value) {
  if (!path.length) {
    return value;
  }

  const [head, ...rest] = path;
  if (Array.isArray(source)) {
    const nextArray = [...source];
    nextArray[Number(head)] = updateNestedValue(nextArray[Number(head)], rest, value);
    return nextArray;
  }

  return {
    ...source,
    [head]: rest.length ? updateNestedValue(source?.[head], rest, value) : value,
  };
}

export function deepMergeDraft(baseDraft, storedDraft) {
  const nextDraft = {
    ...baseDraft,
    ...storedDraft,
    co_document_details: {
      ...baseDraft.co_document_details,
      ...(storedDraft?.co_document_details || {}),
      exporter: {
        ...baseDraft.co_document_details.exporter,
        ...(storedDraft?.co_document_details?.exporter || {}),
      },
      consignee: {
        ...baseDraft.co_document_details.consignee,
        ...(storedDraft?.co_document_details?.consignee || {}),
      },
      transport: {
        ...baseDraft.co_document_details.transport,
        ...(storedDraft?.co_document_details?.transport || {}),
      },
      goods_items:
        Array.isArray(storedDraft?.co_document_details?.goods_items) &&
        storedDraft.co_document_details.goods_items.length > 0
          ? storedDraft.co_document_details.goods_items
          : baseDraft.co_document_details.goods_items,
      special_cases: {
        ...baseDraft.co_document_details.special_cases,
        ...(storedDraft?.co_document_details?.special_cases || {}),
      },
      certification: {
        ...baseDraft.co_document_details.certification,
        ...(storedDraft?.co_document_details?.certification || {}),
      },
    },
    blockchain_proof: {
      ...baseDraft.blockchain_proof,
      ...(storedDraft?.blockchain_proof || {}),
    },
  };

  return nextDraft;
}

export function formatDateTime(value) {
  const numericValue = Number(value || 0);
  if (!numericValue) {
    return "-";
  }
  return new Date(numericValue * 1000).toLocaleString("vi-VN");
}

export function formatDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function shortenAddress(value) {
  if (!value) return "-";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function shortenHash(value) {
  if (!value) return "Hash chưa có";
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

export function normalizeCid(value) {
  if (!value) return "";
  return String(value).replace(/^ipfs:\/\//, "").replace(/^\/ipfs\//, "");
}

export function parseTokenFromText(text) {
  const match = String(text || "").match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

export function extractError(error) {
  return String(error?.shortMessage || error?.reason || error?.message || error)
    .replace(/^Error:\s*/, "")
    .trim();
}

export function statusMeta(status) {
  switch (Number(status)) {
    case 1:
      return {
        label: "VALID",
        tone: "success",
        badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    case 2:
      return {
        label: "SUSPENDED",
        tone: "warning",
        badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
      };
    case 3:
      return {
        label: "REVOKED",
        tone: "danger",
        badgeClass: "border-rose-200 bg-rose-50 text-rose-700",
      };
    case 4:
      return {
        label: "EXPIRED",
        tone: "neutral",
        badgeClass: "border-slate-200 bg-slate-50 text-slate-600",
      };
    default:
      return {
        label: "PENDING",
        tone: "neutral",
        badgeClass: "border-slate-200 bg-slate-50 text-slate-600",
      };
  }
}

export function historyMeta(eventName) {
  switch (eventName) {
    case "Certificate_issued":
      return {
        label: "Mint",
        badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    case "Certificate_revoked":
      return {
        label: "Revoked",
        badgeClass: "border-rose-200 bg-rose-50 text-rose-700",
      };
    case "Certificate_suspended":
      return {
        label: "Suspended",
        badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
      };
    case "Transfer":
      return {
        label: "Transfer",
        badgeClass: "border-cyan-200 bg-cyan-50 text-cyan-700",
      };
    default:
      return {
        label: eventName,
        badgeClass: "border-slate-200 bg-slate-50 text-slate-600",
      };
  }
}

export function computeDocumentHash(metadata) {
  const hashSource = {
    ...metadata,
    blockchain_proof: {
      ...metadata.blockchain_proof,
      nft_token_id: 0,
      contract_address: "",
      co_document_hash: "",
      ipfs_cid: "",
    },
  };
  return ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(hashSource)));
}

export function normalizeBytes32(value) {
  const trimmed = String(value || "").trim();
  if (ethers.isHexString(trimmed, 32)) {
    return trimmed;
  }
  return ethers.keccak256(ethers.toUtf8Bytes(trimmed));
}

export function toTokenUri(cid) {
  const normalized = normalizeCid(cid);
  return normalized ? `ipfs://${normalized}` : "";
}

export function buildMetadata(issuerDraft, contractAddress) {
  return {
    name: issuerDraft.name,
    description: issuerDraft.description,
    image: issuerDraft.image,
    external_url: issuerDraft.external_url,
    co_document_details: structuredClone(issuerDraft.co_document_details),
    blockchain_proof: {
      ...structuredClone(issuerDraft.blockchain_proof),
      contract_address: contractAddress,
    },
  };
}

export async function copyText(text) {
  await navigator.clipboard.writeText(text);
}
