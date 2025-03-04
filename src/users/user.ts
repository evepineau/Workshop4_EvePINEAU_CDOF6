import bodyParser from "body-parser";
import express from "express";
import { BASE_USER_PORT } from "../config";

export type SendMessageBody = {
  message: string;
  destinationUserId: number;
};

// Variables pour stocker les messages
let lastReceivedMessage: string | null = null;
let lastSentMessage: string | null = null;

export async function user(userId: number) {
  const _user = express();
  _user.use(express.json());
  _user.use(bodyParser.json());

  // Vérifier si le serveur est actif
  _user.get("/status", (req, res) => {
    return res.send("live");
  });

  // Route pour récupérer le dernier message reçu
  _user.get("/getLastReceivedMessage", (req, res) => {
    return res.json({ result: lastReceivedMessage });
  });

  // Route pour récupérer le dernier message envoyé
  _user.get("/getLastSentMessage", (req, res) => {
    return res.json({ result: lastSentMessage });
  });

  // Route pour recevoir un message
  _user.post("/message", (req, res) => {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is missing" });
    }

    lastReceivedMessage = message; // Stocke le message reçu

    return res.json({ message: "Message received successfully" });
  });

  const server = _user.listen(BASE_USER_PORT + userId, () => {
    console.log(`User ${userId} is listening on port ${BASE_USER_PORT + userId}`);
  });

  return server;
}
