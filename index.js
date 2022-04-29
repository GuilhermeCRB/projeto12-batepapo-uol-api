import express, {json} from "express";
import cors from "cors";
import dotenv from "dotenv";
import chalk from "chalk";

const app = express();
app.use(cors());
app.use(json());
dotenv.config();

console.log(chalk.white.bold.bgGreenBright("\n Application is online \n"));




app.listen(5000);