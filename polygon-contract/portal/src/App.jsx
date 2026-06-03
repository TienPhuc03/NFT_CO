import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { BrowserProvider, Contract, Interface, JsonRpcProvider, ethers } from "ethers";
import {
  AMOY_CHAIN_HEX,
  AMOY_CHAIN_ID,
  AMOY_CHAIN_NAME,
  CONTRACT_ABI,
  DEFAULT_CONTRACT_ADDRESS,
  DEFAULT_IPFS_GATEWAY,
  DEFAULT_RPC_URL,
  SPECIAL_CASES,
  STORAGE_KEYS,
  createDefaultIssuerDraft,
} from "./constants";
import {
  buildMetadata,
  computeDocumentHash,
  copyText,
  deepMergeDraft,
  extractError,
  formatDateTime,
  historyMeta,
  loadJson,
  normalizeBytes32,
  normalizeCid,
  parseTokenFromText,
  saveJson,
  shortenAddress,
  shortenHash,
  statusMeta,
  toTokenUri,
  updateNestedValue,
} from "./utils";

const envConfig = {
  contractAddress: import.meta.env.VITE_CONTRACT_ADDRESS || DEFAULT_CONTRACT_ADDRESS,
  rpcUrl: import.meta.env.VITE_RPC_URL || DEFAULT_RPC_URL,
  ipfsGateway: import.meta.env.VITE_IPFS_GATEWAY || DEFAULT_IPFS_GATEWAY,
  pinataJwt: import.meta.env.VITE_PINATA_JWT || "",
};

function useLocalStorageState(key, initialValue) {
  const [value, setValue] = useState(() => loadJson(key, initialValue));

  useEffect(() => {
    saveJson(key, value);
  }, [key, value]);

  return [value, setValue];
}

