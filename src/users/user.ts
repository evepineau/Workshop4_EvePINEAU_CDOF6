import bodyParser from "body-parser";
import express from "express";
import { BASE_USER_PORT, REGISTRY_PORT } from "../config";

export type SendMessageBody = {
  message: string;
  destinationUserId: number;
};

let lastReceivedMessage: string | null = null;
let lastSentMessage: string | null = null;

export async function user(userId: number) {
  const _user = express();
  _user.use(express.json());
  _user.use(bodyParser.json());

  _user.get("/status", (req, res) => {
    return res.send("live");
  });

  _user.get("/getLastReceivedMessage", (req, res) => {
    return res.json({ result: lastReceivedMessage });
  });

  _user.get("/getLastSentMessage", (req, res) => {
    return res.json({ result: lastSentMessage });
  });

  _user.get("/getNodeRegistry", async (req, res) => {
    const response = await fetch(`http://localhost:${REGISTRY_PORT}/getNodeRegistry`);
    const data = await response.json();
    return res.json(data);
  });

  const server = _user.listen(BASE_USER_PORT + userId, () => {
    console.log(`User ${userId} is listening on port ${BASE_USER_PORT + userId}`);
  });

  return server;
}
