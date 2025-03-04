import bodyParser from "body-parser";
import express, { Request, Response } from "express";
import { BASE_USER_PORT, REGISTRY_PORT } from "../config";
import {
  createRandomSymmetricKey,
  exportSymKey,
  rsaEncrypt,
  symEncrypt,
} from "../crypto";

type SendMessageBody = {
  message: string;
  destinationUserId: number;
};

type MessageBody = {
  message: string;
};

type NodeRecord = {
  nodeId: number;
  pubKey: string;
};

let registryAddress = `http://localhost:${REGISTRY_PORT}`;

export async function user(userId: number) {
  // in-memory state
  let lastReceivedMessage: string | null = null;
  let lastSentMessage: string | null = null;

  // The tests call /getLastCircuit => store the node IDs used (NOT the final user port).
  let lastCircuitUsed: number[] | null = null;

  const _user = express();
  _user.use(express.json());
  _user.use(bodyParser.json());

  // /status
  _user.get("/status", (req, res) => {
    res.send("live");
  });

  // GET /getLastReceivedMessage
  _user.get("/getLastReceivedMessage", (req: Request, res: Response) => {
    res.json({ result: lastReceivedMessage });
  });

  // GET /getLastSentMessage
  _user.get("/getLastSentMessage", (req: Request, res: Response) => {
    res.json({ result: lastSentMessage });
  });

  // GET /getLastCircuit
  _user.get("/getLastCircuit", (req: Request, res: Response) => {
    // The test wants exactly 3 node IDs here, e.g. [0, 3, 5]
    res.json({ result: lastCircuitUsed });
  });

  // POST /message => user receives a message
  // The test “Each user can receive a message” expects a raw "success"
  _user.post("/message", (req: Request, res: Response) => {
    const { message } = req.body as MessageBody;
    if (!message) {
      return res.status(400).json({ error: "No message provided" });
    }
    lastReceivedMessage = message;
    return res.send("success");
  });

  // POST /sendMessage => user sends a message through the onion network
  _user.post("/sendMessage", async (req: Request, res: Response) => {
    const { message, destinationUserId } = req.body as SendMessageBody;
    if (!message || destinationUserId === undefined) {
      return res.status(400).json({ error: "Missing message or destinationUserId" });
    }

    lastSentMessage = message;

    try {
      // 1. fetch the node registry
      const registryRes = await fetch(`${registryAddress}/getNodeRegistry`);
      const registryJson = (await registryRes.json()) as { nodes: NodeRecord[] };
      const nodeList = registryJson.nodes;
      if (nodeList.length < 3) {
        return res.status(500).json({ error: "Not enough nodes in registry" });
      }

      // 2. pick 3 distinct random nodes
      const shuffled = [...nodeList].sort(() => 0.5 - Math.random());
      const randomNodes = shuffled.slice(0, 3);

      // The test expects just the node IDs (e.g. [0, 2, 7]), not the ports
      lastCircuitUsed = randomNodes.map((nd) => nd.nodeId);

      // 3. Build multi-layer onion in reverse
      let nextDestination = (BASE_USER_PORT + destinationUserId).toString().padStart(10, "0");
      let currentPayload = message;

      for (let i = randomNodes.length - 1; i >= 0; i--) {
        const node = randomNodes[i];
        const symKey = await createRandomSymmetricKey();
        const symKeyB64 = await exportSymKey(symKey);

        // Combine nextDestination + currentPayload
        const toSymEncrypt = nextDestination + currentPayload;
        const symEncrypted = await symEncrypt(symKey, toSymEncrypt);
        const rsaEncryptedSymKey = await rsaEncrypt(symKeyB64, node.pubKey);

        // Concat => onion chunk
        currentPayload = rsaEncryptedSymKey + symEncrypted;
        // Next iteration's destination = node port
        nextDestination = (4000 + node.nodeId).toString().padStart(10, "0");
      }

      // 4. send to the entry node
      const entryNodePort = parseInt(nextDestination, 10);
      await fetch(`http://localhost:${entryNodePort}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: currentPayload }),
      });

      // The tests often expect the raw string "success" from this route
      return res.send("success");
    } catch (error) {
      console.error(`Error in /sendMessage for user ${userId}:`, error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  const port = BASE_USER_PORT + userId;
  const server = _user.listen(port, () => {
    console.log(`User ${userId} listening on port ${port}`);
  });

  return server;
}