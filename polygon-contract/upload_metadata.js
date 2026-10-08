import dotenv from "dotenv";
import fs from "fs";
import axios from "axios";
import FormData from "form-data";
import { ethers } from "ethers";

dotenv.config();

const PINATA_JWT = process.env.PINATA_SECRET_API_KEY || process.env.PINATA_JWT;

async function uploadJsonMetadata() {
    try {
        console.log("Uploading metadata to Pinata...");

        const metadata = JSON.parse(
            fs.readFileSync("./metadata/metadata_schema.json", "utf8")
        );

        // Ensure documentHash is present at root level aligning with WCO DM 4.2.0
        if (!metadata.documentHash) {
            const hashSource = { ...metadata };
            delete hashSource.blockchain_proof;
            metadata.documentHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(hashSource)));
        }

        const data = new FormData();

        data.append(
            "file",
            Buffer.from(JSON.stringify(metadata, null, 2)),
            {
                filename: "metadata.json",
                contentType: "application/json"
            }
        );

        const response = await axios.post(
            "https://api.pinata.cloud/pinning/pinFileToIPFS",
            data,
            {
                maxBodyLength: Infinity,
                headers: {
                    Authorization: `Bearer ${PINATA_JWT}`,
                    ...data.getHeaders()
                }
            }
        );

        const cid = response.data.IpfsHash;

        console.log("\n====================================");
        console.log("UPLOAD SUCCESS");
        console.log("CID:", cid);
        console.log("Document Hash:", metadata.documentHash);
        console.log("TokenURI:");
        console.log(`ipfs://${cid}`);
        console.log("Gateway URL:");
        console.log(`https://gateway.pinata.cloud/ipfs/${cid}`);
        console.log("====================================\n");

    } catch (error) {
        if (error.response) {
            console.error(
                "Pinata Error:",
                JSON.stringify(error.response.data, null, 2)
            );
        } else {
            console.error("Error:", error.message);
        }
    }
}

uploadJsonMetadata();