import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import otpRoutes from "./routes/otp.js";

dotenv.config();
const app = express();

app.use(cors({ origin: "*", methods: ["GET", "POST"] }));
app.use(express.json());

app.use("/otp", otpRoutes);

const PORT = 5000;
app.listen(PORT, () => console.log(`Servidor rodando em ${PORT}`));
