const https = require("https");
const axios = require("axios");
const fs = require("fs");

require("dotenv").config();
const base64 = process.env.PIX_CERTIFICADO_BASE64;
const certificadoBuffer = Buffer.from(base64, "base64");

const credenciais = {
  client_id: process.env.CLIENT_ID,
  client_secret: process.env.CLIENT_SECRET,
};

async function obterToken() {
  try {
    const data_credentials = `${credenciais.client_id}:${credenciais.client_secret}`;
    const auth = Buffer.from(data_credentials).toString("base64");

    const agent = new https.Agent({
      pfx: certificadoBuffer,
      passphrase: "",
    });

    const configToken = {
      method: "POST",
      url: "https://pix.api.efipay.com.br/oauth/token",
      headers: {
        Authorization: "Basic " + auth,
        "Content-Type": "application/json",
      },
      httpsAgent: agent,
      data: { grant_type: "client_credentials" },
    };

    const tokenResponse = await axios(configToken);
    if (tokenResponse.status !== 200) {
      throw new Error("Erro ao obter token");
    }
    return tokenResponse.data.access_token;
  } catch (error) {
    throw new Error("Erro ao obter token");
  }
}

async function gerarQRCode(valor) {
  try {
    const token = await obterToken();

    const agent = new https.Agent({
      pfx: certificadoBuffer,
      passphrase: "",
    });

    const qrcodeConfig = {
      method: "POST",
      url: "https://pix.api.efipay.com.br/v2/cob",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      httpsAgent: agent,
      data: {
        calendario: { expiracao: 600 },
        valor: { original: valor },
        chave: "0a2814e9-73ac-4e23-894e-c40ff3f8e0e9",
        solicitacaoPagador: "Pagamento em Família de Ouro",
      },
    };

    const qrcodeResponse = await axios(qrcodeConfig);

    if (!qrcodeResponse.data || !qrcodeResponse.data.txid) {
      throw new Error("TXID não encontrado na resposta da API.");
    }

    return {
      qrcodeData: qrcodeResponse.data,
      txid: qrcodeResponse.data.txid,
      copiaECola: qrcodeResponse.data.pixCopiaECola,
    };
  } catch (error) {
    console.error("Erro ao gerar QR Code:", error);
    throw new Error("Erro ao gerar QR Code");
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://cardapiofamiliadeouro.netlify.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    // Responder a requisições preflight de CORS
    res.status(200).end();
    return;
  }

  if (req.method === "POST") {
    try {
      const { valor } = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const valorFormatado = parseFloat(valor).toFixed(2);

      const qrcodeData = await gerarQRCode(valorFormatado);

      if (!qrcodeData) {
        res.status(500).json({ error: "Erro ao gerar QR Code." });
        return;
      }

      res.json({
        qrcode: {
          imagemQrcode: qrcodeData.copiaECola,
          txid: qrcodeData.txid,
          copiaECola: qrcodeData.copiaECola,
        },
      });
    } catch (error) {
      console.error("Erro ao gerar o QR Code:", error.message);
      res.status(500).json({ error: error.message || "Erro ao gerar QR Code" });
    }
  } else {
    res.status(405).json({ error: "Método não permitido" });
  }
};

module.exports.obterToken = obterToken;
module.exports.gerarQRCode = gerarQRCode;
