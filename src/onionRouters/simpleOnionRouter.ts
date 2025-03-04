import bodyParser from "body-parser";
import express from "express";
import { BASE_ONION_ROUTER_PORT } from "../config";
import { decryptMessage } from "../crypto";

export async function simpleOnionRouter(nodeId: number) {
  const onionRouter = express();
  onionRouter.use(express.json());
  onionRouter.use(bodyParser.json());

  let lastReceivedEncryptedMessage: string | null = null;
  let lastReceivedDecryptedMessage: string | null = null;
  let lastMessageDestination: number | null = null;

  onionRouter.get("/getLastReceivedEncryptedMessage", (req, res) => {
    res.json({ result: lastReceivedEncryptedMessage });
  });

  onionRouter.get("/getLastReceivedDecryptedMessage", (req, res) => {
    res.json({ result: lastReceivedDecryptedMessage });
  });

  onionRouter.get("/getLastMessageDestination", (req, res) => {
    res.json({ result: lastMessageDestination });
  });

  onionRouter.post("/receiveMessage", async (req, res) => {
    const { encryptedMessage, nextNodePort, privateKey } = req.body;
    if (!encryptedMessage || !nextNodePort || !privateKey) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    lastReceivedEncryptedMessage = encryptedMessage;
    lastReceivedDecryptedMessage = await decryptMessage(encryptedMessage, privateKey);
    lastMessageDestination = nextNodePort;

    res.json({ message: "Message received and decrypted", decrypted: lastReceivedDecryptedMessage });
  });

  const server = onionRouter.listen(BASE_ONION_ROUTER_PORT + nodeId, () => {
    console.log(`Onion router ${nodeId} is listening on port ${BASE_ONION_ROUTER_PORT + nodeId}`);
  });

  return server;
}
