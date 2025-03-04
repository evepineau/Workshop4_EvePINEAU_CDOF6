import bodyParser from "body-parser";
import express from "express";
import { BASE_ONION_ROUTER_PORT, REGISTRY_PORT } from "../config";
import { generateRsaKeyPair, exportPubKey, exportPrvKey, rsaDecrypt } from "../crypto";
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

  // Convertir la clé publique en base64 pour l'enregistrement
  const publicKeyBase64 = await exportPubKey(publicKey);

  // Enregistrer le nœud auprès du registre
  await fetch(`http://localhost:${REGISTRY_PORT}/registerNode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nodeId, pubKey: publicKeyBase64 }),
  });

  // Route pour recevoir et forwarder un message
  onionRouter.post("/receiveMessage", async (req, res) => {
    const { encryptedMessage, nextNodePort } = req.body;
    if (!encryptedMessage || !nextNodePort) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    lastReceivedEncryptedMessage = encryptedMessage;

    try {
      // Déchiffrer le message avec la clé privée du nœud
      lastReceivedDecryptedMessage = await rsaDecrypt(encryptedMessage, privateKey);
    } catch (error) {
      console.error("Decryption failed:", error);
      return res.status(500).json({ error: "Failed to decrypt message" });
    }

    lastMessageDestination = nextNodePort;

    // Forwarder le message au prochain nœud
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

  // Retourner la clé privée (uniquement pour les tests)
  onionRouter.get("/getPrivateKey", async (req, res) => {
    const privateKeyBase64 = await exportPrvKey(privateKey);
    return res.json({ result: privateKeyBase64 });
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