function App() {
  const [config, setConfig] = useLocalStorageState(STORAGE_KEYS.config, envConfig);
  const [issuerDraft, setIssuerDraft] = useLocalStorageState(
    STORAGE_KEYS.issuerDraft,
    deepMergeDraft(createDefaultIssuerDraft(envConfig.contractAddress), loadJson(STORAGE_KEYS.issuerDraft, null)),
  );
  const [verifierTokenInput, setVerifierTokenInput] = useLocalStorageState(STORAGE_KEYS.verifierToken, "");
  const [activeTab, setActiveTab] = useState("issuer");
  const [banner, setBanner] = useState({
    tone: "neutral",
    text: "Sẵn sàng. Kết nối MetaMask để bắt đầu thao tác.",
  });
  const [wallet, setWallet] = useState({
    address: "",
    chainId: null,
    issuerRole: "unchecked",
  });
  const [verifierState, setVerifierState] = useState({
    tokenId: "",
    status: null,
    owner: "",
    issuer: "",
    cid: "",
    documentHash: "",
    tokenUri: "",
    metadata: null,
    history: [],
  });
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerStatus, setScannerStatus] = useState("Chưa mở camera.");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrHint, setQrHint] = useState("Sau khi mint, QR tokenId sẽ xuất hiện ở đây.");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanFrameRef = useRef(null);

  const readProvider = useMemo(
    () => new JsonRpcProvider(config.rpcUrl || DEFAULT_RPC_URL),
    [config.rpcUrl],
  );

  const readContract = useMemo(() => {
    if (!ethers.isAddress(config.contractAddress)) {
      return null;
    }
    return new Contract(config.contractAddress, CONTRACT_ABI, readProvider);
  }, [config.contractAddress, readProvider]);

  const metadataBase = useMemo(
    () => buildMetadata(issuerDraft, config.contractAddress),
    [issuerDraft, config.contractAddress],
  );

  const documentHash = useMemo(
    () => computeDocumentHash(metadataBase),
    [metadataBase],
  );

  const metadataPreview = useMemo(() => {
    const preview = {
      ...metadataBase,
      blockchain_proof: {
        ...metadataBase.blockchain_proof,
        co_document_hash: documentHash,
      },
    };
    return JSON.stringify(preview, null, 2);
  }, [metadataBase, documentHash]);

  const currentTokenId = Number(issuerDraft.blockchain_proof?.nft_token_id || 0);
  const currentQrPayload = currentTokenId > 0 ? `tokenId:${currentTokenId}` : "";

  useEffect(() => {
    if (!currentQrPayload) {
      setQrDataUrl("");
      setQrHint("Sau khi mint, QR tokenId sẽ xuất hiện ở đây.");
      return;
    }

    let cancelled = false;
    QRCode.toDataURL(currentQrPayload, {
      width: 240,
      margin: 2,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    })
      .then((dataUrl) => {
        if (!cancelled) {
          setQrDataUrl(dataUrl);
          setQrHint(`QR chứa ${currentQrPayload}.`);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setBanner({ tone: "danger", text: `Không tạo được QR: ${extractError(error)}` });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentQrPayload]);

  useEffect(() => {
    saveJson(STORAGE_KEYS.config, config);
  }, [config]);

  useEffect(() => {
    saveJson(STORAGE_KEYS.issuerDraft, issuerDraft);
  }, [issuerDraft]);

  useEffect(() => {
    saveJson(STORAGE_KEYS.verifierToken, verifierTokenInput);
  }, [verifierTokenInput]);

  useEffect(() => {
    if (!readContract || !wallet.address) {
      setWallet((prev) => ({ ...prev, issuerRole: "unchecked" }));
      return;
    }

    let cancelled = false;
    const checkRole = async () => {
      try {
        const role = await readContract.ISSUER_ROLE();
        const hasRole = await readContract.hasRole(role, wallet.address);
        if (!cancelled) {
          setWallet((prev) => ({ ...prev, issuerRole: hasRole ? "granted" : "denied" }));
        }
      } catch {
        if (!cancelled) {
          setWallet((prev) => ({ ...prev, issuerRole: "error" }));
        }
      }
    };

    checkRole();
    return () => {
      cancelled = true;
    };
  }, [readContract, wallet.address]);

  const setBannerMessage = useCallback((text, tone = "neutral") => {
    setBanner({ text, tone });
  }, []);

  const updateConfigField = useCallback((field, value) => {
    setConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, [setConfig]);

  const updateIssuerField = useCallback((path, value) => {
    setIssuerDraft((prev) => updateNestedValue(prev, path, value));
  }, [setIssuerDraft]);

  const updateGoodsItem = useCallback((index, field, value) => {
    setIssuerDraft((prev) => {
      const nextGoods = [...prev.co_document_details.goods_items];
      nextGoods[index] = {
        ...nextGoods[index],
        [field]: value,
      };
      return updateNestedValue(prev, ["co_document_details", "goods_items"], nextGoods);
    });
  }, [setIssuerDraft]);

  const addGoodsItem = useCallback(() => {
    setIssuerDraft((prev) => {
      const nextGoods = [
        ...prev.co_document_details.goods_items,
        {
          item_no: prev.co_document_details.goods_items.length + 1,
          hs_code: "",
          description: "",
          origin_criterion: "",
          gross_weight: "",
          quantity: "",
          fob_value: "",
          invoice_number: "",
          invoice_date: "",
        },
      ];
      return updateNestedValue(prev, ["co_document_details", "goods_items"], nextGoods);
    });
  }, [setIssuerDraft]);

  const removeGoodsItem = useCallback((index) => {
    setIssuerDraft((prev) => {
      const nextGoods = prev.co_document_details.goods_items.filter((_, itemIndex) => itemIndex !== index);
      const renumbered = nextGoods.map((item, itemIndex) => ({
        ...item,
        item_no: itemIndex + 1,
      }));
      return updateNestedValue(prev, ["co_document_details", "goods_items"], renumbered.length ? renumbered : [{
        item_no: 1,
        hs_code: "",
        description: "",
        origin_criterion: "",
        gross_weight: "",
        quantity: "",
        fob_value: "",
        invoice_number: "",
        invoice_date: "",
      }]);
    });
  }, [setIssuerDraft]);

  const renderMessageTone = banner.tone === "success"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : banner.tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : banner.tone === "danger"
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : "border-slate-200 bg-slate-50 text-slate-700";

  const walletTone = wallet.issuerRole === "granted"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : wallet.issuerRole === "denied"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : wallet.issuerRole === "error"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-slate-200 bg-slate-50 text-slate-600";

  const walletLabel = wallet.issuerRole === "granted"
    ? "Issuer role OK"
    : wallet.issuerRole === "denied"
      ? "Không có ISSUER_ROLE"
      : wallet.issuerRole === "error"
        ? "Kiểm tra role lỗi"
        : "Chưa kiểm tra quyền";

  const tabButtonClass = (tab) => activeTab === tab
    ? "btn-primary"
    : "btn-secondary";

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      setBannerMessage("Trình duyệt chưa có MetaMask.", "danger");
      return;
    }

    try {
      const provider = new BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();

      setWallet({
        address,
        chainId: Number(network.chainId),
        issuerRole: "unchecked",
      });

      setBannerMessage(`Đã kết nối ví ${shortenAddress(address)}.`, "success");
    } catch (error) {
      setBannerMessage(`Kết nối MetaMask thất bại: ${extractError(error)}`, "danger");
    }
  }, [setBannerMessage]);

  const switchToAmoy = useCallback(async () => {
    if (!window.ethereum) {
      setBannerMessage("Không tìm thấy MetaMask.", "danger");
      return;
    }

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: AMOY_CHAIN_HEX }],
      });
      setBannerMessage("Đã chuyển sang Polygon Amoy.", "success");
    } catch (error) {
      if (error.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: AMOY_CHAIN_HEX,
                chainName: AMOY_CHAIN_NAME,
                nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
                rpcUrls: [DEFAULT_RPC_URL],
                blockExplorerUrls: ["https://www.oklink.com/amoy"],
              },
            ],
          });
          setBannerMessage("Đã thêm mạng Polygon Amoy vào MetaMask.", "success");
        } catch (addError) {
          setBannerMessage(`Không thêm được mạng: ${extractError(addError)}`, "danger");
        }
        return;
      }

      setBannerMessage(`Không đổi được mạng: ${extractError(error)}`, "danger");
    }
  }, [setBannerMessage]);

  const uploadMetadata = useCallback(async () => {
    if (!config.pinataJwt) {
      setBannerMessage("Hãy nhập Pinata JWT nếu muốn upload metadata từ browser.", "warning");
      return;
    }

    try {
      setBannerMessage("Đang upload metadata lên Pinata...", "neutral");
      const payload = {
        pinataContent: JSON.parse(metadataPreview),
        pinataMetadata: {
          name: issuerDraft.name || "certificate-metadata.json",
        },
      };

      const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.pinataJwt}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const result = await response.json();
      const cid = result.IpfsHash;
      updateIssuerField(["blockchain_proof", "ipfs_cid"], cid);
      setBannerMessage(`Upload thành công. CID: ${cid}`, "success");
    } catch (error) {
      setBannerMessage(`Upload IPFS thất bại: ${extractError(error)}`, "danger");
    }
  }, [config.pinataJwt, issuerDraft.name, metadataPreview, setBannerMessage, updateIssuerField]);

  const fetchHistory = useCallback(async (tokenId) => {
    if (!ethers.isAddress(config.contractAddress)) {
      return [];
    }

    const latestBlock = await readProvider.getBlockNumber();
    const logs = await readProvider.getLogs({
      address: config.contractAddress,
      fromBlock: 0,
      toBlock: latestBlock,
    });
    const iface = new Interface(CONTRACT_ABI);

    return logs
      .map((log) => {
        try {
          const parsed = iface.parseLog(log);
          return parsed
            ? {
                eventName: parsed.name,
                args: parsed.args,
                blockNumber: Number(log.blockNumber),
                transactionHash: log.transactionHash,
                logIndex: Number(log.logIndex),
              }
            : null;
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .filter((event) => Number(event.args.tokenId ?? event.args[0] ?? 0) === Number(tokenId))
      .sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex);
  }, [config.contractAddress, readProvider]);

  const mintCertificate = useCallback(async () => {
    if (!window.ethereum) {
      setBannerMessage("Hãy kết nối MetaMask trước khi mint.", "warning");
      return;
    }

    if (!ethers.isAddress(config.contractAddress)) {
      setBannerMessage("Địa chỉ contract không hợp lệ.", "warning");
      return;
    }

    if (!issuerDraft.co_document_details.reference_number) {
      setBannerMessage("Thiếu số tham chiếu C/O.", "warning");
      return;
    }

    if (!issuerDraft.co_document_details.exporter.wallet_address) {
      setBannerMessage("Thiếu địa chỉ ví exporter.", "warning");
      return;
    }

    if (!issuerDraft.blockchain_proof.ipfs_cid) {
      setBannerMessage("Cần upload IPFS CID trước khi mint.", "warning");
      return;
    }

    try {
      setBannerMessage("Đang gửi transaction mint qua MetaMask...", "neutral");
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new Contract(config.contractAddress, CONTRACT_ABI, signer);
      const tx = await contract.mintCertificateNFT(
        issuerDraft.co_document_details.reference_number,
        normalizeBytes32(documentHash),
        normalizeCid(issuerDraft.blockchain_proof.ipfs_cid),
        issuerDraft.co_document_details.exporter.wallet_address,
      );
      const receipt = await tx.wait();
      const iface = new Interface(CONTRACT_ABI);
      const mintedEvent = receipt.logs
        .map((log) => {
          try {
            return iface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((event) => event?.name === "Certificate_issued");

      const tokenId = mintedEvent ? Number(mintedEvent.args.tokenId) : Number(await contract.nextTokenId()) - 1;
      updateIssuerField(["blockchain_proof", "nft_token_id"], tokenId);
      setVerifierTokenInput(String(tokenId));
      setBannerMessage(`Mint thành công. Tx: ${tx.hash}`, "success");
      setActiveTab("issuer");
    } catch (error) {
      setBannerMessage(`Mint thất bại: ${extractError(error)}`, "danger");
    }
  }, [config.contractAddress, documentHash, issuerDraft.blockchain_proof.ipfs_cid, issuerDraft.co_document_details.exporter.wallet_address, issuerDraft.co_document_details.reference_number, setBannerMessage, setVerifierTokenInput, updateIssuerField]);

  const loadCertificate = useCallback(async (tokenIdOverride = null) => {
    const tokenIdValue = Number(tokenIdOverride || verifierTokenInput || 0);
    if (!tokenIdValue) {
      setBannerMessage("Hãy nhập tokenId hợp lệ.", "warning");
      return;
    }

    if (!readContract) {
      setBannerMessage("Thiếu hoặc sai địa chỉ contract.", "warning");
      return;
    }

    try {
      setBannerMessage(`Đang tra cứu token ${tokenIdValue}...`, "neutral");
      const certificate = await readContract.certificates(tokenIdValue);
      const [owner, tokenUri, verified] = await Promise.all([
        readContract.ownerOf(tokenIdValue),
        readContract.tokenURI(tokenIdValue).catch(() => toTokenUri(certificate.ipfsCID)),
        readContract.verifyCertificate(tokenIdValue).catch(() => null),
      ]);

      const statusValue = Number(certificate.status ?? verified?.status ?? 0);
      const status = statusMeta(statusValue);
      const cid = normalizeCid(certificate.ipfsCID || verified?.ipfsCID || "");
      const metadata = await fetchMetadataFromIpfs(cid);
      const history = await fetchHistory(tokenIdValue);

      setVerifierState({
        tokenId: String(tokenIdValue),
        status,
        owner,
        issuer: certificate.issuerAddress || metadata?.co_document_details?.certification?.issuing_authority || "",
        cid,
        documentHash: certificate.documentHash || verified?.documentHash || "",
        tokenUri: tokenUri || toTokenUri(cid),
        metadata,
        history,
      });

      setBannerMessage(`Đã tải token ${tokenIdValue}.`, "success");
    } catch (error) {
      setVerifierState({
        tokenId: String(tokenIdValue),
        status: null,
        owner: "",
        issuer: "",
        cid: "",
        documentHash: "",
        tokenUri: "",
        metadata: null,
        history: [],
      });
      setBannerMessage(`Tra cứu thất bại: ${extractError(error)}`, "danger");
    }
  }, [fetchHistory, readContract, setBannerMessage, verifierTokenInput]);

  const loadFromQrImage = useCallback(async (file) => {
    if (!("BarcodeDetector" in window)) {
      setBannerMessage("Trình duyệt chưa hỗ trợ BarcodeDetector.", "warning");
      return;
    }

    try {
      const detector = new BarcodeDetector({ formats: ["qr_code"] });
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext("2d").drawImage(bitmap, 0, 0);
      const codes = await detector.detect(canvas);
      const rawValue = codes[0]?.rawValue || "";
      const tokenId = parseTokenFromText(rawValue);
      if (!tokenId) {
        throw new Error("Không đọc được tokenId từ QR.");
      }

      setVerifierTokenInput(String(tokenId));
      setBannerMessage(`Đã đọc QR ảnh: ${rawValue}`, "success");
      await loadCertificate(tokenId);
    } catch (error) {
      setBannerMessage(`Quét ảnh QR thất bại: ${extractError(error)}`, "danger");
    }
  }, [loadCertificate, setBannerMessage, setVerifierTokenInput]);

  const startCameraScanner = useCallback(async () => {
    if (!("BarcodeDetector" in window)) {
      setBannerMessage("Trình duyệt chưa hỗ trợ BarcodeDetector.", "warning");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setBannerMessage("Trình duyệt không hỗ trợ camera scan.", "warning");
      return;
    }

    try {
      const detector = new BarcodeDetector({ formats: ["qr_code"] });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      setScannerOpen(true);
      setScannerStatus("Đang mở camera...");

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const scanLoop = async () => {
        if (!streamRef.current || !videoRef.current) {
          return;
        }

        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            const rawValue = codes[0].rawValue || "";
            const tokenId = parseTokenFromText(rawValue);
            if (tokenId) {
              setScannerStatus(`Đã đọc QR: ${rawValue}`);
              setVerifierTokenInput(String(tokenId));
              await stopCameraScanner();
              await loadCertificate(tokenId);
              return;
            }

            setScannerStatus(`Đã đọc QR nhưng không tìm thấy tokenId: ${rawValue}`);
          }
        } catch (error) {
          setScannerStatus(`Đang quét... ${extractError(error)}`);
        }

        scanFrameRef.current = requestAnimationFrame(scanLoop);
      };

      scanFrameRef.current = requestAnimationFrame(scanLoop);
    } catch (error) {
      setBannerMessage(`Không mở được camera: ${extractError(error)}`, "danger");
    }
  }, [loadCertificate, setBannerMessage, setVerifierTokenInput]);

  const stopCameraScanner = useCallback(async () => {
    if (scanFrameRef.current) {
      cancelAnimationFrame(scanFrameRef.current);
      scanFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setScannerOpen(false);
    setScannerStatus("Đã đóng camera.");
  }, []);

  const changeStatus = useCallback(async (action) => {
    if (!wallet.address) {
      setBannerMessage("Hãy kết nối MetaMask trước.", "warning");
      return;
    }

    const tokenIdValue = Number(verifierState.tokenId || verifierTokenInput || 0);
    if (!tokenIdValue) {
      setBannerMessage("Hãy nhập tokenId trước.", "warning");
      return;
    }

    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new Contract(config.contractAddress, CONTRACT_ABI, signer);
      setBannerMessage(action === "suspend" ? "Đang suspend token..." : "Đang revoke token...", "neutral");
      const tx = action === "suspend"
        ? await contract.suspendCertificate(tokenIdValue)
        : await contract.revokedCertificate(tokenIdValue);
      await tx.wait();
      setBannerMessage(`Đã ${action === "suspend" ? "suspend" : "revoke"} token ${tokenIdValue}.`, "success");
      await loadCertificate(tokenIdValue);
    } catch (error) {
      setBannerMessage(`Không thể ${action}: ${extractError(error)}`, "danger");
    }
  }, [config.contractAddress, loadCertificate, setBannerMessage, verifierState.tokenId, verifierTokenInput, wallet.address]);

  const historyItems = verifierState.history.map((entry) => {
    const meta = historyMeta(entry.eventName);
    const details = entry.eventName === "Certificate_issued"
      ? `Ref ${entry.args.coReferenceNumber || "-"} · ${shortenAddress(entry.args.exporterAddress)}`
      : entry.eventName === "Certificate_revoked"
        ? `Revoked at ${formatDateTime(entry.args.revokedAt)}`
        : entry.eventName === "Certificate_suspended"
          ? `Token ${Number(entry.args.tokenId)} suspended`
          : `${shortenAddress(entry.args.from)} → ${shortenAddress(entry.args.to)}`;

    return (
      <tr key={`${entry.transactionHash}-${entry.logIndex}`} className="border-t border-slate-200">
        <td className="px-4 py-4 text-sm text-slate-500">Block {entry.blockNumber}</td>
        <td className="px-4 py-4">
          <span className={`badge ${meta.badgeClass}`}>{meta.label}</span>
        </td>
        <td className="px-4 py-4 text-sm text-slate-700">{details}</td>
      </tr>
    );
  });

  return (
    <div className="app-shell">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="panel px-6 py-6 shadow-glow">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-600">
                Bước 4 · Portal xác minh
              </p>
              <h1 className="mt-2 text-3xl font-bold text-slate-950 sm:text-4xl">
                Certificate of Origin Portal
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Giao diện Issuer và Verifier cho quy trình xuất C/O: tạo metadata, upload IPFS,
                mint NFT qua MetaMask, hiển thị QR tokenId, tra cứu metadata và lịch sử giao dịch.
              </p>
            </div>

            <div className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 sm:grid-cols-3 lg:min-w-[470px]">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Network</p>
                <p className="mt-1 font-semibold text-slate-900">Polygon Amoy</p>
                <p className="text-xs text-slate-500">Chain ID {AMOY_CHAIN_ID}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Contract</p>
                <p className="mt-1 break-all font-semibold text-slate-900">{config.contractAddress || "-"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Wallet</p>
                <p className="mt-1 font-semibold text-slate-900">
                  {wallet.address ? shortenAddress(wallet.address) : "Chưa kết nối"}
                </p>
                <p className="text-xs text-slate-500">
                  {wallet.chainId ? `Chain ${wallet.chainId}` : "MetaMask disconnected"}
                </p>
              </div>
            </div>
          </div>

          <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${renderBannerClass(banner.tone)}`}>
            {banner.text}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-[1.5rem] border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">4.1 Issuer Portal</p>
              <h3 className="mt-2 text-lg font-bold text-slate-950">Nhập thông tin lô hàng</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                <li>• Form nhập thông tin → tạo metadata JSON → upload IPFS</li>
                <li>• Ký và gửi mint NFT qua MetaMask</li>
                <li>• Sinh QR chứa tokenId để gắn vào lô hàng</li>
              </ul>
            </div>

            <div className="rounded-[1.5rem] border border-blue-100 bg-gradient-to-br from-cyan-50 to-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-700">4.2 Verifier Portal</p>
              <h3 className="mt-2 text-lg font-bold text-slate-950">Xác minh nguồn gốc</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                <li>• Nhập tokenId hoặc scan QR → fetch metadata từ IPFS</li>
                <li>• Hiển thị trạng thái VALID, SUSPENDED, REVOKED</li>
                <li>• Hiển thị lịch sử mint, transfer, status changes</li>
              </ul>
            </div>

            <div className="rounded-[1.5rem] border border-blue-100 bg-gradient-to-br from-sky-50 to-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-700">4.3 Test scenarios</p>
              <h3 className="mt-2 text-lg font-bold text-slate-950">Kiểm thử chức năng</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                <li>• C/O hợp lệ, C/O giả mạo, tokenId không tồn tại</li>
                <li>• C/O đã thu hồi, C/O bị suspend, metadata lỗi</li>
                <li>• Kiểm tra responsive trên desktop và mobile</li>
              </ul>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-4">
            <ConfigInput
              label="Contract address"
              value={config.contractAddress}
              onChange={(value) => updateConfigField("contractAddress", value)}
            />
            <ConfigInput
              label="RPC read-only"
              value={config.rpcUrl}
              onChange={(value) => updateConfigField("rpcUrl", value)}
            />
            <ConfigInput
              label="Gateway IPFS"
              value={config.ipfsGateway}
              onChange={(value) => updateConfigField("ipfsGateway", value)}
            />
            <ConfigInput
              label="Pinata JWT"
              type="password"
              value={config.pinataJwt}
              onChange={(value) => updateConfigField("pinataJwt", value)}
              placeholder="Dán JWT nếu muốn upload từ browser"
            />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button className="btn-primary" type="button" onClick={connectWallet}>
              Kết nối MetaMask
            </button>
            <button className="btn-secondary" type="button" onClick={switchToAmoy}>
              Chuyển sang Amoy
            </button>
            <button className="btn-secondary" type="button" onClick={() => setBannerMessage("Đã lưu cấu hình local.", "success")}>
              Lưu cấu hình
            </button>
            <p className="text-sm text-slate-500">
              Portal React/Vite + Tailwind, theme trắng, build nội bộ.
            </p>
          </div>
        </header>

        <div className="mt-6 flex flex-wrap gap-3">
          <button className={tabButtonClass("issuer")} type="button" onClick={() => setActiveTab("issuer")}>
            Issuer Portal
          </button>
          <button className={tabButtonClass("verifier")} type="button" onClick={() => setActiveTab("verifier")}>
            Verifier Portal
          </button>
        </div>

        {activeTab === "issuer" ? (
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
            <div className="space-y-6">
              <SectionCard
                title="Issuer Portal"
                subtitle="Nhập thông tin lô hàng, tạo metadata JSON, upload IPFS và mint NFT."
                actionBadge={<span className={`badge ${walletTone}`}>{walletLabel}</span>}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <ConfigInput
                    label="Tên metadata"
                    value={issuerDraft.name}
                    onChange={(value) => updateIssuerField(["name"], value)}
                  />
                  <ConfigInput
                    label="Image URI"
                    value={issuerDraft.image}
                    onChange={(value) => updateIssuerField(["image"], value)}
                  />
                  <ConfigInput
                    label="External URL"
                    value={issuerDraft.external_url}
                    onChange={(value) => updateIssuerField(["external_url"], value)}
                  />
                  <ConfigInput
                    label="Reference Number"
                    value={issuerDraft.co_document_details.reference_number}
                    onChange={(value) => updateIssuerField(["co_document_details", "reference_number"], value)}
                  />
                  <ConfigInput
                    label="CO ID"
                    value={issuerDraft.co_document_details.co_id}
                    onChange={(value) => updateIssuerField(["co_document_details", "co_id"], value)}
                  />
                  <ConfigInput
                    label="CO standard"
                    value={issuerDraft.co_document_details.co_standard}
                    onChange={(value) => updateIssuerField(["co_document_details", "co_standard"], value)}
                  />
                  <ConfigInput
                    label="Ngày cấp"
                    type="date"
                    value={issuerDraft.co_document_details.issue_date}
                    onChange={(value) => updateIssuerField(["co_document_details", "issue_date"], value)}
                  />
                  <ConfigInput
                    label="Quốc gia cấp"
                    value={issuerDraft.co_document_details.issuing_country}
                    onChange={(value) => updateIssuerField(["co_document_details", "issuing_country"], value)}
                  />
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                  <div className="panel-muted p-5">
                    <h3 className="text-lg font-semibold text-slate-900">Exporter</h3>
                    <div className="mt-4 grid gap-4">
                      <ConfigInput
                        label="Tên exporter"
                        value={issuerDraft.co_document_details.exporter.name}
                        onChange={(value) => updateIssuerField(["co_document_details", "exporter", "name"], value)}
                      />
                      <ConfigInput
                        label="Địa chỉ exporter"
                        value={issuerDraft.co_document_details.exporter.address}
                        onChange={(value) => updateIssuerField(["co_document_details", "exporter", "address"], value)}
                      />
                      <div className="grid gap-4 md:grid-cols-2">
                        <ConfigInput
                          label="Quốc gia"
                          value={issuerDraft.co_document_details.exporter.country}
                          onChange={(value) => updateIssuerField(["co_document_details", "exporter", "country"], value)}
                        />
                        <ConfigInput
                          label="Tax ID"
                          value={issuerDraft.co_document_details.exporter.tax_id}
                          onChange={(value) => updateIssuerField(["co_document_details", "exporter", "tax_id"], value)}
                        />
                      </div>
                      <ConfigInput
                        label="Wallet exporter"
                        value={issuerDraft.co_document_details.exporter.wallet_address}
                        onChange={(value) => updateIssuerField(["co_document_details", "exporter", "wallet_address"], value)}
                      />
                    </div>
                  </div>

                  <div className="panel-muted p-5">
                    <h3 className="text-lg font-semibold text-slate-900">Consignee</h3>
                    <div className="mt-4 grid gap-4">
                      <ConfigInput
                        label="Tên consignee"
                        value={issuerDraft.co_document_details.consignee.name}
                        onChange={(value) => updateIssuerField(["co_document_details", "consignee", "name"], value)}
                      />
                      <ConfigInput
                        label="Địa chỉ consignee"
                        value={issuerDraft.co_document_details.consignee.address}
                        onChange={(value) => updateIssuerField(["co_document_details", "consignee", "address"], value)}
                      />
                      <div className="grid gap-4 md:grid-cols-2">
                        <ConfigInput
                          label="Quốc gia"
                          value={issuerDraft.co_document_details.consignee.country}
                          onChange={(value) => updateIssuerField(["co_document_details", "consignee", "country"], value)}
                        />
                        <ConfigInput
                          label="Wallet consignee"
                          value={issuerDraft.co_document_details.consignee.wallet_address}
                          onChange={(value) => updateIssuerField(["co_document_details", "consignee", "wallet_address"], value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 panel-muted p-5">
                  <h3 className="text-lg font-semibold text-slate-900">Transport</h3>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <ConfigInput
                      label="Mode"
                      value={issuerDraft.co_document_details.transport.mode}
                      onChange={(value) => updateIssuerField(["co_document_details", "transport", "mode"], value)}
                    />
                    <ConfigInput
                      label="Departure date"
                      type="date"
                      value={issuerDraft.co_document_details.transport.departure_date}
                      onChange={(value) => updateIssuerField(["co_document_details", "transport", "departure_date"], value)}
                    />
                    <ConfigInput
                      label="Vessel / Flight"
                      value={issuerDraft.co_document_details.transport.vessel_or_flight_no}
                      onChange={(value) => updateIssuerField(["co_document_details", "transport", "vessel_or_flight_no"], value)}
                    />
                    <ConfigInput
                      label="Port of loading"
                      value={issuerDraft.co_document_details.transport.port_of_loading}
                      onChange={(value) => updateIssuerField(["co_document_details", "transport", "port_of_loading"], value)}
                    />
                    <ConfigInput
                      label="Port of discharge"
                      value={issuerDraft.co_document_details.transport.port_of_discharge}
                      onChange={(value) => updateIssuerField(["co_document_details", "transport", "port_of_discharge"], value)}
                    />
                    <ConfigInput
                      label="B/L number"
                      value={issuerDraft.co_document_details.transport.bill_of_lading_no}
                      onChange={(value) => updateIssuerField(["co_document_details", "transport", "bill_of_lading_no"], value)}
                    />
                  </div>
                </div>

                <div className="mt-6 panel-muted p-5">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-lg font-semibold text-slate-900">Goods items</h3>
                    <button className="btn-secondary !px-3 !py-2 text-xs" type="button" onClick={addGoodsItem}>
                      + Thêm dòng
                    </button>
                  </div>
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full border-separate border-spacing-y-3">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-[0.2em] text-slate-400">
                          <th className="px-2 py-1">#</th>
                          <th className="px-2 py-1">HS code</th>
                          <th className="px-2 py-1">Mô tả</th>
                          <th className="px-2 py-1">Origin</th>
                          <th className="px-2 py-1">Qty</th>
                          <th className="px-2 py-1">Gross</th>
                          <th className="px-2 py-1">FOB</th>
                          <th className="px-2 py-1">Invoice no.</th>
                          <th className="px-2 py-1">Invoice date</th>
                          <th className="px-2 py-1" />
                        </tr>
                      </thead>
                      <tbody>
                        {issuerDraft.co_document_details.goods_items.map((item, index) => (
                          <tr key={`${item.item_no}-${index}`} className="align-top">
                            <td className="px-2 py-1">
                              <input className="field min-w-[56px] px-3 py-2" type="number" min="1" value={item.item_no} readOnly />
                            </td>
                            <td className="px-2 py-1">
                              <input className="field min-w-[110px] px-3 py-2" value={item.hs_code} onChange={(event) => updateGoodsItem(index, "hs_code", event.target.value)} />
                            </td>
                            <td className="px-2 py-1">
                              <input className="field min-w-[180px] px-3 py-2" value={item.description} onChange={(event) => updateGoodsItem(index, "description", event.target.value)} />
                            </td>
                            <td className="px-2 py-1">
                              <input className="field min-w-[130px] px-3 py-2" value={item.origin_criterion} onChange={(event) => updateGoodsItem(index, "origin_criterion", event.target.value)} />
                            </td>
                            <td className="px-2 py-1">
                              <input className="field min-w-[110px] px-3 py-2" value={item.quantity} onChange={(event) => updateGoodsItem(index, "quantity", event.target.value)} />
                            </td>
                            <td className="px-2 py-1">
                              <input className="field min-w-[110px] px-3 py-2" value={item.gross_weight} onChange={(event) => updateGoodsItem(index, "gross_weight", event.target.value)} />
                            </td>
                            <td className="px-2 py-1">
                              <input className="field min-w-[110px] px-3 py-2" value={item.fob_value} onChange={(event) => updateGoodsItem(index, "fob_value", event.target.value)} />
                            </td>
                            <td className="px-2 py-1">
                              <input className="field min-w-[120px] px-3 py-2" value={item.invoice_number} onChange={(event) => updateGoodsItem(index, "invoice_number", event.target.value)} />
                            </td>
                            <td className="px-2 py-1">
                              <input className="field min-w-[120px] px-3 py-2" type="date" value={item.invoice_date} onChange={(event) => updateGoodsItem(index, "invoice_date", event.target.value)} />
                            </td>
                            <td className="px-2 py-1">
                              <button className="btn-secondary !px-3 !py-2 text-xs" type="button" onClick={() => removeGoodsItem(index)}>
                                Xóa
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-6 panel-muted p-5">
                  <h3 className="text-lg font-semibold text-slate-900">Special cases</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {SPECIAL_CASES.map(([key, label]) => (
                      <label key={key} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                          checked={Boolean(issuerDraft.co_document_details.special_cases[key])}
                          onChange={(event) => updateIssuerField(["co_document_details", "special_cases", key], event.target.checked)}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mt-6 panel-muted p-5">
                  <h3 className="text-lg font-semibold text-slate-900">Certification</h3>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <ConfigInput
                      label="Exporter declaration date"
                      type="date"
                      value={issuerDraft.co_document_details.certification.exporter_declaration_date}
                      onChange={(value) => updateIssuerField(["co_document_details", "certification", "exporter_declaration_date"], value)}
                    />
                    <ConfigInput
                      label="Issuing authority"
                      value={issuerDraft.co_document_details.certification.issuing_authority}
                      onChange={(value) => updateIssuerField(["co_document_details", "certification", "issuing_authority"], value)}
                    />
                    <ConfigInput
                      label="Certification date"
                      type="date"
                      value={issuerDraft.co_document_details.certification.certification_date}
                      onChange={(value) => updateIssuerField(["co_document_details", "certification", "certification_date"], value)}
                    />
                    <ConfigInput
                      label="Authority signature"
                      value={issuerDraft.co_document_details.certification.authority_signature}
                      onChange={(value) => updateIssuerField(["co_document_details", "certification", "authority_signature"], value)}
                    />
                  </div>
                </div>

                <div className="mt-6 panel-muted p-5">
                  <h3 className="text-lg font-semibold text-slate-900">Blockchain proof</h3>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <ConfigInput
                      label="Token ID"
                      type="number"
                      value={issuerDraft.blockchain_proof.nft_token_id || 0}
                      readOnly
                    />
                    <ConfigInput
                      label="Document hash"
                      value={documentHash}
                      readOnly
                    />
                    <ConfigInput
                      label="Contract address"
                      value={config.contractAddress}
                      readOnly
                    />
                    <ConfigInput
                      label="IPFS CID"
                      value={issuerDraft.blockchain_proof.ipfs_cid}
                      onChange={(value) => updateIssuerField(["blockchain_proof", "ipfs_cid"], value)}
                    />
                  </div>
                </div>
              </SectionCard>

              <div className="flex flex-wrap gap-3">
                <button className="btn-primary" type="button" onClick={uploadMetadata}>
                  Upload IPFS
                </button>
                <button className="btn-secondary" type="button" onClick={mintCertificate}>
                  Mint NFT
                </button>
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => {
                    updateIssuerField(["blockchain_proof", "co_document_hash"], documentHash);
                    setBannerMessage("Đã làm mới metadata preview.", "success");
                  }}
                >
                  Tạo metadata JSON
                </button>
                <button className="btn-secondary" type="button" onClick={() => copyText(metadataPreview)}>
                  Copy JSON
                </button>
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => setBannerMessage("Draft đã được lưu vào localStorage.", "success")}
                >
                  Lưu draft
                </button>
              </div>
            </div>

            <div className="space-y-6">
              <SectionCard title="Preview metadata" subtitle="JSON sẽ được upload lên IPFS trước khi mint.">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="badge border-cyan-200 bg-cyan-50 text-cyan-700" title={documentHash}>
                    {shortenHash(documentHash)}
                  </span>
                  <span className="text-xs text-slate-500">
                    CID: {issuerDraft.blockchain_proof.ipfs_cid ? normalizeCid(issuerDraft.blockchain_proof.ipfs_cid) : "chưa có"}
                  </span>
                </div>
                <textarea
                  className="h-[560px] w-full rounded-3xl border border-slate-200 bg-slate-950/95 p-4 font-mono text-xs leading-5 text-slate-100 outline-none"
                  readOnly
                  value={metadataPreview}
                />
              </SectionCard>

              <SectionCard title="QR token" subtitle="QR chứa tokenId để gắn vào lô hàng.">
                <div className="flex min-h-[260px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-4">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="QR token"
                      className="h-[220px] w-[220px] rounded-2xl border border-slate-200 bg-white p-2"
                    />
                  ) : (
                    <div className="text-center text-sm text-slate-500">{qrHint}</div>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={() => downloadQrImage(qrDataUrl, issuerDraft.blockchain_proof.nft_token_id)}
                  >
                    Tải QR
                  </button>
                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={() => setIssuerDraft((prev) => updateNestedValue(prev, ["blockchain_proof", "nft_token_id"], Number(verifierState.tokenId || 0)))}
                  >
                    Dùng token hiện tại
                  </button>
                </div>
              </SectionCard>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-6">
              <SectionCard
                title="Verifier Portal"
                subtitle="Nhập tokenId hoặc scan QR để lấy metadata và trạng thái on-chain."
              >
                <div className="flex flex-wrap gap-3">
                  <button className="btn-secondary" type="button" onClick={startCameraScanner}>
                    Quét camera
                  </button>
                  <label className="btn-secondary cursor-pointer">
                    Upload QR ảnh
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          loadFromQrImage(file);
                        }
                        event.target.value = "";
                      }}
                    />
                  </label>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto_auto]">
                  <ConfigInput
                    label="Token ID"
                    type="number"
                    value={verifierTokenInput}
                    onChange={setVerifierTokenInput}
                    placeholder="Nhập tokenId"
                  />
                  <div className="flex items-end">
                    <button className="btn-primary" type="button" onClick={() => loadCertificate()}>
                      Tra cứu
                    </button>
                  </div>
                  <div className="flex items-end">
                    <button
                      className="btn-secondary"
                      type="button"
                      onClick={() => {
                        if (issuerDraft.blockchain_proof.nft_token_id) {
                          setVerifierTokenInput(String(issuerDraft.blockchain_proof.nft_token_id));
                          loadCertificate(issuerDraft.blockchain_proof.nft_token_id);
                        }
                      }}
                    >
                      Dùng token hiện tại
                    </button>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Certificate status" subtitle="Thông tin on-chain và metadata từ IPFS.">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`badge ${verifierState.status?.badgeClass || "border-slate-200 bg-slate-50 text-slate-600"}`}>
                    {verifierState.status?.label || "-"}
                  </span>
                  <span className="badge border-slate-200 bg-slate-50 text-slate-600">
                    Token {verifierState.tokenId || "-"}
                  </span>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <InfoCard label="Reference" value={verifierState.metadata?.co_document_details?.reference_number || "-"} />
                  <InfoCard label="Owner" value={verifierState.owner || "-"} />
                  <InfoCard label="Issuer" value={verifierState.issuer || "-"} />
                  <InfoCard label="IPFS CID" value={verifierState.cid || "-"} />
                  <InfoCard label="Document hash" value={verifierState.documentHash || "-"} />
                  <InfoCard label="Token URI" value={verifierState.tokenUri || "-"} />
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button className="btn-secondary" type="button" onClick={() => changeStatus("suspend")}>
                    Suspend
                  </button>
                  <button className="btn-secondary" type="button" onClick={() => changeStatus("revoke")}>
                    Revoke
                  </button>
                  <button className="btn-secondary" type="button" onClick={() => loadCertificate()}>
                    Refresh
                  </button>
                </div>
              </SectionCard>

              <SectionCard title="Metadata from IPFS" subtitle="JSON gốc lấy từ gateway.">
                <div className="mb-3 flex justify-end">
                  <button className="btn-secondary !px-3 !py-2 text-xs" type="button" onClick={() => copyText(JSON.stringify(verifierState.metadata || {}, null, 2))}>
                    Copy JSON
                  </button>
                </div>
                <textarea
                  className="h-[420px] w-full rounded-3xl border border-slate-200 bg-slate-950/95 p-4 font-mono text-xs leading-5 text-slate-100 outline-none"
                  readOnly
                  value={JSON.stringify(
                    verifierState.metadata
                      ? {
                          tokenId: verifierState.tokenId,
                          certificate: {
                            tokenId: verifierState.tokenId,
                            coReferenceNumber: verifierState.metadata?.co_document_details?.reference_number || "-",
                            documentHash: verifierState.documentHash,
                            ipfsCID: verifierState.cid,
                            issuerAddress: verifierState.issuer,
                            exporterAddress: verifierState.metadata?.co_document_details?.exporter?.wallet_address || "",
                            issueDate: verifierState.metadata?.co_document_details?.issue_date || "",
                            status: verifierState.status?.label || "-",
                          },
                          metadata: verifierState.metadata,
                        }
                      : {},
                    null,
                    2,
                  )}
                />
              </SectionCard>
            </div>

            <div className="space-y-6">
              <SectionCard title="Transaction history" subtitle="Mint, transfer, status changes.">
                <div className="overflow-hidden rounded-3xl border border-slate-200">
                  <div className="max-h-[620px] overflow-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-left">
                      <thead className="sticky top-0 bg-white">
                        <tr className="text-xs uppercase tracking-[0.2em] text-slate-400">
                          <th className="px-4 py-3">Time</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {historyItems.length > 0 ? historyItems : (
                          <tr>
                            <td className="px-4 py-4 text-sm text-slate-500" colSpan={3}>
                              Chưa có lịch sử hoặc hãy tra cứu token trước.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="QR scan" subtitle="BarcodeDetector khi trình duyệt hỗ trợ.">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  {scannerStatus}
                </div>
              </SectionCard>
            </div>
          </div>
        )}
      </div>

      {scannerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur">
          <div className="w-full max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-glow">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-950">Quét QR</h3>
                <p className="text-sm text-slate-500">Đưa mã QR vào camera để đọc tokenId.</p>
              </div>
              <button className="btn-secondary !px-3 !py-2 text-xs" type="button" onClick={stopCameraScanner}>
                Đóng
              </button>
            </div>
            <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-slate-950">
              <video ref={videoRef} className="h-[420px] w-full object-cover" autoPlay playsInline />
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {scannerStatus}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function renderBannerClass(tone) {
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-800";
  if (tone === "danger") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function ConfigInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  readOnly = false,
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        {label}
      </span>
      <input
        className="field"
        type={type}
        value={value ?? ""}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        placeholder={placeholder}
        readOnly={readOnly}
      />
    </label>
  );
}

function SectionCard({ title, subtitle, actionBadge, children }) {
  return (
    <section className="panel px-6 py-6 shadow-glow">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        {actionBadge}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{label}</p>
      <p className="mt-1 break-all text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

async function downloadQrImage(dataUrl, tokenId) {
  if (!dataUrl) {
    return;
  }

  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `token-${tokenId || "qr"}.png`;
  link.click();
}

export default App;
