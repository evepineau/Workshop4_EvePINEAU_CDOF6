import bodyParser from "body-parser";
import express from "express";
import { BASE_ONION_ROUTER_PORT, REGISTRY_PORT } from "../config";
import { generateRsaKeyPair } from "../crypto";
import { webcrypto } from "crypto";

export async function simpleOnionRouter(nodeId: number) {
  const onionRouter = express();
  onionRouter.use(express.json());
  onionRouter.use(bodyParser.json());

  let lastReceivedEncryptedMessage: string | null = null;
  let lastReceivedDecryptedMessage: string | null = null;
  let lastMessageDestination: number | null = null;
  let privateKey: webcrypto.CryptoKey;
  let publicKey: webcrypto.CryptoKey;

  // Générer les clés RSA
  const keyPair = await generateRsaKeyPair();
  privateKey = keyPair.privateKey;
  publicKey = keyPair.publicKey;

  // Enregistrer le nœud auprès du registre
  await fetch(`http://localhost:${REGISTRY_PORT}/registerNode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nodeId, pubKey: publicKey }),
  });

  onionRouter.post("/receiveMessage", async (req, res) => {
    const { encryptedMessage, nextNodePort } = req.body;
    if (!encryptedMessage || !nextNodePort) {
      return res.status(400).json({ error: "Missing required fields" });
    }
  
    lastReceivedEncryptedMessage = encryptedMessage;
    lastMessageDestination = nextNodePort;
  
    await fetch(`http://localhost:${nextNodePort}/receiveMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: encryptedMessage }),
    });
  
    return res.json({ message: "Message forwarded" });
  });  

  onionRouter.get("/status", (req, res) => {
    return res.send("live");
  });

  onionRouter.get("/getPrivateKey", (req, res) => {
    return res.json({ result: privateKey });
  });

  onionRouter.get("/getLastReceivedEncryptedMessage", (req, res) => {
    return res.json({ result: lastReceivedEncryptedMessage });
  });

  onionRouter.get("/getLastReceivedDecryptedMessage", (req, res) => {
    return res.json({ result: lastReceivedDecryptedMessage });
  });

  onionRouter.get("/getLastMessageDestination", (req, res) => {
    return res.json({ result: lastMessageDestination });
  });

  const server = onionRouter.listen(BASE_ONION_ROUTER_PORT + nodeId, () => {
    console.log(`Onion router ${nodeId} is listening on port ${BASE_ONION_ROUTER_PORT + nodeId}`);
  });

  return server;
}
