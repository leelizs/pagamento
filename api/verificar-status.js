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
      // Captura o txid diretamente da URL (usando params.txid)
      const txid = req.params.txid; // O txid é passado como parâmetro de rota (vercel.json: "/api/verificar-status/:txid")
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
