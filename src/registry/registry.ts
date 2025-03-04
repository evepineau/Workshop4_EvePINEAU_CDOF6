import bodyParser from "body-parser";
import express, { Request, Response } from "express";
import { REGISTRY_PORT } from "../config";

export type Node = { nodeId: number; pubKey: string };

export type RegisterNodeBody = {
  nodeId: number;
  pubKey: string;
};

export type GetNodeRegistryBody = {
  nodes: Node[];
};

// In-memory storage for registered nodes
let nodesRegistry: Node[] = [];

export async function launchRegistry() {
  const _registry = express();
  _registry.use(express.json());
  _registry.use(bodyParser.json());

  // Route to check if the registry is live
  _registry.get("/status", (req: Request, res: Response) => {
    res.send("live");
  });

  // Route for nodes to register themselves
  _registry.post("/registerNode", (req: Request, res: Response) => {
    const { nodeId, pubKey } = req.body;

    if (!nodeId || !pubKey) {
      return res.status(400).json({ error: "Missing nodeId or pubKey" });
    }

    // Check if the node is already registered
    if (nodesRegistry.some(node => node.nodeId === nodeId)) {
      return res.status(400).json({ error: "Node already registered" });
    }

    nodesRegistry.push({ nodeId, pubKey });
    console.log(`Node ${nodeId} registered with public key: ${pubKey.substring(0, 10)}...`);

    return res.status(201).json({ message: "Node registered successfully" });
  });

  // Route to get the list of registered nodes
  _registry.get("/getNodeRegistry", (req: Request, res: Response) => {
    return res.json({ nodes: nodesRegistry });
  });

  const server = _registry.listen(REGISTRY_PORT, () => {
    console.log(`Registry is listening on port ${REGISTRY_PORT}`);
  });

  return server;
}
