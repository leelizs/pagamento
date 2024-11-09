const https = require("https");
const axios = require("axios");
require("dotenv").config();  // Carregar variáveis de ambiente

const base64 = process.env.PIX_CERTIFICADO_BASE64; // Vercel Secret
const certificadoBuffer = Buffer.from(base64, "base64");

// Função para obter o token de acesso
const { obterToken } = require("./create-qrcode");

// Função para verificar o status do pagamento
async function verificarStatusPagamento(txid) {
  try {
    // Obtém o token de acesso
    const token = await obterToken();
    console.log("Token obtido para verificação de pagamento.");

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

    // Requisição para verificar o status do pagamento
    const statusResponse = await axios(configStatus);
    console.log("Resposta da API de status:", statusResponse.data); // Log da resposta
    return statusResponse.data;
  } catch (error) {
    // Log do erro detalhado
    if (error.response) {
      console.error("Erro ao verificar status do pagamento:", error.response.status, error.response.data);
    } else {
      console.error("Erro desconhecido ao verificar status do pagamento:", error.message);
    }
    throw new Error("Erro ao verificar o status do pagamento");
  }
}

// Função serverless para Vercel
module.exports = async (req, res) => {
  if (req.method === "GET") {
    try {
      // Captura o txid a partir dos query params
      const txid = req.query.txid; // O txid é passado como query string

      if (!txid) {
        res.status(400).json({ error: "TXID é obrigatório." });
        return;
      }

      console.log("Verificando pagamento para TXID:", txid);

      const statusData = await verificarStatusPagamento(txid);
      console.log("Status de pagamento recebido:", statusData);

      res.json(statusData);
    } catch (error) {
      console.error("Erro ao verificar status de pagamento:", error);
      res.status(500).json({ error: "Erro ao verificar status de pagamento" });
    }
  } else {
    res.status(405).json({ error: "Método não permitido" });
  }
};
