const https = require("https");
const axios = require("axios");
const fs = require("fs");
const { obterToken } = require("./create-qrcode");

require("dotenv").config();  // Carregar variáveis de ambiente
const base64 = process.env.PIX_CERTIFICADO_BASE64; // Vercel Secret
const certificadoBuffer = Buffer.from(base64, "base64");

// Função para verificar o status do pagamento
async function verificarStatusPagamento(txid) {
  try {
    const token = await obterToken();

    const agent = new https.Agent({
      pfx: certificadoBuffer,
      passphrase: "",
    });

    const configStatus = {
      method: "GET",
      url: `https://pix.api.efipay.com.br/v2/cob/${txid}`,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      httpsAgent: agent,
    };

    const statusResponse = await axios(configStatus);
    return statusResponse.data;
  } catch (error) {
    throw new Error("Erro ao verificar o status do pagamento");
  }
}

// Função serverless para Vercel
module.exports = async (req, res) => {
  if (req.method === "GET") {
    try {
      const { txid } = req.query;
      const statusData = await verificarStatusPagamento(txid);
      res.status(200).json(statusData);
    } catch (error) {
      res.status(500).json({ error: "Erro ao verificar status de pagamento" });
    }
  } else {
    res.status(405).json({ error: "Método não permitido" });
  }
};
