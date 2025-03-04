import { webcrypto } from "crypto";
import bodyParser from "body-parser";
import express, { Request, Response } from "express";
import { Server } from "http";

import { BASE_ONION_ROUTER_PORT, REGISTRY_PORT } from "../config";
import {
  exportPrvKey,
  exportPubKey,
  generateRsaKeyPair,
  importPrvKey,
  rsaDecrypt,
  symDecrypt,
} from "../crypto";

type MessageBody = {
  message: string;
};

// This is the registry address
let registryAddress = `http://localhost:${REGISTRY_PORT}`;

export async function simpleOnionRouter(nodeId: number) {
  // In-memory state for the node:
  let lastReceivedEncryptedMessage: string | null = null;
  let lastReceivedDecryptedMessage: string | null = null;
  let lastMessageDestination: number | null = null;

  let privateKeyBase64: string | null = null;
  let privateKeyObject: webcrypto.CryptoKey | null = null;
  let publicKeyBase64: string | null = null;

  // Express server
  const onionRouter = express();
  onionRouter.use(express.json());
  onionRouter.use(bodyParser.json());

  // Status route
  onionRouter.get("/status", (req, res) => {
    res.send("live");
  });

  // GET routes for test validations
  onionRouter.get("/getLastReceivedEncryptedMessage", (req: Request, res: Response) => {
    res.json({ result: lastReceivedEncryptedMessage });
  });

  onionRouter.get("/getLastReceivedDecryptedMessage", (req: Request, res: Response) => {
    res.json({ result: lastReceivedDecryptedMessage });
  });

  onionRouter.get("/getLastMessageDestination", (req: Request, res: Response) => {
    res.json({ result: lastMessageDestination });
  });

  // GET /getPrivateKey => returns the node's private key
  onionRouter.get("/getPrivateKey", async (req: Request, res: Response) => {
    res.json({ result: privateKeyBase64 });
  });

  // POST /message => handle onion-forwarding
  onionRouter.post("/message", async (req: Request, res: Response) => {
    const { message } = req.body as MessageBody;
    if (!message) {
      return res.status(400).json({ error: "No message provided" });
    }
    lastReceivedEncryptedMessage = message;

    try {
      if (!privateKeyObject) {
        return res.status(500).json({ error: "Private key not initialized" });
      }
      
      // We'll sliced that portion, then the remainder is the sym encrypted data
      const possibleKeyLength = 344;
      const rsaEncryptedKeyB64 = message.slice(0, possibleKeyLength);
      const symEncryptedData = message.slice(possibleKeyLength);

      // Decrypt the symmetric key
      const symKeyString = await rsaDecrypt(rsaEncryptedKeyB64, privateKeyObject);

      // Decrypt the remainder with that symmetric key
      const decryptedLayer = await symDecrypt(symKeyString, symEncryptedData);

      // The first 10 chars are the next destination
      const destinationStr = decryptedLayer.slice(0, 10);
      const nextDestination = parseInt(destinationStr, 10);

      // The rest is what we forward
      const remainder = decryptedLayer.slice(10);

      lastReceivedDecryptedMessage = remainder;
      lastMessageDestination = nextDestination;

      // Forward to the next node or user
      await fetch(`http://localhost:${nextDestination}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: remainder }),
      });

      
      return res.json({ status: "ok" });
    } catch (error) {
      console.error(`Node ${nodeId} failed to process /message:`, error);
      return res.status(500).json({ error: "Failed to process onion message" });
    }
  });

  // We must only return once the node is fully registered
  const port = BASE_ONION_ROUTER_PORT + nodeId;
  const server: Server = await new Promise((resolve, reject) => {
    const s = onionRouter.listen(port, async () => {
      console.log(`Node ${nodeId} listening on port ${port}`);
      try {
        // 1. Generate RSA key pair
        const { privateKey, publicKey } = await generateRsaKeyPair();
        privateKeyObject = privateKey;
        privateKeyBase64 = (await exportPrvKey(privateKey)) || null;
        publicKeyBase64 = await exportPubKey(publicKey);

        // 2. Register on the registry
        await fetch(`${registryAddress}/registerNode`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nodeId,
            pubKey: publicKeyBase64,
          }),
        });
        console.log(`Node ${nodeId} registered successfully!`);

        resolve(s); // only now is the node actually "ready"
      } catch (err) {
        console.error(`Node ${nodeId} error during init`, err);
        reject(err);
      }
    });
  });

  return server;
}
