import express from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();
const router = express.Router();

const { EVOLUTION_API_URL, EVOLUTION_INSTANCE, EVOLUTION_API_KEY, JWT_SECRET } = process.env;
if (!JWT_SECRET || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE || !EVOLUTION_API_URL) {
  throw new Error("❌ Missing environment variables");
}

// In-memory stores
const otpStore = new Map();
const userStore = new Map();

// === SEND OTP ===
router.post("/send-otp", async (req, res) => {
  const { phone, name } = req.body;
  if (!phone || !name) {
    return res.status(400).json({ error: "Número e nome são obrigatórios" });
  }

  const cleanPhone = phone.replace(/\D/g, "");
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000;

  otpStore.set(cleanPhone, { otp, expiresAt });

  const message = `👋 Olá ${name}, o teu código de verificação é: *${otp}* (válido por 5 minutos).`;

  try {
    await axios.post(
      `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
      { number: cleanPhone, text: message },
      { headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY } }
    );

    if (!userStore.has(cleanPhone)) {
      userStore.set(cleanPhone, { phone: cleanPhone, name, profile_completed: false });
    }

    return res.json({ success: true, message: "Código enviado via WhatsApp" });
  } catch (err) {
    console.error("❌ Error sending OTP FULL:", JSON.stringify(err.response?.data, null, 2));
    return res.status(500).json({ error: "Falha ao enviar OTP", details: err.response?.data || err.message });
  }
});

// === VERIFY OTP ===
router.post("/verify-otp", (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) {
    return res.status(400).json({ error: "Número e código são obrigatórios" });
  }

  const cleanPhone = phone.replace(/\D/g, "");
  const record = otpStore.get(cleanPhone);

  if (!record) return res.status(400).json({ error: "Nenhum código encontrado" });
  if (Date.now() > record.expiresAt) {
    otpStore.delete(cleanPhone);
    return res.status(400).json({ error: "Código expirado" });
  }
  if (record.otp !== otp) return res.status(400).json({ error: "Código inválido" });

  otpStore.delete(cleanPhone);

  const user = userStore.get(cleanPhone);
  if (!user) return res.status(400).json({ error: "Usuário não encontrado" });

  const token = jwt.sign({ userId: cleanPhone, phone: cleanPhone }, JWT_SECRET, { expiresIn: "5h" });

  return res.json({ success: true, message: "Código verificado com sucesso!", token, user, needsProfile: !user.profile_completed });
});

// === SEND OFFER AFTER OTP VERIFICATION ===
router.post("/send-offer", async (req, res) => {
  const { phone, name } = req.body;
  if (!phone || !name) return res.status(400).json({ error: "Número e nome são obrigatórios" });

  const cleanPhone = phone.replace(/\D/g, "");
  const message = `🎉 Olá ${name}! O teu código da tua oferta (desconto de 50%) é válido por 30 dias. Não partilhes este código com ninguém. O Trilho Académico estará disponível a partir da Segunda Feira, 3 de novembro. Podemos mandar-te uma mensagem quando estiver disponível? (responde com sim ou não)`;

  try {
    await axios.post(
      `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
      { number: cleanPhone, text: message },
      { headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY } }
    );
    return res.json({ success: true, message: "Mensagem de oferta enviada" });
  } catch (err) {
    console.error("❌ Error sending offer:", JSON.stringify(err.response?.data, null, 2));
    return res.status(500).json({ error: "Falha ao enviar oferta", details: err.response?.data || err.message });
  }
});

export default router;
