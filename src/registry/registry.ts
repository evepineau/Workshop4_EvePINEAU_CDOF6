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

export async function launchRegistry() {
  const _registry = express();
  _registry.use(express.json());
  _registry.use(bodyParser.json());

  // /status
  _registry.get("/status", (req, res) => {
    res.send("live");
  });

  let nodes: Node[] = [];

  // POST /registerNode
  _registry.post("/registerNode", (req: Request, res: Response) => {
    const { nodeId, pubKey } = req.body as RegisterNodeBody;

    if (nodeId === undefined || !pubKey) {
      return res.status(400).json({ error: "Invalid node registration" });
    }

    // Store the node in memory
    nodes.push({ nodeId, pubKey });
    return res.json({ message: "Node registered successfully" });
  });

  // GET /getNodeRegistry
  _registry.get("/getNodeRegistry", (_, res: Response) => {
    res.json({ nodes });
  });

  const server = _registry.listen(REGISTRY_PORT, () => {
    console.log(`registry is listening on port ${REGISTRY_PORT}`);
  });

  return server;
}
