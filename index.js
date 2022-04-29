import express, { json } from "express";
import { MongoClient } from "mongodb";
import dayjs from "dayjs";
import cors from "cors";
import dotenv from "dotenv";
import chalk from "chalk";

const app = express();
app.use(cors());
app.use(json());
dotenv.config();

// console.log(chalk.green.bold(`Connection with database ${chalk.blue.bold(`${db.s.namespace}`)} stablished! \n`));
const mongoClient = new MongoClient(process.env.MONGO_URL);

app.post("/participants", async (req, res) => {
    const { body } = req;
    console.log("Post request to \"/participants\" received:", body);
    try {
        await mongoClient.connect();
        const db = mongoClient.db("batepapo-uol");
        const participantsCollection = db.collection("participants");
        const participant = await participantsCollection.insertOne({
            ...body,
            lastStatus: Date.now()
        });

        const messagesCollection = db.collection("messages");
        const now = dayjs();
        const message = await messagesCollection.insertOne({
            from: 'xxx',
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: now.format("HH:mm:ss")
        });

        res.status(201).send(participant);
        mongoClient.close();
    } catch (error) {
        res.status(500).send(error);
        mongoClient.close();
    }
});

app.get("/participants", async (req, res) => {
    console.log("Get request to \"/participants\" received");
    try {
        await mongoClient.connect();
        const db = mongoClient.db("batepapo-uol");
        const participantsCollection = db.collection("participants");
        const participantsList = await participantsCollection.find().toArray();

        res.status(200).send(participantsList);
        mongoClient.close();
    } catch (error) {
        res.status(500).send(error);
        mongoClient.close();
    }
});

app.post("/messages", async (req, res) => {
    const { body } = req;
    const { headers } = req;
    console.log(headers)
    console.log("Post request to \"/messages\" received:", req);
    try {
        await mongoClient.connect();
        const db = mongoClient.db("batepapo-uol");
        const messagesCollection = db.collection("messages");
        const now = dayjs();
        const message = await messagesCollection.insertOne({
            ...body,
            from: headers.user,
            time: now.format("HH:mm:ss")
        });

        res.status(201).send(message);
        mongoClient.close();
    } catch (error) {
        res.status(500).send(error);
        mongoClient.close();
    }
});

app.get("/messages", async (req, res) => {
    const { limit } = req.query;
    console.log(`Get request to \"/messages/${limit}\" received`);
    try {
        await mongoClient.connect();
        const db = mongoClient.db("batepapo-uol");
        const messagesCollection = db.collection("messages");
        const messagesList = await messagesCollection.find().limit(parseInt(limit)).sort({ time: -1 }).toArray();

        res.status(200).send(messagesList.reverse());
        mongoClient.close();
    } catch (error) {
        res.status(500).send(error);
        mongoClient.close();
    }
});

app.post("/status", async (req, res) => {
    const { headers } = req;
    console.log(headers.user)
    console.log("Post request to \"/status\" received:", headers);
    try {
        await mongoClient.connect();
        const db = mongoClient.db("batepapo-uol");
        const participantsCollection = db.collection("participants");
        const participantUpdated = await participantsCollection.updateOne(
            { name: headers.user },
            {
                $set: {
                    lastStatus: new Date.now()
                }
            }
        );

        res.status(200).send(participantUpdated);
        mongoClient.close();
    } catch (error) {
        res.status(500).send(error);
        mongoClient.close();
    }
});

setInterval(udateUsersStatus, 15000);

function udateUsersStatus(){
    console.log(1)
}

const port = process.env.PORT;
app.listen(port, () => console.log(chalk.white.bold.bgGreenBright(`\n Application is online, using port ${port}... \n`)));